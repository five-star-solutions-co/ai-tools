import { describe, expect, test } from 'bun:test'

import { runTool, ToolError, validateModule, withAuth } from '../../src/core'
import { ShipstationClient, shipstationModule } from '../../src/vendors/shipstation'

const auth = {
	v2_api_key: 'shipstation_v2_key',
	v1_api_key: 'shipstation_v1_key',
	v1_api_secret: 'shipstation_v1_secret'
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

describe('shipstation', () => {
	test('module contracts and tool ids', () => {
		expect(validateModule(shipstationModule).ok).toBe(true)
		expect(shipstationModule.tools.map((tool) => tool.id).sort()).toEqual([
			'shipstation-get-carrier',
			'shipstation-list-carrier-options',
			'shipstation-list-carrier-packages',
			'shipstation-list-carrier-services',
			'shipstation-list-carriers',
			'shipstation-list-fulfillments',
			'shipstation-list-labels',
			'shipstation-list-orders',
			'shipstation-list-shipments',
			'shipstation-list-stores'
		])
	})

	test('rejects invalid hybrid auth', () => {
		expect(() => new ShipstationClient({ v2_api_key: '', v1_api_key: '', v1_api_secret: '' })).toThrow(ToolError)
	})

	test('lists a labels page with V2 auth, cost fields, and provider filters', async () => {
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
				expect(request.headers.get('API-Key')).toBe('shipstation_v2_key')
				expect(request.headers.get('Authorization')).toBeNull()

				return new Response(
					JSON.stringify({
						labels: [
							{
								label_id: 'se-123',
								shipment_id: 'se-ship-1',
								carrier_id: 'se-carrier-1',
								service_code: 'ups_ground',
								tracking_number: '1Z999',
								created_at: '2026-08-02T00:00:00.000Z',
								shipment_cost: { currency: 'usd', amount: 12.5 },
								insurance_cost: { currency: 'usd', amount: 1.5 },
								voided: false,
								refund_details: { refund_status: 'pending' }
							}
						],
						total: 501,
						page: 2,
						pages: 3
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
		expect(result.items[0]?.shipment_cost).toEqual({ currency: 'usd', amount: 12.5 })
		expect(result.items[0]?.insurance_cost).toEqual({ currency: 'usd', amount: 1.5 })
		expect(result.items[0]?.refund_details).toEqual({ refund_status: 'pending' })
	})

	test('lists V2 shipments and fulfillments with warehouse-ready time filters', async () => {
		const client = new ShipstationClient(auth, {
			fetch: async (input, init) => {
				const request = new Request(input, init)
				const url = new URL(request.url)
				expect(request.headers.get('API-Key')).toBe('shipstation_v2_key')

				if (url.pathname === '/v2/shipments') {
					expect(url.searchParams.get('modified_at_start')).toBe('2026-08-01T00:00:00.000Z')
					expect(url.searchParams.get('store_id')).toBe('store-1')
					return new Response(
						JSON.stringify({
							shipments: [
								{
									shipment_id: 'se-ship-1',
									external_order_id: 'order-1',
									modified_at: '2026-08-03T00:00:00.000Z'
								}
							],
							total: 1,
							page: 1,
							pages: 1
						}),
						{ status: 200 }
					)
				}

				expect(url.pathname).toBe('/v2/fulfillments')
				expect(url.searchParams.get('ship_date_start')).toBe('2026-08-01T00:00:00.000Z')
				expect(url.searchParams.get('tracking_number')).toBe('1Z999')
				return new Response(
					JSON.stringify({
						fulfillments: [
							{
								fulfillment_id: 'se-fulfillment-1',
								shipment_id: 'se-ship-1',
								tracking_number: '1Z999',
								ship_date: '2026-08-04T00:00:00.000Z'
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

		const shipments = await client.listShipmentsPage({
			modified_at_start: '2026-08-01T00:00:00.000Z',
			store_id: 'store-1'
		})
		const fulfillments = await client.listFulfillmentsPage({
			ship_date_start: '2026-08-01T00:00:00.000Z',
			tracking_number: '1Z999'
		})
		expect(shipments.items[0]?.external_order_id).toBe('order-1')
		expect(fulfillments.items[0]?.fulfillment_id).toBe('se-fulfillment-1')
	})

	test('reads V2 carrier details, services, packages, and options', async () => {
		const client = new ShipstationClient(auth, {
			fetch: async (input, init) => {
				const request = new Request(input, init)
				const url = new URL(request.url)
				expect(request.headers.get('API-Key')).toBe('shipstation_v2_key')
				expect(request.headers.get('Authorization')).toBeNull()

				if (url.pathname === '/v2/carriers') {
					return Response.json({ carriers: [{ carrier_id: 'se-carrier-1' }], total: 1, page: 1, pages: 1 })
				}
				if (url.pathname.endsWith('/services')) {
					return new Response(JSON.stringify({ services: [{ service_code: 'ups_ground', name: 'UPS Ground' }] }), {
						status: 200
					})
				}
				if (url.pathname.endsWith('/packages')) {
					return new Response(JSON.stringify({ packages: [{ package_code: 'package', name: 'Package' }] }), {
						status: 200
					})
				}
				if (url.pathname.endsWith('/options')) {
					return new Response(JSON.stringify({ options: [{ name: 'bill_to_party' }] }), { status: 200 })
				}

				expect(url.pathname).toBe('/v2/carriers/se-carrier-1')
				return new Response(JSON.stringify({ carrier_id: 'se-carrier-1', carrier_code: 'ups', friendly_name: 'UPS' }), {
					status: 200
				})
			}
		})

		expect((await client.listCarriers()).items[0]?.carrier_id).toBe('se-carrier-1')
		expect((await client.getCarrier({ carrier_id: 'se-carrier-1' })).friendly_name).toBe('UPS')
		expect((await client.listCarrierServices({ carrier_id: 'se-carrier-1' })).items[0]?.service_code).toBe('ups_ground')
		expect((await client.listCarrierPackages({ carrier_id: 'se-carrier-1' })).items[0]?.package_code).toBe('package')
		expect((await client.listCarrierOptions({ carrier_id: 'se-carrier-1' })).items[0]?.name).toBe('bill_to_party')
	})

	test('exposes carrier page controls, metadata, and raw fields without fetching additional pages', async () => {
		let requests = 0
		const client = new ShipstationClient(auth, {
			fetch: async (input, init) => {
				requests += 1
				const request = new Request(input, init)
				const url = new URL(request.url)
				expect(url.origin + url.pathname).toBe('https://api.shipstation.com/v2/carriers')
				expect(url.searchParams.get('page')).toBe('2')
				expect(url.searchParams.get('page_size')).toBe('1')
				expect(url.searchParams.get('include_extended_details')).toBe('false')
				expect(request.headers.get('API-Key')).toBe(auth.v2_api_key)
				expect(request.headers.get('Authorization')).toBeNull()
				return Response.json({
					carriers: [{ carrier_id: 'se-2', disabled_by_billing_plan: true }],
					total: 3,
					page: 2,
					pages: 3,
					request_id: 'request-2',
					errors: []
				})
			}
		})
		expect(await client.listCarriers({ page: 2, page_size: 1, include_extended_details: false })).toEqual({
			items: [{ carrier_id: 'se-2', disabled_by_billing_plan: true }],
			pagination: { total: 3, page: 2, pages: 3, page_size: 1, has_more: true },
			request_id: 'request-2',
			errors: [],
			partial: false
		})
		expect(requests).toBe(1)
	})

	test.each([200, 207])('preserves carrier errors at HTTP %i through the agent tool', async (status) => {
		const errors = [
			{
				error_source: 'carrier',
				error_type: 'system',
				error_code: 'unspecified',
				message: 'Carrier unavailable',
				carrier_id: 'se-2'
			}
		]
		const tool = shipstationModule.tools.find((item) => item.id === 'shipstation-list-carriers')
		if (!tool) throw new Error('Missing carriers tool')
		const result = await runTool(
			tool,
			{ page: 1 },
			{
				auth,
				fetch: async () =>
					Response.json({ carriers: [{ carrier_id: 'se-1' }], total: 2, page: 1, pages: 1, errors }, { status })
			}
		)
		expect(result).toMatchObject({ items: [{ carrier_id: 'se-1' }], partial: true, errors })
	})

	test('does not describe HTTP 207 as complete when errors are empty or omitted', async () => {
		const client = new ShipstationClient(auth, {
			fetch: async () => Response.json({ carriers: [], total: 0, page: 1, pages: 0 }, { status: 207 })
		})
		expect(await client.listCarriers()).toMatchObject({ partial: true, errors: [] })
	})

	test('accepts an authoritative empty carrier page and uses explicit default pagination', async () => {
		const client = new ShipstationClient(auth, {
			fetch: async (input, init) => {
				const url = new URL(new Request(input, init).url)
				expect(url.searchParams.get('page')).toBe('1')
				expect(url.searchParams.get('page_size')).toBe('25')
				return Response.json({ carriers: [], total: 0, page: 1, pages: 0 })
			}
		})
		expect(await client.listCarriers()).toEqual({
			items: [],
			pagination: { total: 0, page: 1, pages: 0, page_size: 25, has_more: false },
			errors: [],
			partial: false
		})
	})

	test.each([
		{ carriers: [] },
		{ carriers: [], total: 0, page: 1, pages: 0, errors: 'failed' },
		{ carriers: [], total: 0, page: 1, pages: 0, errors: [{}] }
	])('rejects malformed carrier completeness or error metadata', async (body) => {
		const client = new ShipstationClient(auth, { fetch: async () => Response.json(body) })
		expect((await rejectionOf(client.listCarriers())).code).toBe('upstream')
	})

	test('rejects invalid carrier page inputs before HTTP', async () => {
		const client = new ShipstationClient(auth, {
			fetch: async () => {
				throw new Error('Unexpected request')
			}
		})
		expect((await rejectionOf(client.listCarriers({ page: 0 }))).code).toBe('bad_input')
		expect((await rejectionOf(client.listCarriers({ page_size: 0 }))).code).toBe('bad_input')
	})

	test('lists legacy V1 orders with Basic auth and mapped query fields', async () => {
		const client = new ShipstationClient(auth, {
			fetch: async (input, init) => {
				const request = new Request(input, init)
				const url = new URL(request.url)
				expect(url.origin + url.pathname).toBe('https://ssapi.shipstation.com/orders')
				expect(url.searchParams.get('page')).toBe('3')
				expect(url.searchParams.get('pageSize')).toBe('100')
				expect(url.searchParams.get('modifyDateStart')).toBe('2026-08-01T00:00:00.000Z')
				expect(url.searchParams.get('orderStatus')).toBe('awaiting_shipment')
				expect(url.searchParams.get('storeId')).toBe('42')
				expect(url.searchParams.has('modify_date_start')).toBe(false)
				expect(request.headers.get('API-Key')).toBeNull()
				expect(request.headers.get('Authorization')).toBe(`Basic ${btoa('shipstation_v1_key:shipstation_v1_secret')}`)

				return new Response(
					JSON.stringify({
						orders: [{ orderId: 1001, orderNumber: 'WEB-1001', orderStatus: 'awaiting_shipment' }],
						total: 201,
						page: 3,
						pages: 3
					}),
					{ status: 200 }
				)
			}
		})

		const result = await client.listOrdersPage({
			page: 3,
			page_size: 100,
			modify_date_start: '2026-08-01T00:00:00.000Z',
			order_status: 'awaiting_shipment',
			store_id: 42
		})
		expect(result.items[0]?.orderId).toBe(1001)
		expect(result.pagination).toEqual({ total: 201, page: 3, pages: 3, page_size: 100, has_more: false })
	})

	test('lists legacy V1 stores with provider filters', async () => {
		const client = new ShipstationClient(auth, {
			fetch: async (input, init) => {
				const request = new Request(input, init)
				const url = new URL(request.url)
				expect(url.origin + url.pathname).toBe('https://ssapi.shipstation.com/stores')
				expect(url.searchParams.get('showInactive')).toBe('true')
				expect(url.searchParams.get('marketplaceId')).toBe('36')
				expect(request.headers.get('Authorization')).toBe(`Basic ${btoa('shipstation_v1_key:shipstation_v1_secret')}`)
				return new Response(
					JSON.stringify([{ storeId: 12345, storeName: 'My Shopify Store', marketplaceId: 36, active: true }]),
					{ status: 200 }
				)
			}
		})

		expect((await client.listStores({ show_inactive: true, marketplace_id: 36 })).items).toEqual([
			{ storeId: 12345, storeName: 'My Shopify Store', marketplaceId: 36, active: true }
		])
	})

	test('runs the labels tool through bound hybrid auth', async () => {
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
