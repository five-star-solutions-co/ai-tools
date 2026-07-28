import { describe, expect, test } from 'bun:test'

import { validateModule, withAuth, runTool } from '../../src/core'
import { KatanaClient, katanaModule } from '../../src/vendors/katana'

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

const auth = { api_key: 'katana_test_key' } as const

const expectedToolIds = [
	'katana-create-customer',
	'katana-create-manufacturing-order',
	'katana-create-product',
	'katana-create-purchase-order',
	'katana-create-sales-order',
	'katana-create-supplier',
	'katana-delete-sales-order',
	'katana-get-customer',
	'katana-get-manufacturing-order',
	'katana-get-material',
	'katana-get-product',
	'katana-get-purchase-order',
	'katana-get-sales-order',
	'katana-get-supplier',
	'katana-list-customers',
	'katana-list-inventory',
	'katana-list-manufacturing-orders',
	'katana-list-materials',
	'katana-list-products',
	'katana-list-purchase-orders',
	'katana-list-sales-orders',
	'katana-list-suppliers',
	'katana-query-sales-orders',
	'katana-update-customer',
	'katana-update-manufacturing-order',
	'katana-update-product',
	'katana-update-purchase-order',
	'katana-update-sales-order'
]

describe('katana', () => {
	test('module contracts and tool ids', () => {
		expect(validateModule(katanaModule).ok).toBe(true)
		expect(katanaModule.tools.map((t) => t.id).sort()).toEqual(expectedToolIds)
	})

	test('listSalesOrders hits Katana API with bearer auth', async () => {
		const restore = mockFetch((url, init) => {
			expect(url).toContain('https://api.katanamrp.com/v1/sales_orders')
			expect(init?.method).toBe('GET')
			const headers = new Headers(init?.headers)
			expect(headers.get('Authorization')).toBe('Bearer katana_test_key')
			return new Response(
				JSON.stringify({
					data: [{ id: 9, order_no: 'SO-9', status: 'NOT_SHIPPED', total: 100 }],
					pagination: { page: 1, total_pages: 1 }
				}),
				{ status: 200 }
			)
		})

		try {
			const client = new KatanaClient(auth)
			const result = await client.listSalesOrders({})
			expect(result.items).toEqual([{ id: 9, order_no: 'SO-9', status: 'NOT_SHIPPED', total: 100 }])
			expect(result.truncated).toBe(false)
		} finally {
			restore()
		}
	})

	test('listProducts client + getSalesOrder tool', async () => {
		const restore = mockFetch((url, init) => {
			if (url.includes('/products') && !url.includes('/products/')) {
				expect(init?.method).toBe('GET')
				return new Response(
					JSON.stringify({
						data: [{ id: 4, name: 'Widget', uom: 'pcs', is_sellable: true }],
						pagination: { page: 1, total_pages: 2 }
					}),
					{ status: 200 }
				)
			}
			if (url.includes('/sales_orders/3')) {
				return new Response(JSON.stringify({ data: { id: 3, order_no: 'SO-3' } }), { status: 200 })
			}
			return new Response('not found', { status: 404 })
		})

		try {
			const client = new KatanaClient(auth)
			const products = await client.listProducts({})
			expect(products.items).toEqual([{ id: 4, name: 'Widget', uom: 'pcs', is_sellable: true }])
			expect(products.truncated).toBe(true)
			expect(products.next_cursor).toBe('2')

			const bound = withAuth(katanaModule, auth)
			const tool = bound.tools.find((t) => t.id === 'katana-get-sales-order')
			if (!tool) throw new Error('missing tool')
			const result = await runTool(tool, { sales_order_id: 3 })
			expect(result).toEqual({ sales_order: { id: 3, order_no: 'SO-3' } })
		} finally {
			restore()
		}
	})

	test('querySalesOrders composites list, rows, and customer enrich', async () => {
		const calls: string[] = []
		const restore = mockFetch((url, init) => {
			calls.push(url)
			expect(init?.method).toBe('GET')
			if (url.includes('/sales_orders') && !url.includes('/sales_order_rows')) {
				expect(url).toContain('created_at_min=2026-01-01')
				expect(url).toContain('status=NOT_SHIPPED')
				return new Response(
					JSON.stringify({
						data: [
							{
								id: 10,
								order_no: 'SO-10',
								status: 'NOT_SHIPPED',
								customer_id: 5,
								order_created_date: '2026-02-01T00:00:00.000Z',
								created_at: '2026-02-01T01:00:00.000Z',
								total: 100
							},
							{
								id: 11,
								order_no: 'SO-11',
								status: 'NOT_SHIPPED',
								customer_id: 5,
								// Outside client-side order_created window
								order_created_date: '2025-01-01T00:00:00.000Z',
								created_at: '2025-01-01T01:00:00.000Z'
							}
						],
						pagination: { page: 1, total_pages: 1 }
					}),
					{ status: 200 }
				)
			}
			if (url.includes('/sales_order_rows')) {
				expect(url).toContain('sales_order_ids=10')
				expect(url).toContain('extend=variant')
				return new Response(
					JSON.stringify({
						data: [
							{
								id: 100,
								sales_order_id: 10,
								quantity: '2.00000',
								price_per_unit: '12.5000000000',
								total_discount: '1.00000',
								variant: { sku: 'SKU-A', purchase_price: '3.50' }
							}
						],
						pagination: { page: 1, total_pages: 1 }
					}),
					{ status: 200 }
				)
			}
			if (url.includes('/customers/5')) {
				return new Response(JSON.stringify({ data: { id: 5, name: 'Acme Co', first_name: 'A', last_name: 'C' } }), {
					status: 200
				})
			}
			return new Response(`unexpected ${url}`, { status: 404 })
		})

		try {
			const client = new KatanaClient(auth)
			const result = await client.querySalesOrders({
				scopes: [
					{
						created_from: '2026-01-01T00:00:00.000Z',
						order_created_from: '2026-01-15T00:00:00.000Z',
						statuses: ['NOT_SHIPPED']
					}
				]
			})
			expect(result.order_count).toBe(1)
			expect(result.orders).toEqual([
				{
					id: 10,
					created_at: '2026-02-01T01:00:00.000Z',
					order_created_date: '2026-02-01T00:00:00.000Z',
					order_no: 'SO-10',
					status: 'NOT_SHIPPED',
					customer_id: 5,
					customer_name: 'Acme Co',
					rows: [
						{
							sku: 'SKU-A',
							quantity: 2,
							// (2 * 12.5 - 1) * 100 = 2400
							tax_exclusive_total_cents: 2400,
							// 3.50 * 2 * 100 = 700
							cogs_value_cents: 700
						}
					]
				}
			])
			expect(calls.some((u) => u.includes('/sales_orders'))).toBe(true)
			expect(calls.some((u) => u.includes('/sales_order_rows'))).toBe(true)
			expect(calls.some((u) => u.includes('/customers/5'))).toBe(true)
		} finally {
			restore()
		}
	})
})
