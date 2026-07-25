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
// Separate from AI_TOOLS_QDRANT_COLLECTION (dim-3 smoke) so parallel runs don't thrash dim.
const qdrantCollection = env('AI_TOOLS_QDRANT_RAG_COLLECTION') ?? 'ai_tools_rag_it'
const mastraDb = env('AI_TOOLS_MASTRA_DB_URL')
const mastraSchema = env('AI_TOOLS_MASTRA_SCHEMA')

const runQ = hasEmbed && qdrantUrl ? describe : describe.skip
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
