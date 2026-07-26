import { defineModule, defineTool } from '../../core/define'
import { DocumentClient } from './client'
import {
	documentAuthSchema,
	documentBuildDocumentInputSchema,
	documentBuildOutputSchema,
	documentBuildPresentationInputSchema,
	documentBuildSpreadsheetInputSchema,
	documentBuildTextInputSchema,
	documentEditSpreadsheetInputSchema,
	documentReadInputSchema,
	documentReadOutputSchema
} from './contracts'

export type { DocumentAuth } from './contracts'
export { documentAuthSchema }

export const documentReadTool = defineTool({
	id: 'document-read',
	name: 'readDocument',
	description:
		'Read a document into model-usable content: plain text, HTML when available, spreadsheet tables, or presentation slides. Source may be an object-store artifact, base64 bytes, or inline text. Supports txt, md, json, csv, html, pdf, docx, pptx, xlsx, and images (metadata only for images).',
	inputSchema: documentReadInputSchema,
	outputSchema: documentReadOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => DocumentClient.fromContext(ctx).read(input)
})

export const documentBuildTextTool = defineTool({
	id: 'document-build-text',
	name: 'buildTextDocument',
	description: 'Write a text document (txt, md, json, csv, or html) to object storage and return an ArtifactRef.',
	inputSchema: documentBuildTextInputSchema,
	outputSchema: documentBuildOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => DocumentClient.fromContext(ctx).buildText(input)
})

export const documentBuildSpreadsheetTool = defineTool({
	id: 'document-build-spreadsheet',
	name: 'buildSpreadsheet',
	description: 'Create an xlsx workbook from sheet tables and write it to object storage as an ArtifactRef.',
	inputSchema: documentBuildSpreadsheetInputSchema,
	outputSchema: documentBuildOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => DocumentClient.fromContext(ctx).buildSpreadsheet(input)
})

export const documentBuildDocumentTool = defineTool({
	id: 'document-build-document',
	name: 'buildDocument',
	description: 'Create a docx document from title and sections and write it to object storage as an ArtifactRef.',
	inputSchema: documentBuildDocumentInputSchema,
	outputSchema: documentBuildOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
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
	runtime: 'both',
	execute: async (input, ctx) => DocumentClient.fromContext(ctx).buildPresentation(input)
})

export const documentEditSpreadsheetTool = defineTool({
	id: 'document-edit-spreadsheet',
	name: 'editSpreadsheet',
	description: 'Apply cell patches to an existing xlsx or csv spreadsheet and write the result to object storage.',
	inputSchema: documentEditSpreadsheetInputSchema,
	outputSchema: documentBuildOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => DocumentClient.fromContext(ctx).editSpreadsheet(input)
})

export const documentModule = defineModule({
	id: 'document',
	title: 'Document',
	description:
		'Read documents into text/tables/slides, build text/docx/pptx/xlsx artifacts, and patch spreadsheets. HTML print PDF/PNG is document-render; office-to-PDF is file-convert.',
	runtime: 'both',
	auth: { type: 'custom', schema: documentAuthSchema },
	tools: [
		documentReadTool,
		documentBuildTextTool,
		documentBuildSpreadsheetTool,
		documentBuildDocumentTool,
		documentBuildPresentationTool,
		documentEditSpreadsheetTool
	]
})
