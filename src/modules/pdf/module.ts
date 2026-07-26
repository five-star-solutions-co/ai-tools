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
	description: 'Concatenate two or more PDF artifacts in order and write one PDF artifact.',
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
	description: 'Copy selected one-based pages from a PDF artifact into one new PDF in the requested order.',
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
	description: 'Split a PDF artifact into one output PDF artifact per page.',
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
	description: 'Rotate selected pages in a PDF artifact clockwise, or rotate every page when no page list is supplied.',
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
	tools: [pdfInspectTool, pdfMergeTool, pdfExtractPagesTool, pdfSplitTool, pdfRotateTool]
})
