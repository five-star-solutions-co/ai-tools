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
		'Convert an existing office document ArtifactRef such as DOCX, PPTX, XLSX, or ODT to PDF and return the final PDF ArtifactRef. Use only when the format must change. For HTML or URL print layouts, use document-render-pdf.',
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
		'Convert up to 10 existing office document ArtifactRefs to final PDF ArtifactRefs. Use only when multiple independent files must change format. Returns per-item success or error without aborting the batch.',
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
		'Convert existing office documents to PDF. This changes file format only; it does not create document content or print HTML and URLs.',
	runtime: 'both',
	auth: { type: 'custom', schema: fileConvertAuthSchema },
	tools: [fileConvertTool, fileConvertBatchTool]
})
