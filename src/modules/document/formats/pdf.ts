import { definePDFJSModule, extractText, renderPageAsImage } from 'unpdf'

import { ToolError } from '../../../core/errors'
import type { DocumentReadOutput } from '../contracts'
import { readImageMetadata } from './image'

let nodePdfJsReady: Promise<void> | undefined

function ensurePdfJs(): Promise<void> {
	if (typeof process === 'undefined' || process.release?.name !== 'node') return Promise.resolve()
	nodePdfJsReady ??= definePDFJSModule(() => import('pdfjs-dist/legacy/build/pdf.mjs'))
	return nodePdfJsReady
}

export async function readPdf(bytes: Uint8Array): Promise<Pick<DocumentReadOutput, 'text' | 'page_count' | 'pages'>> {
	try {
		await ensurePdfJs()
		const { text, totalPages } = await extractText(bytes.slice())
		const pageText = Array.isArray(text) ? text : [text]
		return {
			text: pageText.join('\n'),
			page_count: totalPages,
			pages: pageText.map((page, index) => ({ page_number: index + 1, text: page }))
		}
	} catch (error) {
		throw new ToolError('Failed to extract text from PDF', { code: 'upstream', cause: error })
	}
}

export async function renderPdfPages(
	bytes: Uint8Array,
	pageNumbers: number[],
	scale = 1.5
): Promise<Array<{ page_number: number; bytes: Uint8Array; width?: number; height?: number }>> {
	await ensurePdfJs()
	const pages: Array<{ page_number: number; bytes: Uint8Array; width?: number; height?: number }> = []
	for (const pageNumber of pageNumbers) {
		try {
			const rendered = new Uint8Array(
				await renderPageAsImage(bytes.slice(), pageNumber, {
					canvasImport: () => import('@napi-rs/canvas'),
					scale
				})
			)
			const dimensions = readImageMetadata(rendered)
			pages.push({
				page_number: pageNumber,
				bytes: rendered,
				...(dimensions?.width && { width: dimensions.width }),
				...(dimensions?.height && { height: dimensions.height })
			})
		} catch (error) {
			throw new ToolError('Failed to render PDF page image', {
				code: 'upstream',
				cause: error,
				details: { page_number: pageNumber }
			})
		}
	}
	return pages
}
