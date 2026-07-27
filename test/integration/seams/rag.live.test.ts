/**
 * Live RAG: embed (OpenAI-compatible) + each configured vector backend.
 */

import { describe, expect, test } from 'bun:test'

import { RagClient } from '../../../src/modules/rag'
import type { RagAuth } from '../../../src/modules/rag'
import {
	assertLocalUrl,
	embedDimensionFromEnv,
	ensureQdrantCollection,
	env,
	IT,
	pineconeDimensionFromEnv,
	qdrantApiKeyFromEnv,
	qdrantRagCollectionFromEnv,
	qdrantUrlFromEnv,
	sleep,
	supabaseAuthFromEnv,
	supabaseDimensionFromEnv,
	uniqueId
} from '../helpers'

const embedBase = env('AI_TOOLS_EMBED_BASE_URL')
const embedKey = env('AI_TOOLS_EMBED_API_KEY')
const embedModel = env('AI_TOOLS_EMBED_MODEL')
const embedDim = embedDimensionFromEnv()
const pineconeDim = pineconeDimensionFromEnv()
const supabaseDim = supabaseDimensionFromEnv()
const hasEmbed = Boolean(embedBase && embedKey && embedModel)

/** OpenAI-compatible embed auth; `dimensions` must match the bound vector index/table. */
function embedAuth(dimensions: number) {
	return {
		base_url: embedBase!,
		api_key: embedKey!,
		model: embedModel!,
		dimensions
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

const qdrantUrl = qdrantUrlFromEnv()
const qdrantKey = qdrantApiKeyFromEnv()
const qdrantRagCollection = qdrantRagCollectionFromEnv()
const pineconeKey = env('AI_TOOLS_PINECONE_API_KEY')
const pineconeBase = env('AI_TOOLS_PINECONE_BASE_URL')
const pineconeNs = env('AI_TOOLS_PINECONE_NAMESPACE')
const supabase = supabaseAuthFromEnv()
const mastraDb = env('AI_TOOLS_MASTRA_DB_URL')

const runQ = hasEmbed ? describe : describe.skip
const runP = hasEmbed && pineconeKey && pineconeBase ? describe : describe.skip
const runS = hasEmbed && supabase ? describe : describe.skip
const runM = hasEmbed && mastraDb ? describe : describe.skip

runQ('live seam rag + qdrant', () => {
	test('ingest retrieve delete', async () => {
		// Separate collection from dim-3 vector-store smoke — no parallel recreate race.
		await ensureQdrantCollection({
			baseUrl: qdrantUrl,
			apiKey: qdrantKey,
			collection: qdrantRagCollection,
			dimension: embedDim
		})
		await assertRag({
			vector_store: {
				provider: 'qdrant',
				base_url: qdrantUrl,
				default_collection: qdrantRagCollection,
				...(qdrantKey ? { api_key: qdrantKey } : {})
			},
			embed: embedAuth(embedDim),
			default_collection: qdrantRagCollection
		})
	})
})

runP('live seam rag + pinecone', () => {
	test('ingest retrieve delete', async () => {
		// Match live index dim (default 512) — not the OpenAI default 1536.
		await assertRag({
			vector_store: {
				provider: 'pinecone',
				api_key: pineconeKey!,
				base_url: pineconeBase!,
				...(pineconeNs ? { default_namespace: pineconeNs } : {})
			},
			embed: embedAuth(pineconeDim)
		})
	})
})

runS('live seam rag + supabase', () => {
	test('ingest retrieve delete', async () => {
		// IT table is vector(3); request matching embed dimensions from the model.
		await assertRag({
			vector_store: {
				provider: 'supabase',
				url: supabase!.url,
				api_key: supabase!.api_key,
				default_collection: supabase!.table,
				schema: supabase!.schema,
				match_rpc: supabase!.match_rpc
			},
			embed: embedAuth(supabaseDim),
			default_collection: supabase!.table
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
				schema_name: IT.supabase.schema
			},
			embed: embedAuth(embedDim),
			default_collection: indexName
		})
	})
})
