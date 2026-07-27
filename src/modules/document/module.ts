import { defineModule, defineTool } from '../../core/define'
import { DocumentClient } from './client'
import {
	documentAuthSchema,
	documentBuildDocumentInputSchema,
	documentBuildOutputSchema,
	documentBuildSpreadsheetInputSchema,
	documentBuildTextInputSchema,
	documentEditDocumentInputSchema,
	documentEditSpreadsheetInputSchema,
	documentEditTextInputSchema,
	documentReadInputSchema,
	documentReadOutputSchema
} from './contracts'

export const documentReadTool = defineTool({
	id: 'document-read',
	name: 'readDocument',
	description: 'Read text, metadata, tables, pages, or image dimensions from a supported document artifact.',
	inputSchema: documentReadInputSchema,
	outputSchema: documentReadOutputSchema,
	sideEffect: 'read',
	runtime: 'node',
	artifacts: true,
	execute: async (input, ctx) => DocumentClient.fromContext(ctx).read(input)
})

export const documentBuildTextTool = defineTool({
	id: 'document-build-text',
	name: 'buildTextDocument',
	description: 'Build a TXT, Markdown, JSON, CSV, or HTML artifact from text content.',
	inputSchema: documentBuildTextInputSchema,
	outputSchema: documentBuildOutputSchema,
	sideEffect: 'write',
	runtime: 'node',
	artifacts: true,
	execute: async (input, ctx) => DocumentClient.fromContext(ctx).buildText(input)
})

export const documentBuildSpreadsheetTool = defineTool({
	id: 'document-build-spreadsheet',
	name: 'buildSpreadsheet',
	description: 'Build an XLSX artifact from one or more row-major worksheets.',
	inputSchema: documentBuildSpreadsheetInputSchema,
	outputSchema: documentBuildOutputSchema,
	sideEffect: 'write',
	runtime: 'node',
	artifacts: true,
	execute: async (input, ctx) => DocumentClient.fromContext(ctx).buildSpreadsheet(input)
})

export const documentBuildDocumentTool = defineTool({
	id: 'document-build-document',
	name: 'buildDocument',
	description: 'Build a DOCX artifact from titled sections and paragraphs.',
	inputSchema: documentBuildDocumentInputSchema,
	outputSchema: documentBuildOutputSchema,
	sideEffect: 'write',
	runtime: 'node',
	artifacts: true,
	execute: async (input, ctx) => DocumentClient.fromContext(ctx).buildDocument(input)
})

export const documentEditTextTool = defineTool({
	id: 'document-edit-text',
	name: 'editTextDocument',
	description: 'Apply exact text replacements to a TXT, Markdown, JSON, or HTML artifact.',
	inputSchema: documentEditTextInputSchema,
	outputSchema: documentBuildOutputSchema,
	sideEffect: 'write',
	runtime: 'node',
	artifacts: true,
	execute: async (input, ctx) => DocumentClient.fromContext(ctx).editText(input)
})

export const documentEditDocumentTool = defineTool({
	id: 'document-edit-document',
	name: 'editDocument',
	description: 'Apply layout-preserving text replacements to a DOCX artifact.',
	inputSchema: documentEditDocumentInputSchema,
	outputSchema: documentBuildOutputSchema,
	sideEffect: 'write',
	runtime: 'node',
	artifacts: true,
	execute: async (input, ctx) => DocumentClient.fromContext(ctx).editDocument(input)
})

export const documentEditSpreadsheetTool = defineTool({
	id: 'document-edit-spreadsheet',
	name: 'editSpreadsheet',
	description: 'Apply cell updates to an XLSX or CSV artifact.',
	inputSchema: documentEditSpreadsheetInputSchema,
	outputSchema: documentBuildOutputSchema,
	sideEffect: 'write',
	runtime: 'node',
	artifacts: true,
	execute: async (input, ctx) => DocumentClient.fromContext(ctx).editSpreadsheet(input)
})

export const documentModule = defineModule({
	id: 'document',
	title: 'Document',
	description: 'Read, build, and edit text, PDF, DOCX, spreadsheet, and image artifacts.',
	runtime: 'node',
	auth: { type: 'custom', schema: documentAuthSchema },
	tools: [
		documentReadTool,
		documentBuildTextTool,
		documentBuildSpreadsheetTool,
		documentBuildDocumentTool,
		documentEditTextTool,
		documentEditDocumentTool,
		documentEditSpreadsheetTool
	]
})
