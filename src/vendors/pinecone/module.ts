import { defineModule, defineTool } from '../../core/define'
import { PineconeClient } from './client'
import {
	deleteVectorsInputSchema,
	deleteVectorsOutputSchema,
	pineconeAuthSchema,
	queryVectorsInputSchema,
	queryVectorsOutputSchema,
	upsertVectorsInputSchema,
	upsertVectorsOutputSchema
} from './contracts'

export const pineconeUpsertTool = defineTool({
	id: 'pinecone-upsert',
	name: 'pineconeUpsert',
	description:
		'Upsert vectors into the configured Pinecone index. Use the optional namespace only when data must be isolated within the index.',
	inputSchema: upsertVectorsInputSchema,
	outputSchema: upsertVectorsOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => PineconeClient.fromContext(ctx).upsert(input)
})

export const pineconeQueryTool = defineTool({
	id: 'pinecone-query',
	name: 'pineconeQuery',
	description: 'Nearest-neighbor query against the bound Pinecone index.',
	inputSchema: queryVectorsInputSchema,
	outputSchema: queryVectorsOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => PineconeClient.fromContext(ctx).query(input)
})

export const pineconeDeleteTool = defineTool({
	id: 'pinecone-delete',
	name: 'pineconeDelete',
	description: 'Delete vectors by id from the bound Pinecone index.',
	inputSchema: deleteVectorsInputSchema,
	outputSchema: deleteVectorsOutputSchema,
	sideEffect: 'delete',
	runtime: 'both',
	execute: async (input, ctx) => PineconeClient.fromContext(ctx).delete(input)
})

export const pineconeModule = defineModule({
	id: 'pinecone',
	title: 'Pinecone',
	description: 'Pinecone data-plane REST: upsert, query, and delete vectors in a bound index.',
	runtime: 'both',
	auth: { type: 'custom', schema: pineconeAuthSchema },
	categories: ['ai', 'vector'],
	classification: 'pii',
	tags: ['pinecone'],
	tools: [pineconeUpsertTool, pineconeQueryTool, pineconeDeleteTool]
})
