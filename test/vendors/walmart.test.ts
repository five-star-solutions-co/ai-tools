import { describe, expect, test } from 'bun:test'

import { runTool, ToolError, validateModule, withAuth } from '../../src/core'
import { WalmartClient, walmartModule } from '../../src/vendors/walmart'

const auth = {
	client_id: 'walmart-client-id',
	client_secret: 'walmart-client-secret'
}

function tokenResponse(): Response {
	return new Response(JSON.stringify({ access_token: 'walmart-access-token', expires_in: 900 }), { status: 200 })
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

describe('walmart', () => {
	test('module contracts and tool ids', () => {
		expect(validateModule(walmartModule).ok).toBe(true)
		expect(walmartModule.tools.map((tool) => tool.id).sort()).toEqual([
			'walmart-list-items',
			'walmart-list-orders',
			'walmart-list-recon-report-dates',
			'walmart-list-returns'
		])
	})

	test('rejects invalid OAuth credentials', () => {
		expect(() => new WalmartClient({ client_id: '', client_secret: '' })).toThrow(ToolError)
	})

	test('authenticates once, maps order filters, and follows the opaque provider cursor', async () => {
		let tokenRequests = 0
		let orderRequests = 0
		const client = new WalmartClient(auth, {
			fetch: async (input, init) => {
				const request = new Request(input, init)
				const url = new URL(request.url)
				if (url.pathname === '/v3/token') {
					tokenRequests += 1
					expect(request.method).toBe('POST')
					expect(request.headers.get('Authorization')).toBe(`Basic ${btoa('walmart-client-id:walmart-client-secret')}`)
					expect(request.headers.get('Content-Type')).toContain('application/x-www-form-urlencoded')
					expect(await request.text()).toBe('grant_type=client_credentials')
					return tokenResponse()
				}

				orderRequests += 1
				expect(url.origin + url.pathname).toBe('https://marketplace.walmartapis.com/v3/orders')
				expect(request.headers.get('WM_SEC.ACCESS_TOKEN')).toBe('walmart-access-token')
				expect(request.headers.get('WM_MARKET')).toBe('US')
				expect(request.headers.get('WM_SVC.NAME')).toBe('Walmart Marketplace')
				expect(request.headers.get('WM_QOS.CORRELATION_ID')).toBeTruthy()

				if (orderRequests === 1) {
					expect(url.searchParams.get('limit')).toBe('200')
					expect(url.searchParams.get('sku')).toBe('SKU-1')
					expect(url.searchParams.get('customerOrderId')).toBe('CUSTOMER-1')
					expect(url.searchParams.get('purchaseOrderId')).toBe('PO-1')
					expect(url.searchParams.get('status')).toBe('Shipped')
					expect(url.searchParams.get('createdStartDate')).toBe('2026-08-01T00:00:00Z')
					expect(url.searchParams.get('lastModifiedEndDate')).toBe('2026-08-30')
					expect(url.searchParams.get('productInfo')).toBe('true')
					expect(url.searchParams.get('shipNodeType')).toBe('WFSFulfilled')
					return new Response(
						JSON.stringify({
							list: {
								meta: { totalCount: 2, limit: 200, nextCursor: '?limit=200&nextCursor=orders-2' },
								elements: { order: { purchaseOrderId: 'PO-1', customerOrderId: 'CUSTOMER-1' } }
							}
						}),
						{ status: 200 }
					)
				}

				expect(url.searchParams.get('nextCursor')).toBe('orders-2')
				expect(url.searchParams.get('sku')).toBeNull()
				return new Response(
					JSON.stringify({
						list: {
							meta: { totalCount: 2, limit: 200 },
							elements: { order: [{ purchaseOrderId: 'PO-2' }] }
						}
					}),
					{ status: 200 }
				)
			}
		})

		const first = await client.listOrdersPage({
			limit: 200,
			sku: 'SKU-1',
			customer_order_id: 'CUSTOMER-1',
			purchase_order_id: 'PO-1',
			status: 'Shipped',
			created_start_date: '2026-08-01T00:00:00Z',
			last_modified_end_date: '2026-08-30',
			product_info: true,
			ship_node_type: 'WFSFulfilled'
		})
		const second = await client.listOrdersPage({ cursor: first.next_cursor })

		expect(first).toMatchObject({ total_count: 2, limit: 200, truncated: true })
		expect(first.items).toEqual([{ purchaseOrderId: 'PO-1', customerOrderId: 'CUSTOMER-1' }])
		expect(second.items).toEqual([{ purchaseOrderId: 'PO-2' }])
		expect(second.truncated).toBe(false)
		expect(tokenRequests).toBe(1)
		expect(orderRequests).toBe(2)
	})

	test('lists item pages with the provider cursor and local progress, not a wire offset', async () => {
		let itemRequests = 0
		const client = new WalmartClient(auth, {
			fetch: async (input, init) => {
				const request = new Request(input, init)
				const url = new URL(request.url)
				if (url.pathname === '/v3/token') return tokenResponse()

				itemRequests += 1
				expect(url.pathname).toBe('/v3/items')
				if (itemRequests === 1) {
					expect(url.searchParams.get('nextCursor')).toBe('*')
					expect(url.searchParams.get('offset')).toBe('0')
					expect(url.searchParams.get('limit')).toBe('50')
					expect(url.searchParams.get('sku')).toBe('SKU-1')
					return new Response(
						JSON.stringify({
							ItemResponse: [{ sku: 'SKU-1' }, { sku: 'SKU-2' }],
							totalItems: 3,
							nextCursor: 'items-cursor'
						}),
						{ status: 200 }
					)
				}

				expect(url.searchParams.get('nextCursor')).toBe('items-cursor')
				expect(url.searchParams.get('offset')).toBeNull()
				expect(url.searchParams.get('sku')).toBeNull()
				return new Response(
					JSON.stringify({ itemResponse: [{ sku: 'SKU-3' }], totalItems: 3, nextCursor: 'items-cursor' }),
					{ status: 200 }
				)
			}
		})

		const first = await client.listItemsPage({ limit: 50, sku: 'SKU-1' })
		const second = await client.listItemsPage({ cursor: first.next_cursor, offset: first.next_offset, limit: 50 })

		expect(first).toMatchObject({ total_count: 3, offset: 0, limit: 50, next_offset: 2, truncated: true })
		expect(second.items).toEqual([{ sku: 'SKU-3' }])
		expect(second.truncated).toBe(false)
		expect(second.next_offset).toBeUndefined()
	})

	test('round-trips every continuation through a catalog larger than the provider offset limit', async () => {
		let itemRequests = 0
		const total = 12_001
		const client = new WalmartClient(auth, {
			fetch: async (input, init) => {
				const url = new URL(new Request(input, init).url)
				if (url.pathname === '/v3/token') return tokenResponse()
				const offset = itemRequests * 1_000
				expect(url.searchParams.get('offset')).toBe(itemRequests === 0 ? '0' : null)
				expect(url.searchParams.get('nextCursor')).toBe(itemRequests === 0 ? '*' : 'reusable-cursor')
				expect(url.searchParams.get('limit')).toBe('1000')
				itemRequests += 1
				return Response.json({
					ItemResponse: Array.from({ length: Math.min(1_000, total - offset) }, (_, i) => ({
						sku: `SKU-${offset + i}`
					})),
					totalItems: total,
					nextCursor: 'reusable-cursor'
				})
			}
		})
		let page = await client.listItemsPage({ limit: 1_000 })
		let observed = page.items.length
		while (page.truncated) {
			expect(page.next_offset).toBe(observed)
			page = await client.listItemsPage({ cursor: page.next_cursor, offset: page.next_offset, limit: 1_000 })
			observed += page.items.length
			if (itemRequests > 13) throw new Error('Item pagination did not terminate')
		}
		expect(itemRequests).toBe(13)
		expect(observed).toBe(total)
		expect(page).toMatchObject({ offset: 12_000, total_count: total, truncated: false, items: [{ sku: 'SKU-12000' }] })
		expect(page.next_offset).toBeUndefined()
	})

	test.each([{ offset: 10_001 }, { cursor: '*', offset: 10_001 }, { cursor: 'continuation-without-progress' }])(
		'rejects invalid item progress before HTTP: %j',
		async (input) => {
			let requests = 0
			const client = new WalmartClient(auth, {
				fetch: async () => {
					requests += 1
					throw new Error('Invalid pagination must not make a request')
				}
			})
			expect(await rejectionOf(client.listItemsPage(input))).toMatchObject({ code: 'bad_input' })
			expect(requests).toBe(0)
		}
	)

	test('keeps bounded offset pagination available when no provider cursor is returned', async () => {
		let requests = 0
		const client = new WalmartClient(auth, {
			fetch: async (input, init) => {
				const url = new URL(new Request(input, init).url)
				if (url.pathname === '/v3/token') return tokenResponse()
				expect(url.searchParams.get('nextCursor')).toBe('*')
				expect(url.searchParams.get('offset')).toBe(requests === 0 ? '9999' : '10000')
				expect(url.searchParams.get('lifecycleStatus')).toBe('ARCHIVED')
				requests += 1
				return Response.json({
					ItemResponse: [{ sku: `SKU-${requests}`, lifecycleStatus: 'ARCHIVED' }],
					totalItems: 10_001
				})
			}
		})
		const first = await client.listItemsPage({ offset: 9_999, limit: 1, lifecycle_status: 'ARCHIVED' })
		expect(first).toMatchObject({ next_offset: 10_000, truncated: true })
		const last = await client.listItemsPage({ offset: first.next_offset, limit: 1, lifecycle_status: 'ARCHIVED' })
		expect(last).toMatchObject({ truncated: false, offset: 10_000 })
		expect(last.next_offset).toBeUndefined()
	})

	test.each([
		{ totalItems: 1, ItemResponse: [] },
		{ totalItems: 0, ItemResponse: [{ sku: 'one' }] },
		{ totalItems: 2, ItemResponse: [{ sku: 'one' }, { sku: 'two' }] },
		{ ItemResponse: [] },
		{ totalItems: 0 }
	])('rejects inconsistent or missing item pagination: %j', async (body) => {
		const client = new WalmartClient(auth, {
			fetch: async (input) => {
				if (new URL(new Request(input).url).pathname === '/v3/token') return tokenResponse()
				return Response.json(body)
			}
		})
		expect(await rejectionOf(client.listItemsPage({ limit: 1 }))).toMatchObject({ code: 'upstream' })
	})

	test.each([undefined, '*'])('rejects an unusable continuation past 10000: %s', async (nextCursor) => {
		const client = new WalmartClient(auth, {
			fetch: async (input) => {
				if (new URL(new Request(input).url).pathname === '/v3/token') return tokenResponse()
				return Response.json({ ItemResponse: [{ sku: 'one' }], totalItems: 12_000, nextCursor })
			}
		})
		expect(await rejectionOf(client.listItemsPage({ offset: 10_000 }))).toMatchObject({ code: 'upstream' })
	})

	test('accepts authoritative empty lists and retains inactive item fields', async () => {
		const item = { sku: 'retired', lifecycleStatus: 'RETIRED', publishedStatus: 'UNPUBLISHED', custom: { kept: true } }
		let requests = 0
		const client = new WalmartClient(auth, {
			fetch: async (input) => {
				if (new URL(new Request(input).url).pathname === '/v3/token') return tokenResponse()
				requests += 1
				return requests === 1
					? Response.json({ ItemResponse: [], totalItems: 0 })
					: Response.json({ itemResponse: [item], totalItems: 1 })
			}
		})
		expect(await client.listItemsPage()).toEqual({ items: [], total_count: 0, offset: 0, limit: 20, truncated: false })
		expect((await client.listItemsPage()).items).toEqual([item])
	})

	test.each([400, 401, 429, 500])('surfaces item HTTP %s without restarting or falling back', async (status) => {
		let requests = 0
		const client = new WalmartClient(auth, {
			fetch: async (input, init) => {
				const url = new URL(new Request(input, init).url)
				if (url.pathname === '/v3/token') return tokenResponse()
				expect(Object.fromEntries(url.searchParams)).toEqual({ nextCursor: 'expired-or-retry-cursor', limit: '1000' })
				requests += 1
				return Response.json(
					{ errors: [{ code: 'INVALID', description: 'provider failure' }] },
					{ status, headers: { 'Retry-After': '30' } }
				)
			}
		})
		const error = await rejectionOf(
			client.listItemsPage({ cursor: 'expired-or-retry-cursor', offset: 11_000, limit: 1_000 })
		)
		expect(error.details).toMatchObject({ status })
		if (status === 429)
			expect(error).toMatchObject({ code: 'rate_limited', retryable: true, details: { retry_after_ms: 30_000 } })
		expect(requests).toBe(1)
	})

	test('agent item tool uses the same large-catalog continuation contract', async () => {
		const tool = walmartModule.tools.find((entry) => entry.id === 'walmart-list-items')
		if (!tool) throw new Error('Expected Walmart item tool')
		const result = await runTool(
			tool,
			{ cursor: 'agent-cursor', offset: 11_000, limit: 1 },
			{
				auth,
				fetch: async (input, init) => {
					const url = new URL(new Request(input, init).url)
					if (url.pathname === '/v3/token') return tokenResponse()
					expect(Object.fromEntries(url.searchParams)).toEqual({ nextCursor: 'agent-cursor', limit: '1' })
					return Response.json({ ItemResponse: [{ sku: 'last' }], totalItems: 11_001 })
				}
			}
		)
		expect(result).toMatchObject({ offset: 11_000, total_count: 11_001, truncated: false, items: [{ sku: 'last' }] })
	})

	test('maps returns filters and follows the opaque provider cursor', async () => {
		let returnRequests = 0
		const client = new WalmartClient(auth, {
			fetch: async (input, init) => {
				const request = new Request(input, init)
				const url = new URL(request.url)
				if (url.pathname === '/v3/token') return tokenResponse()

				returnRequests += 1
				if (returnRequests === 1) {
					expect(url.searchParams.get('limit')).toBe('200')
					expect(url.searchParams.get('status')).toBe('COMPLETED')
					expect(url.searchParams.get('returnType')).toBe('REFUND')
					expect(url.searchParams.get('isWFSEnabled')).toBe('Y')
					expect(url.searchParams.get('returnCreationStartDate')).toBe('2026-08-01')
					return new Response(
						JSON.stringify({
							meta: { totalCount: 2, limit: 200, nextCursor: '?limit=200&nextCursor=returns-2' },
							returnOrders: [{ returnOrderId: 'RETURN-1', customerOrderId: 'CUSTOMER-1' }]
						}),
						{ status: 200 }
					)
				}

				expect(url.searchParams.get('nextCursor')).toBe('returns-2')
				return new Response(
					JSON.stringify({
						meta: { totalCount: 2, limit: 200 },
						returnOrders: [{ returnOrderId: 'RETURN-2' }]
					}),
					{ status: 200 }
				)
			}
		})

		const first = await client.listReturnsPage({
			limit: 200,
			status: 'COMPLETED',
			return_type: 'REFUND',
			is_wfs_enabled: true,
			return_creation_start_date: '2026-08-01'
		})
		const second = await client.listReturnsPage({ cursor: first.next_cursor })

		expect(first.items[0]?.returnOrderId).toBe('RETURN-1')
		expect(second.items[0]?.returnOrderId).toBe('RETURN-2')
		expect(second.truncated).toBe(false)
	})

	test('lists recon dates and downloads raw report bytes for host processing', async () => {
		const client = new WalmartClient(auth, {
			fetch: async (input, init) => {
				const request = new Request(input, init)
				const url = new URL(request.url)
				if (url.pathname === '/v3/token') return tokenResponse()
				if (url.pathname.endsWith('/availableReconFiles')) {
					expect(url.searchParams.get('reportVersion')).toBe('v1')
					return new Response(JSON.stringify({ availableApReportDates: ['08282026', '08292026'] }), { status: 200 })
				}

				expect(url.pathname).toBe('/v3/report/reconreport/reconFile')
				expect(url.searchParams.get('reportDate')).toBe('08292026')
				expect(url.searchParams.get('reportVersion')).toBe('v1')
				expect(request.headers.get('Accept')).toBe('application/octet-stream')
				return new Response(new Uint8Array([65, 66, 67]), {
					status: 200,
					headers: { 'Content-Type': 'text/csv' }
				})
			}
		})

		expect(await client.listReconReportDates()).toEqual({ dates: ['08282026', '08292026'] })
		expect(await client.downloadReconReportBytes({ report_date: '08292026' })).toEqual({
			report_date: '08292026',
			content_type: 'text/csv',
			byte_length: 3,
			bytes: new Uint8Array([65, 66, 67])
		})
	})

	test('runs the orders tool through bound OAuth credentials', async () => {
		const tool = withAuth(walmartModule, auth).tools.find((entry) => entry.id === 'walmart-list-orders')
		if (!tool) throw new Error('missing Walmart orders tool')

		const result = await runTool(
			tool,
			{ limit: 1 },
			{
				fetch: async (input) => {
					const url = new URL(new Request(input).url)
					if (url.pathname === '/v3/token') return tokenResponse()
					return new Response(
						JSON.stringify({
							list: { meta: { totalCount: 0, limit: 1 }, elements: { order: [] } }
						}),
						{ status: 200 }
					)
				}
			}
		)

		expect(result).toEqual({ items: [], total_count: 0, limit: 1, truncated: false })
	})

	test('rejects malformed provider pages', async () => {
		const client = new WalmartClient(auth, {
			fetch: async (input) => {
				const url = new URL(new Request(input).url)
				if (url.pathname === '/v3/token') return tokenResponse()
				return new Response(JSON.stringify({ list: { meta: {}, elements: {} } }), { status: 200 })
			}
		})

		expect(await rejectionOf(client.listOrdersPage())).toMatchObject({ code: 'upstream', retryable: false })
	})

	test('preserves 429 Retry-After metadata for host retry policy', async () => {
		const client = new WalmartClient(auth, {
			fetch: async (input) => {
				const url = new URL(new Request(input).url)
				if (url.pathname === '/v3/token') return tokenResponse()
				return new Response(JSON.stringify({ errors: [] }), {
					status: 429,
					headers: { 'Retry-After': '30' }
				})
			}
		})

		expect(await rejectionOf(client.listReturnsPage())).toMatchObject({
			code: 'rate_limited',
			retryable: true,
			details: { status: 429, retry_after_ms: 30_000 }
		})
	})
})
