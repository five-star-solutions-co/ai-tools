import { describe, expect, spyOn, test } from 'bun:test'
import { z } from 'zod'

import { runTool, ToolError, validateModule, withAuth } from '../../src/core'
import {
	WayfairClient,
	wayfairAcceptDropshipOrderInputSchema,
	wayfairModule,
	wayfairSendShipmentNoticeInputSchema
} from '../../src/vendors/wayfair'
import type { WayfairAcceptDropshipOrderInput, WayfairSendShipmentNoticeInput } from '../../src/vendors/wayfair'

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
			'wayfair-get-dropship-order',
			'wayfair-list-catalog',
			'wayfair-list-dropship-orders',
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
