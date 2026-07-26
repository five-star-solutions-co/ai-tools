import { z } from 'zod'

import { artifactRefSchema } from '../../shared/artifact'
import { s3AuthSchema } from '../../vendors/s3'

export const MAX_PDF_BYTES = 50 * 1024 * 1024
export const MAX_PDF_PAGES = 500

export const pdfAuthSchema = z.object({
	storage: s3AuthSchema.describe('Object storage for source and output PDF artifacts')
})

const source = artifactRefSchema.describe('Source PDF artifact')
const outputKey = z.string().min(1).max(1_024).describe('Destination object key')
const filename = z.string().min(1).max(512).optional().describe('Display filename for the output PDF')
const pageNumber = z.int().min(1).max(MAX_PDF_PAGES).describe('One-based PDF page number')

export const pdfInspectInputSchema = z.object({ source })

export const pdfPageInfoSchema = z.object({
	page_number: pageNumber,
	width: z.number().positive(),
	height: z.number().positive(),
	rotation_degrees: z.number()
})

export const pdfMetadataSchema = z.object({
	title: z.string().optional(),
	author: z.string().optional(),
	subject: z.string().optional(),
	keywords: z.string().optional(),
	creator: z.string().optional(),
	producer: z.string().optional()
})

export const pdfInspectOutputSchema = z.object({
	page_count: z.int().min(0),
	pages: z.array(pdfPageInfoSchema),
	metadata: pdfMetadataSchema
})

export const pdfMergeInputSchema = z.object({
	sources: z.array(source).min(2).max(50).describe('PDF artifacts to concatenate in order'),
	output_key: outputKey,
	filename
})

export const pdfWriteOutputSchema = z.object({
	result: artifactRefSchema.describe('Written PDF artifact')
})

export const pdfExtractPagesInputSchema = z.object({
	source,
	pages: z.array(pageNumber).min(1).max(MAX_PDF_PAGES).describe('Pages to copy in the requested order'),
	output_key: outputKey,
	filename
})

export const pdfSplitInputSchema = z.object({
	source,
	output_key_prefix: z.string().min(1).max(1_024).describe('Object-key prefix for one PDF per source page'),
	filename_prefix: z.string().min(1).max(200).optional().describe('Filename prefix for page PDFs')
})

export const pdfSplitOutputSchema = z.object({
	results: z.array(artifactRefSchema).describe('One PDF artifact per source page')
})

export const pdfRotateInputSchema = z.object({
	source,
	degrees: z.union([z.literal(90), z.literal(180), z.literal(270)]).describe('Clockwise rotation to add'),
	pages: z.array(pageNumber).min(1).max(MAX_PDF_PAGES).optional().describe('Pages to rotate; defaults to every page'),
	output_key: outputKey,
	filename
})

export type PdfAuth = z.infer<typeof pdfAuthSchema>
export type PdfInspectInput = z.infer<typeof pdfInspectInputSchema>
export type PdfInspectOutput = z.infer<typeof pdfInspectOutputSchema>
export type PdfMergeInput = z.infer<typeof pdfMergeInputSchema>
export type PdfExtractPagesInput = z.infer<typeof pdfExtractPagesInputSchema>
export type PdfSplitInput = z.infer<typeof pdfSplitInputSchema>
export type PdfSplitOutput = z.infer<typeof pdfSplitOutputSchema>
export type PdfRotateInput = z.infer<typeof pdfRotateInputSchema>
export type PdfWriteOutput = z.infer<typeof pdfWriteOutputSchema>
