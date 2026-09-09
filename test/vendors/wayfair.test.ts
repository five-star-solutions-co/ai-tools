import { describe, expect, spyOn, test } from 'bun:test'
import { z } from 'zod'

import { runTool, ToolError, validateModule, withAuth } from '../../src/core'
import {
	WayfairClient,
	wayfairAcceptDropshipOrderInputSchema,
	wayfairConfirmCancellationRequestsInputSchema,
	wayfairListCancellationRequestsByOrdersInputSchema,
	wayfairListCancellationRequestsByWarehousesInputSchema,
	wayfairModule,
	wayfairRejectCancellationRequestsInputSchema,
	wayfairSendShipmentNoticeInputSchema
} from '../../src/vendors/wayfair'
import type {
	WayfairAcceptDropshipOrderInput,
	WayfairCancellationRequest,
	WayfairCancellationResponse,
	WayfairSendShipmentNoticeInput
} from '../../src/vendors/wayfair'

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
			'wayfair-accept-dropship-order',
			'wayfair-confirm-cancellation-requests',
			'wayfair-get-dropship-order',
			'wayfair-list-cancellation-requests-by-orders',
			'wayfair-list-cancellation-requests-by-warehouses',
			'wayfair-list-catalog',
			'wayfair-list-dropship-orders',
			'wayfair-reject-cancellation-requests',
			'wayfair-send-shipment-notice'
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

const cancellationRequest: WayfairCancellationRequest = {
	requestId: '4',
	status: 'CANCELLATION_PENDING_SUPPLIER_CONFIRMATION',
	requestedAt: '2026-09-09T10:15:30-04:00',
	cancellationReason: { reason: 'No longer needed' },
	purchaseOrder: { poNumber: 'CS12345678', warehouse: { warehouseId: 2683 } },
	cancelledProduct: {
		partNumber: 'SKU-1',
		cancellationQuantity: { originalQuantity: 3, cancelledQuantity: 1 }
	}
}

const cancellationResults: WayfairCancellationResponse[] = [
	{ requestId: 4, status: 'SUCCESS', errorCode: 0, errorMessage: '' },
	{ requestId: '5', status: 'FAILURE', errorCode: 103, errorMessage: 'Request is already processed' },
	{ requestId: '6', status: 'SUCCESS', errorCode: null, errorMessage: null }
]

function cancellationClient(handler: (request: Request) => Response | Promise<Response>): WayfairClient {
	return new WayfairClient(auth, {
		fetch: async (input, init) => {
			const request = new Request(input, init)
			if (new URL(request.url).pathname === '/oauth/token') return tokenResponse()
			expect(request.url).toBe('https://api.wayfair.io/v1/supplier-order-api/graphql')
			expect(request.method).toBe('POST')
			expect(request.headers.get('Authorization')).toBe('Bearer wayfair-access-token')
			expect(request.headers.get('Content-Type')).toBe('application/json')
			return handler(request)
		}
	})
}

