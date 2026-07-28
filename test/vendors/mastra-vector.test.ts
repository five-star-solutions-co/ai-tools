import { describe, expect, test } from 'bun:test'

import { validateModule } from '../../src/core'
import { MastraVectorClient, mastraVectorModule } from '../../src/vendors/mastra-vector'
import type { MastraVectorClientOptions } from '../../src/vendors/mastra-vector'

function mockStore(): NonNullable<MastraVectorClientOptions['store']> & { calls: string[] } {
	const calls: string[] = []
	return {
		calls,
		upsert: async (input) => {
			calls.push(`upsert:${input.indexName}:${input.ids?.join(',')}`)
			return input.ids ?? []
		},
		query: async (input) => {
			calls.push(`query:${input.indexName}:${input.topK}`)
			const row: { id: string; score: number; metadata: { text: string }; vector?: number[] } = {
				id: 'a',
				score: 0.9,
				metadata: { text: 'hello' }
			}
			if (input.includeVector) row.vector = [0.1, 0.2]
			return [row]
		},
		deleteVectors: async (input) => {
			calls.push(`delete:${input.indexName}:${input.ids?.join(',')}`)
		},
		createIndex: async (input) => {
			calls.push(`createIndex:${input.indexName}:${input.dimension}`)
		}
	}
}

const auth = {
	connection_string: 'postgres://localhost/test',
	id: 'test-store',
	default_index: 'knowledge',
	dimension: 2,
	auto_create_index: true
} as const

describe('mastra-vector vendor', () => {
	test('module tool ids and runtime', () => {
		expect(validateModule(mastraVectorModule).ok).toBe(true)
		expect(mastraVectorModule.runtime).toBe('node')
		expect(mastraVectorModule.tools.map((t) => t.id).sort()).toEqual([
			'mastra-vector-delete',
			'mastra-vector-query',
			'mastra-vector-upsert'
		])
	})

	test('upsert query delete via injected store', async () => {
		const store = mockStore()
		const client = new MastraVectorClient(auth, { store })

		const up = await client.upsert({
			vectors: [{ id: 'a', values: [0.1, 0.2], metadata: { text: 'hello' } }]
		})
		expect(up).toEqual({ upserted: 1, collection: 'knowledge' })

		const q = await client.query({ vector: [0.1, 0.2], include_values: true })
		expect(q.matches[0]?.id).toBe('a')
		expect(q.matches[0]?.metadata).toEqual({ text: 'hello' })
		expect(q.matches[0]?.values).toEqual([0.1, 0.2])

		const d = await client.delete({ ids: ['a'] })
		expect(d.deleted).toBe(1)

		expect(store.calls.some((c) => c.startsWith('createIndex:knowledge:2'))).toBe(true)
		expect(store.calls.some((c) => c.startsWith('upsert:knowledge:a'))).toBe(true)
		expect(store.calls.some((c) => c.startsWith('query:knowledge:'))).toBe(true)
		expect(store.calls.some((c) => c.startsWith('delete:knowledge:a'))).toBe(true)
	})

	test('default_filter stamps upsert metadata and merges on query', async () => {
		const seen: unknown[] = []
		const store: NonNullable<MastraVectorClientOptions['store']> = {
			upsert: async (input) => {
				seen.push(input.metadata)
				return input.ids ?? []
			},
			query: async (input) => {
				seen.push(input.filter)
				return [{ id: 'a', score: 1, metadata: {} }]
			},
			deleteVectors: async () => {},
			createIndex: async () => {}
		}
		const client = new MastraVectorClient({ ...auth, default_filter: { organization_id: 'org_42' } }, { store })
		await client.upsert({
			vectors: [{ id: 'a', values: [0.1, 0.2], metadata: { text: 'x' } }]
		})
		await client.query({
			vector: [0.1, 0.2],
			filter: { organization_id: 'other', tag: 'a' }
		})
		expect(seen[0]).toEqual([{ text: 'x', organization_id: 'org_42' }])
		expect(seen[1]).toEqual({ organization_id: 'org_42', tag: 'a' })
	})
})
