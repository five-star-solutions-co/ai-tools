import { defineModule, defineTool } from '../../core/define'
import { QdrantClient } from './client'
import {
	deleteVectorsInputSchema,
	deleteVectorsOutputSchema,
	qdrantAuthSchema,
	queryVectorsInputSchema,
	queryVectorsOutputSchema,
	upsertVectorsInputSchema,
	upsertVectorsOutputSchema
} from './contracts'

export const qdrantUpsertTool = defineTool({
	id: 'qdrant-upsert',
	name: 'qdrantUpsert',
	description: 'Upsert points into a Qdrant collection. Omit collection only when a default collection is configured.',
	inputSchema: upsertVectorsInputSchema,
	outputSchema: upsertVectorsOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => QdrantClient.fromContext(ctx).upsert(input)
})

export const qdrantQueryTool = defineTool({
	id: 'qdrant-query',
	name: 'qdrantQuery',
	description: 'Nearest-neighbor search in a Qdrant collection.',
	inputSchema: queryVectorsInputSchema,
	outputSchema: queryVectorsOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => QdrantClient.fromContext(ctx).query(input)
})

export const qdrantDeleteTool = defineTool({
	id: 'qdrant-delete',
	name: 'qdrantDelete',
	description: 'Delete points by id from a Qdrant collection.',
	inputSchema: deleteVectorsInputSchema,
	outputSchema: deleteVectorsOutputSchema,
	sideEffect: 'delete',
	runtime: 'both',
	execute: async (input, ctx) => QdrantClient.fromContext(ctx).delete(input)
})

export const qdrantModule = defineModule({
	id: 'qdrant',
	title: 'Qdrant',
	description: 'Qdrant vector database REST: upsert, query, and delete points in a collection.',
	runtime: 'both',
	auth: { type: 'custom', schema: qdrantAuthSchema },
	categories: ['ai', 'vector'],
	classification: 'pii',
	tags: ['qdrant'],
	tools: [qdrantUpsertTool, qdrantQueryTool, qdrantDeleteTool]
})
