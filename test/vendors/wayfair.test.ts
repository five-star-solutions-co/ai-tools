import { describe, expect, test } from 'bun:test'
import { z } from 'zod'

import { runTool, ToolError, validateModule, withAuth } from '../../src/core'
import { WayfairClient, wayfairModule } from '../../src/vendors/wayfair'

const auth = {
	client_id: 'wayfair-client-id',
	client_secret: 'wayfair-client-secret',
	supplier_id: 2683
}

const graphqlBodySchema = z.object({
	query: z.string(),
	variables: z.record(z.string(), z.json()).optional()
})

function tokenResponse(): Response {
	return new Response(JSON.stringify({ access_token: 'wayfair-access-token', expires_in: 900 }), { status: 200 })
}

async function rejectionOf(promise: Promise<unknown>): Promise<ToolError> {
	try {
		await promise
	} catch (error) {
		if (error instanceof ToolError) return error
		throw error
	}
	throw new Error('expected ToolError rejection')
}

describe('wayfair', () => {
	test('module contracts and tool ids', () => {
		expect(validateModule(wayfairModule).ok).toBe(true)
		expect(wayfairModule.tools.map((tool) => tool.id).sort()).toEqual([
			'wayfair-list-catalog',
			'wayfair-list-dropship-orders'
		])
	})

	test('rejects invalid production OAuth credentials', () => {
		expect(() => new WayfairClient({ client_id: '', client_secret: '', supplier_id: 0 })).toThrow(ToolError)
	})

	test('authenticates once and lists supplier catalog pages', async () => {
		let tokenRequests = 0
		let catalogRequests = 0
		const client = new WayfairClient(auth, {
			fetch: async (input, init) => {
				const request = new Request(input, init)
				const url = new URL(request.url)
				if (url.pathname === '/oauth/token') {
					tokenRequests += 1
					const body: unknown = await request.json()
					expect(body).toEqual({
						grant_type: 'client_credentials',
						client_id: 'wayfair-client-id',
						client_secret: 'wayfair-client-secret',
						audience: 'https://api.wayfair.com/'
					})
					return tokenResponse()
				}

				catalogRequests += 1
				expect(url.origin + url.pathname).toBe('https://api.wayfair.io/v1/supplier-catalog-api/graphql')
				expect(request.headers.get('Authorization')).toBe('Bearer wayfair-access-token')
				expect(request.headers.get('X-SELECTED-SUPPLIER-ID')).toBe('2683')
				const body = graphqlBodySchema.parse(await request.json())
				expect(body.query).toContain('supplierCatalog')
				expect(body.variables).toEqual({ supplierId: 2683, paginationOptions: { page: 2, pageSize: 25 } })
				return new Response(
					JSON.stringify({
						data: {
							supplierCatalog: {
								supplierId: 2683,
								pageInfo: { page: 2, pageSize: 25, hasNextPage: true, totalPages: 4 },
								products: [
									{
										productId: 10354239,
										supplierPartNumber: 'SKU-1',
										status: 'LIVE_PRODUCT',
										skus: [{ sku: 'TPS1001', productName: 'Sink', isLive: true }]
									}
								]
							}
						}
					}),
					{ status: 200 }
				)
			}
		})

		const first = await client.listCatalogPage({ page: 2, page_size: 25 })
		const second = await client.listCatalogPage({ page: 2, page_size: 25 })

		expect(first).toMatchObject({ page: 2, page_size: 25, total_pages: 4, has_next_page: true })
		expect(first.items[0]?.supplierPartNumber).toBe('SKU-1')
		expect(second.items).toEqual(first.items)
		expect(tokenRequests).toBe(1)
		expect(catalogRequests).toBe(2)
	})

	test('lists dropship orders without requesting customer PII', async () => {
		const client = new WayfairClient(auth, {
			fetch: async (input, init) => {
				const request = new Request(input, init)
				const url = new URL(request.url)
				if (url.pathname === '/oauth/token') return tokenResponse()

				expect(url.origin + url.pathname).toBe('https://api.wayfair.com/v1/graphql')
				const body = graphqlBodySchema.parse(await request.json())
				expect(body.query).toContain('limit: 50')
				expect(body.query).toContain('fromDate: "2026-08-01"')
				expect(body.query).toContain('hasResponse: true')
				expect(body.query).toContain('poNumbers: ["CS12345678"]')
				expect(body.query).toContain('sortOrder: DESC')
				expect(body.query).not.toContain('customerName')
				expect(body.query).not.toContain('shipTo')
				expect(body.query).not.toContain('billTo')
				return new Response(
					JSON.stringify({
						data: {
							getDropshipPurchaseOrders: [
								{
									id: 'order-1',
									poNumber: 'CS12345678',
									poDate: '2026-08-01T01:02:03Z',
									warehouse: { id: 2683 },
									products: [{ partNumber: 'SKU-1', quantity: 2 }]
								}
							]
						}
					}),
					{ status: 200 }
				)
			}
		})

		const result = await client.listDropshipOrders({
			limit: 50,
			from_date: '2026-08-01',
			has_response: true,
			po_numbers: ['CS12345678'],
			sort_order: 'DESC'
		})

		expect(result.items[0]?.poNumber).toBe('CS12345678')
		expect(result).toMatchObject({ limit: 50, limit_reached: false })
	})

	test('runs the catalog tool through bound credentials', async () => {
		const tool = withAuth(wayfairModule, auth).tools.find((entry) => entry.id === 'wayfair-list-catalog')
		if (!tool) throw new Error('missing Wayfair catalog tool')

		const result = await runTool(
			tool,
			{ page: 1, page_size: 10 },
			{
				fetch: async (input) => {
					const url = new URL(new Request(input).url)
					if (url.pathname === '/oauth/token') return tokenResponse()
					return new Response(
						JSON.stringify({
							data: {
								supplierCatalog: {
									supplierId: 2683,
									pageInfo: { page: 1, pageSize: 10, hasNextPage: false, totalPages: 0 },
									products: []
								}
							}
						}),
						{ status: 200 }
					)
				}
			}
		)

		expect(result).toEqual({ items: [], page: 1, page_size: 10, total_pages: 0, has_next_page: false })
	})

	test('maps GraphQL errors to upstream ToolError', async () => {
		const client = new WayfairClient(auth, {
			fetch: async (input) => {
				const url = new URL(new Request(input).url)
				if (url.pathname === '/oauth/token') return tokenResponse()
				return new Response(JSON.stringify({ errors: [{ message: 'Access denied' }], data: null }), { status: 200 })
			}
		})

		expect(await rejectionOf(client.listCatalogPage())).toMatchObject({
			code: 'upstream',
			retryable: false,
			details: { issues: ['Access denied'] }
		})
	})

	test('preserves 429 Retry-After metadata for host retry policy', async () => {
		const client = new WayfairClient(auth, {
			fetch: async (input) => {
				const url = new URL(new Request(input).url)
				if (url.pathname === '/oauth/token') return tokenResponse()
				return new Response(JSON.stringify({ errors: [] }), {
					status: 429,
					headers: { 'Retry-After': '30' }
				})
			}
		})

		expect(await rejectionOf(client.listDropshipOrders())).toMatchObject({
			code: 'rate_limited',
			retryable: true,
			details: { status: 429, retry_after_ms: 30_000 }
		})
	})
})
