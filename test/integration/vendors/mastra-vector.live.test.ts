import { afterAll, describe, test } from 'bun:test'

import { VectorStoreClient } from '../../../src/modules/vector-store'
import { MastraVectorClient } from '../../../src/vendors/mastra-vector'
import { assertLocalUrl, assertUpsertQueryDeleteRoundTrip, env, IT, sampleVectorA, uniqueId } from '../helpers'

const dbUrl = env('AI_TOOLS_MASTRA_DB_URL')
const run = dbUrl ? describe : describe.skip

run('live vendor mastra-vector', () => {
	const indexName = uniqueId('ai_tools_mastra').replaceAll('-', '_')
	const clients: MastraVectorClient[] = []

	afterAll(async () => {
		for (const c of clients) {
			await c.disconnect().catch(() => undefined)
		}
	})

	test('client round-trip', async () => {
		if (!dbUrl) return
		assertLocalUrl(dbUrl, 'AI_TOOLS_MASTRA_DB_URL')
		const client = new MastraVectorClient({
			connection_string: dbUrl,
			id: `ai-tools-it-${indexName}`,
			default_index: indexName,
			dimension: sampleVectorA.length,
			auto_create_index: true,
			schema_name: IT.supabase.schema
		})
		clients.push(client)
		await assertUpsertQueryDeleteRoundTrip(client, { values: sampleVectorA })
	})

	test('seam vector-store provider=mastra', async () => {
		if (!dbUrl) return
		assertLocalUrl(dbUrl, 'AI_TOOLS_MASTRA_DB_URL')
		const seamIndex = `${indexName}_seam`
		const client = VectorStoreClient.fromAuth({
			provider: 'mastra',
			connection_string: dbUrl,
			id: `ai-tools-it-seam-${seamIndex}`,
			default_index: seamIndex,
			dimension: sampleVectorA.length,
			auto_create_index: true,
			schema_name: IT.supabase.schema
		})
		await assertUpsertQueryDeleteRoundTrip(client, { values: sampleVectorA })
	})
})
