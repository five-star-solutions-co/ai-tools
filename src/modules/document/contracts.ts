/**
 * Document plane contracts — read / build office and text artifacts.
 * Auth: nested object storage for ArtifactRef IO.
 */

import { z } from 'zod'

import { artifactRefSchema } from '../../shared/artifact'
import { s3AuthSchema } from '../../vendors/s3'

export const MAX_INLINE_CHARS = 2_000_000
export const MAX_SLIDES = 50
export const MAX_SECTIONS = 100
export const MAX_SHEET_ROWS = 5_000
export const MAX_SHEETS = 20
export const MAX_REPLACEMENTS = 200
export const MAX_PDF_PAGE_IMAGES = 20

export const documentAuthSchema = z.object({
	storage: s3AuthSchema.describe('Object storage for document ArtifactRef read/write')
})

export type DocumentAuth = z.infer<typeof documentAuthSchema>

export const documentFormatSchema = z.enum(['txt', 'md', 'json', 'csv', 'html', 'pdf', 'docx', 'pptx', 'xlsx', 'image'])

export type DocumentFormat = z.infer<typeof documentFormatSchema>

export const documentSourceSchema = z
	.object({
		artifact: artifactRefSchema.optional().describe('Object-store artifact to read (store must be object)'),
		body_base64: z.string().min(1).optional().describe('Inline file bytes as base64 (small files only)'),
		text: z.string().min(1).max(MAX_INLINE_CHARS).optional().describe('Inline utf8 text when the format is text-based'),
		filename: z.string().min(1).optional().describe('Filename hint for format detection'),
		media_type: z.string().min(1).optional().describe('MIME type hint for format detection')
	})
	.superRefine((val, ctx) => {
		const n = [val.artifact, val.body_base64, val.text].filter((x) => x !== undefined).length
		if (n !== 1) {
			ctx.addIssue({
				code: 'custom',
				message: 'Provide exactly one of artifact, body_base64, or text'
			})
		}
	})

export const documentTableSchema = z.object({
	name: z.string().optional().describe('Sheet or table name'),
	rows: z
		.array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])))
		.max(MAX_SHEET_ROWS)
		.describe('Row-major cell values')
})

export const documentSlideSchema = z.object({
	title: z.string().max(500).optional().describe('Slide title'),
	bullets: z.array(z.string().max(2_000)).max(40).optional().describe('Bullet lines'),
	notes: z.string().max(5_000).optional().describe('Speaker notes')
})

export const documentPageSchema = z.object({
	page_number: z.int().min(1).describe('1-based page number'),
	text: z.string().optional().describe('Text extracted from this page when available'),
	image: artifactRefSchema.optional().describe('Rendered page image when page images were requested')
})

export const documentImageMetadataSchema = z.object({
	width: z.int().positive().optional().describe('Pixel width when available'),
	height: z.int().positive().optional().describe('Pixel height when available')
})

export const documentSectionSchema = z.object({
	heading: z.string().max(500).optional().describe('Section heading'),
	paragraphs: z.array(z.string().max(20_000)).max(50).optional().describe('Body paragraphs')
})

export const documentPdfPageImagesSchema = z.object({
	page_numbers: z
		.array(z.int().min(1))
		.min(1)
		.max(MAX_PDF_PAGE_IMAGES)
		.describe('Specific 1-based PDF pages to render as images'),
	output_key_prefix: z.string().min(1).describe('Object-key prefix for rendered page images'),
	scale: z.number().min(0.5).max(4).optional().describe('Render scale; defaults to 1.5')
})

export const documentReadInputSchema = z.object({
	source: documentSourceSchema.describe('Document to read'),
	format: documentFormatSchema.optional().describe('Format override when filename/media_type is missing'),
	pdf_page_images: documentPdfPageImagesSchema
		.optional()
		.describe('Optional PDF pages to render for visual reasoning; valid only for PDF documents')
})

export const documentReadOutputSchema = z.object({
	format: documentFormatSchema,
	text: z.string().optional().describe('Extracted plain text when available'),
	html: z.string().optional().describe('HTML when available (e.g. from docx)'),
	tables: z.array(documentTableSchema).optional().describe('Spreadsheet / tabular data'),
	slides: z.array(documentSlideSchema).optional().describe('Presentation slides when structured'),
	page_count: z.int().nonnegative().optional().describe('Page count when available'),
	pages: z.array(documentPageSchema).optional().describe('Per-page text and requested page images'),
	image: documentImageMetadataSchema.optional().describe('Image dimensions when available'),
	filename: z.string().optional(),
	media_type: z.string().optional(),
	byte_length: z.int().nonnegative().optional()
})

export const documentBuildTextInputSchema = z.object({
	format: z.enum(['txt', 'md', 'json', 'csv', 'html']).describe('Text output format'),
	content: z.string().min(1).max(MAX_INLINE_CHARS).describe('Utf8 content to write'),
	output_key: z.string().min(1).describe('Object key for the written artifact'),
	filename: z.string().min(1).optional().describe('Display filename on the ArtifactRef')
})

export const documentBuildOutputSchema = z.object({
	result: artifactRefSchema
})

