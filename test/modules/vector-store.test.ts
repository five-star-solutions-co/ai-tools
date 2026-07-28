import { describe, expect, test } from 'bun:test'

import { isToolError, runTool, validateModule, withAuth } from '../../src/core'
import { VectorStoreClient, vectorStoreModule } from '../../src/modules/vector-store'
import { MastraVectorStoreProvider } from '../../src/modules/vector-store/providers/mastra'
import type { MastraVectorClientOptions } from '../../src/vendors/mastra-vector'

function mockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
	const original = globalThis.fetch
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
		return handler(url, init)
	}) as typeof globalThis.fetch
	return () => {
		globalThis.fetch = original
	}
}

describe('vector-store seam', () => {
	test('module contracts and tool ids', () => {
		expect(validateModule(vectorStoreModule).ok).toBe(true)
		expect(vectorStoreModule.tools.map((t) => t.id).sort()).toEqual([
			'vector-store-delete',
			'vector-store-query',
			'vector-store-upsert'
		])
	})

	test('qdrant upsert + query + delete', async () => {
		const seen: string[] = []
		const restore = mockFetch((url, init) => {
			seen.push(`${init?.method ?? 'GET'} ${url}`)
			if (url.includes('/points/search')) {
				return new Response(
					JSON.stringify({
						result: [{ id: 'a', score: 0.91, payload: { text: 'hello' } }]
					}),
					{ status: 200 }
				)
			}
			return new Response(JSON.stringify({ result: { status: 'ok' } }), { status: 200 })
		})

		try {
			const client = VectorStoreClient.fromAuth({
				provider: 'qdrant',
				base_url: 'https://qdrant.example',
				api_key: 'k',
				default_collection: 'docs'
			})
			const up = await client.upsert({
				vectors: [{ id: 'a', values: [0.1, 0.2], metadata: { text: 'hello' } }]
			})
			expect(up.upserted).toBe(1)
			expect(up.collection).toBe('docs')

			const q = await client.query({ vector: [0.1, 0.2], top_k: 3 })
			expect(q.matches).toEqual([{ id: 'a', score: 0.91, metadata: { text: 'hello' } }])

			const d = await client.delete({ ids: ['a'] })
			expect(d.deleted).toBe(1)
			expect(seen.some((s) => s.includes('/collections/docs/points'))).toBe(true)
			expect(seen.some((s) => s.includes('/points/search'))).toBe(true)
		} finally {
			restore()
		}
	})

	test('pinecone upsert via withAuth tool', async () => {
		const restore = mockFetch((url, init) => {
			expect(url).toBe('https://idx.pinecone.io/vectors/upsert')
			expect(init?.method).toBe('POST')
			const headers = new Headers(init?.headers)
			expect(headers.get('Api-Key')).toBe('pk')
			return new Response(JSON.stringify({ upsertedCount: 1 }), { status: 200 })
		})

		try {
			const bound = withAuth(vectorStoreModule, {
				provider: 'pinecone',
				api_key: 'pk',
				base_url: 'https://idx.pinecone.io'
			})
			const tool = bound.tools.find((t) => t.id === 'vector-store-upsert')
			if (!tool) throw new Error('missing tool')
			const result = await runTool(tool, {
				vectors: [{ id: 'v1', values: [1, 2, 3] }]
			})
			expect(result).toEqual({ upserted: 1 })
		} finally {
			restore()
		}
	})

	test('pinecone default_filter + locked namespace on query and upsert', async () => {
		const restore = mockFetch((url, init) => {
			const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {}
			if (url.includes('/vectors/upsert')) {
				expect(body.namespace).toBe('org_ns')
				expect(body.vectors[0].metadata).toEqual({
					text: 'hi',
					organization_id: 'org_42'
				})
				return new Response(JSON.stringify({ upsertedCount: 1 }), { status: 200 })
			}
			if (url.includes('/query')) {
				expect(body.namespace).toBe('org_ns')
				// host wins over tool organization_id
				expect(body.filter).toEqual({ organization_id: 'org_42', doc_type: 'pdf' })
				return new Response(JSON.stringify({ matches: [] }), { status: 200 })
			}
			return new Response(JSON.stringify({}), { status: 200 })
		})

		try {
			const client = VectorStoreClient.fromAuth({
				provider: 'pinecone',
				api_key: 'pk',
				base_url: 'https://idx.pinecone.io',
				default_namespace: 'org_ns',
				default_filter: { organization_id: 'org_42' }
			})
			await client.upsert({
				// tool tries other namespace — ignored
				namespace: 'attacker',
				vectors: [{ id: 'v1', values: [1], metadata: { text: 'hi' } }]
			})
			await client.query({
				vector: [1],
				namespace: 'attacker',
				filter: { organization_id: 'other', doc_type: 'pdf' }
			})
		} finally {
			restore()
		}
	})

	test('qdrant default_filter converts flat equality to must', async () => {
		const restore = mockFetch((url, init) => {
			if (url.includes('/points/search')) {
				const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {}
				expect(body.filter).toEqual({
					must: [{ key: 'organization_id', match: { value: 'org_42' } }]
				})
				return new Response(JSON.stringify({ result: [] }), { status: 200 })
			}
			return new Response(JSON.stringify({ result: { status: 'ok' } }), { status: 200 })
		})

		try {
			const client = VectorStoreClient.fromAuth({
				provider: 'qdrant',
				base_url: 'https://qdrant.example',
				default_collection: 'docs',
				default_filter: { organization_id: 'org_42' }
			})
			await client.query({ vector: [0.1] })
		} finally {
			restore()
		}
	})

	test('qdrant requires collection when no default', async () => {
		const client = VectorStoreClient.fromAuth({
			provider: 'qdrant',
			base_url: 'https://qdrant.example'
		})
		try {
			await client.query({ vector: [1] })
			expect(true).toBe(false)
		} catch (error) {
			expect(isToolError(error) && error.code === 'bad_input').toBe(true)
		}
	})

	test('mastra provider wraps injected PgVector-like store', async () => {
		const calls: string[] = []
		const store: NonNullable<MastraVectorClientOptions['store']> = {
			upsert: async (input) => {
				calls.push(`upsert:${input.indexName}`)
				return input.ids ?? []
			},
			query: async () => [{ id: 'm1', score: 0.5, metadata: { k: 1 } }],
			deleteVectors: async () => {
				calls.push('delete')
			},
			createIndex: async () => {
				calls.push('create')
			}
		}
		const provider = new MastraVectorStoreProvider(
			{
				provider: 'mastra',
				connection_string: 'postgres://localhost/test',
				id: 'seam-test',
				default_index: 'idx'
			},
			{ store }
		)
		const up = await provider.upsert({ vectors: [{ id: 'm1', values: [1, 2] }] })
		expect(up.upserted).toBe(1)
		const q = await provider.query({ vector: [1, 2] })
		expect(q.matches[0]?.id).toBe('m1')
		await provider.delete({ ids: ['m1'] })
		expect(calls).toContain('upsert:idx')
		expect(calls).toContain('delete')
	})

	test('supabase upsert query delete via PostgREST + match RPC', async () => {
		const seen: string[] = []
		const restore = mockFetch((url, init) => {
			seen.push(`${init?.method ?? 'GET'} ${url}`)
			if (url.includes('/rpc/match_vectors')) {
				return new Response(
					JSON.stringify([{ id: 'p1', score: 0.95, metadata: { text: 'hi' }, embedding: [0.1, 0.2] }]),
					{ status: 200 }
				)
			}
			return new Response(null, { status: 201 })
		})

		try {
			const client = VectorStoreClient.fromAuth({
				provider: 'supabase',
				url: 'https://proj.supabase.co',
				api_key: 'srk',
				default_collection: 'chunks'
			})
			const up = await client.upsert({
				vectors: [{ id: 'p1', values: [0.1, 0.2], metadata: { text: 'hi' } }]
			})
			expect(up.upserted).toBe(1)
			expect(up.collection).toBe('chunks')

			const q = await client.query({ vector: [0.1, 0.2], include_values: true })
			expect(q.matches[0]?.id).toBe('p1')
			expect(q.matches[0]?.metadata).toEqual({ text: 'hi' })
			expect(q.matches[0]?.values).toEqual([0.1, 0.2])

			const d = await client.delete({ ids: ['p1'] })
			expect(d.deleted).toBe(1)

			expect(seen.some((s) => s.includes('POST') && s.includes('/rest/v1/chunks'))).toBe(true)
			expect(seen.some((s) => s.includes('/rpc/match_vectors'))).toBe(true)
			expect(seen.some((s) => s.includes('DELETE') && s.includes('/rest/v1/chunks'))).toBe(true)
		} finally {
			restore()
		}
	})
})
