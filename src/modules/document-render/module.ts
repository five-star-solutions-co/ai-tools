import { defineModule, defineTool } from '../../core/define'
import { runBatchItems } from '../../shared/batch'
import { DocumentRenderClient } from './client'
import {
	documentRenderAuthSchema,
	renderOutputSchema,
	renderPdfBatchInputSchema,
	renderPdfBatchOutputSchema,
	renderPdfInputSchema,
	renderScreenshotBatchInputSchema,
	renderScreenshotBatchOutputSchema,
	renderScreenshotInputSchema
} from './contracts'

export type { DocumentRenderAuth } from './contracts'
export { documentRenderAuthSchema }

export const documentRenderPdfTool = defineTool({
	id: 'document-render-pdf',
	name: 'renderDocumentPdf',
	description:
		'Create a PDF from HTML or a URL with a browser print engine and return the final ArtifactRef. Use for web layouts, reports, and invoices. Do not use a general code sandbox to print HTML.',
	inputSchema: renderPdfInputSchema,
	outputSchema: renderOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => DocumentRenderClient.fromContext(ctx).renderPdf(input)
})

export const documentRenderScreenshotTool = defineTool({
	id: 'document-render-screenshot',
	name: 'renderDocumentScreenshot',
	description:
		'Create a PNG screenshot ArtifactRef from HTML or a URL. Use when the requested deliverable is a rendered page image, not when interactive browsing or a source image transform is required.',
	inputSchema: renderScreenshotInputSchema,
	outputSchema: renderOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => DocumentRenderClient.fromContext(ctx).renderScreenshot(input)
})

export const documentRenderPdfBatchTool = defineTool({
	id: 'document-render-pdf-batch',
	name: 'renderDocumentPdfBatch',
	description:
		'Create PDF ArtifactRefs from up to 10 HTML or URL sources. Use only when multiple independent browser-printed PDFs are required. Returns per-item success or error without aborting the batch.',
	inputSchema: renderPdfBatchInputSchema,
	outputSchema: renderPdfBatchOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => {
		const client = DocumentRenderClient.fromContext(ctx)
		return runBatchItems(input.items, async (item) => client.renderPdf(item))
	}
})

export const documentRenderScreenshotBatchTool = defineTool({
	id: 'document-render-screenshot-batch',
	name: 'renderDocumentScreenshotBatch',
	description:
		'Create PNG screenshot ArtifactRefs from up to 10 HTML or URL sources. Use only when multiple independent page images are required. Returns per-item success or error without aborting the batch.',
	inputSchema: renderScreenshotBatchInputSchema,
	outputSchema: renderScreenshotBatchOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => {
		const client = DocumentRenderClient.fromContext(ctx)
		return runBatchItems(input.items, async (item) => client.renderScreenshot(item))
	}
})

export const documentRenderModule = defineModule({
	id: 'document-render',
	title: 'Document Render',
	description: 'Create final PDF or PNG ArtifactRefs from HTML or URLs with a browser renderer.',
	runtime: 'both',
	auth: { type: 'custom', schema: documentRenderAuthSchema },
	categories: ['documents', 'render'],
	classification: 'standard',
	tags: ['pdf', 'screenshot'],
	tools: [
		documentRenderPdfTool,
		documentRenderScreenshotTool,
		documentRenderPdfBatchTool,
		documentRenderScreenshotBatchTool
	]
})
