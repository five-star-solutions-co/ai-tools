import { z } from 'zod'

import { vectorDefaultFilterSchema } from '../_vector'

export {
	MAX_TOP_K,
	MAX_VECTOR_BATCH,
	MAX_VECTOR_DIMENSIONS,
	deleteVectorsInputSchema,
	deleteVectorsOutputSchema,
	queryVectorsInputSchema,
	queryVectorsOutputSchema,
	upsertVectorsInputSchema,
	upsertVectorsOutputSchema,
	vectorMatchSchema,
	vectorMetadataSchema,
	vectorPointSchema
} from '../_vector'
export type {
	DeleteVectorsInput,
	DeleteVectorsOutput,
	QueryVectorsInput,
	QueryVectorsOutput,
	UpsertVectorsInput,
	UpsertVectorsOutput,
	VectorMatch,
	VectorMetadata,
	VectorPoint
} from '../_vector'

/**
 * Supabase Postgres + pgvector over PostgREST.
 * Host owns table + match RPC (see docs/vendors/supabase-vector.md).
 */
export const supabaseVectorAuthSchema = z.object({
	url: z.string().url().describe('Supabase project URL, for example https://xxxx.supabase.co'),
	api_key: z
		.string()
		.min(1)
		.describe('Supabase API key with table/RPC grants (typically service_role for server-side tools)'),
	default_collection: z
		.string()
		.min(1)
		.optional()
		.describe('Default PostgREST table name when tool input omits collection'),
	schema: z
		.string()
		.min(1)
		.optional()
		.describe('Postgres schema for PostgREST (default public; sets Content/Accept-Profile)'),
	id_column: z.string().min(1).optional().describe('Id column name (default id)'),
	embedding_column: z.string().min(1).optional().describe('Embedding/vector column name (default embedding)'),
	metadata_column: z.string().min(1).optional().describe('Metadata jsonb column name (default metadata)'),
	match_rpc: z.string().min(1).optional().describe('Nearest-neighbor RPC name (default match_vectors)'),
	default_filter: vectorDefaultFilterSchema
		.optional()
		.describe('Host-bound filter always applied on match RPC; flat keys stamped on upsert metadata')
})

export type SupabaseVectorAuth = z.infer<typeof supabaseVectorAuthSchema>
