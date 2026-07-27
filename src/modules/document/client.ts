/** Core document client. Presentation operations live in the presentation module. */
import { ToolError } from '../../core/errors'
import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import { artifactRefSchema } from '../../shared/artifact'
import type { ArtifactRef } from '../../shared/artifact'
import { utf8ToBytes } from '../../shared/bytes'
import { mediaTypeFromPath } from '../../shared/content-type'
import { S3Client } from '../../vendors/s3'
import { attachPdfPageArtifacts, loadDocumentSource, sourceName } from './artifacts'
import type { LoadedDocument } from './artifacts'
import { documentAuthSchema, documentBuildOutputSchema, documentReadOutputSchema } from './contracts'
import type {
	DocumentAuth,
	DocumentBuildDocumentInput,
	DocumentBuildSpreadsheetInput,
	DocumentBuildTextInput,
	DocumentEditDocumentInput,
	DocumentEditSpreadsheetInput,
	DocumentEditTextInput,
	DocumentFormat,
	DocumentReadInput,
	DocumentReadOutput
} from './contracts'
import {
	buildDocument,
	buildSpreadsheet,
	detectFormatFromBytes,
	mediaTypeForTextFormat,
	patchDocx,
	patchSpreadsheet,
	patchTextDocument,
	readBytes
} from './domain'

export type DocumentClientOptions = {
	fetch?: ToolContext['fetch']
	signal?: ToolContext['signal']
}

function transportOptions(context: DocumentClientOptions) {
	return {
		...(context.fetch && { fetch: context.fetch }),
		...(context.signal && { signal: context.signal })
	}
}

function mediaTypeFor(filename: string): string {
	return mediaTypeFromPath(filename) ?? 'application/octet-stream'
}

export class DocumentClient {
	readonly #storage: S3Client

	constructor(auth: DocumentAuth, context: DocumentClientOptions = {}) {
		const parsed = documentAuthSchema.safeParse(auth)
		if (!parsed.success) {
			throw new ToolError('Invalid document auth credentials', {
				code: 'bad_auth',
				details: { issues: parsed.error.issues.map((issue) => issue.message) }
			})
		}
		this.#storage = new S3Client(parsed.data.storage, transportOptions(context))
	}

	static fromContext(context: ToolContext): DocumentClient {
		return new DocumentClient(requireAuth(context, documentAuthSchema), context)
	}

	static fromAuth(auth: DocumentAuth, context: DocumentClientOptions = {}): DocumentClient {
		return new DocumentClient(auth, context)
	}

	async read(input: DocumentReadInput): Promise<DocumentReadOutput> {
		const loaded = await this.#load(input.source)
		const format = await this.#format(loaded, input.format)
		const output = await readBytes(format, loaded.bytes, {
			...(loaded.filename && { filename: loaded.filename }),
			...(loaded.media_type && { media_type: loaded.media_type })
		})
		if (input.pdf_page_images) {
			await attachPdfPageArtifacts(output, loaded, format, input.pdf_page_images, (key, bytes, mediaType, filename) =>
				this.#putArtifact(key, bytes, mediaType, filename)
			)
		}
		return documentReadOutputSchema.parse(output)
	}

	async buildText(input: DocumentBuildTextInput) {
		return this.#write(
			input.output_key,
			utf8ToBytes(input.content),
			mediaTypeForTextFormat(input.format),
			input.filename ?? `document.${input.format}`
		)
	}

	async buildSpreadsheet(input: DocumentBuildSpreadsheetInput) {
		return this.#write(
			input.output_key,
			await buildSpreadsheet(input.sheets),
			mediaTypeFor('workbook.xlsx'),
			input.filename ?? 'workbook.xlsx'
		)
	}

	async buildDocument(input: DocumentBuildDocumentInput) {
		return this.#write(
			input.output_key,
			await buildDocument({ title: input.title, sections: input.sections }),
			mediaTypeFor('document.docx'),
			input.filename ?? 'document.docx'
		)
	}

	async editText(input: DocumentEditTextInput) {
		const loaded = await this.#load(input.source)
		const format = await this.#format(loaded, input.format)
		if (format !== 'txt' && format !== 'md' && format !== 'json' && format !== 'html') {
			throw new ToolError('editText requires txt, md, json, or html source', { code: 'bad_input' })
		}
		return this.#write(
			input.output_key,
			patchTextDocument(loaded.bytes, format, input.replacements),
			mediaTypeForTextFormat(format),
			input.filename ?? sourceName(loaded, `document.${format}`)
		)
	}

	async editDocument(input: DocumentEditDocumentInput) {
		const loaded = await this.#requireFormat(input.source, 'docx', 'editDocument')
		return this.#write(
			input.output_key,
			await patchDocx(loaded.bytes, input.replacements),
			mediaTypeFor('document.docx'),
			input.filename ?? sourceName(loaded, 'document.docx')
		)
	}

	async editSpreadsheet(input: DocumentEditSpreadsheetInput) {
		const loaded = await this.#load(input.source)
		const format = await this.#format(loaded)
		if (format !== 'csv' && format !== 'xlsx') {
			throw new ToolError('editSpreadsheet requires xlsx or csv source', { code: 'bad_input' })
		}
		const output = await patchSpreadsheet(loaded.bytes, format, input.patches)
		const fallback = `workbook.${output.filename_ext}`
		const current = sourceName(loaded, fallback)
		const filename = input.filename ?? current.replace(/\.[^./]+$/, `.${output.filename_ext}`)
		return this.#write(input.output_key, output.bytes, output.media_type, filename)
	}

	async #load(source: DocumentReadInput['source']): Promise<LoadedDocument> {
		return loadDocumentSource(source, (key) => this.#storage.getBytes(key))
	}

	#format(loaded: LoadedDocument, format?: DocumentFormat): Promise<DocumentFormat> {
		return detectFormatFromBytes(loaded.bytes, {
			format,
			filename: loaded.filename,
			media_type: loaded.media_type
		})
	}

	async #requireFormat(
		source: DocumentReadInput['source'],
		required: 'docx',
		operation: string
	): Promise<LoadedDocument> {
		const loaded = await this.#load(source)
		if ((await this.#format(loaded)) !== required) {
			throw new ToolError(`${operation} requires ${required} source`, { code: 'bad_input' })
		}
		return loaded
	}

	async #write(key: string, bytes: Uint8Array, mediaType: string, filename: string) {
		const result = await this.#putArtifact(key, bytes, mediaType, filename)
		return documentBuildOutputSchema.parse({ result })
	}

	async #putArtifact(key: string, bytes: Uint8Array, mediaType: string, filename: string): Promise<ArtifactRef> {
		await this.#storage.putBytes(key, bytes, mediaType)
		return artifactRefSchema.parse({
			store: 'object',
			key,
			media_type: mediaType,
			filename,
			byte_length: bytes.byteLength
		})
	}
}

export type { DocumentFormat }
