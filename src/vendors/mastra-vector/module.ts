import { defineModule, defineTool } from '../../core/define'
import { MastraVectorClient } from './client'
import {
	deleteVectorsInputSchema,
	deleteVectorsOutputSchema,
	mastraVectorAuthSchema,
	queryVectorsInputSchema,
	queryVectorsOutputSchema,
	upsertVectorsInputSchema,
	upsertVectorsOutputSchema
} from './contracts'

export const mastraVectorUpsertTool = defineTool({
	id: 'mastra-vector-upsert',
	name: 'mastraVectorUpsert',
	description: 'Upsert vectors into a Mastra PgVector index. collection maps to indexName.',
	inputSchema: upsertVectorsInputSchema,
	outputSchema: upsertVectorsOutputSchema,
	sideEffect: 'write',
	runtime: 'node',
	execute: async (input, ctx) => MastraVectorClient.fromContext(ctx).upsert(input)
})

export const mastraVectorQueryTool = defineTool({
	id: 'mastra-vector-query',
	name: 'mastraVectorQuery',
	description: 'Nearest-neighbor query against a Mastra PgVector index.',
	inputSchema: queryVectorsInputSchema,
	outputSchema: queryVectorsOutputSchema,
	sideEffect: 'read',
	runtime: 'node',
	execute: async (input, ctx) => MastraVectorClient.fromContext(ctx).query(input)
})

export const mastraVectorDeleteTool = defineTool({
	id: 'mastra-vector-delete',
	name: 'mastraVectorDelete',
	description: 'Delete vectors by id from a Mastra PgVector index.',
	inputSchema: deleteVectorsInputSchema,
	outputSchema: deleteVectorsOutputSchema,
	sideEffect: 'delete',
	runtime: 'node',
	execute: async (input, ctx) => MastraVectorClient.fromContext(ctx).delete(input)
})

export const mastraVectorModule = defineModule({
	id: 'mastra-vector',
	title: 'Mastra Vector',
	description:
		'Mastra PgVector over Postgres: upsert, query, and delete vectors. Index names map from collection. Node runtime.',
	runtime: 'node',
	auth: { type: 'custom', schema: mastraVectorAuthSchema },
	categories: ['ai', 'vector'],
	classification: 'pii',
	tags: ['pgvector', 'mastra'],
	tools: [mastraVectorUpsertTool, mastraVectorQueryTool, mastraVectorDeleteTool]
})
