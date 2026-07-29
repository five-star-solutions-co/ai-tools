import { defineModule, defineTool } from '../../core/define'
import { SupabaseVectorClient } from './client'
import {
	deleteVectorsInputSchema,
	deleteVectorsOutputSchema,
	queryVectorsInputSchema,
	queryVectorsOutputSchema,
	supabaseVectorAuthSchema,
	upsertVectorsInputSchema,
	upsertVectorsOutputSchema
} from './contracts'

export const supabaseVectorUpsertTool = defineTool({
	id: 'supabase-vector-upsert',
	name: 'supabaseVectorUpsert',
	description:
		'Upsert embedding vectors into the configured Supabase pgvector table. Provide stable ids, vector values, and optional flat metadata.',
	inputSchema: upsertVectorsInputSchema,
	outputSchema: upsertVectorsOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => SupabaseVectorClient.fromContext(ctx).upsert(input)
})

export const supabaseVectorQueryTool = defineTool({
	id: 'supabase-vector-query',
	name: 'supabaseVectorQuery',
	description:
		'Run a nearest-neighbor query against the configured Supabase pgvector table. Returns the closest rows up to the requested top_k and optional score threshold.',
	inputSchema: queryVectorsInputSchema,
	outputSchema: queryVectorsOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => SupabaseVectorClient.fromContext(ctx).query(input)
})

export const supabaseVectorDeleteTool = defineTool({
	id: 'supabase-vector-delete',
	name: 'supabaseVectorDelete',
	description: 'Delete embedding vectors by id from the configured Supabase pgvector table.',
	inputSchema: deleteVectorsInputSchema,
	outputSchema: deleteVectorsOutputSchema,
	sideEffect: 'delete',
	runtime: 'both',
	execute: async (input, ctx) => SupabaseVectorClient.fromContext(ctx).delete(input)
})

export const supabaseVectorModule = defineModule({
	id: 'supabase-vector',
	title: 'Supabase Vector',
	description: 'Supabase Postgres and pgvector tools to upsert vectors, query nearest matches, and delete vectors.',
	runtime: 'both',
	auth: { type: 'custom', schema: supabaseVectorAuthSchema },
	tools: [supabaseVectorUpsertTool, supabaseVectorQueryTool, supabaseVectorDeleteTool]
})
