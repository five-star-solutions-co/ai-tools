/**
 * Live RAG: embed (OpenAI-compatible) + each configured vector backend.
 */

import { describe, expect, test } from 'bun:test'

import { RagClient } from '../../../src/modules/rag'
import type { RagAuth } from '../../../src/modules/rag'
import { assertLocalUrl, ensureQdrantCollection, env, sleep, uniqueId } from '../helpers'

const embedBase = env('AI_TOOLS_EMBED_BASE_URL')
const embedKey = env('AI_TOOLS_EMBED_API_KEY')
const embedModel = env('AI_TOOLS_EMBED_MODEL')
const embedDim = Number(env('AI_TOOLS_EMBED_DIMENSION') ?? '1536')
const hasEmbed = Boolean(embedBase && embedKey && embedModel)

function embedAuth() {
	return {
		base_url: embedBase!,
		api_key: embedKey!,
		model: embedModel!,
		...(Number.isFinite(embedDim) ? { dimensions: embedDim } : {})
	}
}

async function assertRag(auth: RagAuth): Promise<void> {
	const rag = RagClient.fromAuth(auth)
	const documentId = uniqueId('doc')
	const text = 'Integration test document: the refund window for Acme Corp is exactly thirty days from purchase.'
	const ingested = await rag.ingest({ document_id: documentId, text })
	expect(ingested.chunk_count).toBeGreaterThan(0)
	await sleep(800)
	const hits = await rag.retrieve({ query: 'refund window thirty days', top_k: 5 })
	expect(hits.matches.length).toBeGreaterThan(0)
	await rag.delete({ chunk_ids: ingested.chunk_ids })
}

const qdrantUrl = env('AI_TOOLS_QDRANT_URL')
const qdrantKey = env('AI_TOOLS_QDRANT_API_KEY')
const qdrantCollection = env('AI_TOOLS_QDRANT_RAG_COLLECTION') ?? 'ai_tools_rag_it'
const pineconeKey = env('AI_TOOLS_PINECONE_API_KEY')
const pineconeBase = env('AI_TOOLS_PINECONE_BASE_URL')
const pineconeNs = env('AI_TOOLS_PINECONE_NAMESPACE')
const supabaseUrl = env('AI_TOOLS_SUPABASE_URL')
const supabaseKey = env('AI_TOOLS_SUPABASE_API_KEY')
const supabaseTable = env('AI_TOOLS_SUPABASE_TABLE') ?? 'ai_tools_vectors'
const supabaseSchema = env('AI_TOOLS_SUPABASE_SCHEMA')
const supabaseRpc = env('AI_TOOLS_SUPABASE_MATCH_RPC')
const mastraDb = env('AI_TOOLS_MASTRA_DB_URL')
const mastraSchema = env('AI_TOOLS_MASTRA_SCHEMA')

const runQ = hasEmbed && qdrantUrl ? describe : describe.skip
const runP = hasEmbed && pineconeKey && pineconeBase ? describe : describe.skip
const runS = hasEmbed && supabaseUrl && supabaseKey ? describe : describe.skip
const runM = hasEmbed && mastraDb ? describe : describe.skip

runQ('live seam rag + qdrant', () => {
	test('ingest retrieve delete', async () => {
		await ensureQdrantCollection({
			baseUrl: qdrantUrl!,
			apiKey: qdrantKey,
			collection: qdrantCollection,
			dimension: embedDim
		})
		await assertRag({
			vector_store: {
				provider: 'qdrant',
				base_url: qdrantUrl!,
				default_collection: qdrantCollection,
				...(qdrantKey ? { api_key: qdrantKey } : {})
			},
			embed: embedAuth(),
			default_collection: qdrantCollection
		})
	})
})

runP('live seam rag + pinecone', () => {
	test('ingest retrieve delete', async () => {
		await assertRag({
			vector_store: {
				provider: 'pinecone',
				api_key: pineconeKey!,
				base_url: pineconeBase!,
				...(pineconeNs ? { default_namespace: pineconeNs } : {})
			},
			embed: embedAuth()
		})
	})
})

runS('live seam rag + supabase', () => {
	test('ingest retrieve delete', async () => {
		await assertRag({
			vector_store: {
				provider: 'supabase',
				url: supabaseUrl!,
				api_key: supabaseKey!,
				default_collection: supabaseTable,
				...(supabaseSchema ? { schema: supabaseSchema } : {}),
				...(supabaseRpc ? { match_rpc: supabaseRpc } : {})
			},
			embed: embedAuth(),
			default_collection: supabaseTable
		})
	})
})

runM('live seam rag + mastra', () => {
	test('ingest retrieve delete', async () => {
		assertLocalUrl(mastraDb!, 'AI_TOOLS_MASTRA_DB_URL')
		const indexName = uniqueId('rag_mastra').replaceAll('-', '_')
		await assertRag({
			vector_store: {
				provider: 'mastra',
				connection_string: mastraDb!,
				id: `ai-tools-rag-${indexName}`,
				default_index: indexName,
				dimension: embedDim,
				auto_create_index: true,
				...(mastraSchema ? { schema_name: mastraSchema } : {})
			},
			embed: embedAuth(),
			default_collection: indexName
		})
	})
})
