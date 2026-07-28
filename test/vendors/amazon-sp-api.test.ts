import { describe, expect, test } from 'bun:test'

import { validateModule } from '../../src/core'
import { AmazonSpApiClient, amazonSpApiModule } from '../../src/vendors/amazon-sp-api'

function mockFetch(
	handler: (
		url: string,
		headers: Headers,
		init?: RequestInit,
		input?: RequestInfo | URL
	) => Response | Promise<Response>
) {
	const original = globalThis.fetch
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
		const headers = input instanceof Request ? new Headers(input.headers) : new Headers(init?.headers)
		return handler(url, headers, init, input)
	}) as typeof globalThis.fetch
	return () => {
		globalThis.fetch = original
	}
}

function isPost(init?: RequestInit, input?: RequestInfo | URL): boolean {
	if (init?.method) return init.method.toUpperCase() === 'POST'
	if (input instanceof Request) return input.method.toUpperCase() === 'POST'
	return false
}

const auth = {
	client_id: 'amzn1.application-oa2-client.x',
	client_secret: 'secret',
	refresh_token: 'Atzr|refresh',
	access_key_id: 'AKIA',
	secret_access_key: 'secretkey',
	region: 'us-east-1',
	endpoint: 'https://sellingpartnerapi-na.amazon.com' as const,
	marketplace_ids: ['ATVPDKIKX0DER']
}

describe('amazon-sp-api', () => {
	test('module contracts and tool ids', () => {
		expect(validateModule(amazonSpApiModule).ok).toBe(true)
		expect(amazonSpApiModule.tools.map((t) => t.id).sort()).toEqual([
			'amazon-sp-api-create-report',
			'amazon-sp-api-get-order',
			'amazon-sp-api-get-order-items',
			'amazon-sp-api-get-report',
			'amazon-sp-api-get-report-document',
			'amazon-sp-api-list-inventory-summaries',
			'amazon-sp-api-list-orders',
			'amazon-sp-api-list-reports',
			'amazon-sp-api-search-catalog-items',
			'amazon-sp-api-search-orders'
		])
	})

	test('listOrders exchanges LWA token then calls Orders API', async () => {
		let lwaCalls = 0
		const restore = mockFetch((url, headers, init, input) => {
			if (url.includes('api.amazon.com/auth/o2/token')) {
				lwaCalls += 1
				expect(isPost(init, input)).toBe(true)
				return new Response(JSON.stringify({ access_token: 'Atza|access', expires_in: 3600 }), {
					status: 200
				})
			}
			expect(url).toContain('sellingpartnerapi-na.amazon.com/orders/v0/orders')
			expect(url).toContain('MarketplaceIds=ATVPDKIKX0DER')
			// ofetch may pass a signed Request; token is on Request headers after LWA
			expect(headers.get('x-amz-access-token') ?? headers.get('X-Amz-Access-Token')).toBe('Atza|access')
			return new Response(
				JSON.stringify({
					payload: {
						Orders: [
							{
								AmazonOrderId: '111-222',
								OrderStatus: 'Shipped',
								PurchaseDate: '2026-01-01T00:00:00Z',
								OrderTotal: { Amount: '10.00', CurrencyCode: 'USD' }
							}
						]
					}
				}),
				{ status: 200 }
			)
		})

		try {
			const client = new AmazonSpApiClient(auth)
			const result = await client.listOrders({ created_after: '2026-01-01T00:00:00Z' })
			expect(lwaCalls).toBe(1)
			expect(result.items[0]?.amazon_order_id).toBe('111-222')
			expect(result.items[0]?.order_total_amount).toBe('10.00')
			expect(result.truncated).toBe(false)
		} finally {
			restore()
		}
	})

	test('searchOrders uses Orders API v2026 with FULFILLMENT includedData', async () => {
		let pages = 0
		const restore = mockFetch((url, headers) => {
			if (url.includes('api.amazon.com/auth/o2/token')) {
				return new Response(JSON.stringify({ access_token: 'Atza|access', expires_in: 3600 }), {
					status: 200
				})
			}
			expect(url).toContain('/orders/2026-01-01/orders')
			expect(url).toContain('createdAfter=')
			expect(url).toContain('includedData=FULFILLMENT')
			expect(headers.get('x-amz-access-token') ?? headers.get('X-Amz-Access-Token')).toBe('Atza|access')
			pages += 1
			if (pages === 1) {
				return new Response(
					JSON.stringify({
						orders: [
							{
								orderId: '111-aaa',
								createdTime: '2026-03-01T12:00:00Z',
								fulfillment: { fulfillmentStatus: 'SHIPPED' }
							}
						],
						pagination: { nextToken: 'page-2' }
					}),
					{ status: 200 }
				)
			}
			expect(url).toContain('paginationToken=page-2')
			return new Response(
				JSON.stringify({
					orders: [
						{
							orderId: '111-bbb',
							createdTime: '2026-03-02T12:00:00Z',
							fulfillment: { fulfillmentStatus: 'UNSHIPPED' }
						}
					]
				}),
				{ status: 200 }
			)
		})
		try {
			const client = new AmazonSpApiClient(auth)
			const result = await client.searchOrders({
				created_after: '2026-03-01T00:00:00Z',
				max_pages: 2
			})
			expect(pages).toBe(2)
			expect(result.items).toEqual([
				{ order_id: '111-aaa', created_time: '2026-03-01T12:00:00Z', fulfillment_status: 'SHIPPED' },
				{ order_id: '111-bbb', created_time: '2026-03-02T12:00:00Z', fulfillment_status: 'UNSHIPPED' }
			])
			expect(result.truncated).toBe(false)
		} finally {
			restore()
		}
	})

	test('createReport posts JSON body after LWA', async () => {
		const restore = mockFetch((url, headers, init, input) => {
			if (url.includes('api.amazon.com/auth/o2/token')) {
				return new Response(JSON.stringify({ access_token: 'Atza|access', expires_in: 3600 }), {
					status: 200
				})
			}
			expect(url).toContain('sellingpartnerapi-na.amazon.com/reports/2021-06-30/reports')
			expect(isPost(init, input)).toBe(true)
			expect(headers.get('x-amz-access-token') ?? headers.get('X-Amz-Access-Token')).toBe('Atza|access')
			return new Response(JSON.stringify({ reportId: 'r-123' }), { status: 200 })
		})

		try {
			const client = new AmazonSpApiClient(auth)
			const result = await client.createReport({
				report_type: 'GET_FLAT_FILE_OPEN_LISTINGS_DATA'
			})
			expect(result.report_id).toBe('r-123')
		} finally {
			restore()
		}
	})
})
