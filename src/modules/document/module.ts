import { defineModule, defineTool } from '../../core/define'
import { DocumentClient } from './client'
import {
	documentAuthSchema,
	documentBuildDocumentInputSchema,
	documentBuildOutputSchema,
	documentBuildPresentationInputSchema,
	documentBuildSpreadsheetInputSchema,
	documentBuildTextInputSchema,
	documentEditDocumentInputSchema,
	documentEditPresentationInputSchema,
	documentEditSpreadsheetInputSchema,
	documentEditTextInputSchema,
	documentReadInputSchema,
	documentReadOutputSchema
} from './contracts'

export type { DocumentAuth } from './contracts'
export { documentAuthSchema }

export const documentReadTool = defineTool({
	id: 'document-read',
	name: 'readDocument',
	description:
		'Read a document into model-usable text, HTML, tables, slides, page text, or image metadata. Request selected PDF page images when visual reasoning is useful. Supports txt, md, json, csv, html, pdf, docx, pptx, xlsx, and common images.',
	inputSchema: documentReadInputSchema,
	outputSchema: documentReadOutputSchema,
	sideEffect: 'read',
	runtime: 'node',
	execute: async (input, ctx) => DocumentClient.fromContext(ctx).read(input)
})

export const documentBuildTextTool = defineTool({
	id: 'document-build-text',
	name: 'buildTextDocument',
	description: 'Write a text document (txt, md, json, csv, or html) to object storage and return an ArtifactRef.',
	inputSchema: documentBuildTextInputSchema,
	outputSchema: documentBuildOutputSchema,
	sideEffect: 'write',
	runtime: 'node',
	execute: async (input, ctx) => DocumentClient.fromContext(ctx).buildText(input)
})

export const documentBuildSpreadsheetTool = defineTool({
	id: 'document-build-spreadsheet',
	name: 'buildSpreadsheet',
	description: 'Create an xlsx workbook from sheet tables and write it to object storage as an ArtifactRef.',
	inputSchema: documentBuildSpreadsheetInputSchema,
	outputSchema: documentBuildOutputSchema,
	sideEffect: 'write',
	runtime: 'node',
	execute: async (input, ctx) => DocumentClient.fromContext(ctx).buildSpreadsheet(input)
})

export const documentBuildDocumentTool = defineTool({
	id: 'document-build-document',
	name: 'buildDocument',
	description: 'Create a docx document from title and sections and write it to object storage as an ArtifactRef.',
	inputSchema: documentBuildDocumentInputSchema,
	outputSchema: documentBuildOutputSchema,
	sideEffect: 'write',
	runtime: 'node',
	execute: async (input, ctx) => DocumentClient.fromContext(ctx).buildDocument(input)
})

export const documentBuildPresentationTool = defineTool({
	id: 'document-build-presentation',
	name: 'buildPresentation',
	description:
		'Create a pptx presentation from slides (title, bullets, notes) and write it to object storage as an ArtifactRef.',
	inputSchema: documentBuildPresentationInputSchema,
	outputSchema: documentBuildOutputSchema,
	sideEffect: 'write',
	runtime: 'node',
	execute: async (input, ctx) => DocumentClient.fromContext(ctx).buildPresentation(input)
})

export const documentEditTextTool = defineTool({
	id: 'document-edit-text',
	name: 'editTextDocument',
	description:
		'Apply ordered exact-text replacements to an existing txt, md, json, or html document while preserving the rest of the file.',
	inputSchema: documentEditTextInputSchema,
	outputSchema: documentBuildOutputSchema,
	sideEffect: 'write',
	runtime: 'node',
	execute: async (input, ctx) => DocumentClient.fromContext(ctx).editText(input)
})

export const documentEditDocumentTool = defineTool({
	id: 'document-edit-document',
	name: 'editDocument',
	description:
		'Apply ordered text replacements to an existing docx while preserving its package, layout, styles, media, headers, and footers.',
	inputSchema: documentEditDocumentInputSchema,
	outputSchema: documentBuildOutputSchema,
	sideEffect: 'write',
	runtime: 'node',
	execute: async (input, ctx) => DocumentClient.fromContext(ctx).editDocument(input)
})

export const documentEditPresentationTool = defineTool({
	id: 'document-edit-presentation',
	name: 'editPresentation',
	description: 'Replace text in pptx slide content while preserving layout, speaker notes, and media.',
	inputSchema: documentEditPresentationInputSchema,
	outputSchema: documentBuildOutputSchema,
	sideEffect: 'write',
	runtime: 'node',
	execute: async (input, ctx) => DocumentClient.fromContext(ctx).editPresentation(input)
})

export const documentEditSpreadsheetTool = defineTool({
	id: 'document-edit-spreadsheet',
	name: 'editSpreadsheet',
	description: 'Apply cell patches to an existing xlsx or csv spreadsheet and write the result to object storage.',
	inputSchema: documentEditSpreadsheetInputSchema,
	outputSchema: documentBuildOutputSchema,
	sideEffect: 'write',
	runtime: 'node',
	execute: async (input, ctx) => DocumentClient.fromContext(ctx).editSpreadsheet(input)
})

export const documentModule = defineModule({
	id: 'document',
	title: 'Document',
	description:
		'Read common documents, build native text/docx/pptx/xlsx artifacts, and edit existing text, documents, presentations, and spreadsheets. Browser print and format conversion remain separate capabilities.',
	runtime: 'node',
	auth: { type: 'custom', schema: documentAuthSchema },
	tools: [
		documentReadTool,
		documentBuildTextTool,
		documentBuildSpreadsheetTool,
		documentBuildDocumentTool,
		documentBuildPresentationTool,
		documentEditTextTool,
		documentEditDocumentTool,
		documentEditPresentationTool,
		documentEditSpreadsheetTool
	]
})
