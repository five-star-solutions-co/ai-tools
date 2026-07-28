/**
 * Public document-extract seam surface.
 * Internals (providers/*) stay private.
 */

export { DocumentExtractClient } from './client'
export {
	documentExtractAuthSchema,
	documentExtractModule,
	documentExtractStatusTool,
	documentExtractTextBatchTool,
	documentExtractTextTool
} from './module'
export type { DocumentExtractAuth } from './module'
export type {
	ExtractResult,
	ExtractTextBatchInput,
	ExtractTextBatchOutput,
	ExtractTextInput,
	StatusInput
} from './contracts'
export {
	extractResultSchema,
	extractTextBatchInputSchema,
	extractTextBatchOutputSchema,
	extractTextInputSchema,
	MAX_BATCH_EXTRACT,
	MAX_INLINE_EXTRACT_CHARS,
	extractOutputModeSchema,
	statusInputSchema
} from './contracts'
export type { ExtractOutputMode, ExtractTextChunk } from './contracts'
