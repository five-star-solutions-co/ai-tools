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
		'Chunk text with the requested overlap, create embeddings, and store the vectors for later semantic retrieval. Returns chunk ids for deletion and preserves chunk text in metadata.',
	inputSchema: ragIngestInputSchema,
	outputSchema: ragIngestOutputSchema,
	sideEffect: 'write',
	runtime: 'node',
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
	runtime: 'node',
	execute: async (input, ctx) => RagClient.fromContext(ctx).retrieve(input)
})

export const ragDeleteTool = defineTool({
	id: 'rag-delete',
	name: 'ragDelete',
	description: 'Delete previously ingested chunk vectors by id (from rag-ingest chunk_ids).',
	inputSchema: ragDeleteInputSchema,
	outputSchema: ragDeleteOutputSchema,
	sideEffect: 'delete',
	runtime: 'node',
	execute: async (input, ctx) => RagClient.fromContext(ctx).delete(input)
})

export const ragModule = defineModule({
	id: 'rag',
	title: 'RAG',
	description:
		'Ingest text by chunking, embedding, and storing it; retrieve related chunks for a natural-language query; or delete previously ingested chunks. Use for semantic retrieval, not ordinary file reading.',
	runtime: 'node',
	auth: { type: 'custom', schema: ragAuthSchema },
	tools: [ragIngestTool, ragRetrieveTool, ragDeleteTool]
})
