import { describe, expect, test } from 'bun:test'
import { isPlainObject } from 'es-toolkit'

import { runTool, ToolError, validateModule, withAuth } from '../../src/core'
import { WoocommerceClient, woocommerceModule } from '../../src/vendors/woocommerce'

function asRecord(value: unknown): Record<string, unknown> {
	if (!isPlainObject(value)) throw new Error('expected object')
	return value
}

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

const auth = {
	store_url: 'https://shop.example.com',
	consumer_key: 'ck_test',
	consumer_secret: 'cs_test'
} as const

const FULL_TOOL_IDS = [
	'woocommerce-create-coupon',
	'woocommerce-create-customer',
	'woocommerce-create-order',
	'woocommerce-create-order-note',
	'woocommerce-create-order-refund',
	'woocommerce-create-product',
	'woocommerce-delete-order',
	'woocommerce-delete-product',
	'woocommerce-get-coupon',
	'woocommerce-get-customer',
	'woocommerce-get-order',
	'woocommerce-get-product',
	'woocommerce-get-product-category',
	'woocommerce-get-product-variation',
	'woocommerce-list-coupons',
	'woocommerce-list-customers',
	'woocommerce-list-order-notes',
	'woocommerce-list-order-refunds',
	'woocommerce-list-orders',
	'woocommerce-list-product-categories',
	'woocommerce-list-product-variations',
	'woocommerce-list-products',
	'woocommerce-update-coupon',
	'woocommerce-update-customer',
	'woocommerce-update-order',
	'woocommerce-update-product'
] as const

