import { describe, expect, test } from 'bun:test'
import { z } from 'zod'
import { runTool, ToolError, withAuth } from '../../src/core'
import {
	WayfairClient,
	wayfairCreateFulfillmentOrderInputSchema,
	wayfairListFulfillmentOrdersInputSchema,
	wayfairListFulfillmentShippingAdvicesInputSchema,
	wayfairListInboundOrdersInputSchema,
	wayfairModule
} from '../../src/vendors/wayfair'
import type {
	WayfairCreateFulfillmentOrderInput,
	WayfairCreateFulfillmentOrderOutput,
	WayfairCancelFulfillmentOrderOutput,
	WayfairFulfillmentOrderDetails
} from '../../src/vendors/wayfair'

const auth = { client_id: 'test-client', client_secret: 'test-secret', supplier_id: 2683 }
const bodySchema = z.object({ query: z.string(), variables: z.record(z.string(), z.json()) })
const pageInfo = { hasNextPage: true, hasPreviousPage: false, totalPages: 3, totalItems: 21 }
const order: WayfairFulfillmentOrderDetails = {
	fulfillmentOrder: {
		requestId: 'MC-123',
		status: 'NEW',
		statusLabel: 'New',
		billingType: 'PICK_AND_SHIP',
		orderDate: null,
		customerOrderNumber: 'ORDER-1',
		retailer: { name: 'Test retailer', retailerId: '42', orderNumber: 'ORDER-1' },
		shippingAddress: {
			name: 'Test recipient',
			address1: '1 Example Street',
			address2: null,
			city: 'Example',
			stateShortName: 'MA',
			postalCode: '02110',
			countryShortName: 'US',
			companyName: null
		},
		fulfillmentOrderItems: [
			{
				fulfillmentOrderItemId: null,
				productId: null,
				partNumber: 'PART-1',
				supplierProductName: null,
				supplierPartNumber: 'PART-1',
				srcCategory: null,
				status: 'NEW',
				statusLabel: null,
				failureReasons: [null, 'Waiting for inventory'],
				quantityOrdered: 2,
				quantityShipped: 0,
				option: null,
				forcedQuantityMultiplier: 1.5,
				unitPrice: 24.5,
				expectedShippingDate: null,
				trackingNumbers: null,
				errors: null
			}
		]
	},
	fulfillmentOrderErrors: null
}
const createInput: WayfairCreateFulfillmentOrderInput = {
	seller_fulfillment_order_id: 'SELLER-1',
	billing_address: {
		name: 'Example Billing',
		address1: '2 Example Street',
		address2: '',
		city: 'Example',
		state_short_name: 'MA',
		postal_code: '02110',
		country_short_name: 'US'
	},
	customer: { order_number: 'ORDER-1' },
	retailer: { retailer_id: 42, order_number: 'ORDER-1' },
	items: [{ supplier_part_number: 'PART-1', quantity: 2, supplier_product_name: '', fulfillment_warehouse_id: 10 }],
	shipping_address: {
		name: 'Test recipient',
		address1: '1 Example Street',
		address2: '',
		city: 'Example',
		state_short_name: 'MA',
		postal_code: '02110',
		country_short_name: 'US',
		phone_number: '347-448-3590',
		company_name: ''
	},
	shipping_details: { shipping_account_number: 'ACCOUNT-1', carrier_scac: 'FDEG', ship_speed_code: 'FDHD' },
	delivery_signature_required: false
}
function clientFor(handler: (request: Request) => Response | Promise<Response>) {
	return new WayfairClient(auth, {
		fetch: async (input, init) => {
			const request = new Request(input, init)
			if (new URL(request.url).pathname === '/oauth/token') {
				return Response.json({ access_token: 'test-token', expires_in: 900 })
			}
			expect(request.url).toBe('https://api.wayfair.io/v1/supplier-order-api/graphql')
			expect(request.method).toBe('POST')
			expect(request.headers.get('Authorization')).toBe('Bearer test-token')
			return handler(request)
		}
	})
}
async function rejectionOf(promise: Promise<unknown>): Promise<ToolError> {
	try {
		await promise
	} catch (error) {
		if (error instanceof ToolError) return error
		throw error
	}
	throw new Error('Expected ToolError')
}

