import { describe, expect, test } from 'bun:test'
import { isPlainObject } from 'es-toolkit'

import { runTool, validateModule, withAuth } from '../../src/core'
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
})
