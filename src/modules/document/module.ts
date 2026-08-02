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
	description:
		'Read an existing supported artifact for understanding, including text, metadata, tables, PDF pages, or image dimensions. Use before answering about or editing a user-supplied file. This does not create a new deliverable.',
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
	description:
		'Create a new TXT, Markdown, JSON, CSV, or HTML deliverable from complete text content. Prefer this purpose-built tool over writing the file in a general code sandbox. Returns the final ArtifactRef; no export or edit step is needed.',
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
	description:
		'Create a new XLSX workbook from structured, row-major worksheets. Use whenever the user asks to build a spreadsheet or workbook from data. Prefer this over generating XLSX in a general code sandbox. Returns the final ArtifactRef; use document-edit-spreadsheet only for an existing spreadsheet.',
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
	description:
		'Create a new DOCX deliverable from titled sections and paragraphs. Prefer this purpose-built builder over generating DOCX in a general code sandbox. Returns the final ArtifactRef; use document-edit-document only for an existing DOCX.',
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
	description:
		'Edit an existing TXT, Markdown, JSON, or HTML ArtifactRef with ordered exact-text replacements and return a new ArtifactRef. Use only when changing a supplied file. For a new deliverable, use document-build-text; do not call this merely to make a built artifact deliverable.',
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
	description:
		'Edit an existing DOCX ArtifactRef with layout-preserving text replacements and return a new ArtifactRef. Use only when changing a supplied DOCX. For a new document, use document-build-document; do not call this merely to make a built artifact deliverable.',
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
	description:
		'Edit cells in an existing XLSX or CSV ArtifactRef and return a new ArtifactRef. Use only when changing a supplied spreadsheet and provide explicit sheet, row, and column patches. For a new workbook, use document-build-spreadsheet; do not call this merely to make a built artifact deliverable.',
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
	description:
		'Purpose-built document tools for reading existing files, creating final text, DOCX, and XLSX deliverables, and editing supplied files. Prefer these tools over general sandbox file generation.',
	runtime: 'node',
	auth: { type: 'custom', schema: documentAuthSchema },
	categories: ['documents', 'office'],
	classification: 'pii',
	tags: ['read', 'build', 'edit'],
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
