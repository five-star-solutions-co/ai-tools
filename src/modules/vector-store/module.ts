import { defineModule, defineTool } from '../../core/define'
import { VectorStoreClient } from './client'
import {
	deleteVectorsInputSchema,
	deleteVectorsOutputSchema,
	queryVectorsInputSchema,
	queryVectorsOutputSchema,
	upsertVectorsInputSchema,
	upsertVectorsOutputSchema,
	vectorStoreAuthSchema
} from './contracts'

export type { VectorStoreAuth } from './contracts'
export { vectorStoreAuthSchema }

export const vectorStoreUpsertTool = defineTool({
	id: 'vector-store-upsert',
	name: 'upsertVectors',
	description:
		'Upsert embedding vectors into the bound vector store. Provide stable ids, values, and optional flat metadata. Specify collection only when no default collection is configured.',
	inputSchema: upsertVectorsInputSchema,
	outputSchema: upsertVectorsOutputSchema,
	sideEffect: 'write',
	runtime: 'node',
	execute: async (input, ctx) => VectorStoreClient.fromContext(ctx).upsert(input)
})

export const vectorStoreQueryTool = defineTool({
	id: 'vector-store-query',
	name: 'queryVectors',
	description:
		'Nearest-neighbor query against the bound vector store. Returns matches with scores and optional metadata/values.',
	inputSchema: queryVectorsInputSchema,
	outputSchema: queryVectorsOutputSchema,
	sideEffect: 'read',
	runtime: 'node',
	execute: async (input, ctx) => VectorStoreClient.fromContext(ctx).query(input)
})

export const vectorStoreDeleteTool = defineTool({
	id: 'vector-store-delete',
	name: 'deleteVectors',
	description: 'Delete vectors by id from the bound vector store.',
	inputSchema: deleteVectorsInputSchema,
	outputSchema: deleteVectorsOutputSchema,
	sideEffect: 'delete',
	runtime: 'node',
	execute: async (input, ctx) => VectorStoreClient.fromContext(ctx).delete(input)
})

export const vectorStoreModule = defineModule({
	id: 'vector-store',
	title: 'Vector Store',
	description:
		'Upsert, query, and delete embedding vectors in the configured store. Use for vector operations, not text embedding or document chunking.',
	runtime: 'node',
	auth: { type: 'custom', schema: vectorStoreAuthSchema },
	tools: [vectorStoreUpsertTool, vectorStoreQueryTool, vectorStoreDeleteTool]
})