describe('Wayfair multichannel fulfillment', () => {
	test('gets exact fulfillment details with native nullable fields and no acknowledgment', async () => {
		const client = clientFor(async (request) => {
			const body = bodySchema.parse(await request.json())
			expect(body.query).toContain('$orderDetailsInput: FulfillmentOrderDetailsInput!')
			expect(body.query).toContain('fulfillmentOrderDetails(orderDetailsInput: $orderDetailsInput)')
			expect(body.query).toContain('expectedShippingDate')
			expect(body.query).not.toContain('mutation')
			expect(body.query).not.toContain('acknowledge')
			expect(body.variables).toEqual({
				orderDetailsInput: { supplierId: 2683, fulfillmentOrderRequestId: 'MC-123', locale: 'en-US' }
			})
			return Response.json({ data: { fulfillmentOrderDetails: order } })
		})
		expect(await client.getFulfillmentOrder({ request_id: 'MC-123', locale: 'en-US' })).toEqual(order)
	})

	test('rejects missing, malformed, and mismatched exact order results', async () => {
		for (const [data, code] of [
			[{ fulfillmentOrderDetails: null }, 'not_found'],
			[null, 'upstream'],
			[{}, 'upstream'],
			[
				{
					fulfillmentOrderDetails: { ...order, fulfillmentOrder: { ...order.fulfillmentOrder, requestId: 'MC-other' } }
				},
				'upstream'
			]
		] as const) {
			const client = clientFor(() => Response.json({ data }))
			expect((await rejectionOf(client.getFulfillmentOrder({ request_id: 'MC-123' }))).code).toBe(code)
		}
	})

	test('uses declared flat page and filter fields, not stale nested pagination examples', async () => {
		const interval = { from: '2026-09-01T00:00:00Z', to: '2026-09-02T00:00:00Z' }
		const client = clientFor(async (request) => {
			const body = bodySchema.parse(await request.json())
			expect(body.query).toContain('$orderDetailsListInput: FulfillmentOrderDetailsListInput!')
			expect(body.variables).toEqual({
				orderDetailsListInput: {
					supplierId: 2683,
					page: 2,
					pageSize: 100,
					sortOption: { sortBy: 'SHIPPING_DATE', sortOrder: 'ASC' },
					locale: 'en-US',
					status: ['NEW', 'ALLOCATED'],
					retailer: { retailerIds: ['42'], orderNumbers: ['ORDER-"1'] },
					orderCreationDateInterval: interval,
					shippingDateInterval: interval,
					expectedShippingDateInterval: interval
				}
			})
			expect(body.query).not.toContain('ORDER-"1')
			return Response.json({ data: { fulfillmentOrderDetailsList: { nodes: [order], pageInfo } } })
		})
		expect(
			await client.listFulfillmentOrders({
				page: 2,
				page_size: 100,
				sort_by: 'SHIPPING_DATE',
				sort_order: 'ASC',
				locale: 'en-US',
				status: ['NEW', 'ALLOCATED'],
				retailer_ids: ['42'],
				retailer_order_numbers: ['ORDER-"1'],
				order_creation_date_interval: interval,
				shipping_date_interval: interval,
				expected_shipping_date_interval: interval
			})
		).toEqual({ nodes: [order], pageInfo })
	})

	test('uses documented order defaults, preserves null metadata and does not auto-page', async () => {
		let calls = 0
		const client = clientFor(async (request) => {
			calls++
			expect(bodySchema.parse(await request.json()).variables).toEqual({
				orderDetailsListInput: {
					supplierId: 2683,
					page: 1,
					pageSize: 10,
					sortOption: { sortBy: 'ORDER_CREATION_DATE', sortOrder: 'DESC' }
				}
			})
			return Response.json({ data: { fulfillmentOrderDetailsList: { nodes: [], pageInfo: null } } })
		})
		expect(await client.listFulfillmentOrders()).toEqual({ nodes: [], pageInfo: null })
		expect(calls).toBe(1)
	})

	test('creates one order with nested typed data and explicit false values', async () => {
		const accepted: WayfairCreateFulfillmentOrderOutput = {
			fulfillmentOrderRequestId: 'MC-123',
			requestStatus: 'ACCEPTED',
			errors: null
		}
		let calls = 0
		const client = clientFor(async (request) => {
			calls++
			const body = bodySchema.parse(await request.json())
			expect(body.query).toContain('$fulfillmentOrderInput: CreateFulfillmentOrderInput!')
			expect(body.query).toContain('createFulfillmentOrder(fulfillmentOrderInput: $fulfillmentOrderInput)')
			expect(body.variables).toEqual({
				fulfillmentOrderInput: {
					supplierId: 2683,
					sellerFulfillmentOrderId: 'SELLER-1',
					billingAddress: {
						name: 'Example Billing',
						address1: '2 Example Street',
						address2: '',
						city: 'Example',
						stateShortName: 'MA',
						postalCode: '02110',
						countryShortName: 'US'
					},
					customer: { orderNumber: 'ORDER-1' },
					retailer: { retailerId: 42, orderNumber: 'ORDER-1' },
					items: [{ supplierPartNumber: 'PART-1', quantity: 2, supplierProductName: '', fulfillmentWarehouseId: 10 }],
					shippingAddress: {
						name: 'Test recipient',
						address1: '1 Example Street',
						address2: '',
						city: 'Example',
						stateShortName: 'MA',
						postalCode: '02110',
						countryShortName: 'US',
						phoneNumber: '347-448-3590',
						companyName: ''
					},
					shippingDetails: { shippingAccountNumber: 'ACCOUNT-1', carrierScac: 'FDEG', shipSpeedCode: 'FDHD' },
					deliverySignatureRequired: false
				}
			})
			return Response.json({ data: { createFulfillmentOrder: accepted } })
		})
		expect(await client.createFulfillmentOrder(createInput)).toEqual(accepted)
		expect(calls).toBe(1)
	})

	test('preserves rejection errors instead of treating request submission as success', async () => {
		const failure: WayfairCreateFulfillmentOrderOutput = {
			fulfillmentOrderRequestId: null,
			requestStatus: 'FAILURE',
			errors: [{ code: 'INVALID_ITEM', message: 'Invalid item', field: 'items', value: null }]
		}
		const client = clientFor(() => Response.json({ data: { createFulfillmentOrder: failure } }))
		expect(await client.createFulfillmentOrder(createInput)).toEqual(failure)
	})

	test('maps cancellation request ID and string supplier ID, preserving mixed item results', async () => {
		const result: WayfairCancelFulfillmentOrderOutput = {
			aggregatorOrderId: 'MC-123',
			errors: null,
			results: [
				{ fulfillmentOrderItemId: 'ITEM-1', supplierPartNumber: 'PART-1', requestStatus: 'SUCCESS', errors: null },
				{
					fulfillmentOrderItemId: 'ITEM-2',
					supplierPartNumber: null,
					requestStatus: 'FAILURE',
					errors: [
						{ errorCode: 'ALREADY_SHIPPED', errorMessage: 'Item has shipped', errorField: null, errorValue: null }
					]
				}
			]
		}
		const client = clientFor(async (request) => {
			const body = bodySchema.parse(await request.json())
			expect(body.query).toContain('$cancelFulfillmentOrderInput: CancelFulfillmentOrderInput!')
			expect(body.variables).toEqual({
				cancelFulfillmentOrderInput: { aggregatorOrderId: 'MC-123', supplierId: '2683' }
			})
			return Response.json({ data: { cancelFulfillmentOrder: result } })
		})
		expect(await client.cancelFulfillmentOrder({ request_id: 'MC-123' })).toEqual(result)
	})

	test('reads multichannel advice tracking with distinct default pagination', async () => {
		const advice = {
			fulfillmentOrderItemId: 'ITEM-1',
			warehouseShippingAdviceDate: null,
			fulfillmentOrderRequestId: 'MC-123',
			fulfillmentPurchaseOrderNumber: null,
			supplierId: 2683,
			retailer: { name: null, retailerId: '42', orderNumber: 'ORDER-1' },
			productDetails: null,
			shippingDetails: null,
			tracking: {
				carrier: 'Carrier',
				carrierScac: null,
				expectedShippingDate: null,
				shippingDate: null,
				shipSpeed: null,
				shipSpeedCode: null,
				trackingNumbers: ['TRACK-1']
			}
		}
		const client = clientFor(async (request) => {
			const body = bodySchema.parse(await request.json())
			expect(body.query).toContain('$warehouseShippingAdviceInput: WarehouseShippingAdviceInput!')
			expect(body.variables).toEqual({
				warehouseShippingAdviceInput: {
					supplierId: 2683,
					page: 1,
					pageSize: 50,
					sortOption: { sortBy: 'WAREHOUSE_SHIPPING_ADVICE_DATE', sortOrder: 'DESC' },
					fulfillmentOrderItemIds: ['ITEM-1'],
					warehouseShippingAdviceDateInterval: { from: '2026-09-01T00:00:00Z' }
				}
			})
			return Response.json({ data: { warehouseShippingAdvices: { nodes: [advice], pageInfo: null } } })
		})
		expect(
			await client.listFulfillmentShippingAdvices({
				fulfillment_order_item_ids: ['ITEM-1'],
				date_interval: { from: '2026-09-01T00:00:00Z' }
			})
		).toEqual({ nodes: [advice], pageInfo: null })
	})

	test('enforces published page limits, address lengths, US state and positive quantity', async () => {
		for (const input of [
			{ ...createInput, items: [] },
			{ ...createInput, items: [{ supplier_part_number: 'PART-1', quantity: 0 }] },
			{ ...createInput, shipping_address: { ...createInput.shipping_address, name: 'n'.repeat(31) } },
			{ ...createInput, shipping_address: { ...createInput.shipping_address, address1: 'a'.repeat(36) } },
			{ ...createInput, shipping_address: { ...createInput.shipping_address, state_short_name: undefined } },
			{ ...createInput, supplier_id: 999 }
		])
			expect(wayfairCreateFulfillmentOrderInputSchema.safeParse(input).success).toBe(false)
		for (const schema of [wayfairListFulfillmentOrdersInputSchema, wayfairListFulfillmentShippingAdvicesInputSchema]) {
			for (const input of [{ page: 0 }, { page_size: 0 }, { page_size: 101 }, { page: 2147483648 }]) {
				expect(schema.safeParse(input).success).toBe(false)
			}
		}
		expect(
			wayfairListFulfillmentOrdersInputSchema.safeParse({
				shipping_date_interval: { from: '2026-09-01 00:00:00Z' }
			}).success
		).toBe(false)
		expect(
			wayfairListFulfillmentOrdersInputSchema.safeParse({
				shipping_date_interval: { from: '2026-09-01T02:00:00-04:00', to: '2026-09-01T05:00:00Z' }
			}).success
		).toBe(false)
		let calls = 0
		const client = new WayfairClient(auth, {
			fetch: async () => {
				calls++
				throw new Error('Unexpected HTTP')
			}
		})
		expect((await rejectionOf(client.createFulfillmentOrder({ ...createInput, items: [] }))).code).toBe('bad_input')
		expect((await rejectionOf(client.listFulfillmentOrders({ page: 0 }))).code).toBe('bad_input')
		expect(calls).toBe(0)
	})

	test('keeps GraphQL fatal errors sanitized even alongside partial mutation results', async () => {
		for (const category of ['PERMISSION_DENIED', 'BAD_REQUEST', 'INTERNAL']) {
			const client = clientFor(() =>
				Response.json({
					data: {
						createFulfillmentOrder: { fulfillmentOrderRequestId: 'MC-123', requestStatus: 'ACCEPTED', errors: null }
					},
					errors: [{ message: 'Customer private address and test-secret', extensions: { category } }]
				})
			)
			const error = await rejectionOf(client.createFulfillmentOrder(createInput))
			expect(error.code).toBe(
				category === 'PERMISSION_DENIED' ? 'forbidden' : category === 'BAD_REQUEST' ? 'bad_input' : 'upstream'
			)
			expect(JSON.stringify(error)).not.toContain('private address')
			expect(JSON.stringify(error)).not.toContain('test-secret')
		}
	})

	test('never replays creation or cancellation on unknown outcomes or transport errors', async () => {
		for (const status of [0, 401, 429, 500, 503]) {
			let calls = 0
			const client = clientFor(() => {
				calls++
				if (!status) throw new TypeError('Connection lost')
				return new Response(null, { status, headers: { 'Retry-After': '3' } })
			})
			await rejectionOf(client.createFulfillmentOrder(createInput))
			await rejectionOf(client.cancelFulfillmentOrder({ request_id: 'MC-123' }))
			expect(calls).toBe(2)
		}
	})

	test('binds mutation tools with explicit write intent and non-overridable supplier scope', async () => {
		const bound = withAuth(wayfairModule, auth)
		const tool = bound.tools.find((item) => item.id === 'wayfair-cancel-fulfillment-order')
		if (!tool) throw new Error('Missing cancellation tool')
		expect(tool.meta).toMatchObject({ sideEffect: 'write', requiresConfirmation: true, idempotent: false })
		const output = await runTool(
			tool,
			{ request_id: 'MC-123' },
			{
				auth: { ...auth, supplier_id: 999 },
				fetch: async (input, init) => {
					const request = new Request(input, init)
					if (new URL(request.url).pathname === '/oauth/token')
						return Response.json({ access_token: 'test-token', expires_in: 900 })
					expect(bodySchema.parse(await request.json()).variables).toEqual({
						cancelFulfillmentOrderInput: { aggregatorOrderId: 'MC-123', supplierId: '2683' }
					})
					return Response.json({
						data: { cancelFulfillmentOrder: { aggregatorOrderId: 'MC-123', errors: null, results: null } }
					})
				}
			}
		)
		expect(output).toEqual({ aggregatorOrderId: 'MC-123', errors: null, results: null })
	})
})

