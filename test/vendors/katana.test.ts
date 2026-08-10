import { describe, expect, test } from 'bun:test'

import { ToolError, runTool, validateModule, withAuth } from '../../src/core'
import { KatanaClient, katanaListInventoryPageInputSchema, katanaModule } from '../../src/vendors/katana'

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

function paginationHeaders(
	overrides: Partial<{
		total_records: number
		total_pages: number
		offset: number
		page: number
		first_page: boolean
		last_page: boolean
	}> = {}
): Record<string, string> {
	return {
		'X-Pagination': JSON.stringify({
			total_records: 1,
			total_pages: 1,
			offset: 0,
			page: 1,
			first_page: true,
			last_page: true,
			...overrides
		})
	}
}

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
			return new Response(JSON.stringify([{ id: 9, order_no: 'SO-9', status: 'NOT_SHIPPED', total: 100 }]), {
				status: 200,
				headers: paginationHeaders()
			})
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
				return new Response(JSON.stringify([{ id: 4, name: 'Widget', uom: 'pcs', is_sellable: true }]), {
					status: 200,
					headers: paginationHeaders({ total_pages: 2, last_page: false })
				})
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
					JSON.stringify([
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
					]),
					{ status: 200, headers: paginationHeaders({ total_records: 2 }) }
				)
			}
			if (url.includes('/sales_order_rows')) {
				expect(url).toContain('sales_order_ids=10')
				expect(url).toContain('extend=variant')
				return new Response(
					JSON.stringify([
						{
							id: 100,
							sales_order_id: 10,
							quantity: '2.00000',
							price_per_unit: '12.5000000000',
							total_discount: '1.00000',
							variant: { sku: 'SKU-A', purchase_price: '3.50' }
						}
					]),
					{ status: 200, headers: paginationHeaders() }
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

	test('returns raw array records with Zod-parsed pagination and rate metadata', async () => {
		const raw = {
			id: 42,
			created_at: '2026-01-01T00:00:00Z',
			updated_at: '2026-02-01T00:00:00Z',
			deleted_at: null,
			archived_at: '2026-03-01T00:00:00Z',
			variants: [{ id: 7, sku: 'SKU-7', provider_variant_field: true }],
			custom_fields: { warehouse_zone: 'A' },
			provider_added_field: { nested: 'kept' }
		}
		const restore = mockFetch((url) => {
			const query = new URL(url).searchParams
			expect(query.get('limit')).toBe('250')
			return new Response(JSON.stringify([raw]), {
				status: 200,
				headers: {
					...paginationHeaders({ total_records: 42, total_pages: 2, offset: 41, page: 2 }),
					'X-Ratelimit-Limit': '60',
					'X-Ratelimit-Remaining': '17',
					'X-Ratelimit-Reset': '1780000000123'
				}
			})
		})

		try {
			const result = await new KatanaClient(auth).listProductsPage({ page: 2, limit: 250 })
			expect(result.items[0]).toEqual(raw)
			expect(result.pagination).toEqual({
				total_records: 42,
				total_pages: 2,
				offset: 41,
				page: 2,
				first_page: true,
				last_page: true
			})
			expect(result.rate_limit).toEqual({ limit: 60, remaining: 17, reset_at_ms: 1780000000123 })
		} finally {
			restore()
		}
	})

	test('fails on missing, malformed, or invalid X-Pagination', async () => {
		let response = 0
		const restore = mockFetch(() => {
			response += 1
			if (response === 1) return new Response(JSON.stringify([{ id: 1 }]), { status: 200 })
			if (response === 2) {
				return new Response(JSON.stringify([{ id: 1 }]), {
					status: 200,
					headers: { 'X-Pagination': '{not-json' }
				})
			}
			return new Response(JSON.stringify([{ id: 1 }]), {
				status: 200,
				headers: { 'X-Pagination': JSON.stringify({ page: 1, last_page: true }) }
			})
		})

		try {
			const client = new KatanaClient(auth)
			expect(client.listCustomersPage()).rejects.toMatchObject({ code: 'upstream' })
			expect(client.listCustomersPage()).rejects.toMatchObject({ code: 'upstream' })
			expect(client.listCustomersPage()).rejects.toMatchObject({ code: 'upstream' })
		} finally {
			restore()
		}
	})

	test('does not infer another page from a full final page', async () => {
		const items = Array.from({ length: 250 }, (_, index) => ({ id: index + 1, name: `Product ${index + 1}` }))
		const restore = mockFetch(
			() =>
				new Response(JSON.stringify(items), {
					status: 200,
					headers: paginationHeaders({ total_records: 250, total_pages: 1, last_page: true })
				})
		)

		try {
			const result = await new KatanaClient(auth).listProducts({ limit: 250 })
			expect(result.items).toHaveLength(250)
			expect(result.truncated).toBe(false)
			expect(result.next_cursor).toBeUndefined()
		} finally {
			restore()
		}
	})

	test('serializes exact endpoint filters for every raw page method', async () => {
		const urls: URL[] = []
		const restore = mockFetch((url) => {
			const parsedUrl = new URL(url)
			urls.push(parsedUrl)
			const item = parsedUrl.pathname.endsWith('/inventory')
				? { variant_id: 10, location_id: 20, quantities: { available: '9.00000' } }
				: { id: urls.length, linked_resource: { id: 99 } }
			return new Response(JSON.stringify([item]), { status: 200, headers: paginationHeaders() })
		})

		const timestamps = {
			created_at_min: '2026-01-01T00:00:00Z',
			created_at_max: '2026-01-31T23:59:59Z',
			updated_at_min: '2026-02-01T00:00:00Z',
			updated_at_max: '2026-02-28T23:59:59Z'
		}
		try {
			expect(katanaListInventoryPageInputSchema.safeParse({ extend: ['warehouse'] }).success).toBe(false)
			const client = new KatanaClient(auth)
			await client.listSalesOrdersPage({ ...timestamps, include_deleted: true, status: 'NOT_SHIPPED' })
			await client.listProductsPage({ ...timestamps, include_deleted: true, include_archived: true })
			await client.listMaterialsPage({ ...timestamps, include_deleted: true, include_archived: true })
			await client.listCustomersPage({ ...timestamps, include_deleted: true })
			await client.listSuppliersPage({ ...timestamps, include_deleted: true })
			await client.listPurchaseOrdersPage({ ...timestamps, include_deleted: true, status: 'PENDING' })
			await client.listManufacturingOrdersPage({ ...timestamps, include_deleted: true, status: 'NOT_STARTED' })
			const inventory = await client.listInventoryPage({
				page: 3,
				limit: 250,
				location_id: 20,
				variant_id: [10, 11],
				include_archived: true,
				extend: ['variant', 'location']
			})
			expect(urls).toHaveLength(8)
			for (const url of urls.slice(0, 7)) {
				expect(url.searchParams.get('created_at_min')).toBe(timestamps.created_at_min)
				expect(url.searchParams.get('updated_at_max')).toBe(timestamps.updated_at_max)
				expect(url.searchParams.get('include_deleted')).toBe('true')
			}
			expect(urls[1]?.searchParams.get('include_archived')).toBe('true')
			expect(urls[2]?.searchParams.get('include_archived')).toBe('true')
			const inventoryQuery = urls[7]?.searchParams
			expect(inventoryQuery?.getAll('variant_id')).toEqual(['10', '11'])
			expect(inventoryQuery?.getAll('extend')).toEqual(['variant', 'location'])
			expect(inventoryQuery?.get('location_id')).toBe('20')
			expect(inventoryQuery?.get('limit')).toBe('250')
			expect(inventory.items[0]?.quantities).toEqual({ available: '9.00000' })
		} finally {
			restore()
		}
	})

	test('preserves Retry-After on Katana rate limits', async () => {
		const restore = mockFetch(
			() =>
				new Response(JSON.stringify({ error: 'rate limited' }), {
					status: 429,
					headers: { 'Retry-After': '2' }
				})
		)

		try {
			try {
				await new KatanaClient(auth).listInventoryPage()
				throw new Error('expected rate limit error')
			} catch (error) {
				expect(error).toBeInstanceOf(ToolError)
				if (error instanceof ToolError) {
					expect(error.code).toBe('rate_limited')
					expect(error.details?.retry_after_ms).toBe(2000)
				}
			}
		} finally {
			restore()
		}
	})
})
