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
 * Mastra PgVector auth (`@mastra/pg`).
 * Host owns Postgres connection + schema; package does not invent org policy.
 */
export const mastraVectorAuthSchema = z.object({
	connection_string: z
		.string()
		.min(1)
		.describe('Postgres connection string for Mastra PgVector (e.g. Supabase DB URL)'),
	id: z.string().min(1).describe('Mastra vector store id (stable string for this store instance)'),
	schema_name: z
		.string()
		.min(1)
		.optional()
		.describe('Postgres schema for vector tables (e.g. agent); omit for package default'),
	default_index: z.string().min(1).optional().describe('Default index name when tool input omits collection'),
	dimension: z
		.number()
		.int()
		.positive()
		.optional()
		.describe('Embedding dimension; required when auto_create_index is true'),
	auto_create_index: z
		.boolean()
		.optional()
		.describe('When true, create the index on upsert if missing (needs dimension)'),
	disable_init: z.boolean().optional().describe('Pass disableInit to PgVector (host manages migration/init)'),
	default_filter: vectorDefaultFilterSchema
		.optional()
		.describe(
			'Host-bound metadata filter always applied on query (Mongo-style / Mastra PG filter); flat keys stamped on upsert'
		)
})

export type MastraVectorAuth = z.infer<typeof mastraVectorAuthSchema>