describe('wayfair cancellation request lifecycle', () => {
	test('reads requests by purchase orders without mutations and preserves nullable fields and statuses', async () => {
		const items: WayfairCancellationRequest[] = [
			cancellationRequest,
			{ ...cancellationRequest, requestId: 5, status: 'CANCELLED', cancellationReason: null },
			{
				...cancellationRequest,
				requestId: '6',
				status: 'CANCELLATION_REJECTED',
				cancelledProduct: { partNumber: 'SKU-1', cancellationQuantity: null }
			}
		]
		let calls = 0
		const client = cancellationClient(async (request) => {
			calls += 1
			const body = graphqlBodySchema.parse(await request.json())
			expect(body.query).toContain('$poInput: LineItemCancellationRequestByPurchaseOrdersInput!')
			expect(body.query).toContain('lineItemCancellationRequestByPurchaseOrders(poInput: $poInput)')
			expect(body.query).toContain('cancellationQuantity { originalQuantity cancelledQuantity }')
			expect(body.query).not.toContain('mutation')
			expect(body.query).not.toContain('confirmLineItemCancellationRequest')
			expect(body.query).not.toContain('rejectLineItemCancellationRequest')
			expect(body.query).not.toContain('CS12345678')
			expect(body.variables).toEqual({ poInput: { poNumbers: ['CS12345678'] } })
			return Response.json({ data: { lineItemCancellationRequestByPurchaseOrders: items } })
		})
		expect(await client.listCancellationRequestsByOrders({ po_numbers: ['CS12345678'] })).toEqual({ items })
		expect(calls).toBe(1)
	})

	test('maps warehouse status and optional date filters without inventing pagination or writes', async () => {
		for (const filters of [
			{},
			{ from_datetime: '2026-09-01T00:00:00Z' },
			{ to_datetime: '2026-09-09T10:15:30-04:00' },
			{ from_datetime: '2026-09-09T14:15:29Z', to_datetime: '2026-09-09T10:15:30-04:00' }
		]) {
			let calls = 0
			const client = cancellationClient(async (request) => {
				calls += 1
				const body = graphqlBodySchema.parse(await request.json())
				expect(body.query).toContain('$warehouseInput: LineItemCancellationRequestByWarehousesInput!')
				expect(body.query).toContain('lineItemCancellationRequestByWarehouses(warehouseInput: $warehouseInput)')
				expect(body.query).not.toContain('mutation')
				expect(body.query).not.toContain('cursor')
				expect(body.variables).toEqual({
					warehouseInput: {
						warehouseIds: [2683],
						status: 'CANCELLED',
						...(filters.from_datetime && { fromDatetime: filters.from_datetime }),
						...(filters.to_datetime && { toDatetime: filters.to_datetime })
					}
				})
				return Response.json({ data: { lineItemCancellationRequestByWarehouses: [] } })
			})
			expect(
				await client.listCancellationRequestsByWarehouses({
					warehouse_ids: [2683],
					status: 'CANCELLED',
					...filters
				})
			).toEqual({ items: [] })
			expect(calls).toBe(1)
		}
	})

	test('confirms one native batch and preserves mixed per-request results', async () => {
		let calls = 0
		const client = cancellationClient(async (request) => {
			calls += 1
			const body = graphqlBodySchema.parse(await request.json())
			expect(body.query).toContain('$confirmationInputs: [ConfirmLineItemCancellationRequestInput!]!')
			expect(body.query).toContain('confirmLineItemCancellationRequest(confirmationInputs: $confirmationInputs)')
			expect(body.variables).toEqual({ confirmationInputs: [{ requestId: 4 }, { requestId: '5' }, { requestId: '6' }] })
			return Response.json({ data: { confirmLineItemCancellationRequest: cancellationResults } })
		})
		expect(await client.confirmCancellationRequests({ request_ids: [4, '5', '6'] })).toEqual({
			items: cancellationResults
		})
		expect(calls).toBe(1)
	})

	test('rejects requests using the documented response key and puts reasons only in variables', async () => {
		const reason = 'Already shipped " }) { confirmLineItemCancellationRequest } #'
		let calls = 0
		const client = cancellationClient(async (request) => {
			calls += 1
			const body = graphqlBodySchema.parse(await request.json())
			expect(body.query).toContain('$rejectionInputs: [RejectLineItemCancellationRequestInput!]!')
			expect(body.query).toContain('rejectLineItemCancellationRequest(rejectionInputs: $rejectionInputs)')
			expect(body.query).not.toContain(reason)
			expect(body.variables).toEqual({
				rejectionInputs: [
					{ requestId: 4, reason },
					{ requestId: '5', reason: 'Already processed' },
					{ requestId: '6', reason: 'Shipped' }
				]
			})
			return Response.json({ data: { rejectLineItemCancellationRequest: cancellationResults } })
		})
		expect(
			await client.rejectCancellationRequests({
				requests: [
					{ request_id: 4, reason },
					{ request_id: '5', reason: 'Already processed' },
					{ request_id: '6', reason: 'Shipped' }
				]
			})
		).toEqual({ items: cancellationResults })
		expect(calls).toBe(1)
	})

	test('rejects invalid direct-client inputs before auth or vendor HTTP', async () => {
		let calls = 0
		const client = new WayfairClient(auth, {
			fetch: async () => {
				calls += 1
				throw new Error('network must not be called')
			}
		})
		const invalid = [
			client.listCancellationRequestsByOrders({ po_numbers: [] }),
			client.listCancellationRequestsByOrders({ po_numbers: ['INVALID-PO'] }),
			client.listCancellationRequestsByOrders({ po_numbers: Array.from({ length: 51 }, () => 'CS123') }),
			client.listCancellationRequestsByWarehouses({ warehouse_ids: [], status: 'CANCELLED' }),
			client.listCancellationRequestsByWarehouses({ warehouse_ids: [1.5], status: 'CANCELLED' }),
			client.listCancellationRequestsByWarehouses({ warehouse_ids: [2_147_483_648], status: 'CANCELLED' }),
			client.listCancellationRequestsByWarehouses({
				warehouse_ids: Array.from({ length: 51 }, () => 2683),
				status: 'CANCELLED'
			}),
			client.confirmCancellationRequests({ request_ids: [] }),
			client.confirmCancellationRequests({ request_ids: [''] }),
			client.confirmCancellationRequests({ request_ids: [1.5] }),
			client.confirmCancellationRequests({ request_ids: Array.from({ length: 101 }, (_, index) => index) }),
			client.rejectCancellationRequests({ requests: [] }),
			client.rejectCancellationRequests({ requests: [{ request_id: '4', reason: '' }] }),
			client.rejectCancellationRequests({ requests: [{ request_id: '4', reason: ' \n\t ' }] }),
			client.rejectCancellationRequests({ requests: [{ request_id: '4', reason: 'x'.repeat(501) }] }),
			client.rejectCancellationRequests({
				requests: Array.from({ length: 101 }, (_, index) => ({
					request_id: index,
					reason: 'Already shipped'
				}))
			})
		]
		for (const promise of invalid) expect(await rejectionOf(promise)).toMatchObject({ code: 'bad_input' })
		expect(calls).toBe(0)
	})

	test('accepts exact batch limits and follows the published PO validation pattern', () => {
		expect(
			wayfairListCancellationRequestsByOrdersInputSchema.safeParse({
				po_numbers: Array.from({ length: 50 }, (_, index) => `CS${index}`)
			}).success
		).toBe(true)
		expect(wayfairListCancellationRequestsByOrdersInputSchema.safeParse({ po_numbers: ['CS', 'cs123'] }).success).toBe(
			true
		)
		expect(
			wayfairListCancellationRequestsByWarehousesInputSchema.safeParse({
				warehouse_ids: Array.from({ length: 50 }, (_, index) => index),
				status: 'CANCELLED'
			}).success
		).toBe(true)
		expect(
			wayfairConfirmCancellationRequestsInputSchema.safeParse({
				request_ids: Array.from({ length: 100 }, (_, index) => index)
			}).success
		).toBe(true)
		expect(
			wayfairRejectCancellationRequestsInputSchema.safeParse({
				requests: Array.from({ length: 100 }, (_, index) => ({ request_id: index, reason: 'x'.repeat(500) }))
			}).success
		).toBe(true)
	})

	test('requires a documented warehouse filter status and rejects unknown auth inputs', () => {
		for (const input of [
			{ warehouse_ids: [2683] },
			{ warehouse_ids: [2683], status: 'CANCELLATION_REJECTED' },
			{ warehouse_ids: [2683], status: 'CANCELLED', client_secret: 'not-a-tool-input' }
		]) {
			expect(wayfairListCancellationRequestsByWarehousesInputSchema.safeParse(input).success).toBe(false)
		}
		expect(
			wayfairListCancellationRequestsByOrdersInputSchema.safeParse({
				po_numbers: ['CS123'],
				client_id: 'not-a-tool-input'
			}).success
		).toBe(false)
		expect(
			wayfairConfirmCancellationRequestsInputSchema.safeParse({
				request_ids: ['4'],
				auth
			}).success
		).toBe(false)
		expect(
			wayfairRejectCancellationRequestsInputSchema.safeParse({
				requests: [{ request_id: '4', reason: 'Shipped', client_secret: 'not-a-tool-input' }]
			}).success
		).toBe(false)
	})

	test('validates calendar dates, timezones and chronological date ranges before HTTP', async () => {
		const client = new WayfairClient(auth, {
			fetch: async () => {
				throw new Error('unexpected HTTP')
			}
		})
		for (const filters of [
			{ from_datetime: '2026-02-30T12:00:00Z' },
			{ from_datetime: '2026-09-09T12:00:00' },
			{ to_datetime: '2026-09-09' },
			{ from_datetime: '2026-09-09T14:15:30Z', to_datetime: '2026-09-09T10:15:30-04:00' },
			{ from_datetime: '2026-09-09T14:15:31Z', to_datetime: '2026-09-09T10:15:30-04:00' }
		]) {
			expect(
				await rejectionOf(
					client.listCancellationRequestsByWarehouses({
						warehouse_ids: [2683],
						status: 'CANCELLED',
						...filters
					})
				)
			).toMatchObject({ code: 'bad_input' })
		}
	})

	test('maps documented GraphQL categories without exposing upstream messages or paths', async () => {
		for (const [extensions, code] of [
			[{ category: 'PERMISSION_DENIED' }, 'forbidden'],
			[{ category: 'BAD_REQUEST' }, 'bad_input'],
			[{ category: 'INTERNAL' }, 'upstream'],
			[null, 'upstream'],
			['invalid', 'upstream'],
			[{}, 'upstream']
		] as const) {
			const client = cancellationClient(() =>
				Response.json({
					data: null,
					errors: [{ message: 'Sensitive submitted reason', extensions, path: ['Sensitive resource'] }]
				})
			)
			for (const promise of [
				client.listCancellationRequestsByOrders({ po_numbers: ['CS123'] }),
				client.listCancellationRequestsByWarehouses({ warehouse_ids: [2683], status: 'CANCELLED' }),
				client.confirmCancellationRequests({ request_ids: ['4'] }),
				client.rejectCancellationRequests({ requests: [{ request_id: '4', reason: 'Already shipped' }] })
			]) {
				const error = await rejectionOf(promise)
				expect(error).toMatchObject({ code, retryable: false, details: { error_count: 1 } })
				expect(JSON.stringify(error)).not.toContain('Sensitive')
				expect(error.message).not.toContain('Sensitive')
			}
		}
	})

	test('rejects absent, null or malformed lists rather than inventing empty results', async () => {
		for (const [field, invoke] of [
			[
				'lineItemCancellationRequestByPurchaseOrders',
				(client: WayfairClient) => client.listCancellationRequestsByOrders({ po_numbers: ['CS123'] })
			],
			[
				'lineItemCancellationRequestByWarehouses',
				(client: WayfairClient) =>
					client.listCancellationRequestsByWarehouses({ warehouse_ids: [2683], status: 'CANCELLED' })
			],
			[
				'confirmLineItemCancellationRequest',
				(client: WayfairClient) => client.confirmCancellationRequests({ request_ids: ['4'] })
			],
			[
				'rejectLineItemCancellationRequest',
				(client: WayfairClient) =>
					client.rejectCancellationRequests({ requests: [{ request_id: '4', reason: 'Shipped' }] })
			]
		] as const) {
			for (const body of [{}, { data: null }, { data: {} }, { data: { [field]: null } }, { data: { [field]: [{}] } }]) {
				expect(await rejectionOf(invoke(cancellationClient(() => Response.json(body))))).toMatchObject({
					code: 'upstream',
					retryable: false
				})
			}
			expect(await invoke(cancellationClient(() => Response.json({ data: { [field]: [] } })))).toEqual({ items: [] })
		}
		const wrongKey = cancellationClient(() =>
			Response.json({
				data: { confirmLineItemCancellationRequest: cancellationResults }
			})
		)
		expect(
			await rejectionOf(
				wrongKey.rejectCancellationRequests({
					requests: [{ request_id: '4', reason: 'Shipped' }]
				})
			)
		).toMatchObject({ code: 'upstream' })
	})

	test('fails on top-level GraphQL errors even when partial data is present', async () => {
		const client = cancellationClient(() =>
			Response.json({
				data: { confirmLineItemCancellationRequest: cancellationResults },
				errors: [{ message: 'Partial response', extensions: { category: 'INTERNAL' } }]
			})
		)
		expect(await rejectionOf(client.confirmCancellationRequests({ request_ids: [4, '5', '6'] }))).toMatchObject({
			code: 'upstream',
			retryable: false,
			details: { error_count: 1 }
		})
	})

	test('never replays confirmation or rejection after HTTP or uncertain network failures', async () => {
		for (const [status, code] of [
			[401, 'bad_auth'],
			[403, 'forbidden'],
			[429, 'rate_limited'],
			[500, 'upstream'],
			[503, 'upstream'],
			[0, 'upstream']
		] as const) {
			let calls = 0
			const client = cancellationClient(() => {
				calls += 1
				if (status === 0) throw new TypeError('Connection lost')
				return new Response(null, { status, headers: { 'Retry-After': '30' } })
			})
			for (const promise of [
				client.confirmCancellationRequests({ request_ids: ['4'] }),
				client.rejectCancellationRequests({ requests: [{ request_id: '5', reason: 'Already shipped' }] })
			]) {
				const error = await rejectionOf(promise)
				expect(error.code).toBe(code)
				if (status === 429) expect(error.details).toMatchObject({ retry_after_ms: 30_000 })
			}
			expect(calls).toBe(2)
		}
	})

	test('reuses a token across catalog and cancellation reads without leaking catalog headers', async () => {
		let tokens = 0
		const client = new WayfairClient(auth, {
			fetch: async (input, init) => {
				const request = new Request(input, init)
				if (request.url === 'https://sso.auth.wayfair.com/oauth/token') {
					tokens += 1
					return tokenResponse()
				}
				expect(request.headers.get('Authorization')).toBe('Bearer wayfair-access-token')
				if (request.url === 'https://api.wayfair.io/v1/supplier-catalog-api/graphql') {
					expect(request.headers.get('X-SELECTED-SUPPLIER-ID')).toBe('2683')
					return Response.json({
						data: {
							supplierCatalog: {
								supplierId: 2683,
								pageInfo: { page: 1, pageSize: 25, hasNextPage: false, totalPages: 0 },
								products: []
							}
						}
					})
				}
				expect(request.url).toBe('https://api.wayfair.io/v1/supplier-order-api/graphql')
				expect(request.headers.get('X-SELECTED-SUPPLIER-ID')).toBeNull()
				return Response.json({ data: { lineItemCancellationRequestByPurchaseOrders: [] } })
			}
		})
		await client.listCatalogPage()
		await client.listCancellationRequestsByOrders({ po_numbers: ['CS123'] })
		await client.listCatalogPage()
		expect(tokens).toBe(1)
	})

	test('binds all cancellation tools to host auth with accurate side effects', async () => {
		const module = withAuth(wayfairModule, auth)
		for (const [id, input, field, items, sideEffect] of [
			[
				'wayfair-list-cancellation-requests-by-orders',
				{ po_numbers: ['CS123'] },
				'lineItemCancellationRequestByPurchaseOrders',
				[cancellationRequest],
				'read'
			],
			[
				'wayfair-list-cancellation-requests-by-warehouses',
				{ warehouse_ids: [2683], status: 'CANCELLED' },
				'lineItemCancellationRequestByWarehouses',
				[],
				'read'
			],
			[
				'wayfair-confirm-cancellation-requests',
				{ request_ids: [4, '5', '6'] },
				'confirmLineItemCancellationRequest',
				cancellationResults,
				'write'
			],
			[
				'wayfair-reject-cancellation-requests',
				{ requests: [{ request_id: 4, reason: 'Shipped' }] },
				'rejectLineItemCancellationRequest',
				[cancellationResults[0]],
				'write'
			]
		] as const) {
			const tool = module.tools.find((entry) => entry.id === id)
			if (!tool) throw new Error('missing Wayfair cancellation tool')
			expect(tool.meta).toMatchObject({ sideEffect, idempotent: sideEffect === 'read', supportsCancel: true })
			if (sideEffect === 'write') expect(tool.meta.requiresConfirmation).toBe(true)
			const output = await runTool(tool, input, {
				auth: { client_id: 'must-not-override', client_secret: 'wrong', supplier_id: 99 },
				fetch: async (requestInput, init) => {
					const request = new Request(requestInput, init)
					if (new URL(request.url).pathname === '/oauth/token') {
						expect(await request.json()).toMatchObject({
							client_id: 'wayfair-client-id',
							client_secret: 'wayfair-client-secret'
						})
						return tokenResponse()
					}
					expect(request.url).toBe('https://api.wayfair.io/v1/supplier-order-api/graphql')
					return Response.json({ data: { [field]: items } })
				}
			})
			expect(output).toEqual({ items })
		}
	})

	test('propagates abort signals to cancellation mutations', async () => {
		for (const invoke of [
			(client: WayfairClient) => client.confirmCancellationRequests({ request_ids: ['4'] }),
			(client: WayfairClient) =>
				client.rejectCancellationRequests({ requests: [{ request_id: '4', reason: 'Shipped' }] })
		]) {
			const controller = new AbortController()
			let writes = 0
			const client = new WayfairClient(auth, {
				signal: controller.signal,
				fetch: async (input, init) => {
					const request = new Request(input, init)
					if (new URL(request.url).pathname === '/oauth/token') {
						controller.abort()
						return tokenResponse()
					}
					writes += 1
					expect(request.signal.aborted).toBe(true)
					throw new DOMException('Aborted', 'AbortError')
				}
			})
			expect(await rejectionOf(invoke(client))).toMatchObject({ code: 'timeout' })
			expect(writes).toBe(1)
		}
	})
})

