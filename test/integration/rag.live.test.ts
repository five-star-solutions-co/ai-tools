/**
 * Live RAG: embed (OpenAI-compatible) + vector store for each configured backend.
 *
 * Shared embed env:
 *   AI_TOOLS_EMBED_BASE_URL=https://openrouter.ai/api/v1
 *   AI_TOOLS_EMBED_API_KEY=
 *   AI_TOOLS_EMBED_MODEL=openai/text-embedding-3-small
 *   AI_TOOLS_EMBED_DIMENSION=1536   (must match model + vector index)
 *
 * Plus at least one vector backend env set (same as vendor integration tests):
 *   AI_TOOLS_QDRANT_URL=…
 *   AI_TOOLS_PINECONE_API_KEY=… + AI_TOOLS_PINECONE_BASE_URL=…
 *   AI_TOOLS_SUPABASE_URL=… + AI_TOOLS_SUPABASE_API_KEY=…
 *   AI_TOOLS_MASTRA_DB_URL=…
 */

import { describe, expect, test } from 'bun:test'

import { RagClient } from '../../src/modules/rag'
import type { RagAuth } from '../../src/modules/rag'
import { assertLocalDbUrl, ensureQdrantCollection, env, sleep, uniqueId } from './helpers'

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

async function assertRagRoundTrip(auth: RagAuth): Promise<void> {
	const rag = RagClient.fromAuth(auth)
	const documentId = uniqueId('doc')
	const text = 'Integration test document: the refund window for Acme Corp is exactly thirty days from purchase.'

	const ingested = await rag.ingest({ document_id: documentId, text })
	expect(ingested.chunk_count).toBeGreaterThan(0)
	expect(ingested.chunk_ids.length).toBe(ingested.chunk_count)

	await sleep(800)

	const hits = await rag.retrieve({ query: 'refund window thirty days', top_k: 5 })
	expect(hits.matches.length).toBeGreaterThan(0)
	const related = hits.matches.some(
		(m) =>
			m.document_id === documentId ||
			m.id.startsWith(`${documentId}#`) ||
			(typeof m.text === 'string' && m.text.toLowerCase().includes('refund'))
	)
	expect(related).toBe(true)

	await rag.delete({ chunk_ids: ingested.chunk_ids })
	await sleep(500)
}

const qdrantUrl = env('AI_TOOLS_QDRANT_URL')
const qdrantKey = env('AI_TOOLS_QDRANT_API_KEY')
// Separate from AI_TOOLS_QDRANT_COLLECTION (dim-3 smoke) so parallel runs don't thrash dim.
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

const runQdrant = hasEmbed && qdrantUrl ? describe : describe.skip
const runPinecone = hasEmbed && pineconeKey && pineconeBase ? describe : describe.skip
const runSupabase = hasEmbed && supabaseUrl && supabaseKey ? describe : describe.skip
const runMastra = hasEmbed && mastraDb ? describe : describe.skip

runQdrant('integration rag + qdrant', () => {
	test('ingest retrieve delete', async () => {
		if (!qdrantUrl || !hasEmbed) return
		await ensureQdrantCollection({
			baseUrl: qdrantUrl,
			apiKey: qdrantKey,
			collection: qdrantCollection,
			dimension: embedDim
		})
		await assertRagRoundTrip({
			vector_store: {
				provider: 'qdrant',
				base_url: qdrantUrl,
				default_collection: qdrantCollection,
				...(qdrantKey ? { api_key: qdrantKey } : {})
			},
			embed: embedAuth(),
			default_collection: qdrantCollection
		})
	})
})

runPinecone('integration rag + pinecone', () => {
	test('ingest retrieve delete', async () => {
		if (!pineconeKey || !pineconeBase || !hasEmbed) return
		await assertRagRoundTrip({
			vector_store: {
				provider: 'pinecone',
				api_key: pineconeKey,
				base_url: pineconeBase,
				...(pineconeNs ? { default_namespace: pineconeNs } : {})
			},
			embed: embedAuth()
		})
	})
})

runSupabase('integration rag + supabase', () => {
	test('ingest retrieve delete', async () => {
		if (!supabaseUrl || !supabaseKey || !hasEmbed) return
		await assertRagRoundTrip({
			vector_store: {
				provider: 'supabase',
				url: supabaseUrl,
				api_key: supabaseKey,
				default_collection: supabaseTable,
				...(supabaseSchema ? { schema: supabaseSchema } : {}),
				...(supabaseRpc ? { match_rpc: supabaseRpc } : {})
			},
			embed: embedAuth(),
			default_collection: supabaseTable
		})
	})
})

runMastra('integration rag + mastra', () => {
	test('ingest retrieve delete', async () => {
		if (!mastraDb || !hasEmbed) return
		assertLocalDbUrl(mastraDb, 'AI_TOOLS_MASTRA_DB_URL')
		const indexName = uniqueId('ai_tools_rag_mastra').replaceAll('-', '_')
		await assertRagRoundTrip({
			vector_store: {
				provider: 'mastra',
				connection_string: mastraDb,
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