describe('Wayfair inbound milestones', () => {
	test('preserves nullable orders, shipment journeys and native offset filters', async () => {
		const inbound = {
			orderId: 'IN-1',
			supplierOrderNumber: null,
			orderStatus: 'OPEN' as const,
			estimatedCargoReadyDate: null,
			createdDate: null,
			destinationName: null,
			shipper: null,
			carrier: null,
			bookings: [
				{
					shippingOrderReceivedDate: null,
					shippingOrderConfirmedDate: null,
					shipments: [
						{
							shipmentId: 'SHIP-1',
							receivingIds: [null, 'REC-1'],
							masterBillOfLading: null,
							houseBillOfLading: null,
							containerNumber: null,
							containerType: 'CONTAINER_45G0',
							originPortCode: null,
							destinationPortCode: null,
							trackingStatus: 'TERMINATED',
							legStops: [
								{
									locationName: 'Destination',
									shipmentJourneyPortCode: null,
									shipmentJourney: [{ type: 'EMPTY_CONTAINER_RETUNRED_TO_PORT', timestamp: '2026-09-01T00:00:00Z' }]
								}
							]
						}
					]
				}
			]
		}
		const client = clientFor(async (request) => {
			const body = bodySchema.parse(await request.json())
			expect(body.query).toContain('$paginate: InboundOrderPageInput!')
			expect(body.query).toContain('shipmentJourney { type timestamp }')
			expect(body.variables).toEqual({
				supplierId: 2683,
				status: 'OPEN',
				paginate: { limit: 2, offset: 3 },
				sorts: { createdDate: 'DESCENDING' },
				filters: {
					inboundOrderId: 'IN-1',
					legacyOrderId: '',
					supplierPurchaseOrderId: 'PO-1',
					estimatedCargoReadyDate: { from: '2026-09-01T00:00:00Z' },
					createdDate: { to: '2026-09-02T00:00:00Z' },
					services: 'OCEAN',
					receivingReferenceId: 'REC-1',
					supplierPartNumber: 'PART-1',
					inboundShipmentId: 'SHIP-1',
					billOfLading: 'BOL-1'
				}
			})
			return Response.json({ data: { inboundOrderList: { inboundOrders: [inbound, null] } } })
		})
		expect(
			await client.listInboundOrders({
				status: 'OPEN',
				limit: 2,
				offset: 3,
				sort_order: 'DESCENDING',
				filters: {
					inbound_order_id: 'IN-1',
					legacy_order_id: '',
					supplier_purchase_order_id: 'PO-1',
					estimated_cargo_ready_date: { from: '2026-09-01T00:00:00Z' },
					created_date: { to: '2026-09-02T00:00:00Z' },
					services: 'OCEAN',
					receiving_reference_id: 'REC-1',
					supplier_part_number: 'PART-1',
					inbound_shipment_id: 'SHIP-1',
					bill_of_lading: 'BOL-1'
				}
			})
		).toEqual({ items: [inbound, null], limit: 2, offset: 3, limit_reached: true })
	})

	test('defaults to ten results and zero offset without inventing a cursor or totals', async () => {
		const client = clientFor(async (request) => {
			expect(bodySchema.parse(await request.json()).variables).toEqual({
				supplierId: 2683,
				status: 'COMPLETED',
				paginate: { limit: 10, offset: 0 },
				sorts: { createdDate: 'ASCENDING' }
			})
			return Response.json({ data: { inboundOrderList: { inboundOrders: null } } })
		})
		expect(await client.listInboundOrders({ status: 'COMPLETED' })).toEqual({
			items: null,
			limit: 10,
			offset: 0,
			limit_reached: false
		})
	})

	test('rejects empty response roots and bad pagination or dates', async () => {
		for (const input of [
			{},
			{ status: 'PENDING' },
			{ status: 'OPEN', offset: -1 },
			{ status: 'OPEN', limit: 0 },
			{ status: 'OPEN', filters: { created_date: { from: '2026-09-02T00:00:00Z', to: '2026-09-01T00:00:00Z' } } }
		]) {
			expect(wayfairListInboundOrdersInputSchema.safeParse(input).success).toBe(false)
		}
		for (const data of [null, {}, { inboundOrderList: null }, { inboundOrderList: {} }]) {
			const client = clientFor(() => Response.json({ data }))
			expect((await rejectionOf(client.listInboundOrders({ status: 'OPEN' }))).code).toBe('upstream')
		}
	})
})
