/**
 * Document client — read / build / edit documents with object-storage ArtifactRefs.
 */

import { ToolError } from '../../core/errors'
import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import type { ArtifactRef } from '../../shared/artifact'
import { artifactRefSchema } from '../../shared/artifact'
import { base64ToBytes, utf8ToBytes } from '../../shared/bytes'
import { S3Client } from '../../vendors/s3'
import { documentAuthSchema, documentBuildOutputSchema, documentReadOutputSchema } from './contracts'
import type {
	DocumentAuth,
	DocumentBuildDocumentInput,
	DocumentBuildPresentationInput,
	DocumentBuildSpreadsheetInput,
	DocumentBuildTextInput,
	DocumentEditSpreadsheetInput,
	DocumentFormat,
	DocumentReadInput,
	DocumentReadOutput
} from './contracts'
import {
	buildDocument,
	buildPresentation,
	buildSpreadsheet,
	detectFormat,
	mediaTypeForTextFormat,
	patchSpreadsheet,
	readBytes
} from './domain'

type LoadResult = {
	bytes: Uint8Array
	filename?: string | undefined
	media_type?: string | undefined
}

function transportOptions(ctx: ToolContext) {
	return {
		...(ctx.fetch && { fetch: ctx.fetch }),
		...(ctx.signal && { signal: ctx.signal })
	}
}

export type DocumentClientOptions = {
	fetch?: ToolContext['fetch']
	signal?: ToolContext['signal']
}

export class DocumentClient {
	readonly #storage: S3Client

	constructor(auth: DocumentAuth, ctx: ToolContext = {}) {
		const parsed = documentAuthSchema.safeParse(auth)
		if (!parsed.success) {
			throw new ToolError('Invalid document auth credentials', {
				code: 'bad_auth',
				details: { issues: parsed.error.issues.map((issue) => issue.message) }
			})
		}
		this.#storage = new S3Client(parsed.data.storage, transportOptions(ctx))
	}

	static fromContext(ctx: ToolContext): DocumentClient {
		const auth = requireAuth(ctx, documentAuthSchema)
		return new DocumentClient(auth, ctx)
	}

	static fromAuth(auth: DocumentAuth, ctx: ToolContext = {}): DocumentClient {
		return new DocumentClient(auth, ctx)
	}

	async read(input: DocumentReadInput): Promise<DocumentReadOutput> {
		const loaded = await this.#loadSource(input.source)
		const format = detectFormat({
			format: input.format,
			filename: loaded.filename ?? input.source.filename,
			media_type: loaded.media_type ?? input.source.media_type
		})
		const meta: { filename?: string; media_type?: string } = {}
		const fn = loaded.filename ?? input.source.filename
		const mt = loaded.media_type ?? input.source.media_type
		if (fn !== undefined) meta.filename = fn
		if (mt !== undefined) meta.media_type = mt
		const out = await readBytes(format, loaded.bytes, meta)
		return documentReadOutputSchema.parse(out)
	}

	async buildText(input: DocumentBuildTextInput) {
		const bytes = utf8ToBytes(input.content)
		const mediaType = mediaTypeForTextFormat(input.format)
		const filename = input.filename ?? `document.${input.format}`
		return this.#putResult(input.output_key, bytes, mediaType, filename)
	}

	async buildSpreadsheet(input: DocumentBuildSpreadsheetInput) {
		const bytes = await buildSpreadsheet(input.sheets)
		const filename = input.filename ?? 'workbook.xlsx'
		return this.#putResult(
			input.output_key,
			bytes,
			'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			filename
		)
	}

	async buildDocument(input: DocumentBuildDocumentInput) {
		const buildIn: { title?: string; sections: DocumentBuildDocumentInput['sections'] } = {
			sections: input.sections
		}
		if (input.title !== undefined) buildIn.title = input.title
		const bytes = await buildDocument(buildIn)
		const filename = input.filename ?? 'document.docx'
		return this.#putResult(
			input.output_key,
			bytes,
			'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
			filename
		)
	}

	async buildPresentation(input: DocumentBuildPresentationInput) {
		const buildIn: { title?: string; slides: DocumentBuildPresentationInput['slides'] } = {
			slides: input.slides
		}
		if (input.title !== undefined) buildIn.title = input.title
		const bytes = await buildPresentation(buildIn)
		const filename = input.filename ?? 'deck.pptx'
		return this.#putResult(
			input.output_key,
			bytes,
			'application/vnd.openxmlformats-officedocument.presentationml.presentation',
			filename
		)
	}

	async editSpreadsheet(input: DocumentEditSpreadsheetInput) {
		const loaded = await this.#loadSource(input.source)
		const detectIn: { filename?: string; media_type?: string } = {}
		if (loaded.filename !== undefined) detectIn.filename = loaded.filename
		else if (input.source.filename !== undefined) detectIn.filename = input.source.filename
		if (loaded.media_type !== undefined) detectIn.media_type = loaded.media_type
		else if (input.source.media_type !== undefined) detectIn.media_type = input.source.media_type
		const format = detectFormat(detectIn)
		if (format !== 'xlsx' && format !== 'csv') {
			throw new ToolError('editSpreadsheet requires xlsx or csv source', { code: 'bad_input' })
		}
		const patches = input.patches.map((p) => {
			const item: { sheet?: string; row: number; col: number; value: string | number | boolean | null } = {
				row: p.row,
				col: p.col,
				value: p.value
			}
			if (p.sheet !== undefined) item.sheet = p.sheet
			return item
		})
		const patched = await patchSpreadsheet(loaded.bytes, format, patches)
		let outName = input.filename
		if (outName === undefined) {
			const base = loaded.filename?.replace(/\.[^./]+$/, '')
			outName =
				base !== undefined && base.length > 0 ? `${base}.${patched.filename_ext}` : `workbook.${patched.filename_ext}`
		}
		return this.#putResult(input.output_key, patched.bytes, patched.media_type, outName)
	}

	async #loadSource(source: DocumentReadInput['source']): Promise<LoadResult> {
		if (source.text !== undefined) {
			const out: LoadResult = {
				bytes: utf8ToBytes(source.text),
				media_type: source.media_type ?? 'text/plain'
			}
			if (source.filename !== undefined) out.filename = source.filename
			return out
		}
		if (source.body_base64 !== undefined) {
			const out: LoadResult = {
				bytes: base64ToBytes(source.body_base64)
			}
			if (source.filename !== undefined) out.filename = source.filename
			if (source.media_type !== undefined) out.media_type = source.media_type
			return out
		}
		if (source.artifact) {
			if (source.artifact.store !== 'object') {
				throw new ToolError('Document artifact store must be object', { code: 'bad_input' })
			}
			const bytes = await this.#storage.getBytes(source.artifact.key)
			const out: LoadResult = { bytes }
			const fn = source.filename ?? source.artifact.filename
			const mt = source.media_type ?? source.artifact.media_type
			if (fn !== undefined) out.filename = fn
			if (mt !== undefined) out.media_type = mt
			return out
		}
		throw new ToolError('Missing document source', { code: 'bad_input' })
	}

	async #putResult(
		key: string,
		bytes: Uint8Array,
		mediaType: string,
		filename: string
	): Promise<{ result: ArtifactRef }> {
		await this.#storage.putBytes(key, bytes, mediaType)
		const result = artifactRefSchema.parse({
			store: 'object',
			key,
			media_type: mediaType,
			filename,
			byte_length: bytes.byteLength
		})
		return documentBuildOutputSchema.parse({ result })
	}
}

export type { DocumentFormat }
