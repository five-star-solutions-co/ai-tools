/**
 * RAG seam contracts — ingest + retrieve over host-bound embed + vector-store.
 */

import { z } from 'zod'

import { vectorMetadataSchema } from '../../vendors/_vector'
import {
	mastraVectorSeamAuthSchema,
	pineconeVectorAuthSchema,
	qdrantVectorAuthSchema,
	supabaseVectorSeamAuthSchema
} from '../vector-store/contracts'

export const DEFAULT_CHUNK_MAX_CHARS = 1200
export const DEFAULT_CHUNK_OVERLAP = 200
export const MAX_CHUNK_MAX_CHARS = 8000
export const MAX_INGEST_CHARS = 500_000
export const MAX_EMBED_BATCH = 32

export const embedAuthSchema = z.object({
	base_url: z
		.string()
		.url()
		.describe(
			'OpenAI-compatible embeddings origin, for example https://api.openai.com/v1 or https://openrouter.ai/api/v1'
		),
	api_key: z.string().min(1).optional().describe('Optional Bearer token for the embed route'),
	model: z.string().min(1).describe('Embedding model id'),
	path: z.string().min(1).optional().describe('Embeddings path relative to base_url (default /embeddings)'),
	dimensions: z.number().int().positive().optional().describe('Optional dimensions when the embed API supports it')
})

export const ragChunkOptionsSchema = z.object({
	max_chars: z
		.number()
		.int()
		.min(200)
		.max(MAX_CHUNK_MAX_CHARS)
		.optional()
		.describe(`Chunk size in characters (default ${DEFAULT_CHUNK_MAX_CHARS})`),
	overlap: z
		.number()
		.int()
		.min(0)
		.max(2000)
		.optional()
		.describe(`Overlap in characters between chunks (default ${DEFAULT_CHUNK_OVERLAP})`)
})

export const ragAuthSchema = z.object({
	vector_store: z.discriminatedUnion('provider', [
		qdrantVectorAuthSchema,
		pineconeVectorAuthSchema,
		supabaseVectorSeamAuthSchema,
		mastraVectorSeamAuthSchema
	]),
	embed: embedAuthSchema,
	default_collection: z
		.string()
		.min(1)
		.optional()
		.describe('Default collection / index when tool input omits collection'),
	chunk: ragChunkOptionsSchema.optional().describe('Default chunking options for ingest')
})

export const ragIngestInputSchema = z.object({
	document_id: z.string().min(1).describe('Stable document id used as the chunk id prefix'),
	text: z
		.string()
		.min(1)
		.max(MAX_INGEST_CHARS)
		.describe(`Document text to chunk, embed, and store (max ${MAX_INGEST_CHARS} characters)`),
	metadata: vectorMetadataSchema.optional().describe('Metadata copied onto every chunk'),
	collection: z.string().min(1).optional().describe('Collection / index override'),
	namespace: z.string().min(1).optional().describe('Optional vector namespace when the bound store supports it'),
	chunk: ragChunkOptionsSchema.optional().describe('Per-call chunking override')
})

export const ragIngestOutputSchema = z.object({
	document_id: z.string(),
	chunk_count: z.number().int().nonnegative(),
	chunk_ids: z.array(z.string()).describe('Vector ids written for this document'),
	collection: z.string().optional()
})

export const ragRetrieveInputSchema = z.object({
	query: z.string().min(1).describe('Natural-language query to embed and search'),
	top_k: z.number().int().min(1).max(100).optional().describe('Number of chunks to return (default 8)'),
	collection: z.string().min(1).optional().describe('Collection / index override'),
	namespace: z.string().min(1).optional().describe('Optional vector namespace when the bound store supports it'),
	filter: z.record(z.string(), z.unknown()).optional().describe('Optional store-native metadata filter')
})

export const ragRetrievedChunkSchema = z.object({
	id: z.string(),
	score: z.number(),
	text: z.string().optional().describe('Chunk text when stored in metadata'),
	document_id: z.string().optional(),
	chunk_index: z.number().int().optional(),
	metadata: vectorMetadataSchema.optional()
})

export const ragRetrieveOutputSchema = z.object({
	matches: z.array(ragRetrievedChunkSchema),
	collection: z.string().optional()
})

export const ragDeleteInputSchema = z.object({
	chunk_ids: z
		.array(z.string().min(1))
		.min(1)
		.max(100)
		.describe('Chunk / vector ids to delete (from a prior rag-ingest)'),
	collection: z.string().min(1).optional().describe('Collection / index override'),
	namespace: z.string().min(1).optional().describe('Optional vector namespace when the bound store supports it')
})

export const ragDeleteOutputSchema = z.object({
	deleted: z.number().int().nonnegative(),
	collection: z.string().optional()
})

export type EmbedAuth = z.infer<typeof embedAuthSchema>
export type RagAuth = z.infer<typeof ragAuthSchema>
export type RagIngestInput = z.infer<typeof ragIngestInputSchema>
export type RagIngestOutput = z.infer<typeof ragIngestOutputSchema>
export type RagRetrieveInput = z.infer<typeof ragRetrieveInputSchema>
export type RagRetrieveOutput = z.infer<typeof ragRetrieveOutputSchema>
export type RagDeleteInput = z.infer<typeof ragDeleteInputSchema>
export type RagDeleteOutput = z.infer<typeof ragDeleteOutputSchema>
