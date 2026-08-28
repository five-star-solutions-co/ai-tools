import { describe, expect, test } from 'bun:test'

import { runTool, ToolError, validateModule, withAuth } from '../../src/core'
import { ShipstationClient, shipstationModule } from '../../src/vendors/shipstation'

const auth = { api_key: 'shipstation_test_key' } as const

async function rejectionOf(promise: Promise<unknown>): Promise<ToolError> {
	try {
		await promise
	} catch (error) {
		if (error instanceof ToolError) return error
		throw error
	}
	throw new Error('expected ToolError rejection')
}

describe('shipstation', () => {
	test('module contracts and tool ids', () => {
		expect(validateModule(shipstationModule).ok).toBe(true)
		expect(shipstationModule.tools.map((tool) => tool.id).sort()).toEqual([
			'shipstation-list-labels',
			'shipstation-list-shipments'
		])
	})

	test('rejects invalid auth', () => {
		expect(() => new ShipstationClient({ api_key: '' })).toThrow(ToolError)
	})

	test('lists a labels page with API-Key auth and provider filters', async () => {
		const client = new ShipstationClient(auth, {
			fetch: async (input, init) => {
				const request = new Request(input, init)
				const url = new URL(request.url)
				expect(url.origin + url.pathname).toBe('https://api.shipstation.com/v2/labels')
				expect(url.searchParams.get('page')).toBe('2')
				expect(url.searchParams.get('page_size')).toBe('500')
				expect(url.searchParams.get('created_at_start')).toBe('2026-08-01T00:00:00.000Z')
				expect(url.searchParams.get('sort_by')).toBe('created_at')
				expect(url.searchParams.get('sort_dir')).toBe('asc')
				expect(request.method).toBe('GET')
				expect(request.headers.get('API-Key')).toBe('shipstation_test_key')
				expect(request.headers.get('Accept')).toBe('application/json')

				return new Response(
					JSON.stringify({
						labels: [
							{
								label_id: 'se-123',
								shipment_id: 'se-ship-1',
								created_at: '2026-08-02T00:00:00.000Z',
								shipment_cost: { currency: 'usd', amount: 12.5 }
							}
						],
						total: 501,
						page: 2,
						pages: 3,
						links: { first: { href: 'https://api.shipstation.com/v2/labels?page=1' } }
					}),
					{ status: 200 }
				)
			}
		})

		const result = await client.listLabelsPage({
			page: 2,
			page_size: 500,
			created_at_start: '2026-08-01T00:00:00.000Z',
			sort_by: 'created_at',
			sort_dir: 'asc'
		})
		expect(result.pagination).toEqual({ total: 501, page: 2, pages: 3, page_size: 500, has_more: true })
		expect(result.items[0]).toEqual({
			label_id: 'se-123',
			shipment_id: 'se-ship-1',
			created_at: '2026-08-02T00:00:00.000Z',
			shipment_cost: { currency: 'usd', amount: 12.5 }
		})
	})

	test('lists a shipments page with warehouse-ready time filters', async () => {
		const client = new ShipstationClient(auth, {
			fetch: async (input, init) => {
				const request = new Request(input, init)
				const url = new URL(request.url)
				expect(url.origin + url.pathname).toBe('https://api.shipstation.com/v2/shipments')
				expect(url.searchParams.get('page')).toBe('1')
				expect(url.searchParams.get('page_size')).toBe('25')
				expect(url.searchParams.get('modified_at_start')).toBe('2026-08-01T00:00:00.000Z')
				expect(url.searchParams.get('modified_at_end')).toBe('2026-08-31T23:59:59.000Z')
				expect(url.searchParams.get('store_id')).toBe('store-1')

				return new Response(
					JSON.stringify({
						shipments: [
							{
								shipment_id: 'se-ship-1',
								external_order_id: 'order-1',
								modified_at: '2026-08-03T00:00:00.000Z',
								ship_to: { name: 'Ada Lovelace' },
								items: [{ sku: 'SKU-1', quantity: 2 }]
							}
						],
						total: 1,
						page: 1,
						pages: 1
					}),
					{ status: 200 }
				)
			}
		})

		const result = await client.listShipmentsPage({
			modified_at_start: '2026-08-01T00:00:00.000Z',
			modified_at_end: '2026-08-31T23:59:59.000Z',
			store_id: 'store-1'
		})
		expect(result.pagination).toEqual({ total: 1, page: 1, pages: 1, page_size: 25, has_more: false })
		expect(result.items[0]?.ship_to).toEqual({ name: 'Ada Lovelace' })
		expect(result.items[0]?.items).toEqual([{ sku: 'SKU-1', quantity: 2 }])
	})

	test('runs the labels tool through bound auth', async () => {
		const tool = withAuth(shipstationModule, auth).tools.find((entry) => entry.id === 'shipstation-list-labels')
		if (!tool) throw new Error('missing ShipStation labels tool')

		const result = await runTool(
			tool,
			{ page_size: 1 },
			{
				fetch: async () => new Response(JSON.stringify({ labels: [], total: 0, page: 1, pages: 0 }), { status: 200 })
			}
		)
		expect(result).toEqual({
			items: [],
			pagination: { total: 0, page: 1, pages: 0, page_size: 1, has_more: false }
		})
	})

	test('rejects malformed provider pages', async () => {
		const client = new ShipstationClient(auth, {
			fetch: async () => new Response(JSON.stringify({ labels: [{ created_at: 'missing-label-id' }] }), { status: 200 })
		})

		expect(await rejectionOf(client.listLabelsPage())).toMatchObject({ code: 'upstream', retryable: false })
	})

	test('preserves 429 Retry-After metadata for host retry policy', async () => {
		const client = new ShipstationClient(auth, {
			fetch: async () =>
				new Response(JSON.stringify({ message: 'Too many requests' }), {
					status: 429,
					headers: { 'Retry-After': '30' }
				})
		})

		expect(await rejectionOf(client.listShipmentsPage())).toMatchObject({
			code: 'rate_limited',
			retryable: true,
			details: { status: 429, retry_after_ms: 30_000 }
		})
	})
})
