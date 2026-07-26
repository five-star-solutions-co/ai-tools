import { describe, expect, test } from 'bun:test'

import { VectorStoreClient } from '../../../src/modules/vector-store'
import { QdrantClient } from '../../../src/vendors/qdrant'
import {
	assertUpsertQueryDeleteRoundTrip,
	ensureQdrantCollection,
	qdrantApiKeyFromEnv,
	qdrantCollectionFromEnv,
	qdrantUrlFromEnv,
	sampleVectorA
} from '../helpers'

const baseUrl = qdrantUrlFromEnv()
const apiKey = qdrantApiKeyFromEnv()
const collection = qdrantCollectionFromEnv()
const run = describe

run('live vendor qdrant', () => {
	test('client round-trip', async () => {
		await ensureQdrantCollection({
			baseUrl,
			apiKey,
			collection,
			dimension: sampleVectorA.length
		})
		const client = new QdrantClient({
			base_url: baseUrl,
			default_collection: collection,
			...(apiKey ? { api_key: apiKey } : {})
		})
		await assertUpsertQueryDeleteRoundTrip(client)
	})

	test('seam vector-store provider=qdrant', async () => {
		await ensureQdrantCollection({
			baseUrl,
			apiKey,
			collection,
			dimension: sampleVectorA.length
		})
		const client = VectorStoreClient.fromAuth({
			provider: 'qdrant',
			base_url: baseUrl,
			default_collection: collection,
			...(apiKey ? { api_key: apiKey } : {})
		})
		await assertUpsertQueryDeleteRoundTrip(client)
		expect(true).toBe(true)
	})
})
