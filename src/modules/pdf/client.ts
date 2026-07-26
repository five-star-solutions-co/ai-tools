import { PDFDocument, degrees } from 'pdf-lib'

import { ToolError } from '../../core/errors'
import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import { ObjectArtifactStore } from '../../shared/object-artifact-store'
import type { ObjectArtifactStoreOptions } from '../../shared/object-artifact-store'
import type {
	PdfAuth,
	PdfExtractPagesInput,
	PdfInspectInput,
	PdfInspectOutput,
	PdfMergeInput,
	PdfRotateInput,
	PdfSplitInput,
	PdfSplitOutput,
	PdfWriteOutput
} from './contracts'
import {
	MAX_PDF_BYTES,
	pdfAuthSchema,
	pdfInspectOutputSchema,
	pdfSplitOutputSchema,
	pdfWriteOutputSchema
} from './contracts'

export type PdfClientOptions = ObjectArtifactStoreOptions

function pageIndexes(pages: readonly number[], pageCount: number): number[] {
	for (const page of pages) {
		if (page > pageCount) {
			throw new ToolError(`PDF page ${page} does not exist`, {
				code: 'bad_input',
				details: { page, page_count: pageCount }
			})
		}
	}
	return pages.map((page) => page - 1)
}

async function loadPdf(bytes: Uint8Array): Promise<PDFDocument> {
	try {
		return await PDFDocument.load(bytes, { updateMetadata: false })
	} catch (error) {
		throw new ToolError('Failed to read PDF', { code: 'bad_input', cause: error })
	}
}

export class PdfClient {
	readonly #artifacts: ObjectArtifactStore

	constructor(auth: PdfAuth, options: PdfClientOptions = {}) {
		const parsed = pdfAuthSchema.safeParse(auth)
		if (!parsed.success) {
			throw new ToolError('Invalid PDF auth credentials', {
				code: 'bad_auth',
				details: { issues: parsed.error.issues.map((issue) => issue.message) }
			})
		}
		this.#artifacts = new ObjectArtifactStore(parsed.data.storage, options)
	}

	static fromContext(ctx: ToolContext): PdfClient {
		return new PdfClient(requireAuth(ctx, pdfAuthSchema), {
			...(ctx.fetch && { fetch: ctx.fetch }),
			...(ctx.signal && { signal: ctx.signal })
		})
	}

	static fromAuth(auth: PdfAuth, options: PdfClientOptions = {}): PdfClient {
		return new PdfClient(auth, options)
	}

	async inspect(input: PdfInspectInput): Promise<PdfInspectOutput> {
		const pdf = await this.#read(input.source)
		const metadata: PdfInspectOutput['metadata'] = {}
		const title = pdf.getTitle()
		const author = pdf.getAuthor()
		const subject = pdf.getSubject()
		const keywords = pdf.getKeywords()
		const creator = pdf.getCreator()
		const producer = pdf.getProducer()
		if (title) metadata.title = title
		if (author) metadata.author = author
		if (subject) metadata.subject = subject
		if (keywords) metadata.keywords = keywords
		if (creator) metadata.creator = creator
		if (producer) metadata.producer = producer
		return pdfInspectOutputSchema.parse({
			page_count: pdf.getPageCount(),
			pages: pdf.getPages().map((page, index) => ({
				page_number: index + 1,
				width: page.getWidth(),
				height: page.getHeight(),
				rotation_degrees: page.getRotation().angle
			})),
			metadata
		})
	}

	async merge(input: PdfMergeInput): Promise<PdfWriteOutput> {
		const output = await PDFDocument.create()
		for (const source of input.sources) {
			const current = await this.#read(source)
			const pages = await output.copyPages(current, current.getPageIndices())
			for (const page of pages) output.addPage(page)
		}
		return this.#write(output, input.output_key, input.filename ?? 'merged.pdf')
	}

	async extractPages(input: PdfExtractPagesInput): Promise<PdfWriteOutput> {
		const source = await this.#read(input.source)
		const output = await PDFDocument.create()
		const pages = await output.copyPages(source, pageIndexes(input.pages, source.getPageCount()))
		for (const page of pages) output.addPage(page)
		return this.#write(output, input.output_key, input.filename ?? 'extracted.pdf')
	}

	async split(input: PdfSplitInput): Promise<PdfSplitOutput> {
		const source = await this.#read(input.source)
		const results = []
		for (let index = 0; index < source.getPageCount(); index += 1) {
			const output = await PDFDocument.create()
			const [page] = await output.copyPages(source, [index])
			if (!page) throw new ToolError('Failed to copy PDF page', { code: 'internal' })
			output.addPage(page)
			const number = index + 1
			const key = `${input.output_key_prefix.replace(/\/$/, '')}/page-${number}.pdf`
			const name = `${input.filename_prefix ?? 'page'}-${number}.pdf`
			results.push((await this.#write(output, key, name)).result)
		}
		return pdfSplitOutputSchema.parse({ results })
	}

	async rotate(input: PdfRotateInput): Promise<PdfWriteOutput> {
		const pdf = await this.#read(input.source)
		const indexes = new Set(input.pages ? pageIndexes(input.pages, pdf.getPageCount()) : pdf.getPageIndices())
		for (const [index, page] of pdf.getPages().entries()) {
			if (indexes.has(index)) {
				page.setRotation(degrees((page.getRotation().angle + input.degrees) % 360))
			}
		}
		return this.#write(pdf, input.output_key, input.filename ?? 'rotated.pdf')
	}

	async #read(source: PdfInspectInput['source']): Promise<PDFDocument> {
		return loadPdf(await this.#artifacts.read(source, MAX_PDF_BYTES))
	}

	async #write(pdf: PDFDocument, key: string, filename: string): Promise<PdfWriteOutput> {
		const bytes = await pdf.save()
		const result = await this.#artifacts.write(key, bytes, 'application/pdf', filename)
		return pdfWriteOutputSchema.parse({ result })
	}
}
