/** Document source loading and ArtifactRef output helpers. */
import { ToolError } from '../../core/errors'
import type { ArtifactRef } from '../../shared/artifact'
import { base64ToBytes, utf8ToBytes } from '../../shared/bytes'
import type { DocumentFormat, DocumentReadInput, DocumentReadOutput } from './contracts'
import { renderPdfPages } from './domain'

export type LoadedDocument = {
	bytes: Uint8Array
	filename?: string | undefined
	media_type?: string | undefined
}

type ReadArtifact = (key: string) => Promise<Uint8Array>
type WriteArtifact = (key: string, bytes: Uint8Array, mediaType: string, filename: string) => Promise<ArtifactRef>

export function sourceName(loaded: LoadedDocument, fallback: string): string {
	const filename = loaded.filename?.split('/').at(-1)
	return filename || fallback
}

export async function loadDocumentSource(
	source: DocumentReadInput['source'],
	readArtifact: ReadArtifact
): Promise<LoadedDocument> {
	if (source.text !== undefined) {
		return {
			bytes: utf8ToBytes(source.text),
			filename: source.filename,
			media_type: source.media_type ?? (source.filename ? undefined : 'text/plain')
		}
	}
	if (source.body_base64 !== undefined) {
		return {
			bytes: base64ToBytes(source.body_base64),
			filename: source.filename,
			media_type: source.media_type
		}
	}
	if (source.artifact) {
		if (source.artifact.store !== 'object') {
			throw new ToolError('Document artifact store must be object', { code: 'bad_input' })
		}
		return {
			bytes: await readArtifact(source.artifact.key),
			filename: source.filename ?? source.artifact.filename,
			media_type: source.media_type ?? source.artifact.media_type
		}
	}
	throw new ToolError('Missing document source', { code: 'bad_input' })
}

export async function attachPdfPageArtifacts(
	output: DocumentReadOutput,
	loaded: LoadedDocument,
	format: DocumentFormat,
	options: NonNullable<DocumentReadInput['pdf_page_images']>,
	writeArtifact: WriteArtifact
): Promise<void> {
	if (format !== 'pdf') {
		throw new ToolError('pdf_page_images is only valid for PDF documents', { code: 'bad_input' })
	}
	const pageCount = output.page_count ?? 0
	const invalidPage = options.page_numbers.find((page) => page > pageCount)
	if (invalidPage) {
		throw new ToolError('Requested PDF page is outside the document', {
			code: 'bad_input',
			details: { page_number: invalidPage, page_count: pageCount }
		})
	}

	const rendered = await renderPdfPages(loaded.bytes, options.page_numbers, options.scale)
	const pages = [...(output.pages ?? [])]
	const prefix = options.output_key_prefix.replace(/\/+$/, '')
	const basename = sourceName(loaded, 'document').replace(/\.[^./]+$/, '')
	for (const page of rendered) {
		const image = await writeArtifact(
			`${prefix}/page-${page.page_number}.png`,
			page.bytes,
			'image/png',
			`${basename}-page-${page.page_number}.png`
		)
		const index = pages.findIndex((existing) => existing.page_number === page.page_number)
		if (index >= 0) {
			const existing = pages[index]
			if (existing) pages[index] = { ...existing, image }
		} else {
			pages.push({ page_number: page.page_number, image })
		}
	}
	output.pages = pages.sort((left, right) => left.page_number - right.page_number)
}
