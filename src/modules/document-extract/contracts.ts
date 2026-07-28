import { z } from 'zod'

import {
	MAX_BATCH_EXTRACT,
	MAX_INLINE_EXTRACT_CHARS,
	textractAuthSchema,
	textractExtractResultSchema,
	textractExtractTextBatchInputSchema,
	textractExtractTextBatchOutputSchema,
	textractExtractTextInputSchema,
	textractOutputModeSchema,
	textractStatusInputSchema,
	textractTextChunkSchema
} from '../../vendors/textract'
import type {
	TextractExtractResult,
	TextractExtractTextBatchInput,
	TextractExtractTextBatchOutput,
	TextractExtractTextInput,
	TextractOutputMode,
	TextractStatusInput,
	TextractTextChunk
} from '../../vendors/textract'

export { MAX_BATCH_EXTRACT, MAX_INLINE_EXTRACT_CHARS }

/** Host auth: vendor credentials + provider discriminator. */
export const textractDocumentExtractAuthSchema = textractAuthSchema.extend({
	provider: z.literal('textract')
})

export type TextractDocumentExtractAuth = z.infer<typeof textractDocumentExtractAuthSchema>

export const documentExtractAuthSchema = z.discriminatedUnion('provider', [textractDocumentExtractAuthSchema])

export type DocumentExtractAuth = z.infer<typeof documentExtractAuthSchema>

/** Capability I/O — re-export Textract shapes under seam names (vendor owns presentation). */
export const extractOutputModeSchema = textractOutputModeSchema
export type ExtractOutputMode = TextractOutputMode

export const extractTextChunkSchema = textractTextChunkSchema
export type ExtractTextChunk = TextractTextChunk

export const extractResultSchema = textractExtractResultSchema
export const extractTextInputSchema = textractExtractTextInputSchema
export const extractTextBatchInputSchema = textractExtractTextBatchInputSchema
export const statusInputSchema = textractStatusInputSchema
export const extractTextBatchOutputSchema = textractExtractTextBatchOutputSchema

export type ExtractResult = TextractExtractResult
export type ExtractTextInput = TextractExtractTextInput
export type ExtractTextBatchInput = TextractExtractTextBatchInput
export type StatusInput = TextractStatusInput
export type ExtractTextBatchOutput = TextractExtractTextBatchOutput

/** Provider + public client surface (same ops; vendor does the work). */
export type DocumentExtractOps = {
	extractText: (input: ExtractTextInput) => Promise<ExtractResult>
	getStatus: (input: StatusInput) => Promise<ExtractResult>
	extractTextBatch: (input: ExtractTextBatchInput) => Promise<ExtractTextBatchOutput>
}
