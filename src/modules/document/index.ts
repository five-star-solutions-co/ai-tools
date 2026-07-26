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
	documentEditSpreadsheetInputSchema,
	documentFormatSchema,
	documentReadInputSchema,
	documentReadOutputSchema,
	documentSectionSchema,
	documentSlideSchema,
	documentSourceSchema,
	documentTableSchema,
	MAX_INLINE_CHARS,
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
	DocumentEditSpreadsheetInput,
	DocumentFormat,
	DocumentReadInput,
	DocumentReadOutput,
	DocumentSection,
	DocumentSlide,
	DocumentTable
} from './contracts'
export {
	documentBuildDocumentTool,
	documentBuildPresentationTool,
	documentBuildSpreadsheetTool,
	documentBuildTextTool,
	documentEditSpreadsheetTool,
	documentModule,
	documentReadTool
} from './module'
