/**
 * Seam-only matrix: each vector-store provider (when env present).
 * Vendor-specific round-trips also live under test/integration/vendors/*.
 */

import { describe, test } from 'bun:test'

import { VectorStoreClient } from '../../../src/modules/vector-store'
import {
	assertLocalUrl,
	assertUpsertQueryDeleteRoundTrip,
	ensureQdrantCollection,
	env,
	IT,
	pineconeDimensionFromEnv,
	qdrantApiKeyFromEnv,
	qdrantCollectionFromEnv,
	qdrantUrlFromEnv,
	sampleVectorA,
	supabaseAuthFromEnv,
	uniqueId
} from '../helpers'

const qdrantUrl = qdrantUrlFromEnv()
const qdrantKey = qdrantApiKeyFromEnv()
const qdrantCollection = qdrantCollectionFromEnv()

const pineconeKey = env('AI_TOOLS_PINECONE_API_KEY')
const pineconeBase = env('AI_TOOLS_PINECONE_BASE_URL')
const pineconeNs = env('AI_TOOLS_PINECONE_NAMESPACE')
const pineconeDim = pineconeDimensionFromEnv()

const supabase = supabaseAuthFromEnv()
const mastraDb = env('AI_TOOLS_MASTRA_DB_URL')

const runQ = describe
const runP = pineconeKey && pineconeBase ? describe : describe.skip
const runS = supabase ? describe : describe.skip
const runM = mastraDb ? describe : describe.skip

runQ('live seam vector-store qdrant', () => {
	test('round-trip', async () => {
		await ensureQdrantCollection({
			baseUrl: qdrantUrl,
			apiKey: qdrantKey,
			collection: qdrantCollection,
			dimension: sampleVectorA.length
		})
		await assertUpsertQueryDeleteRoundTrip(
			VectorStoreClient.fromAuth({
				provider: 'qdrant',
				base_url: qdrantUrl,
				default_collection: qdrantCollection,
				...(qdrantKey ? { api_key: qdrantKey } : {})
			})
		)
	})
})

runP('live seam vector-store pinecone', () => {
	test(
		'round-trip',
		async () => {
			const values: number[] = []
			for (let i = 0; i < pineconeDim; i += 1) values.push(0.1 + i * 0.01)
			await assertUpsertQueryDeleteRoundTrip(
				VectorStoreClient.fromAuth({
					provider: 'pinecone',
					api_key: pineconeKey!,
					base_url: pineconeBase!,
					...(pineconeNs ? { default_namespace: pineconeNs } : {})
				}),
				{ values, settleMs: 2500, ...(pineconeNs ? { namespace: pineconeNs } : {}) }
			)
		},
		{ timeout: 30_000 }
	)
})

runS('live seam vector-store supabase', () => {
	test('round-trip', async () => {
		await assertUpsertQueryDeleteRoundTrip(
			VectorStoreClient.fromAuth({
				provider: 'supabase',
				url: supabase!.url,
				api_key: supabase!.api_key,
				default_collection: supabase!.table,
				schema: supabase!.schema,
				match_rpc: supabase!.match_rpc
			}),
			{ values: sampleVectorA }
		)
	})
})

runM('live seam vector-store mastra', () => {
	test('round-trip', async () => {
		assertLocalUrl(mastraDb!, 'AI_TOOLS_MASTRA_DB_URL')
		const indexName = uniqueId('seam_mastra').replaceAll('-', '_')
		await assertUpsertQueryDeleteRoundTrip(
			VectorStoreClient.fromAuth({
				provider: 'mastra',
				connection_string: mastraDb!,
				id: `ai-tools-seam-${indexName}`,
				default_index: indexName,
				dimension: sampleVectorA.length,
				auto_create_index: true,
				schema_name: IT.supabase.schema
			}),
			{ values: sampleVectorA }
		)
	})
})