export const documentBuildSpreadsheetInputSchema = z.object({
	sheets: z.array(documentTableSchema).min(1).max(MAX_SHEETS).describe('Worksheets to create'),
	output_key: z.string().min(1).describe('Object key for the .xlsx artifact'),
	filename: z.string().min(1).optional().describe('Display filename (defaults to workbook.xlsx)')
})

export const documentBuildDocumentInputSchema = z.object({
	title: z.string().max(500).optional().describe('Document title'),
	sections: z.array(documentSectionSchema).min(1).max(MAX_SECTIONS).describe('Document sections'),
	output_key: z.string().min(1).describe('Object key for the .docx artifact'),
	filename: z.string().min(1).optional().describe('Display filename (defaults to document.docx)')
})

export const documentBuildPresentationInputSchema = z.object({
	title: z.string().max(500).optional().describe('Presentation title metadata'),
	slides: z.array(documentSlideSchema).min(1).max(MAX_SLIDES).describe('Slides to create'),
	output_key: z.string().min(1).describe('Object key for the .pptx artifact'),
	filename: z.string().min(1).optional().describe('Display filename (defaults to deck.pptx)')
})

export const documentTextReplacementSchema = z.object({
	find: z.string().min(1).max(20_000).describe('Exact existing text to find'),
	replace: z.string().max(20_000).describe('Replacement text'),
	match: z.enum(['first', 'all']).describe('Replace the first match or every match')
})

export const documentPresentationReplacementSchema = documentTextReplacementSchema.omit({ match: true })

export const documentEditTextInputSchema = z.object({
	source: documentSourceSchema.describe('Existing txt, md, json, or html document'),
	format: z.enum(['txt', 'md', 'json', 'html']).optional().describe('Format override when it cannot be detected'),
	replacements: z
		.array(documentTextReplacementSchema)
		.min(1)
		.max(MAX_REPLACEMENTS)
		.describe('Ordered exact-text replacements'),
	output_key: z.string().min(1).describe('Object key for the written document'),
	filename: z.string().min(1).optional().describe('Display filename')
})

export const documentEditDocumentInputSchema = z.object({
	source: documentSourceSchema.describe('Existing docx document'),
	replacements: z
		.array(documentTextReplacementSchema)
		.min(1)
		.max(MAX_REPLACEMENTS)
		.describe('Ordered layout-preserving text replacements'),
	output_key: z.string().min(1).describe('Object key for the written docx document'),
	filename: z.string().min(1).optional().describe('Display filename')
})

export const documentEditPresentationInputSchema = z.object({
	source: documentSourceSchema.describe('Existing pptx presentation'),
	replacements: z
		.array(documentPresentationReplacementSchema)
		.min(1)
		.max(MAX_REPLACEMENTS)
		.describe('Layout-preserving global text replacements'),
	output_key: z.string().min(1).describe('Object key for the written pptx presentation'),
	filename: z.string().min(1).optional().describe('Display filename')
})

export const documentEditSpreadsheetInputSchema = z.object({
	source: documentSourceSchema.describe('Existing spreadsheet (xlsx or csv)'),
	patches: z
		.array(
			z.object({
				sheet: z.string().min(1).optional().describe('Sheet name (default first sheet)'),
				row: z.int().min(1).describe('1-based row index'),
				col: z.int().min(1).describe('1-based column index'),
				value: z.union([z.string(), z.number(), z.boolean(), z.null()]).describe('New cell value')
			})
		)
		.min(1)
		.max(2_000)
		.describe('Cell updates to apply'),
	output_key: z.string().min(1).describe('Object key for the written spreadsheet'),
	filename: z.string().min(1).optional().describe('Display filename')
})

export type DocumentReadInput = z.infer<typeof documentReadInputSchema>
export type DocumentReadOutput = z.infer<typeof documentReadOutputSchema>
export type DocumentBuildTextInput = z.infer<typeof documentBuildTextInputSchema>
export type DocumentBuildSpreadsheetInput = z.infer<typeof documentBuildSpreadsheetInputSchema>
export type DocumentBuildDocumentInput = z.infer<typeof documentBuildDocumentInputSchema>
export type DocumentBuildPresentationInput = z.infer<typeof documentBuildPresentationInputSchema>
export type DocumentEditTextInput = z.infer<typeof documentEditTextInputSchema>
export type DocumentEditDocumentInput = z.infer<typeof documentEditDocumentInputSchema>
export type DocumentEditPresentationInput = z.infer<typeof documentEditPresentationInputSchema>
export type DocumentEditSpreadsheetInput = z.infer<typeof documentEditSpreadsheetInputSchema>
export type DocumentTable = z.infer<typeof documentTableSchema>
export type DocumentSlide = z.infer<typeof documentSlideSchema>
export type DocumentSection = z.infer<typeof documentSectionSchema>
export type DocumentPage = z.infer<typeof documentPageSchema>
export type DocumentTextReplacement = z.infer<typeof documentTextReplacementSchema>
export type DocumentPresentationReplacement = z.infer<typeof documentPresentationReplacementSchema>
