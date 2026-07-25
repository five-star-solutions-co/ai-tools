import { defineModule, defineTool } from '../../core/define'
import { RagClient } from './client'
import {
	ragAuthSchema,
	ragDeleteInputSchema,
	ragDeleteOutputSchema,
	ragIngestInputSchema,
	ragIngestOutputSchema,
	ragRetrieveInputSchema,
	ragRetrieveOutputSchema
} from './contracts'

export type { RagAuth } from './contracts'
export { ragAuthSchema }

export const ragIngestTool = defineTool({
	id: 'rag-ingest',
	name: 'ragIngest',
	description:
		'Chunk text, embed via the host-bound embed route, and upsert vectors. Returns chunk ids for later delete. Stores chunk text in metadata for retrieve.',
	inputSchema: ragIngestInputSchema,
	outputSchema: ragIngestOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => RagClient.fromContext(ctx).ingest(input)
})

export const ragRetrieveTool = defineTool({
	id: 'rag-retrieve',
	name: 'ragRetrieve',
	description:
		'Embed a natural-language query and retrieve nearest chunks from the bound vector store. Returns text when stored in metadata.',
	inputSchema: ragRetrieveInputSchema,
	outputSchema: ragRetrieveOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => RagClient.fromContext(ctx).retrieve(input)
})

export const ragDeleteTool = defineTool({
	id: 'rag-delete',
	name: 'ragDelete',
	description: 'Delete previously ingested chunk vectors by id (from rag-ingest chunk_ids).',
	inputSchema: ragDeleteInputSchema,
	outputSchema: ragDeleteOutputSchema,
	sideEffect: 'delete',
	runtime: 'both',
	execute: async (input, ctx) => RagClient.fromContext(ctx).delete(input)
})

export const ragModule = defineModule({
	id: 'rag',
	title: 'RAG',
	description:
		'Retrieve-augmented generation helpers: chunk, embed (host route), store, retrieve, delete. Host binds embed credentials and vector-store credentials. Does not own classification or access policy.',
	runtime: 'both',
	auth: { type: 'custom', schema: ragAuthSchema },
	tools: [ragIngestTool, ragRetrieveTool, ragDeleteTool]
})
