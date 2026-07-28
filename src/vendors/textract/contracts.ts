import { z } from 'zod'

import { artifactRefSchema } from '../../shared/artifact'
import { batchResultSchema } from '../../shared/batch'

export const MAX_BATCH_EXTRACT = 10
export const DEFAULT_POLL_TIMEOUT_MS = 60_000
export const DEFAULT_POLL_INTERVAL_MS = 2_000
export const MAX_POLL_TIMEOUT_MS = 900_000
export const MAX_POLL_INTERVAL_MS = 30_000

/** Hard cap for inline extract text returned to the model. */
export const MAX_INLINE_EXTRACT_CHARS = 100_000
export const DEFAULT_EXTRACT_CHUNK_MAX_CHARS = 1_200
export const DEFAULT_EXTRACT_CHUNK_OVERLAP = 200
export const MAX_EXTRACT_CHUNK_MAX_CHARS = 8_000

export const textractAuthSchema = z.object({
	access_key_id: z.string().min(1).describe('AWS access key id'),
	secret_access_key: z.string().min(1).describe('AWS secret access key'),
	region: z.string().min(1).describe('AWS region for Textract and the source S3 bucket'),
	bucket: z.string().min(1).describe('AWS S3 bucket containing source documents'),
	session_token: z.string().min(1).optional().describe('Optional session token'),
	key_prefix: z
		.string()
		.min(1)
		.optional()
		.describe(
			'Optional object-key root matching the bound S3 storage (no leading slash). ArtifactRef.key is logical; DocumentLocation uses the wire key under this prefix.'
		),
	poll_timeout_ms: z
		.int()
		.min(1_000)
		.max(MAX_POLL_TIMEOUT_MS)
		.optional()
		.describe('Max time to wait for Textract before returning pending plus job_id (default 60000)'),
	poll_interval_ms: z
		.int()
		.min(200)
		.max(MAX_POLL_INTERVAL_MS)
		.optional()
		.describe('Delay between GetDocumentTextDetection polls (default 2000)')
})

export type TextractAuth = z.infer<typeof textractAuthSchema>

export const textractOutputModeSchema = z
	.enum(['inline', 'artifact', 'chunks'])
	.describe(
		'How to return extracted text: inline (default, fails if over inline limit), artifact (write to object storage), chunks (split for RAG handoff)'
	)

export type TextractOutputMode = z.infer<typeof textractOutputModeSchema>

export const textractChunkOptionsSchema = z.object({
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

export const textractTextChunkSchema = z.object({
	id: z.string().describe('Stable chunk id (document-scoped)'),
	index: z.number().int().nonnegative(),
	text: z.string().describe('Chunk text')
})

export type TextractTextChunk = z.infer<typeof textractTextChunkSchema>

const outputModeFields = {
	output: textractOutputModeSchema.optional(),
	destination_key: z
		.string()
		.min(1)
		.optional()
		.describe('Object key for artifact mode (logical under key_prefix when set). Default extracts/{job_id}.txt'),
	chunk: textractChunkOptionsSchema.optional().describe('Chunking options when output is chunks')
}

export const textractExtractResultSchema = z.object({
	status: z.enum(['succeeded', 'pending', 'failed']).describe('Job status'),
	job_id: z.string().optional().describe('Textract job id when started or polled'),
	text: z.string().optional().describe('Extracted LINE text when succeeded and output is inline'),
	page_count: z.int().optional().describe('Document page count when known'),
	error: z.string().optional().describe('Failure message when status is failed'),
	source: artifactRefSchema.optional().describe('Source ArtifactRef when known'),
	output: textractOutputModeSchema.optional().describe('Presentation mode used for this result'),
	artifact: artifactRefSchema
		.optional()
		.describe('Object-store ArtifactRef when output is artifact and status is succeeded'),
	chunks: z
		.array(textractTextChunkSchema)
		.optional()
		.describe('Text chunks when output is chunks and status is succeeded')
})

export const textractExtractTextInputSchema = z.object({
	source: artifactRefSchema.describe('Document ArtifactRef in object storage (store must be object)'),
	...outputModeFields
})

export const textractExtractTextBatchInputSchema = z.object({
	sources: z
		.array(artifactRefSchema)
		.min(1)
		.max(MAX_BATCH_EXTRACT)
		.describe('Document ArtifactRefs to extract (max 10)'),
	...outputModeFields,
	destination_key_prefix: z
		.string()
		.min(1)
		.optional()
		.describe('Prefix for per-item artifact keys in batch artifact mode (default extracts/)')
})

export const textractStatusInputSchema = z.object({
	job_id: z.string().min(1).describe('Job id from a prior extract call'),
	...outputModeFields
})

export const textractExtractTextBatchOutputSchema = batchResultSchema(textractExtractResultSchema)

export type TextractExtractResult = z.infer<typeof textractExtractResultSchema>
export type TextractExtractTextInput = z.infer<typeof textractExtractTextInputSchema>
export type TextractExtractTextBatchInput = z.infer<typeof textractExtractTextBatchInputSchema>
export type TextractStatusInput = z.infer<typeof textractStatusInputSchema>
export type TextractExtractTextBatchOutput = z.infer<typeof textractExtractTextBatchOutputSchema>
