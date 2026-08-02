import { defineModule, defineTool } from '../../core/define'
import { PdfClient } from './client'
import {
	pdfAuthSchema,
	pdfExtractPagesInputSchema,
	pdfInspectInputSchema,
	pdfInspectOutputSchema,
	pdfMergeInputSchema,
	pdfRotateInputSchema,
	pdfSplitInputSchema,
	pdfSplitOutputSchema,
	pdfWriteOutputSchema
} from './contracts'

export const pdfInspectTool = defineTool({
	id: 'pdf-inspect',
	name: 'inspectPdf',
	description:
		'Inspect a PDF artifact and return page count, page dimensions, rotations, and available document metadata.',
	inputSchema: pdfInspectInputSchema,
	outputSchema: pdfInspectOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	artifacts: true,
	execute: async (input, ctx) => PdfClient.fromContext(ctx).inspect(input)
})

export const pdfMergeTool = defineTool({
	id: 'pdf-merge',
	name: 'mergePdfs',
	description:
		'Concatenate two or more existing PDF ArtifactRefs in order and return one final PDF ArtifactRef. Use for combining PDFs, not for creating a PDF from HTML or an office document.',
	inputSchema: pdfMergeInputSchema,
	outputSchema: pdfWriteOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	artifacts: true,
	execute: async (input, ctx) => PdfClient.fromContext(ctx).merge(input)
})

export const pdfExtractPagesTool = defineTool({
	id: 'pdf-extract-pages',
	name: 'extractPdfPages',
	description:
		'Copy selected one-based pages from an existing PDF ArtifactRef into a new PDF and return its ArtifactRef. Use when the requested output is one PDF containing a chosen page sequence.',
	inputSchema: pdfExtractPagesInputSchema,
	outputSchema: pdfWriteOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	artifacts: true,
	execute: async (input, ctx) => PdfClient.fromContext(ctx).extractPages(input)
})

export const pdfSplitTool = defineTool({
	id: 'pdf-split',
	name: 'splitPdf',
	description:
		'Split an existing PDF ArtifactRef into one output PDF ArtifactRef per page. Use only when separate page files are required; use pdf-extract-pages for one combined subset.',
	inputSchema: pdfSplitInputSchema,
	outputSchema: pdfSplitOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	artifacts: true,
	execute: async (input, ctx) => PdfClient.fromContext(ctx).split(input)
})

export const pdfRotateTool = defineTool({
	id: 'pdf-rotate',
	name: 'rotatePdfPages',
	description:
		'Rotate selected pages in an existing PDF ArtifactRef clockwise, or every page when no page list is supplied, and return a new PDF ArtifactRef.',
	inputSchema: pdfRotateInputSchema,
	outputSchema: pdfWriteOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	artifacts: true,
	execute: async (input, ctx) => PdfClient.fromContext(ctx).rotate(input)
})

export const pdfModule = defineModule({
	id: 'pdf',
	title: 'PDF',
	description: 'Inspect, merge, extract, split, and rotate PDF artifacts.',
	runtime: 'both',
	auth: { type: 'custom', schema: pdfAuthSchema },
	categories: ['documents', 'pdf'],
	classification: 'pii',
	tags: ['merge', 'split'],
	tools: [pdfInspectTool, pdfMergeTool, pdfExtractPagesTool, pdfSplitTool, pdfRotateTool]
})
