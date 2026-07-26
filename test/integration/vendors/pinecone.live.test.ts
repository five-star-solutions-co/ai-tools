import { describe, test } from 'bun:test'

import { VectorStoreClient } from '../../../src/modules/vector-store'
import { PineconeClient } from '../../../src/vendors/pinecone'
import { assertUpsertQueryDeleteRoundTrip, env, pineconeDimensionFromEnv } from '../helpers'

const apiKey = env('AI_TOOLS_PINECONE_API_KEY')
const baseUrl = env('AI_TOOLS_PINECONE_BASE_URL')
const namespace = env('AI_TOOLS_PINECONE_NAMESPACE')
const dim = pineconeDimensionFromEnv()
const run = apiKey && baseUrl ? describe : describe.skip

function sample(dimN: number): number[] {
	const out: number[] = []
	for (let i = 0; i < dimN; i += 1) out.push(0.1 + i * 0.01)
	return out
}

run('live vendor pinecone', () => {
	const values = sample(dim)

	test(
		'client round-trip',
		async () => {
			if (!apiKey || !baseUrl) return
			const client = new PineconeClient({
				api_key: apiKey,
				base_url: baseUrl,
				...(namespace ? { default_namespace: namespace } : {})
			})
			await assertUpsertQueryDeleteRoundTrip(client, {
				values,
				settleMs: 2500,
				...(namespace ? { namespace } : {})
			})
		},
		{ timeout: 20_000 }
	)

	test(
		'seam vector-store provider=pinecone',
		async () => {
			if (!apiKey || !baseUrl) return
			const client = VectorStoreClient.fromAuth({
				provider: 'pinecone',
				api_key: apiKey,
				base_url: baseUrl,
				...(namespace ? { default_namespace: namespace } : {})
			})
			await assertUpsertQueryDeleteRoundTrip(client, {
				values,
				settleMs: 2500,
				...(namespace ? { namespace } : {})
			})
		},
		{ timeout: 20_000 }
	)
})
