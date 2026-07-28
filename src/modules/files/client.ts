/**
 * Files client — path-rooted workspace over S3Client.
 * Host: withAuth + fromContext. Tools stay thin adapters.
 */

import { ToolError } from '../../core/errors'
import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import { bytesToBase64, bytesToUtf8 } from '../../shared/bytes'
import { S3Client } from '../../vendors/s3'
import {
	MAX_FILES_LINES_SCAN_BYTES,
	MAX_FILES_RANGE_BYTES,
	filesAuthSchema,
	filesCopyOutputSchema,
	filesCreateArtifactOutputSchema,
	filesDeleteOutputSchema,
	filesGetOutputSchema,
	filesGetRangeOutputSchema,
	filesListOutputSchema,
	filesMkdirOutputSchema,
	filesMoveOutputSchema,
	filesMultipartAbortOutputSchema,
	filesMultipartCompleteOutputSchema,
	filesMultipartStartOutputSchema,
	filesMultipartUploadPartOutputSchema,
	filesPutOutputSchema,
	filesReadLinesOutputSchema,
	filesSearchOutputSchema,
	filesStatOutputSchema
} from './contracts'
import type {
	FileItem,
	FilesAuth,
	FilesCopyInput,
	FilesCreateArtifactInput,
	FilesDeleteInput,
	FilesGetInput,
	FilesGetRangeInput,
	FilesListInput,
	FilesMkdirInput,
	FilesMoveInput,
	FilesMultipartAbortInput,
	FilesMultipartCompleteInput,
	FilesMultipartStartInput,
	FilesMultipartUploadPartInput,
	FilesPutInput,
	FilesReadLinesInput,
	FilesSearchInput,
	FilesStatInput
} from './contracts'
import { basename, normalizeRootPrefix, resolveListPrefix, resolveUnderRoot, toRelativeKey } from './path'

function transportOptions(ctx: ToolContext) {
	return {
		...(ctx.fetch && { fetch: ctx.fetch }),
		...(ctx.signal && { signal: ctx.signal })
	}
}

export class FilesClient {
	readonly #s3: S3Client
	readonly #root: string

	constructor(auth: FilesAuth, ctx: ToolContext = {}) {
		const parsed = filesAuthSchema.safeParse(auth)
		if (!parsed.success) {
			throw new ToolError('Invalid files auth credentials', {
				code: 'bad_auth',
				details: { issues: parsed.error.issues.map((issue) => issue.message) }
			})
		}
		this.#root = normalizeRootPrefix(parsed.data.root_prefix)
		this.#s3 = new S3Client(parsed.data.storage, transportOptions(ctx))
	}

	static fromContext(ctx: ToolContext): FilesClient {
		const auth = requireAuth(ctx, filesAuthSchema)
		return new FilesClient(auth, ctx)
	}

	static fromAuth(auth: FilesAuth, ctx: ToolContext = {}): FilesClient {
		return new FilesClient(auth, ctx)
	}

	async list(input: FilesListInput) {
		const prefix = resolveListPrefix(this.#root, input.path)
		const listed = await this.#s3.list({
			prefix,
			delimiter: '/',
			...(input.cursor && { cursor: input.cursor }),
			...(input.limit !== undefined && { limit: input.limit })
		})