const acceptance: WayfairAcceptDropshipOrderInput = {
	po_number: 'CS12345678',
	ship_speed: 'GROUND',
	line_items: [
		{
			part_number: 'SKU-1',
			quantity: 2,
			unit_price: 24.5,
			estimated_ship_date: '2026-09-09 10:16:44.000000 -04:00'
		}
	]
}

const address = {
	name: 'Test Warehouse',
	street_address1: '1 Example Street',
	street_address2: '',
	city: 'Boston',
	state: 'MA',
	postal_code: '02110',
	country: 'US'
}

const shipmentNotice: WayfairSendShipmentNoticeInput = {
	po_number: 'CS12345678',
	supplier_id: 2683,
	package_count: 1,
	weight: 0,
	volume: 0,
	carrier_code: 'FDEG',
	ship_speed: 'GROUND',
	tracking_number: 'tracking-1',
	ship_date: '2026-09-09T14:16:44Z',
	source_address: address,
	destination_address: address,
	small_parcel_shipments: [
		{
			package: { code: { type: 'TRACKING_NUMBER', value: 'tracking-1' }, weight: 0 },
			items: [{ part_number: 'SKU-1', quantity: 2 }]
		}
	]
}

const transaction = {
	id: '123',
	handle: 'transaction-handle',
	status: 'NEW' as const,
	submittedAt: '2026-09-09 14:16:44.000000 +00:00',
	completedAt: null,
	itemCount: 1,
	errorCount: 0,
	errors: [],
	completedCount: 0,
	completed: [],
	processingCount: 1,
	processing: [{ key: 'SKU-1', message: 'Queued' }]
}