describe('woocommerce', () => {
	test('module contracts and tool ids', () => {
		expect(validateModule(woocommerceModule).ok).toBe(true)
		expect(woocommerceModule.tools.map((t) => t.id).sort()).toEqual([...FULL_TOOL_IDS])
	})

	test('listOrders posts to wc/v3 with basic auth', async () => {
		const restore = mockFetch((url, init) => {
			expect(url).toContain('https://shop.example.com/wp-json/wc/v3/orders')
			expect(url).toContain('per_page=10')
			expect(init?.method).toBe('GET')
			const headers = new Headers(init?.headers)
			expect(headers.get('Authorization')?.startsWith('Basic ')).toBe(true)
			return new Response(
				JSON.stringify([
					{
						id: 12,
						number: '12',
						status: 'processing',
						currency: 'USD',
						total: '19.00',
						date_created: '2026-01-01T00:00:00',
						line_items: [
							{
								id: 1,
								product_id: 44,
								variation_id: 0,
								quantity: 2,
								name: 'Widget',
								sku: 'W-1',
								price: 9.5,
								total: '19.00'
							}
						]
					}
				]),
				{ status: 200, headers: { 'x-wp-totalpages': '1' } }
			)
		})

		try {
			const client = new WoocommerceClient(auth)
			const result = await client.listOrders({})
			expect(result.items).toHaveLength(1)
			expect(result.items[0]?.id).toBe(12)
			expect(result.items[0]?.line_items).toEqual([
				{
					id: 1,
					product_id: 44,
					variation_id: 0,
					quantity: 2,
					name: 'Widget',
					sku: 'W-1',
					price: '9.5',
					total: '19.00'
				}
			])
			expect(result.truncated).toBe(false)
		} finally {
			restore()
		}
	})

	test('listProducts supports include and returns categories', async () => {
		const restore = mockFetch((url, init) => {
			expect(url).toContain('/wp-json/wc/v3/products')
			expect(url).toContain('include=10,20')
			expect(init?.method).toBe('GET')
			return new Response(
				JSON.stringify([
					{
						id: 10,
						name: 'Alpha',
						type: 'simple',
						status: 'publish',
						sku: 'A-1',
						categories: [
							{ id: 3, name: 'Widgets', slug: 'widgets' },
							{ id: 4, name: 'Sale' }
						]
					}
				]),
				{ status: 200, headers: { 'x-wp-totalpages': '1' } }
			)
		})
		try {
			const client = new WoocommerceClient(auth)
			const result = await client.listProducts({ include: [10, 20] })
			expect(result.items).toHaveLength(1)
			expect(result.items[0]?.categories).toEqual([
				{ id: 3, name: 'Widgets', slug: 'widgets' },
				{ id: 4, name: 'Sale' }
			])
		} finally {
			restore()
		}
	})

	test('createProduct posts body and returns product', async () => {
		const restore = mockFetch((url, init) => {
			expect(url).toBe('https://shop.example.com/wp-json/wc/v3/products')
			expect(init?.method).toBe('POST')
			const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
			expect(body).toEqual({ name: 'Widget', type: 'simple', regular_price: '9.99' })
			return new Response(
				JSON.stringify({
					id: 44,
					name: 'Widget',
					type: 'simple',
					status: 'publish',
					regular_price: '9.99',
					price: '9.99'
				}),
				{ status: 201 }
			)
		})

		try {
			const client = new WoocommerceClient(auth)
			const result = await client.createProduct({
				name: 'Widget',
				type: 'simple',
				regular_price: '9.99'
			})
			expect(result.product.id).toBe(44)
			expect(result.product.name).toBe('Widget')
			expect(result.product.price).toBe('9.99')
		} finally {
			restore()
		}
	})

	test('updateOrder puts to orders/{id}', async () => {
		const restore = mockFetch((url, init) => {
			expect(url).toBe('https://shop.example.com/wp-json/wc/v3/orders/12')
			expect(init?.method).toBe('PUT')
			const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
			expect(body).toEqual({ status: 'completed' })
			return new Response(
				JSON.stringify({
					id: 12,
					number: '12',
					status: 'completed',
					currency: 'USD',
					total: '19.00'
				}),
				{ status: 200 }
			)
		})

		try {
			const client = new WoocommerceClient(auth)
			const result = await client.updateOrder({ order_id: 12, status: 'completed' })
			expect(result.order.status).toBe('completed')
		} finally {
			restore()
		}
	})

	test('listOrders tool via withAuth', async () => {
		const bound = withAuth(woocommerceModule, auth)
		const tool = bound.tools.find((t) => t.id === 'woocommerce-list-orders')
		if (!tool) throw new Error('missing tool')

		const restore = mockFetch(
			() => new Response(JSON.stringify([]), { status: 200, headers: { 'x-wp-totalpages': '1' } })
		)
		try {
			const result = asRecord(await runTool(tool, { limit: 5 }))
			expect(Array.isArray(result['items'])).toBe(true)
			expect(result['truncated']).toBe(false)
		} finally {
			restore()
		}
	})

	test('rejects store_url with path, query, or fragment', () => {
		const invalid = [
			'https://shop.example.com/shop',
			'https://shop.example.com/?ref=1',
			'https://shop.example.com/#checkout'
		]
		for (const store_url of invalid) {
			expect(() => new WoocommerceClient({ ...auth, store_url })).toThrow(ToolError)
		}
	})

	test('keeps extra provider fields on raw page records', async () => {
		const order = {
			id: 12,
			date_created: '2026-01-01T00:00:00',
			date_created_gmt: '2026-01-01T00:00:00',
			date_modified: '2026-01-02T00:00:00',
			date_modified_gmt: '2026-01-02T00:00:00',
			billing: { first_name: 'Ada', email: 'ada@example.com' },
			shipping: { first_name: 'Ada', address_1: '1 Main' },
			tax_lines: [{ id: 9, label: 'VAT', total: '1.50' }],
			fee_lines: [{ id: 8, name: 'Handling', total: '2.00' }],
			coupon_lines: [{ id: 7, code: 'SAVE', discount: '3.00' }],
			refunds: [{ id: 6, total: '-4.00' }],
			meta_data: [{ id: 5, key: '_warehouse', value: 'west' }]
		}
		const product = {
			id: 44,
			date_modified_gmt: '2026-01-03T00:00:00',
			attributes: [{ id: 1, name: 'Color', options: ['Red'] }],
			images: [{ id: 2, src: 'https://cdn.example.com/p.png' }],
			meta_data: [{ id: 3, key: '_cost', value: '4.00' }]
		}
		const customer = {
			id: 90,
			date_modified_gmt: '2026-01-04T00:00:00',
			billing: { city: 'Austin' },
			shipping: { city: 'Austin' },
			meta_data: [{ id: 4, key: '_vip', value: '1' }]
		}
		const restore = mockFetch((url) => {
			const path = new URL(url).pathname
			const body = path.endsWith('/orders') ? [order] : path.endsWith('/products') ? [product] : [customer]
			return new Response(JSON.stringify(body), {
				status: 200,
				headers: { 'x-wp-total': '1', 'x-wp-totalpages': '1' }
			})
		})
		try {
			const client = new WoocommerceClient(auth)
			expect((await client.listOrdersPage()).items[0]).toEqual(order)
			expect((await client.listProductsPage()).items[0]).toEqual(product)
			expect((await client.listCustomersPage()).items[0]).toEqual(customer)
		} finally {
			restore()
		}
	})

	test('accepts nullable WooCommerce collection timestamps', async () => {
		const customer = {
			id: 90,
			date_created: null,
			date_created_gmt: null,
			date_modified: null,
			date_modified_gmt: null
		}
		const restore = mockFetch(
			() =>
				new Response(JSON.stringify([customer]), {
					status: 200,
					headers: { 'x-wp-total': '1', 'x-wp-totalpages': '1' }
				})
		)

		try {
			const result = await new WoocommerceClient(auth).listCustomersPage()
			expect(result.items).toEqual([customer])
		} finally {
			restore()
		}
	})

	test('maps modified-time collection parameters exactly', async () => {
		const urls: URL[] = []
		const restore = mockFetch((url) => {
			urls.push(new URL(url))
			return new Response(JSON.stringify([]), {
				status: 200,
				headers: { 'x-wp-total': '0', 'x-wp-totalpages': '0' }
			})
		})
		const filters = {
			after: '2026-01-01T00:00:00',
			before: '2026-01-31T23:59:59',
			modified_after: '2026-02-01T00:00:00',
			modified_before: '2026-02-28T23:59:59',
			dates_are_gmt: true,
			order: 'asc' as const,
			orderby: 'modified'
		}
		try {
			const client = new WoocommerceClient(auth)
			await client.listOrdersPage(filters)
			await client.listProductsPage(filters)
			await client.listCustomersPage(filters)
			expect(urls).toHaveLength(3)
			for (const url of urls) {
				expect(url.searchParams.get('after')).toBe(filters.after)
				expect(url.searchParams.get('before')).toBe(filters.before)
				expect(url.searchParams.get('modified_after')).toBe(filters.modified_after)
				expect(url.searchParams.get('modified_before')).toBe(filters.modified_before)
				expect(url.searchParams.get('dates_are_gmt')).toBe('true')
				expect(url.searchParams.get('order')).toBe('asc')
				expect(url.searchParams.get('orderby')).toBe('modified')
			}
		} finally {
			restore()
		}
	})

	test('returns X-WP-Total pagination metadata', async () => {
		const restore = mockFetch(
			() =>
				new Response(JSON.stringify([{ id: 1, date_modified_gmt: '2026-01-01T00:00:00' }]), {
					status: 200,
					headers: { 'x-wp-total': '41', 'x-wp-totalpages': '5' }
				})
		)
		try {
			const result = await new WoocommerceClient(auth).listOrdersPage({ page: 2, limit: 10 })
			expect(result.pagination).toEqual({
				page: 2,
				page_size: 10,
				total_items: 41,
				total_pages: 5,
				has_more: true
			})
		} finally {
			restore()
		}
	})

	test('page progression and final pages', async () => {
		const restore = mockFetch((url) => {
			const page = new URL(url).searchParams.get('page')
			const headers = { 'x-wp-total': '3', 'x-wp-totalpages': '2' }
			const id = page === '1' ? 1 : 2
			return new Response(JSON.stringify([{ id, date_modified_gmt: '2026-01-01T00:00:00' }]), {
				status: 200,
				headers
			})
		})
		try {
			const client = new WoocommerceClient(auth)
			const first = await client.listProductsPage({ page: 1, limit: 2 })
			expect(first.pagination.has_more).toBe(true)
			expect(first.pagination.page).toBe(1)
			const last = await client.listProductsPage({ page: 2, limit: 2 })
			expect(last.pagination.has_more).toBe(false)
			expect(last.pagination.page).toBe(2)
			expect(last.pagination.total_pages).toBe(2)
			expect(last.pagination.total_items).toBe(3)
		} finally {
			restore()
		}
	})

	test('empty pages return items and pagination', async () => {
		const restore = mockFetch(
			() =>
				new Response(JSON.stringify([]), {
					status: 200,
					headers: { 'x-wp-total': '0', 'x-wp-totalpages': '0' }
				})
		)
		try {
			const result = await new WoocommerceClient(auth).listCustomersPage({ page: 1, limit: 50 })
			expect(result.items).toEqual([])
			expect(result.pagination).toEqual({
				page: 1,
				page_size: 50,
				total_items: 0,
				total_pages: 0,
				has_more: false
			})
		} finally {
			restore()
		}
	})

	test('HTTP 429 remains retryable and preserves retry_after_ms', async () => {
		const restore = mockFetch(
			() =>
				new Response(
					JSON.stringify({
						code: 'woocommerce_rest_too_many_requests',
						message: 'Too many requests.'
					}),
					{ status: 429, headers: { 'Retry-After': '2' } }
				)
		)
		try {
			try {
				await new WoocommerceClient(auth).listOrdersPage()
				throw new Error('expected rate limit error')
			} catch (error) {
				expect(error).toBeInstanceOf(ToolError)
				if (error instanceof ToolError) {
					expect(error.code).toBe('rate_limited')
					expect(error.retryable).toBe(true)
					expect(error.details?.retry_after_ms).toBe(2000)
					expect(error.details?.woocommerce_code).toBe('woocommerce_rest_too_many_requests')
					expect(error.details?.woocommerce_message).toBe('Too many requests.')
				}
			}
		} finally {
			restore()
		}
	})
})
