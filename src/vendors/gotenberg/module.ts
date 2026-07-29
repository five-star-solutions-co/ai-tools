import { defineModule, defineTool } from '../../core/define'
import { batchResultSchema } from '../../shared/batch'
import { GotenbergClient } from './client'
import {
	gotenbergAuthSchema,
	gotenbergConvertBatchInputSchema,
	gotenbergConvertInputSchema,
	gotenbergConvertOutputSchema,
	gotenbergRenderOutputSchema,
	gotenbergRenderPdfInputSchema,
	gotenbergRenderScreenshotInputSchema
} from './contracts'

const gotenbergConvertBatchOutputSchema = batchResultSchema(gotenbergConvertOutputSchema)

export const gotenbergRenderPdfTool = defineTool({
	id: 'gotenberg-render-pdf',
	name: 'gotenbergRenderPdf',
	description:
		'Render HTML or a URL to a PDF via Chromium. Writes the PDF to object storage and returns an ArtifactRef. Prefer for web layouts; use convert for office documents.',
	inputSchema: gotenbergRenderPdfInputSchema,
	outputSchema: gotenbergRenderOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => GotenbergClient.fromContext(ctx).renderPdf(input)
})

export const gotenbergRenderScreenshotTool = defineTool({
	id: 'gotenberg-render-screenshot',
	name: 'gotenbergRenderScreenshot',
	description:
		'Capture a PNG screenshot of HTML or a URL via Chromium. Writes the image to object storage and returns an ArtifactRef.',
	inputSchema: gotenbergRenderScreenshotInputSchema,
	outputSchema: gotenbergRenderOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => GotenbergClient.fromContext(ctx).renderScreenshot(input)
})

export const gotenbergConvertTool = defineTool({
	id: 'gotenberg-convert',
	name: 'gotenbergConvert',
	description:
		'Convert an office document ArtifactRef to PDF (path office-to-pdf: docx, pptx, xlsx, odt, …). Not for HTML print layouts. Writes PDF to object storage.',
	inputSchema: gotenbergConvertInputSchema,
	outputSchema: gotenbergConvertOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => GotenbergClient.fromContext(ctx).convert(input)
})

export const gotenbergConvertBatchTool = defineTool({
	id: 'gotenberg-convert-batch',
	name: 'gotenbergConvertBatch',
	description:
		'Convert up to 10 office document ArtifactRefs to PDF. Per-item success or error without aborting the batch.',
	inputSchema: gotenbergConvertBatchInputSchema,
	outputSchema: gotenbergConvertBatchOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => GotenbergClient.fromContext(ctx).convertBatch(input)
})

export const gotenbergModule = defineModule({
	id: 'gotenberg',
	title: 'Gotenberg',
	description:
		'Gotenberg tools for HTML or URL rendering and office-document-to-PDF conversion. Each successful output is a final ArtifactRef; use the specific render or convert action matching the source format.',
	runtime: 'both',
	auth: { type: 'custom', schema: gotenbergAuthSchema },
	tools: [gotenbergRenderPdfTool, gotenbergRenderScreenshotTool, gotenbergConvertTool, gotenbergConvertBatchTool]
})