const orderDetails = {
	id: 123,
	poNumber: 'CS12345678',
	poDate: '2026-09-09 14:16:44.000000 +00:00',
	supplierId: 2683,
	shippingInfo: { shipSpeed: 'GROUND', carrierCode: 'FDEG' },
	products: [{ partNumber: 'SKU-1', quantity: '2', price: 24.5 }],
	shipTo: { name: 'Test Customer', address1: '2 Example Street', country: 'US' },
	billTo: { name: 'Test Customer', address1: '2 Example Street', country: 'US' }
}

function orderClient(handler: (request: Request) => Response | Promise<Response>): WayfairClient {
	return new WayfairClient(auth, {
		fetch: async (input, init) => {
			const request = new Request(input, init)
			if (new URL(request.url).pathname === '/oauth/token') return tokenResponse()
			expect(request.url).toBe('https://api.wayfair.com/v1/graphql')
			expect(request.method).toBe('POST')
			expect(request.headers.get('Authorization')).toBe('Bearer wayfair-access-token')
			return handler(request)
		}
	})
}

describe('wayfair dropship order lifecycle', () => {
	test('reads an exact order with fulfillment details without accepting it', async () => {
		let calls = 0
		const client = orderClient(async (request) => {
			calls += 1
			const body = graphqlBodySchema.parse(await request.json())
			expect(body.variables).toEqual({ poNumber: 'CS12345678' })
			expect(body.query).toContain('poNumbers: [$poNumber]')
			expect(body.query).toContain('shipTo')
			expect(body.query).toContain('billTo')
			expect(body.query).toContain('shipSpeed')
			expect(body.query).not.toContain('mutation')
			expect(body.query).not.toContain('packingSlipUrl')
			return Response.json({ data: { getDropshipPurchaseOrders: [orderDetails] } })
		})

		const result = await client.getDropshipOrder({ po_number: 'CS12345678' })
		expect(result.products[0]?.quantity).toBe(2)
		expect(result.shipTo.name).toBe('Test Customer')
		expect(calls).toBe(1)
	})

	test('keeps purchase order numbers in GraphQL variables', async () => {
		const po = 'CS" }) { accept } #'
		const client = orderClient(async (request) => {
			const body = graphqlBodySchema.parse(await request.json())
			expect(body.variables).toEqual({ poNumber: po })
			expect(body.query).not.toContain(po)
			return Response.json({ data: { getDropshipPurchaseOrders: [] } })
		})
		expect(await rejectionOf(client.getDropshipOrder({ po_number: po }))).toMatchObject({ code: 'not_found' })
	})

	test('rejects missing, mismatched and duplicate order results', async () => {
		for (const items of [[], [{ ...orderDetails, poNumber: 'OTHER' }], [orderDetails, orderDetails]]) {
			const client = orderClient(() => Response.json({ data: { getDropshipPurchaseOrders: items } }))
			expect(await rejectionOf(client.getDropshipOrder({ po_number: 'CS12345678' }))).toMatchObject({
				code: items.length === 0 ? 'not_found' : 'upstream'
			})
		}
	})

	test('normalizes numeric-string quantities on the existing order read', async () => {
		const client = orderClient(() => Response.json({ data: { getDropshipPurchaseOrders: [orderDetails] } }))
		expect((await client.listDropshipOrders()).items[0]?.products[0]?.quantity).toBe(2)
	})

	test('does not coerce null, boolean or empty order quantities to numbers', async () => {
		for (const quantity of [null, false, '', 'not-a-number', 'Infinity']) {
			const client = orderClient(() =>
				Response.json({
					data: {
						getDropshipPurchaseOrders: [
							{
								...orderDetails,
								products: [{ partNumber: 'SKU-1', quantity }]
							}
						]
					}
				})
			)
			expect(await rejectionOf(client.listDropshipOrders())).toMatchObject({ code: 'upstream' })
		}
	})

	test('accepts order lines through the documented purchaseOrders mutation wrapper', async () => {
		const client = orderClient(async (request) => {
			const body = graphqlBodySchema.parse(await request.json())
			expect(body.query).toContain('mutation AcceptDropshipOrder')
			expect(body.query).toContain('purchaseOrders')
			expect(body.query).toContain('$lineItems: [AcceptedLineItemInput!]!')
			expect(body.variables).toEqual({
				poNumber: 'CS12345678',
				shipSpeed: 'GROUND',
				lineItems: [
					{
						partNumber: 'SKU-1',
						quantity: 2,
						unitPrice: 24.5,
						estimatedShipDate: '2026-09-09 10:16:44.000000 -04:00'
					}
				]
			})
			return Response.json({ data: { purchaseOrders: { accept: transaction } } })
		})
		const result = await client.acceptDropshipOrder(acceptance)
		expect(result).toEqual(transaction)
		expect(result).not.toHaveProperty('success')
	})

	test('preserves pending, complete, failed and partial transaction information', async () => {
		for (const status of ['NEW', 'PROCESSING', 'COMPLETE', 'ERROR', null] as const) {
			const result = {
				...transaction,
				status,
				errorCount: 12,
				errors: [{ key: 'SKU-1', message: 'Quantity already accepted' }]
			}
			const client = orderClient(() => Response.json({ data: { purchaseOrders: { accept: result } } }))
			expect(await client.acceptDropshipOrder(acceptance)).toEqual(result)
		}
	})

	test('maps small-parcel ASN fields and preserves falsy optional values', async () => {
		const client = orderClient(async (request) => {
			const body = graphqlBodySchema.parse(await request.json())
			expect(body.query).toContain('mutation SendShipmentNotice($notice: ShipNoticeInput!)')
			expect(body.query).toContain('purchaseOrders')
			expect(body.variables).toEqual({
				notice: {
					poNumber: 'CS12345678',
					supplierId: 2683,
					packageCount: 1,
					weight: 0,
					volume: 0,
					carrierCode: 'FDEG',
					shipSpeed: 'GROUND',
					trackingNumber: 'tracking-1',
					shipDate: '2026-09-09T14:16:44Z',
					sourceAddress: {
						name: 'Test Warehouse',
						streetAddress1: '1 Example Street',
						streetAddress2: '',
						city: 'Boston',
						state: 'MA',
						postalCode: '02110',
						country: 'US'
					},
					destinationAddress: {
						name: 'Test Warehouse',
						streetAddress1: '1 Example Street',
						streetAddress2: '',
						city: 'Boston',
						state: 'MA',
						postalCode: '02110',
						country: 'US'
					},
					smallParcelShipments: [
						{
							package: { code: { type: 'TRACKING_NUMBER', value: 'tracking-1' }, weight: 0 },
							items: [{ partNumber: 'SKU-1', quantity: 2 }]
						}
					]
				}
			})
			return Response.json({ data: { purchaseOrders: { shipment: transaction } } })
		})
		expect(await client.sendShipmentNotice(shipmentNotice)).toEqual(transaction)
	})

	test('maps large-parcel ASNs and UCC-128 tracking', async () => {
		const { small_parcel_shipments: _small, ...notice } = shipmentNotice
		const packages = [{ code: { type: 'UCC_128' as const, value: 'ucc-1' } }]
		const client = orderClient(async (request) => {
			const body = graphqlBodySchema.parse(await request.json())
			expect(body.variables?.notice).toMatchObject({
				largeParcelShipments: [{ partNumber: 'SKU-1', packages }]
			})
			expect(body.variables?.notice).not.toHaveProperty('smallParcelShipments')
			return Response.json({ data: { purchaseOrders: { shipment: transaction } } })
		})
		await client.sendShipmentNotice({
			...notice,
			large_parcel_shipments: [{ part_number: 'SKU-1', packages }]
		})
	})

	test('validates direct-client inputs before any auth or vendor request', async () => {
		let calls = 0
		const client = new WayfairClient(auth, {
			fetch: async () => {
				calls += 1
				throw new Error('network must not be called')
			}
		})
		const invalid = [
			client.getDropshipOrder({ po_number: '' }),
			client.acceptDropshipOrder({ ...acceptance, line_items: [] }),
			client.sendShipmentNotice({ ...shipmentNotice, small_parcel_shipments: [], large_parcel_shipments: [] }),
			client.sendShipmentNotice({ ...shipmentNotice, package_count: 0 }),
			client.sendShipmentNotice({ ...shipmentNotice, tracking_number: 'x'.repeat(1001) }),
			client.sendShipmentNotice({ ...shipmentNotice, ship_date: 'not-a-date' })
		]
		for (const promise of invalid) expect(await rejectionOf(promise)).toMatchObject({ code: 'bad_input' })
		expect(calls).toBe(0)
	})

	test('validates nested parcel contents, tracking lengths and documented date formats', () => {
		expect(
			wayfairSendShipmentNoticeInputSchema.safeParse({
				...shipmentNotice,
				small_parcel_shipments: [{ package: { code: { type: 'TRACKING_NUMBER', value: 'x' } }, items: [] }]
			}).success
		).toBe(false)
		expect(
			wayfairSendShipmentNoticeInputSchema.safeParse({
				...shipmentNotice,
				small_parcel_shipments: [
					{
						package: { code: { type: 'TRACKING_NUMBER', value: 'x'.repeat(256) } },
						items: [{ part_number: 'SKU-1', quantity: 1 }]
					}
				]
			}).success
		).toBe(false)
		expect(
			wayfairSendShipmentNoticeInputSchema.safeParse({
				...shipmentNotice,
				destination_address: { ...address, country: 'United States' }
			}).success
		).toBe(false)
		expect(wayfairAcceptDropshipOrderInputSchema.safeParse(acceptance).success).toBe(true)
		expect(
			wayfairAcceptDropshipOrderInputSchema.safeParse({
				...acceptance,
				line_items: [{ ...acceptance.line_items[0], quantity: 2_147_483_648 }]
			}).success
		).toBe(false)
		expect(
			wayfairAcceptDropshipOrderInputSchema.safeParse({
				...acceptance,
				line_items: [{ ...acceptance.line_items[0], estimated_ship_date: '2026-02-30T10:00:00Z' }]
			}).success
		).toBe(false)
	})

	test('sanitizes GraphQL errors and rejects missing or malformed transactions', async () => {
		for (const data of [
			{ errors: [{ message: 'Customer address and sensitive input must not leak' }], data: { purchaseOrders: null } },
			{ data: { purchaseOrders: { accept: null } } },
			{ data: { purchaseOrders: { accept: { status: 'NEW' } } } },
			{ data: { accept: transaction } }
		]) {
			const client = orderClient(() => Response.json(data))
			const error = await rejectionOf(client.acceptDropshipOrder(acceptance))
			expect(error.code).toBe('upstream')
			expect(error.retryable).toBe(false)
			expect(JSON.stringify(error)).not.toContain('Customer address')
		}
	})

	test('does not replay an acceptance or ASN after HTTP errors or an uncertain network failure', async () => {
		for (const status of [401, 403, 429, 500, 503, 0]) {
			let calls = 0
			const client = orderClient(() => {
				calls += 1
				if (status === 0) throw new TypeError('Connection lost')
				return new Response(null, { status, headers: { 'Retry-After': '30' } })
			})
			await rejectionOf(client.acceptDropshipOrder(acceptance))
			await rejectionOf(client.sendShipmentNotice(shipmentNotice))
			expect(calls).toBe(2)
		}
	})

	test('binds new tools to host auth and exposes accurate side effects', async () => {
		const module = withAuth(wayfairModule, auth)
		for (const [id, input, field, sideEffect] of [
			['wayfair-accept-dropship-order', acceptance, 'accept', 'write'],
			['wayfair-send-shipment-notice', shipmentNotice, 'shipment', 'send']
		] as const) {
			const tool = module.tools.find((entry) => entry.id === id)
			if (!tool) throw new Error('missing Wayfair tool')
			expect(tool.meta).toMatchObject({ sideEffect, idempotent: false, requiresConfirmation: true })
			const output = await runTool(tool, input, {
				auth: { client_id: 'must-not-override', client_secret: 'wrong', supplier_id: 99 },
				fetch: async (requestInput, init) => {
					const request = new Request(requestInput, init)
					if (new URL(request.url).pathname === '/oauth/token') {
						expect(await request.json()).toMatchObject({
							client_id: 'wayfair-client-id',
							client_secret: 'wayfair-client-secret'
						})
						return tokenResponse()
					}
					return Response.json({ data: { purchaseOrders: { [field]: transaction } } })
				}
			})
			expect(output).toEqual(transaction)
		}
		expect(module.tools.find((entry) => entry.id === 'wayfair-get-dropship-order')?.meta).toMatchObject({
			sideEffect: 'read',
			idempotent: true
		})
	})

	test('deduplicates concurrent token refresh and refreshes before expiry', async () => {
		let now = 1_000_000
		const clock = spyOn(Date, 'now').mockImplementation(() => now)
		let tokens = 0
		let writes = 0
		try {
			const client = new WayfairClient(auth, {
				fetch: async (input, init) => {
					const request = new Request(input, init)
					if (new URL(request.url).pathname === '/oauth/token') {
						tokens += 1
						await Promise.resolve()
						return tokenResponse()
					}
					writes += 1
					return Response.json({ data: { purchaseOrders: { accept: transaction } } })
				}
			})
			await Promise.all([client.acceptDropshipOrder(acceptance), client.acceptDropshipOrder(acceptance)])
			expect(tokens).toBe(1)
			now += 841_000
			await client.acceptDropshipOrder(acceptance)
			expect(tokens).toBe(2)
			expect(writes).toBe(3)
		} finally {
			clock.mockRestore()
		}
	})

	test('propagates cancellation without sending a mutation', async () => {
		const controller = new AbortController()
		controller.abort()
		let mutations = 0
		const client = new WayfairClient(auth, {
			signal: controller.signal,
			fetch: async (input, init) => {
				const request = new Request(input, init)
				expect(request.signal.aborted).toBe(true)
				if (new URL(request.url).pathname !== '/oauth/token') mutations += 1
				throw new DOMException('Aborted', 'AbortError')
			}
		})
		expect(await rejectionOf(client.sendShipmentNotice(shipmentNotice))).toMatchObject({ code: 'timeout' })
		expect(mutations).toBe(0)
	})
})