		const items: FileItem[] = []
		for (const obj of listed.items) {
			const rel = toRelativeKey(this.#root, obj.key)
			if (!rel) continue
			items.push({
				path: rel,
				kind: 'file',
				...(obj.size !== undefined && { size: obj.size }),
				...(obj.last_modified && { last_modified: obj.last_modified }),
				...(obj.etag && { etag: obj.etag })
			})
		}
		if (listed.common_prefixes) {
			for (const folderAbs of listed.common_prefixes) {
				const rel = toRelativeKey(this.#root, folderAbs.endsWith('/') ? folderAbs.slice(0, -1) : folderAbs)
				if (!rel) continue
				const folderPath = folderAbs.endsWith('/') ? (toRelativeKey(this.#root, folderAbs.slice(0, -1)) ?? rel) : rel
				items.push({
					path: folderPath.endsWith('/') ? folderPath.slice(0, -1) : folderPath,
					kind: 'folder'
				})
			}
		}

		return filesListOutputSchema.parse({
			items,
			truncated: listed.truncated,
			...(listed.next_cursor && { next_cursor: listed.next_cursor })
		})
	}

	async search(input: FilesSearchInput) {
		const prefix = resolveListPrefix(this.#root, input.path)
		const listed = await this.#s3.list({
			prefix,
			...(input.cursor && { cursor: input.cursor }),
			...(input.limit !== undefined && { limit: input.limit })
		})

		const needle = input.query.toLowerCase()
		const items: FileItem[] = []
		for (const obj of listed.items) {
			const rel = toRelativeKey(this.#root, obj.key)
			if (!rel) continue
			if (!basename(rel).toLowerCase().includes(needle)) continue
			items.push({
				path: rel,
				kind: 'file',
				...(obj.size !== undefined && { size: obj.size }),
				...(obj.last_modified && { last_modified: obj.last_modified }),
				...(obj.etag && { etag: obj.etag })
			})
		}

		return filesSearchOutputSchema.parse({
			items,
			truncated: listed.truncated,
			...(listed.next_cursor && { next_cursor: listed.next_cursor })
		})
	}

	async stat(input: FilesStatInput) {
		const absolute = resolveUnderRoot(this.#root, input.path)
		const head = await this.#s3.head({ key: absolute })
		if (!head.exists) {
			return filesStatOutputSchema.parse({ exists: false })
		}
		const rel = toRelativeKey(this.#root, head.key) ?? input.path
		return filesStatOutputSchema.parse({
			exists: true,
			item: {
				path: rel,
				kind: 'file',
				...(head.content_length !== undefined && { size: head.content_length }),
				...(head.etag && { etag: head.etag }),
				...(head.content_type && { media_type: head.content_type })
			}
		})
	}

	async get(input: FilesGetInput) {
		const absolute = resolveUnderRoot(this.#root, input.path)
		const got = await this.#s3.get({
			key: absolute,
			...(input.encoding && { encoding: input.encoding })
		})
		return filesGetOutputSchema.parse({
			path: input.path,
			body: got.body,
			encoding: got.encoding,
			...(got.content_type && { content_type: got.content_type }),
			...(got.content_length !== undefined && { content_length: got.content_length })
		})
	}

	async getRange(input: FilesGetRangeInput) {
		if (input.end_byte < input.start_byte) {
			throw new ToolError('end_byte must be >= start_byte', { code: 'bad_input' })
		}
		const rangeSize = input.end_byte - input.start_byte + 1
		if (rangeSize > MAX_FILES_RANGE_BYTES) {
			throw new ToolError(`Byte range exceeds max of ${MAX_FILES_RANGE_BYTES} bytes`, {
				code: 'too_large',
				details: { max_bytes: MAX_FILES_RANGE_BYTES, requested_bytes: rangeSize }
			})
		}
		const absolute = resolveUnderRoot(this.#root, input.path)
		const range = await this.#s3.getBytesRange(absolute, {
			start_byte: input.start_byte,
			end_byte: input.end_byte
		})
		const encoding = input.encoding ?? 'base64'
		const body = encoding === 'utf8' ? bytesToUtf8(range.bytes) : bytesToBase64(range.bytes)
		return filesGetRangeOutputSchema.parse({
			path: input.path,
			body,
			encoding,
			start_byte: range.start_byte,
			end_byte: range.end_byte,
			...(range.total_bytes !== undefined && { total_bytes: range.total_bytes }),
			...(range.content_type && { content_type: range.content_type })
		})
	}

	async readLines(input: FilesReadLinesInput) {
		const startLine = input.start_line ?? 1
		const maxLines = input.max_lines ?? 200
		const absolute = resolveUnderRoot(this.#root, input.path)
		// Scan a bounded prefix of the object as UTF-8 to extract lines.
		const range = await this.#s3.getBytesRange(absolute, {
			start_byte: 0,
			end_byte: MAX_FILES_LINES_SCAN_BYTES - 1
		})
		const text = bytesToUtf8(range.bytes)
		const allLines = text.split(/\r\n|\n|\r/)
		// Drop trailing empty segment from final newline.
		if (allLines.length > 0 && allLines[allLines.length - 1] === '') {
			allLines.pop()
		}
		const sliceStart = startLine - 1
		const page = allLines.slice(sliceStart, sliceStart + maxLines)
		const scannedAll = range.total_bytes === undefined || range.end_byte >= range.total_bytes - 1
		const moreInScan = sliceStart + page.length < allLines.length
		const truncated = moreInScan || !scannedAll
		return filesReadLinesOutputSchema.parse({
			path: input.path,
			start_line: startLine,
			lines: page,
			truncated,
			...(truncated && { next_start_line: startLine + page.length })
		})
	}

	async createArtifact(input: FilesCreateArtifactInput) {
		const absolute = resolveUnderRoot(this.#root, input.path)
		const head = await this.#s3.head({ key: absolute })
		if (!head.exists) {
			throw new ToolError('File not found', { code: 'not_found', details: { path: input.path } })
		}
		// Zero-copy: ArtifactRef points at the same logical key under storage key_prefix + root.
		const artifact = {
			store: 'object' as const,
			key: absolute,
			...(input.filename && { filename: input.filename }),
			...(input.media_type
				? { media_type: input.media_type }
				: head.content_type
					? { media_type: head.content_type }
					: {}),
			...(head.content_length !== undefined && { byte_length: head.content_length })
		}
		return filesCreateArtifactOutputSchema.parse({ path: input.path, artifact })
	}

	async put(input: FilesPutInput) {
		const absolute = resolveUnderRoot(this.#root, input.path)
		const put = await this.#s3.put({
			key: absolute,
			body: input.body,
			...(input.body_encoding && { body_encoding: input.body_encoding }),
			...(input.content_type && { content_type: input.content_type })
		})
		return filesPutOutputSchema.parse({
			path: input.path,
			content_length: put.content_length,
			...(put.etag && { etag: put.etag })
		})
	}

	async delete(input: FilesDeleteInput) {
		const absolute = resolveUnderRoot(this.#root, input.path)
		const result = await this.#s3.delete({ key: absolute })
		return filesDeleteOutputSchema.parse({ path: input.path, deleted: result.deleted })
	}

	async copy(input: FilesCopyInput) {
		const source = resolveUnderRoot(this.#root, input.source_path)
		const destination = resolveUnderRoot(this.#root, input.destination_path)
		const result = await this.#s3.copy({ source_key: source, destination_key: destination })
		return filesCopyOutputSchema.parse({
			source_path: input.source_path,
			destination_path: input.destination_path,
			...(result.etag && { etag: result.etag })
		})
	}

	async mkdir(input: FilesMkdirInput) {
		const folder = input.path.trim().replaceAll('\\', '/').replace(/^\/+/, '').replace(/\/+$/, '')
		const keepRelative = `${folder}/.keep`
		const absolute = resolveUnderRoot(this.#root, keepRelative)
		await this.#s3.put({
			key: absolute,
			body: '',
			body_encoding: 'utf8',
			content_type: 'application/x-directory'
		})
		return filesMkdirOutputSchema.parse({ path: folder, created: true })
	}

	async move(input: FilesMoveInput) {
		const source = resolveUnderRoot(this.#root, input.source_path)
		const destination = resolveUnderRoot(this.#root, input.destination_path)
		if (source === destination) {
			throw new ToolError('source_path and destination_path must differ', { code: 'bad_input' })
		}
		const copied = await this.#s3.copy({ source_key: source, destination_key: destination })
		await this.#s3.delete({ key: source })
		return filesMoveOutputSchema.parse({
			source_path: input.source_path,
			destination_path: input.destination_path,
			...(copied.etag && { etag: copied.etag })
		})
	}

	async multipartStart(input: FilesMultipartStartInput) {
		const absolute = resolveUnderRoot(this.#root, input.path)
		const started = await this.#s3.createMultipartUpload({
			key: absolute,
			...(input.content_type && { content_type: input.content_type })
		})
		return filesMultipartStartOutputSchema.parse({
			path: input.path,
			upload_id: started.upload_id
		})
	}

	async multipartUploadPart(input: FilesMultipartUploadPartInput) {
		const absolute = resolveUnderRoot(this.#root, input.path)
		const part = await this.#s3.uploadPart({
			key: absolute,
			upload_id: input.upload_id,
			part_number: input.part_number,
			body: input.body,
			...(input.body_encoding && { body_encoding: input.body_encoding })
		})
		return filesMultipartUploadPartOutputSchema.parse({
			path: input.path,
			upload_id: input.upload_id,
			part_number: part.part_number,
			etag: part.etag,
			content_length: part.content_length
		})
	}

	async multipartComplete(input: FilesMultipartCompleteInput) {
		const absolute = resolveUnderRoot(this.#root, input.path)
		const completed = await this.#s3.completeMultipartUpload({
			key: absolute,
			upload_id: input.upload_id,
			parts: input.parts
		})
		return filesMultipartCompleteOutputSchema.parse({
			path: input.path,
			upload_id: input.upload_id,
			...(completed.etag && { etag: completed.etag })
		})
	}

	async multipartAbort(input: FilesMultipartAbortInput) {
		const absolute = resolveUnderRoot(this.#root, input.path)
		const aborted = await this.#s3.abortMultipartUpload({ key: absolute, upload_id: input.upload_id })
		return filesMultipartAbortOutputSchema.parse({
			path: input.path,
			upload_id: input.upload_id,
			aborted: aborted.aborted
		})
	}
}
