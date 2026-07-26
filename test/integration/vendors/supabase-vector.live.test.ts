import { describe, test } from 'bun:test'

import { VectorStoreClient } from '../../../src/modules/vector-store'
import { SupabaseVectorClient } from '../../../src/vendors/supabase-vector'
import { assertUpsertQueryDeleteRoundTrip, sampleVectorA, supabaseAuthFromEnv } from '../helpers'

const supabase = supabaseAuthFromEnv()
const run = supabase ? describe : describe.skip

run('live vendor supabase-vector', () => {
	const vendorAuth = {
		url: supabase!.url,
		api_key: supabase!.api_key,
		default_collection: supabase!.table,
		schema: supabase!.schema,
		match_rpc: supabase!.match_rpc
	}

	test('client round-trip', async () => {
		await assertUpsertQueryDeleteRoundTrip(new SupabaseVectorClient(vendorAuth), {
			values: sampleVectorA
		})
	})

	test('seam vector-store provider=supabase', async () => {
		await assertUpsertQueryDeleteRoundTrip(VectorStoreClient.fromAuth({ provider: 'supabase', ...vendorAuth }), {
			values: sampleVectorA
		})
	})
})
