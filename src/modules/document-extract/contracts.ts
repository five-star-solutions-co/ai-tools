import { z } from 'zod'

import { artifactRefSchema } from '../../shared/artifact'
import { batchResultSchema } from '../../shared/batch'
import {
	MAX_BATCH_EXTRACT,
	textractAuthSchema,
	textractExtractTextBatchInputSchema,
	textractExtractTextInputSchema,
	textractStatusInputSchema
} from '../../vendors/textract'

export { MAX_BATCH_EXTRACT }

/** Hard cap for inline extract text returned to the model. */
export const MAX_INLINE_EXTRACT_CHARS = 100_000
export const DEFAULT_EXTRACT_CHUNK_MAX_CHARS = 1_200
export const DEFAULT_EXTRACT_CHUNK_OVERLAP = 200
export const MAX_EXTRACT_CHUNK_MAX_CHARS = 8_000

/** Host auth: vendor credentials + provider discriminator. */
export const textractDocumentExtractAuthSchema = textractAuthSchema.extend({
	provider: z.literal('textract')
})

export type TextractDocumentExtractAuth = z.infer<typeof textractDocumentExtractAuthSchema>

export const documentExtractAuthSchema = z.discriminatedUnion('provider', [textractDocumentExtractAuthSchema])

export type DocumentExtractAuth = z.infer<typeof documentExtractAuthSchema>

export const extractOutputModeSchema = z
	.enum(['inline', 'artifact', 'chunks'])
	.describe(
		'How to return extracted text: inline (default, fails if over inline limit), artifact (write to object storage), chunks (split for RAG handoff)'
	)

export type ExtractOutputMode = z.infer<typeof extractOutputModeSchema>

export const extractChunkOptionsSchema = z.object({
	max_chars: z
		.int()
		.min(200)
		.max(MAX_EXTRACT_CHUNK_MAX_CHARS)
		.optional()
		.describe(`Chunk size in characters (default ${DEFAULT_EXTRACT_CHUNK_MAX_CHARS})`),
	overlap: z
		.int()
		.min(0)
		.max(2_000)
		.optional()
		.describe(`Overlap in characters between chunks (default ${DEFAULT_EXTRACT_CHUNK_OVERLAP})`)
})

const outputModeFields = {
	output: extractOutputModeSchema.optional(),
	destination_key: z
		.string()
		.min(1)
		.optional()
		.describe('Object key for artifact mode (logical under key_prefix when set). Default extracts/{job_id}.txt'),
	chunk: extractChunkOptionsSchema.optional().describe('Chunking options when output is chunks')
}

/** Capability I/O — Textract shapes plus output presentation. */
export const extractTextChunkSchema = z.object({
	id: z.string().describe('Stable chunk id (document-scoped)'),
	index: z.number().int().nonnegative(),
	text: z.string().describe('Chunk text')
})

export type ExtractTextChunk = z.infer<typeof extractTextChunkSchema>

export const extractResultSchema = z.object({
	status: z.enum(['succeeded', 'pending', 'failed']).describe('Job status'),
	job_id: z.string().optional().describe('Provider job id when started or polled'),
	text: z.string().optional().describe('Extracted text when status is succeeded and output is inline'),
	page_count: z.int().optional().describe('Document page count when known'),
	error: z.string().optional().describe('Failure message when status is failed'),
	source: artifactRefSchema.optional().describe('Source ArtifactRef when known'),
	output: extractOutputModeSchema.optional().describe('Presentation mode used for this result'),
	artifact: artifactRefSchema
		.optional()
		.describe('Object-store ArtifactRef when output is artifact and status is succeeded'),
	chunks: z
		.array(extractTextChunkSchema)
		.optional()
		.describe('Text chunks when output is chunks and status is succeeded')
})

export const extractTextInputSchema = textractExtractTextInputSchema.extend(outputModeFields)

export const extractTextBatchInputSchema = textractExtractTextBatchInputSchema.extend({
	...outputModeFields,
	destination_key_prefix: z
		.string()
		.min(1)
		.optional()
		.describe('Prefix for per-item artifact keys in batch artifact mode (default extracts/)')
})

export const statusInputSchema = textractStatusInputSchema.extend(outputModeFields)

export const extractTextBatchOutputSchema = batchResultSchema(extractResultSchema)

export type ExtractResult = z.infer<typeof extractResultSchema>
export type ExtractTextInput = z.infer<typeof extractTextInputSchema>
export type ExtractTextBatchInput = z.infer<typeof extractTextBatchInputSchema>
export type StatusInput = z.infer<typeof statusInputSchema>
export type ExtractTextBatchOutput = z.infer<typeof extractTextBatchOutputSchema>

/** Provider ops stay raw (always return full text when succeeded). */
export type DocumentExtractProviderOps = {
	extractText: (input: { source: ExtractTextInput['source'] }) => Promise<ExtractResult>
	getStatus: (input: { job_id: string }) => Promise<ExtractResult>
	extractTextBatch: (input: { sources: ExtractTextBatchInput['sources'] }) => Promise<ExtractTextBatchOutput>
}

/** Public client surface (includes presentation). */
export type DocumentExtractOps = {
	extractText: (input: ExtractTextInput) => Promise<ExtractResult>
	getStatus: (input: StatusInput) => Promise<ExtractResult>
	extractTextBatch: (input: ExtractTextBatchInput) => Promise<ExtractTextBatchOutput>
}
