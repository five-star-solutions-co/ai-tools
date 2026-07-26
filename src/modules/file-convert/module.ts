import { defineModule, defineTool } from '../../core/define'
import { FileConvertClient } from './client'
import {
	convertBatchInputSchema,
	convertBatchOutputSchema,
	convertInputSchema,
	convertOutputSchema,
	fileConvertAuthSchema
} from './contracts'

export type { FileConvertAuth } from './contracts'
export { fileConvertAuthSchema }

export const fileConvertTool = defineTool({
	id: 'file-convert',
	name: 'convertFile',
	description:
		'Convert an office document ArtifactRef to PDF (path office-to-pdf: docx, pptx, xlsx, odt, …). Not for HTML print layouts — use document render for those. Writes PDF to object storage.',
	inputSchema: convertInputSchema,
	outputSchema: convertOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => FileConvertClient.fromContext(ctx).convert(input)
})

export const fileConvertBatchTool = defineTool({
	id: 'file-convert-batch',
	name: 'convertFiles',
	description:
		'Convert up to 10 office document ArtifactRefs to PDF. Per-item success or error without aborting the batch.',
	inputSchema: convertBatchInputSchema,
	outputSchema: convertBatchOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => FileConvertClient.fromContext(ctx).convertBatch(input)
})

export const fileConvertModule = defineModule({
	id: 'file-convert',
	title: 'File Convert',
	description:
		'Office document to PDF conversion via the host-bound provider (LibreOffice). Distinct from HTML/URL render.',
	runtime: 'both',
	auth: { type: 'custom', schema: fileConvertAuthSchema },
	tools: [fileConvertTool, fileConvertBatchTool]
})
