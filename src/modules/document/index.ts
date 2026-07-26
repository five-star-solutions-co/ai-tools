/**
 * Public document plane: read / build / edit.
 */

export { DocumentClient } from './client'
export type { DocumentClientOptions } from './client'
export {
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
	documentFormatSchema,
	documentImageMetadataSchema,
	documentPageSchema,
	documentPdfPageImagesSchema,
	documentPresentationReplacementSchema,
	documentReadInputSchema,
	documentReadOutputSchema,
	documentSectionSchema,
	documentSlideSchema,
	documentSourceSchema,
	documentTableSchema,
	documentTextReplacementSchema,
	MAX_INLINE_CHARS,
	MAX_PDF_PAGE_IMAGES,
	MAX_REPLACEMENTS,
	MAX_SECTIONS,
	MAX_SHEET_ROWS,
	MAX_SHEETS,
	MAX_SLIDES
} from './contracts'
export type {
	DocumentAuth,
	DocumentBuildDocumentInput,
	DocumentBuildPresentationInput,
	DocumentBuildSpreadsheetInput,
	DocumentBuildTextInput,
	DocumentEditDocumentInput,
	DocumentEditPresentationInput,
	DocumentEditSpreadsheetInput,
	DocumentEditTextInput,
	DocumentFormat,
	DocumentPage,
	DocumentPresentationReplacement,
	DocumentReadInput,
	DocumentReadOutput,
	DocumentSection,
	DocumentSlide,
	DocumentTable,
	DocumentTextReplacement
} from './contracts'
export {
	documentBuildDocumentTool,
	documentBuildPresentationTool,
	documentBuildSpreadsheetTool,
	documentBuildTextTool,
	documentEditDocumentTool,
	documentEditPresentationTool,
	documentEditSpreadsheetTool,
	documentEditTextTool,
	documentModule,
	documentReadTool
} from './module'
