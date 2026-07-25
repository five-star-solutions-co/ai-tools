/**
 * Files client — path-rooted workspace over S3Client.
 * Host: withAuth + fromContext. Tools stay thin adapters.
 */

import { ToolError } from '../../core/errors'
import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import { S3Client } from '../../vendors/s3'
import {
	filesAuthSchema,
	filesCopyOutputSchema,
	filesDeleteOutputSchema,
	filesGetOutputSchema,
	filesListOutputSchema,
	filesMkdirOutputSchema,
	filesMoveOutputSchema,
	filesMultipartAbortOutputSchema,
	filesMultipartCompleteOutputSchema,
	filesMultipartStartOutputSchema,
	filesMultipartUploadPartOutputSchema,
	filesPutOutputSchema,
	filesSearchOutputSchema,
	filesStatOutputSchema
} from './contracts'
import type {
	FileItem,
	FilesAuth,
	FilesCopyInput,
	FilesDeleteInput,
	FilesGetInput,
	FilesListInput,
	FilesMkdirInput,
	FilesMoveInput,
	FilesMultipartAbortInput,
	FilesMultipartCompleteInput,
	FilesMultipartStartInput,
	FilesMultipartUploadPartInput,
	FilesPutInput,
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
