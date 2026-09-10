import { describe, expect, spyOn, test } from 'bun:test'
import { z } from 'zod'

import { runTool, ToolError, withAuth } from '../../src/core'
import type { ArtifactsCreateInput, HostArtifactsAuth } from '../../src/modules/artifacts/contracts'
import { WayfairClient, wayfairModule } from '../../src/vendors/wayfair'
import type {
	WayfairAuth,
	WayfairDownloadDocumentInput,
	WayfairLabelGenerationEvent,
	WayfairRegisterShipmentInput,
	WayfairSaveInventoryInput,
	WayfairStoreDocumentInput,
	WayfairTransactionStatus
} from '../../src/vendors/wayfair/contracts'

const auth: WayfairAuth = { client_id: 'shipping-client', client_secret: 'shipping-secret', supplier_id: 2683 }
const tokenUrl = 'https://sso.auth.wayfair.com/oauth/token'
const orderUrl = 'https://api.wayfair.com/v1/graphql'
const supplierUrl = 'https://api.wayfair.io/v1/supplier-order-api/graphql'
const graphqlBodySchema = z.object({ query: z.string(), variables: z.record(z.string(), z.json()) })
const inventoryLine = { supplier_id: 2683, supplier_part_number: 'PART-001', quantity_on_hand: 0 }
const inventory: WayfairSaveInventoryInput = {
	inventory: [inventoryLine],
	feed_kind: 'TRUE_UP',
	dry_run: false
}
const transaction: WayfairTransactionStatus = {
	handle: 'transaction-1',
	status: 'PROCESSING',
	submittedAt: '2026-09-09 14:16:44.000000 +00:00',
	completedAt: null,
	itemCount: 30,
	errorCount: 12,
	errors: [null, { key: 'PART-001', message: 'Quantity already processed' }, { key: null, message: null }],
	completed: [{ key: 'PART-002', message: null }],
	processingCount: 17,
	processing: null
}
const event: WayfairLabelGenerationEvent = {
	id: 'label-event-1',
	eventDate: '2026-09-09 10:16:44.000000 -04:00',
	pickupDate: '2026-09-10 10:16:44.000000 -04:00',
	poNumber: 12345678,
	billOfLading: { url: 'https://documents.example.test/bol?signature=opaque' },
	consolidatedShippingLabel: { url: 'https://documents.example.test/labels' },
	customsDocument: { required: false, url: null },
	generatedShippingLabels: [
		null,
		{
			poNumber: 12345678,
			fullPoNumber: 'CS12345678',
			numberOfLabels: 2,
			carrier: 'FedEx',
			carrierCode: 'FDEG',
			trackingNumber: 'tracking-1'
		}
	],
	shippingLabelInfo: [null, { carrier: 'FedEx', carrierCode: 'FDEG', trackingNumber: 'tracking-1' }],
	shippingUnits: [{ groupIdentifier: 1, sequenceIdentifier: 1, part: { supplierPartNumber: 'PART-001', upc: null } }]
}
const weight = { value: 12.5, unit: 'POUNDS' as const }
const dimensions = {
	length: { value: 12, unit: 'INCHES' as const },
	width: { value: 8 },
	height: { value: 6, unit: 'CENTIMETERS' as const }
}
const shippingUnit = {
	part_number: 'PART-001',
	unit_type: 'CARTON' as const,
	weight,
	dimensions,
	freight_class: 'CODE_92_5' as const,
	pallet_info: { weight: { value: 2, unit: 'KILOGRAMS' as const } },
	group_identifier: 1,
	sequence_identifier: 2
}
const packageUnit = {
	unit_type: 'BAG' as const,
	weight,
	dimensions,
	freight_class: 'CODE_50' as const,
	contained_parts: [{ part_number: 'PART-001', group_identifier: 1 }]
}
const registration: WayfairRegisterShipmentInput = { po_number: 'CS12345678' }
const bol = {
	availability: 'AVAILABLE' as const,
	url: 'https://storage.googleapis.com/example/bol.pdf?signature=opaque',
	bolNumber: 'BOL-123',
	linkExpirationDatetime: '2026-09-10T19:46:54.488021',
	shipmentReferences: ['shipment-1', null]
}
const missingBol = {
	availability: 'NOT_FOUND' as const,
	url: null,
	bolNumber: null,
	linkExpirationDatetime: null,
	shipmentReferences: null
}
const pdf = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55, 10, 0, 255])

function tokenResponse(): Response {
	return Response.json({ access_token: 'shipping-access-token', expires_in: 900 })
}

function mockClient(handler: (request: Request) => Response | Promise<Response>, binding: WayfairAuth = auth) {
	const requests: Request[] = []
	const client = new WayfairClient(binding, {
		fetch: async (input, init) => {
			const request = new Request(input, init)
			requests.push(request)
			if (request.url === tokenUrl) return tokenResponse()
			expect(request.headers.get('Authorization')).toBe('Bearer shipping-access-token')
			expect(request.headers.has('X-SELECTED-SUPPLIER-ID')).toBe(false)
			return handler(request)
		}
	})
	return { client, requests }
}

async function graphqlBody(request: Request, endpoint = orderUrl) {
	expect(request.url).toBe(endpoint)
	expect(request.method).toBe('POST')
	expect(request.headers.get('Content-Type')).toBe('application/json')
	return graphqlBodySchema.parse(await request.json())
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

function expectSanitized(error: ToolError) {
	const serialized = error.message + JSON.stringify(error)
	for (const value of ['private-customer', 'shipping-secret', 'shipping-access-token', 'private-path'])
		expect(serialized).not.toContain(value)
}

function hostStorage(onCreate: (input: ArtifactsCreateInput) => void): HostArtifactsAuth {
	return {
		provider: 'host',
		backend: {
			create: async (input) => {
				onCreate(input)
				return {
					artifact: { store: 'host', key: input.key, media_type: input.media_type, byte_length: pdf.byteLength }
				}
			},
			readRange: async () => {
				throw new Error('unexpected artifact read')
			},
			readLines: async () => {
				throw new Error('unexpected artifact read')
			}
		}
	}
}

describe('wayfair redirect policy', () => {
	test('disables redirects for authentication, mutations and document downloads', async () => {
		const { client, requests } = mockClient((request) => {
			expect(request.redirect).toBe('error')
			return request.method === 'GET'
				? new Response(pdf, { headers: { 'Content-Type': 'application/pdf' } })
				: Response.json({ data: { inventory: { save: transaction } } })
		})
		await client.saveInventory(inventory)
		await client.downloadPackingSlipBytes({ po_number: 'CS123', max_bytes: 100 })
		expect(requests).toHaveLength(3)
		expect(requests.every((request) => request.redirect === 'error')).toBe(true)
	})

	test('does not follow or replay redirected writes', async () => {
		for (const status of [307, 308]) {
			const { client, requests } = mockClient(
				() =>
					new Response(null, {
						status,
						headers: { Location: 'https://other.example/private-path' }
					})
			)
			const error = await rejectionOf(client.saveInventory(inventory))
			expect(error.code).toBe('upstream')
			expectSanitized(error)
			expect(requests).toHaveLength(2)
		}
	})
})

const writes = [
	{
		name: 'saveInventory',
		invoke: (client: WayfairClient) => client.saveInventory(inventory),
		data: { inventory: { save: transaction } }
	},
	{
		name: 'registerShipment',
		invoke: (client: WayfairClient) => client.registerShipment(registration),
		data: { purchaseOrders: { register: event } }
	},
	{
		name: 'acknowledgeCastleGateOrder',
		invoke: (client: WayfairClient) => client.acknowledgeCastleGateOrder({ po_number: 'CS12345678' }),
		data: { purchaseOrders: { acknowledgeCastleGate: transaction } }
	},
	{
		name: 'acknowledgeCastleGateShippingAdvices',
		invoke: (client: WayfairClient) => client.acknowledgeCastleGateShippingAdvices({ wsa_ids: ['WSA-1', 'WSA-2'] }),
		data: { purchaseOrders: { acknowledgeCastleGateWarehouseShippingAdvice: transaction } }
	}
]
const reads = [
	{
		name: 'listLabelGenerationEvents',
		invoke: (client: WayfairClient) => client.listLabelGenerationEvents(),
		data: { labelGenerationEvents: [event] },
		endpoint: orderUrl
	},
	{
		name: 'getConsolidatedBol',
		invoke: (client: WayfairClient) => client.getConsolidatedBol({ date: '2026-09-09' }),
		data: { consolidatedBolDocument: bol },
		endpoint: supplierUrl
	},
	{
		name: 'listCastleGateOrders',
		invoke: (client: WayfairClient) => client.listCastleGateOrders(),
		data: { getCastleGatePurchaseOrders: [] },
		endpoint: orderUrl
	},
	{
		name: 'listCastleGateShippingAdvices',
		invoke: (client: WayfairClient) => client.listCastleGateShippingAdvices(),
		data: { getCastleGateWarehouseShippingAdvice: [] },
		endpoint: orderUrl
	}
]
const documents = [
	{
		name: 'bill of lading',
		path: 'bill_of_lading',
		toolId: 'wayfair-download-bill-of-lading',
		bytes: (client: WayfairClient, input: WayfairDownloadDocumentInput) => client.downloadBillOfLadingBytes(input),
		store: (client: WayfairClient, input: WayfairStoreDocumentInput) => client.downloadBillOfLading(input)
	},
	{
		name: 'packing slip',
		path: 'packing_slip',
		toolId: 'wayfair-download-packing-slip',
		bytes: (client: WayfairClient, input: WayfairDownloadDocumentInput) => client.downloadPackingSlipBytes(input),
		store: (client: WayfairClient, input: WayfairStoreDocumentInput) => client.downloadPackingSlip(input)
	},
	{
		name: 'shipping label',
		path: 'shipping_label',
		toolId: 'wayfair-download-shipping-label',
		bytes: (client: WayfairClient, input: WayfairDownloadDocumentInput) => client.downloadShippingLabelBytes(input),
		store: (client: WayfairClient, input: WayfairStoreDocumentInput) => client.downloadShippingLabel(input)
	}
]

describe('wayfair inventory feed submission', () => {
	test('uses the inventory wrapper and explicit feed semantics, preserving falsy optional fields', async () => {
		const part = 'PART" }) { save } #'
		const { client, requests } = mockClient(async (request) => {
			const body = await graphqlBody(request)
			expect(body.query).toContain('$inventory: [inventoryInput!]!')
			expect(body.query).toContain('$feedKind: inventoryFeedKind')
			expect(body.query).toContain('$dryRun: Boolean')
			expect(body.query).toMatch(
				/inventory\s*\{\s*save\(inventory: \$inventory, feedKind: \$feedKind, dryRun: \$dryRun\)/
			)
			expect(body.query).not.toContain(part)
			expect(body.variables).toEqual({
				feedKind: 'DIFFERENTIAL',
				dryRun: false,
				inventory: [
					{
						supplierId: 17,
						supplierPartNumber: part,
						quantityOnHand: -1,
						quantityBackordered: 0,
						quantityOnOrder: 0,
						itemNextAvailabilityDate: '12-31-2026 11:59:59',
						productNameAndOptions: '',
						discontinued: false
					},
					{ supplierId: 2683, supplierPartNumber: 'PART-001', quantityOnHand: 0 }
				]
			})
			return Response.json({ data: { inventory: { save: transaction } } })
		})
		expect(
			await client.saveInventory({
				feed_kind: 'DIFFERENTIAL',
				dry_run: false,
				inventory: [
					{
						supplier_id: 17,
						supplier_part_number: part,
						quantity_on_hand: -1,
						quantity_backordered: 0,
						quantity_on_order: 0,
						item_next_availability_date: '12-31-2026 11:59:59',
						product_name_and_options: '',
						discontinued: false
					},
					inventoryLine
				]
			})
		).toEqual(transaction)
		expect(requests).toHaveLength(2)
	})

	test('passes dry_run=true without submitting a second applying mutation', async () => {
		const { client, requests } = mockClient(async (request) => {
			expect((await graphqlBody(request)).variables).toEqual({
				feedKind: 'TRUE_UP',
				dryRun: true,
				inventory: [{ supplierId: 2683, supplierPartNumber: 'PART-001', quantityOnHand: 0 }]
			})
			return Response.json({ data: { inventory: { save: transaction } } })
		})
		expect(await client.saveInventory({ ...inventory, dry_run: true })).toEqual(transaction)
		expect(requests).toHaveLength(2)
	})

	test('preserves native nullable and mixed item states rather than inferring success from submission', async () => {
		for (const status of ['NEW', 'PROCESSING', 'ERROR', 'COMPLETE', null] as const) {
			const value = { ...transaction, status, handle: null, itemCount: null }
			const { client } = mockClient(() => Response.json({ data: { inventory: { save: value } } }))
			const result = await client.saveInventory(inventory)
			expect(result).toEqual(value)
			expect(result).not.toHaveProperty('success')
			expect(result.errorCount).toBe(12)
			expect(result.errors).toHaveLength(3)
		}
	})
})

describe('wayfair shipment registration and labels', () => {
	test('omits optional registration fields so Wayfair supplies warehouse, pickup and catalog defaults', async () => {
		const { client, requests } = mockClient(async (request) => {
			const body = await graphqlBody(request)
			expect(body.query).toContain('$registrationInput: RegistrationInput!')
			expect(body.query).toMatch(/purchaseOrders\s*\{\s*register\(registrationInput: \$registrationInput\)/)
			expect(body.query).not.toContain('shipment(notice:')
			expect(body.variables).toEqual({ registrationInput: { poNumber: 'CS12345678' } })
			return Response.json({ data: { purchaseOrders: { register: event } } })
		})
		expect(await client.registerShipment(registration)).toEqual(event)
		expect(requests).toHaveLength(2)
	})

	test('maps shipping units, pallet details and date-times without interpolating values', async () => {
		const po = 'CS" }) { shipment } #'
		const { client } = mockClient(async (request) => {
			const body = await graphqlBody(request)
			expect(body.query).not.toContain(po)
			expect(body.variables).toEqual({
				registrationInput: {
					poNumber: po,
					warehouseId: 0,
					requestForPickupDate: '2026-09-09 10:16:44.000000 -04:00',
					shippingUnits: [
						{
							partNumber: 'PART-001',
							unitType: 'CARTON',
							weight,
							dimensions,
							freightClass: 'CODE_92_5',
							palletInfo: { weight: { value: 2, unit: 'KILOGRAMS' } },
							groupIdentifier: 1,
							sequenceIdentifier: 2
						}
					]
				}
			})
			return Response.json({ data: { purchaseOrders: { register: event } } })
		})
		expect(
			await client.registerShipment({
				po_number: po,
				warehouse_id: 0,
				request_for_pickup_date: '2026-09-09 10:16:44.000000 -04:00',
				shipping_units: [shippingUnit]
			})
		).toEqual(event)
	})

	test('maps alternative package-level packing without sending shippingUnits', async () => {
		const { client } = mockClient(async (request) => {
			expect((await graphqlBody(request)).variables).toEqual({
				registrationInput: {
					poNumber: 'CS12345678',
					warehouseId: 'warehouse-1',
					packageUnits: [
						{
							unitType: 'BAG',
							weight,
							dimensions,
							freightClass: 'CODE_50',
							containedParts: [{ partNumber: 'PART-001', groupIdentifier: 1 }]
						}
					]
				}
			})
			return Response.json({ data: { purchaseOrders: { register: event } } })
		})
		await client.registerShipment({ ...registration, warehouse_id: 'warehouse-1', package_units: [packageUnit] })
	})

	test('reads one default page with nullable label items and never registers or follows document links', async () => {
		const { client, requests } = mockClient(async (request) => {
			const body = await graphqlBody(request)
			expect(body.query).toContain('$filters: [LabelGenerationEventFilterInput]')
			expect(body.query).toContain('$ordering: [orderingInput]')
			expect(body.query).toContain(
				'labelGenerationEvents(filters: $filters, ordering: $ordering, limit: $limit, offset: $offset)'
			)
			expect(body.query).not.toContain('mutation')
			expect(body.query).not.toContain('register(')
			for (const field of [
				'billOfLading',
				'consolidatedShippingLabel',
				'customsDocument',
				'generatedShippingLabels',
				'shippingLabelInfo',
				'shippingUnits'
			])
				expect(body.query).toContain(field)
			expect(body.variables).toEqual({ limit: 10, offset: 0 })
			return Response.json({ data: { labelGenerationEvents: [event] } })
		})
		expect(await client.listLabelGenerationEvents()).toEqual({
			items: [event],
			limit: 10,
			offset: 0,
			limit_reached: false
		})
		expect(requests.map((request) => request.url)).toEqual([tokenUrl, orderUrl])
	})

	test('maps every filter comparator and returns only the requested offset page', async () => {
		const value = 'CS" }) { register } #'
		const { client, requests } = mockClient(async (request) => {
			const body = await graphqlBody(request)
			expect(body.query).not.toContain(value)
			expect(body.variables).toEqual({
				limit: 1,
				offset: 7,
				ordering: [{ desc: 'eventDate' }, { asc: 'id' }],
				filters: [
					{
						field: 'poNumber',
						conjunction: 'OR',
						equals: value,
						greaterThan: '1',
						greaterThanOrEqualTo: '2',
						lessThan: '9',
						lessThanOrEqualTo: '8',
						notEqualTo: '',
						in: ['3', '4'],
						notIn: ['5'],
						isNull: false
					}
				]
			})
			return Response.json({ data: { labelGenerationEvents: [event] } })
		})
		expect(
			await client.listLabelGenerationEvents({
				limit: 1,
				offset: 7,
				ordering: [{ desc: 'eventDate' }, { asc: 'id' }],
				filters: [
					{
						field: 'poNumber',
						conjunction: 'OR',
						equals: value,
						greater_than: '1',
						greater_than_or_equal_to: '2',
						less_than: '9',
						less_than_or_equal_to: '8',
						not_equal_to: '',
						in: ['3', '4'],
						not_in: ['5'],
						is_null: false
					}
				]
			})
		).toEqual({ items: [event], limit: 1, offset: 7, limit_reached: true })
		expect(requests).toHaveLength(2)
	})

	test('returns an empty event page without inventing events or continuation tokens', async () => {
		const { client } = mockClient(() => Response.json({ data: { labelGenerationEvents: [] } }))
		expect(await client.listLabelGenerationEvents({ offset: 10 })).toEqual({
			items: [],
			limit: 10,
			offset: 10,
			limit_reached: false
		})
	})

	test('rejects malformed event structures and required fields while allowing documented nullable members', async () => {
		for (const malformed of [
			{ ...event, billOfLading: null },
			{ ...event, customsDocument: { required: null, url: null } },
			{ ...event, generatedShippingLabels: null },
			{ ...event, generatedShippingLabels: [{ numberOfLabels: '2' }] },
			{ ...event, shippingLabelInfo: null },
			{ ...event, shippingUnits: [null] }
		]) {
			for (const mode of ['register', 'list']) {
				const data =
					mode === 'register' ? { purchaseOrders: { register: malformed } } : { labelGenerationEvents: [malformed] }
				const { client } = mockClient(() => Response.json({ data }))
				const error = await rejectionOf(
					mode === 'register' ? client.registerShipment(registration) : client.listLabelGenerationEvents()
				)
				expect(error.code).toBe('upstream')
			}
		}
	})
})

describe('wayfair consolidated bill of lading', () => {
	test('uses the supplier GraphQL endpoint, bound supplier and strict date variable without downloading the URL', async () => {
		const { client, requests } = mockClient(async (request) => {
			const body = await graphqlBody(request, supplierUrl)
			expect(body.query).toContain('$supplierId: Int!')
			expect(body.query).toContain('$date: Date!')
			expect(body.query).toContain('consolidatedBolDocument(supplierId: $supplierId, date: $date)')
			expect(body.query).not.toContain('mutation')
			expect(body.variables).toEqual({ supplierId: 2683, date: '2026-09-09' })
			return Response.json({ data: { consolidatedBolDocument: bol } })
		})
		expect(await client.getConsolidatedBol({ date: '2026-09-09' })).toEqual(bol)
		expect(requests.map((request) => request.url)).toEqual([tokenUrl, supplierUrl])
	})

	test('preserves NOT_FOUND and null document metadata instead of throwing not_found or manufacturing an artifact', async () => {
		const { client } = mockClient(() => Response.json({ data: { consolidatedBolDocument: missingBol } }))
		expect(await client.getConsolidatedBol({ date: '2024-02-29' })).toEqual(missingBol)
	})

	test('rejects malformed availability, references and document roots', async () => {
		for (const value of [null, {}, { ...bol, availability: 'PENDING' }, { ...bol, shipmentReferences: [4] }]) {
			const { client } = mockClient(() => Response.json({ data: { consolidatedBolDocument: value } }))
			expect(await rejectionOf(client.getConsolidatedBol({ date: '2026-09-09' }))).toMatchObject({ code: 'upstream' })
		}
	})
})

describe('wayfair CastleGate receipt lifecycle', () => {
	test('reads orders with native defaults and no implicit acknowledgment', async () => {
		const { client, requests } = mockClient(async (request) => {
			const body = await graphqlBody(request)
			expect(body.variables).toEqual({ limit: 10, sortOrder: 'ASC' })
			expect(body.query).toContain('$limit: Int32')
			expect(body.query).toContain('$fromDate: IsoDateTime')
			expect(body.query).toContain('$poNumbers: [String]')
			expect(body.query).toContain(
				'getCastleGatePurchaseOrders(limit: $limit, hasResponse: $hasResponse, fromDate: $fromDate, poNumbers: $poNumbers, sortOrder: $sortOrder)'
			)
			expect(body.query).toContain('shipTo')
			expect(body.query).toContain('billTo')
			expect(body.query).not.toContain('mutation')
			expect(body.query).not.toContain('acknowledgeCastleGate')
			return Response.json({ data: { getCastleGatePurchaseOrders: [] } })
		})
		expect(await client.listCastleGateOrders()).toEqual({ items: [], limit: 10, limit_reached: false })
		expect(requests).toHaveLength(2)
	})

	test('preserves null order items and product fields, normalizes numeric-string quantities and passes exact filters', async () => {
		const po = 'CS" }) { acknowledgeCastleGate } #'
		const order = {
			id: null,
			poNumber: po,
			poDate: null,
			shippingInfo: null,
			products: [null, { partNumber: null, quantity: '2', price: null, name: null, sku: null }, { quantity: null }],
			shipTo: { name: null },
			billTo: {}
		}
		const { client, requests } = mockClient(async (request) => {
			const body = await graphqlBody(request)
			expect(body.query).not.toContain(po)
			expect(body.variables).toEqual({
				limit: 2,
				sortOrder: 'DESC',
				hasResponse: false,
				fromDate: '2026-09-09 10:16:44.000000 -04:00',
				poNumbers: [po]
			})
			return Response.json({ data: { getCastleGatePurchaseOrders: [null, order] } })
		})
		const result = await client.listCastleGateOrders({
			limit: 2,
			sort_order: 'DESC',
			has_response: false,
			from_date: '2026-09-09 10:16:44.000000 -04:00',
			po_numbers: [po]
		})
		expect(result).toEqual({
			items: [
				null,
				{
					...order,
					products: [null, { partNumber: null, quantity: 2, price: null, name: null, sku: null }, { quantity: null }]
				}
			],
			limit: 2,
			limit_reached: true
		})
		expect(requests).toHaveLength(2)
	})

	test('reads shipping advices with exact wrappers, nullable nested items and no receipt acknowledgment', async () => {
		const id = 'WSA" }) { acknowledgeCastleGate } #'
		const advice = {
			wsaId: id,
			supplierId: null,
			poNumber: null,
			totalShipmentWeight: 0,
			totalQuantity: 0,
			packages: [null, { packageWeight: null, trackingNumber: null }],
			shipFrom: null,
			shipTo: { name: null, title: null, company: null },
			products: [null, { quantityOrdered: null, quantityShipped: 0, forceQuantityMultiplier: null }]
		}
		const { client, requests } = mockClient(async (request) => {
			const body = await graphqlBody(request)
			expect(body.query).toContain('$wsaIds: [String]')
			expect(body.query).toContain(
				'getCastleGateWarehouseShippingAdvice(limit: $limit, hasResponse: $hasResponse, fromDate: $fromDate, wsaIds: $wsaIds, sortOrder: $sortOrder)'
			)
			expect(body.query).not.toContain('mutation')
			expect(body.query).not.toContain(id)
			expect(body.variables).toEqual({
				limit: 2,
				sortOrder: 'DESC',
				hasResponse: false,
				fromDate: '2026-09-09T10:00:00Z',
				wsaIds: [id]
			})
			return Response.json({ data: { getCastleGateWarehouseShippingAdvice: [advice, null] } })
		})
		expect(
			await client.listCastleGateShippingAdvices({
				limit: 2,
				sort_order: 'DESC',
				has_response: false,
				from_date: '2026-09-09T10:00:00Z',
				wsa_ids: [id]
			})
		).toEqual({ items: [advice, null], limit: 2, limit_reached: true })
		expect(requests).toHaveLength(2)
	})

	test('preserves native null CastleGate lists rather than inventing empty arrays', async () => {
		for (const [field, invoke] of [
			['getCastleGatePurchaseOrders', (client: WayfairClient) => client.listCastleGateOrders()],
			['getCastleGateWarehouseShippingAdvice', (client: WayfairClient) => client.listCastleGateShippingAdvices()]
		] as const) {
			const { client } = mockClient(async (request) => {
				expect((await graphqlBody(request)).variables).toEqual({ limit: 10, sortOrder: 'ASC' })
				return Response.json({ data: { [field]: null } })
			})
			expect(await invoke(client)).toEqual({ items: null, limit: 10, limit_reached: false })
		}
	})

	test('acknowledges exactly one order or native WSA batch and preserves pending per-item failures', async () => {
		for (const { field, variables, invoke } of [
			{
				field: 'acknowledgeCastleGate',
				variables: { poNumber: 'CS12345678' },
				invoke: (client: WayfairClient) => client.acknowledgeCastleGateOrder({ po_number: 'CS12345678' })
			},
			{
				field: 'acknowledgeCastleGateWarehouseShippingAdvice',
				variables: { wsaIds: ['WSA-1', 'WSA-2'] },
				invoke: (client: WayfairClient) => client.acknowledgeCastleGateShippingAdvices({ wsa_ids: ['WSA-1', 'WSA-2'] })
			}
		]) {
			const { client, requests } = mockClient(async (request) => {
				const body = await graphqlBody(request)
				expect(body.query).toContain('mutation')
				expect(body.query).toMatch(new RegExp(`purchaseOrders\\s*\\{\\s*${field}\\(`))
				expect(body.query).toContain(field === 'acknowledgeCastleGate' ? '$poNumber: String!' : '$wsaIds: [String]!')
				expect(body.variables).toEqual(variables)
				expect(body.query).not.toContain('shipment(notice:')
				expect(body.query).not.toContain('accept(')
				return Response.json({ data: { purchaseOrders: { [field]: transaction } } })
			})
			expect(await invoke(client)).toEqual(transaction)
			expect(requests).toHaveLength(2)
		}
	})
})

describe('wayfair lifecycle validation and error boundaries', () => {
	test('rejects invalid client inputs before token acquisition or vendor HTTP', async () => {
		let calls = 0
		const client = new WayfairClient(auth, {
			fetch: async () => {
				calls += 1
				throw new Error('unexpected HTTP')
			}
		})
		const invalid: Array<() => Promise<unknown>> = [
			() => client.saveInventory({ ...inventory, inventory: [] }),
			() => client.saveInventory({ ...inventory, inventory: [{ ...inventoryLine, supplier_id: 0 }] }),
			() => client.saveInventory({ ...inventory, inventory: [{ ...inventoryLine, supplier_part_number: '' }] }),
			() => client.saveInventory({ ...inventory, inventory: [{ ...inventoryLine, quantity_on_hand: -2 }] }),
			() => client.saveInventory({ ...inventory, inventory: [{ ...inventoryLine, quantity_on_hand: 1.5 }] }),
			() => client.saveInventory({ ...inventory, inventory: [{ ...inventoryLine, quantity_on_hand: 2_147_483_648 }] }),
			() => client.registerShipment({ po_number: '' }),
			() => client.registerShipment({ ...registration, shipping_units: [] }),
			() => client.registerShipment({ ...registration, package_units: [] }),
			() => client.registerShipment({ ...registration, shipping_units: [shippingUnit], package_units: [packageUnit] }),
			() => client.registerShipment({ ...registration, request_for_pickup_date: '2026-02-30T10:00:00Z' }),
			() => client.registerShipment({ ...registration, shipping_units: [{ ...shippingUnit, group_identifier: 0 }] }),
			() =>
				client.registerShipment({
					...registration,
					shipping_units: [{ ...shippingUnit, sequence_identifier: 2_147_483_648 }]
				}),
			() =>
				client.registerShipment({
					...registration,
					shipping_units: [{ ...shippingUnit, weight: { ...weight, value: -1 } }]
				}),
			() =>
				client.registerShipment({
					...registration,
					shipping_units: [{ ...shippingUnit, dimensions: { ...dimensions, length: { value: 0 } } }]
				}),
			() => client.registerShipment({ ...registration, package_units: [{ ...packageUnit, contained_parts: [] }] }),
			() => client.listLabelGenerationEvents({ limit: 0 }),
			() => client.listLabelGenerationEvents({ limit: 2_147_483_648 }),
			() => client.listLabelGenerationEvents({ offset: -1 }),
			() => client.listLabelGenerationEvents({ offset: 1.5 }),
			() => client.getConsolidatedBol({ date: '2026-02-29' }),
			() => client.getConsolidatedBol({ date: '2026-09-09T00:00:00Z' }),
			() => client.listCastleGateOrders({ limit: 0 }),
			() => client.listCastleGateOrders({ limit: 2_147_483_648 }),
			() => client.listCastleGateOrders({ po_numbers: [] }),
			() => client.listCastleGateOrders({ po_numbers: [''] }),
			() => client.listCastleGateOrders({ from_date: '2026-09-09' }),
			() => client.listCastleGateShippingAdvices({ limit: 1.5 }),
			() => client.listCastleGateShippingAdvices({ wsa_ids: [] }),
			() => client.listCastleGateShippingAdvices({ wsa_ids: [''] }),
			() => client.listCastleGateShippingAdvices({ from_date: 'not-a-date' }),
			() => client.acknowledgeCastleGateOrder({ po_number: '' }),
			() => client.acknowledgeCastleGateShippingAdvices({ wsa_ids: [] }),
			() => client.acknowledgeCastleGateShippingAdvices({ wsa_ids: [''] })
		]
		for (const invoke of invalid) expect(await rejectionOf(invoke())).toMatchObject({ code: 'bad_input' })
		expect(calls).toBe(0)
	})

	for (const operation of [...writes, ...reads]) {
		test(`${operation.name} sanitizes GraphQL messages, paths and extensions, including partial data`, async () => {
			for (const [extensions, code] of [
				[{ category: 'PERMISSION_DENIED' }, 'forbidden'],
				[{ category: 'BAD_REQUEST' }, 'bad_input'],
				[{ classification: 'ValidationError' }, 'bad_input'],
				[{ classification: { type: 'ExtendedValidationError' } }, 'bad_input'],
				[{ classification: { type: 'InternalError', debugInfo: 'private-customer' } }, 'upstream'],
				[null, 'upstream']
			] as const) {
				const { client, requests } = mockClient(() =>
					Response.json({
						data: operation.data,
						errors: [
							{
								message: 'private-customer shipping-secret shipping-access-token',
								path: ['private-path'],
								extensions
							}
						]
					})
				)
				const error = await rejectionOf(operation.invoke(client))
				expect(error).toMatchObject({ code, retryable: false, details: { error_count: 1 } })
				expectSanitized(error)
				expect(requests).toHaveLength(2)
			}
		})

		test(`${operation.name} rejects missing or malformed response envelopes`, async () => {
			for (const body of [
				{},
				{ data: null },
				{ data: {} },
				{ data: { purchaseOrders: null } },
				{ errors: [{ message: 'private-customer', extensions: [] }] }
			]) {
				const { client } = mockClient(() => Response.json(body))
				const error = await rejectionOf(operation.invoke(client))
				expect(error.code).toBe('upstream')
				expectSanitized(error)
			}
		})
	}

	for (const operation of writes) {
		test(`${operation.name} never replays writes after HTTP or uncertain network failure`, async () => {
			for (const [status, code] of [
				[401, 'bad_auth'],
				[403, 'forbidden'],
				[429, 'rate_limited'],
				[500, 'upstream'],
				[503, 'upstream'],
				[0, 'upstream']
			] as const) {
				const { client, requests } = mockClient(() => {
					if (!status) throw new TypeError('Connection lost')
					return Response.json(
						{ message: 'private-customer shipping-secret' },
						{ status, headers: { 'Retry-After': '17' } }
					)
				})
				const error = await rejectionOf(operation.invoke(client))
				expect(error.code).toBe(code)
				if (status === 429) expect(error.details).toMatchObject({ retry_after_ms: 17_000 })
				expectSanitized(error)
				expect(requests.map((request) => request.url)).toEqual([tokenUrl, orderUrl])
			}
		})
	}
})

describe('wayfair document bytes and artifacts', () => {
	for (const document of documents) {
		test(`${document.name} uses the authenticated fixed GET endpoint and encodes the entire PO segment`, async () => {
			const po = 'CS/../123?redirect=https://untrusted.example/#%2f'
			const { client, requests } = mockClient((request) => {
				expect(request.url).toBe(`https://api.wayfair.com/v1/${document.path}/${encodeURIComponent(po)}`)
				expect(request.method).toBe('GET')
				expect(request.headers.get('Accept')).toBe('application/octet-stream')
				return new Response(pdf, {
					headers: { 'Content-Type': 'application/pdf; charset=binary', 'Content-Length': String(pdf.byteLength) }
				})
			})
			expect(await document.bytes(client, { po_number: po, max_bytes: pdf.byteLength })).toEqual({
				bytes: pdf,
				media_type: 'application/pdf',
				byte_length: pdf.byteLength
			})
			expect(requests).toHaveLength(2)
		})

		test(`${document.name} requires valid byte bounds and PO before any HTTP`, async () => {
			const { client, requests } = mockClient(() => {
				throw new Error('unexpected HTTP')
			})
			for (const input of [
				{ po_number: '', max_bytes: 1 },
				{ po_number: '.', max_bytes: 1 },
				{ po_number: '..', max_bytes: 1 },
				{ po_number: 'CS123', max_bytes: 0 },
				{ po_number: 'CS123', max_bytes: -1 },
				{ po_number: 'CS123', max_bytes: 1.5 },
				{ po_number: 'CS123', max_bytes: Number.POSITIVE_INFINITY }
			])
				expect(await rejectionOf(document.bytes(client, input))).toMatchObject({ code: 'bad_input' })
			expect(requests).toHaveLength(0)
		})

		test(`${document.name} checks artifact binding and destination before authentication or download`, async () => {
			const { client, requests } = mockClient(() => {
				throw new Error('unexpected HTTP')
			})
			expect(
				await rejectionOf(
					document.store(client, {
						po_number: 'CS123',
						max_bytes: 100,
						output_key: 'shipping/document.pdf'
					})
				)
			).toMatchObject({ code: 'bad_auth' })
			expect(
				await rejectionOf(
					document.store(client, {
						po_number: 'CS123',
						max_bytes: 100,
						output_key: ''
					})
				)
			).toMatchObject({ code: 'bad_input' })
			expect(requests).toHaveLength(0)
		})

		test(`${document.name} creates exactly one bound artifact with byte-exact base64 and no credentials`, async () => {
			const created: ArtifactsCreateInput[] = []
			const { client, requests } = mockClient(
				() => new Response(pdf, { headers: { 'Content-Type': 'application/pdf' } }),
				{ ...auth, artifacts: hostStorage((input) => created.push(input)) }
			)
			const result = await document.store(client, {
				po_number: 'CS123',
				max_bytes: pdf.byteLength,
				output_key: 'shipping/document.pdf'
			})
			expect(created).toEqual([
				{
					key: 'shipping/document.pdf',
					body: Buffer.from(pdf).toString('base64'),
					encoding: 'base64',
					media_type: 'application/pdf'
				}
			])
			expect(result).toEqual({
				artifact: {
					store: 'host',
					key: 'shipping/document.pdf',
					media_type: 'application/pdf',
					byte_length: pdf.byteLength
				}
			})
			for (const value of ['shipping-secret', 'shipping-access-token', 'shipping-client', 'Authorization'])
				expect(JSON.stringify({ created, result })).not.toContain(value)
			expect(result).not.toHaveProperty('bytes')
			expect(result).not.toHaveProperty('body')
			expect(requests).toHaveLength(2)
		})

		test(`${document.name} rejects declared or streamed overflow, cancels reading and never stores oversized bytes`, async () => {
			for (const declaredLength of [undefined, '1', '1000']) {
				let cancelled = false
				let creates = 0
				const { client, requests } = mockClient(
					() => {
						const stream = new ReadableStream<Uint8Array>({
							start(controller) {
								controller.enqueue(pdf)
							},
							cancel() {
								cancelled = true
							}
						})
						return new Response(stream, {
							headers: {
								'Content-Type': 'application/pdf',
								...(declaredLength !== undefined && { 'Content-Length': declaredLength })
							}
						})
					},
					{
						...auth,
						artifacts: hostStorage(() => {
							creates += 1
						})
					}
				)
				expect(
					await rejectionOf(
						document.store(client, {
							po_number: 'CS123',
							max_bytes: pdf.byteLength - 1,
							output_key: 'document.pdf'
						})
					)
				).toMatchObject({ code: 'too_large', details: { max_bytes: pdf.byteLength - 1 } })
				expect(cancelled).toBe(true)
				expect(creates).toBe(0)
				expect(requests).toHaveLength(2)
			}
		})

		test(`${document.name} rejects HTML and JSON error pages rather than creating artifacts`, async () => {
			for (const mediaType of [
				'text/html; charset=UTF-8',
				'application/json',
				'application/problem+json',
				'application/xhtml+xml'
			]) {
				let creates = 0
				const { client } = mockClient(
					() => new Response('private-customer', { headers: { 'Content-Type': mediaType } }),
					{
						...auth,
						artifacts: hostStorage(() => {
							creates += 1
						})
					}
				)
				const error = await rejectionOf(
					document.store(client, { po_number: 'CS123', max_bytes: 100, output_key: 'document.pdf' })
				)
				expect(error.code).toBe('upstream')
				expectSanitized(error)
				expect(creates).toBe(0)
			}
		})

		test(`${document.name} rejects error MIME types case-insensitively`, async () => {
			for (const mediaType of ['Text/HTML; charset=UTF-8', 'Application/JSON']) {
				const { client } = mockClient(
					() => new Response('private-customer', { headers: { 'Content-Type': mediaType } })
				)
				const error = await rejectionOf(document.bytes(client, { po_number: 'CS123', max_bytes: 100 }))
				expect(error.code).toBe('upstream')
				expectSanitized(error)
			}
		})

		test(`${document.name} rejects an empty successful document before artifact creation`, async () => {
			let creates = 0
			const { client } = mockClient(() => new Response(null, { headers: { 'Content-Type': 'application/pdf' } }), {
				...auth,
				artifacts: hostStorage(() => {
					creates++
				})
			})
			expect(
				(
					await rejectionOf(
						document.store(client, {
							po_number: 'CS123',
							max_bytes: 100,
							output_key: 'document.pdf'
						})
					)
				).code
			).toBe('upstream')
			expect(creates).toBe(0)
		})

		test(`${document.name} maps upstream HTTP errors without retry, artifact creation or sensitive error text`, async () => {
			for (const [status, code] of [
				[401, 'bad_auth'],
				[403, 'forbidden'],
				[404, 'not_found'],
				[429, 'rate_limited'],
				[503, 'upstream']
			] as const) {
				let creates = 0
				const { client, requests } = mockClient(
					() =>
						new Response('private-customer shipping-secret', {
							status,
							headers: { 'Content-Type': 'text/html', 'Retry-After': '9' }
						}),
					{
						...auth,
						artifacts: hostStorage(() => {
							creates += 1
						})
					}
				)
				const error = await rejectionOf(
					document.store(client, { po_number: 'CS123', max_bytes: 100, output_key: 'document.pdf' })
				)
				expect(error.code).toBe(code)
				if (status === 429) expect(error.details).toMatchObject({ retry_after_ms: 9000 })
				expectSanitized(error)
				expect(creates).toBe(0)
				expect(requests).toHaveLength(2)
			}
		})
	}

	test('returns binary media fallback and concatenates multiple byte chunks within the bound', async () => {
		const { client } = mockClient(
			() =>
				new Response(
					new ReadableStream<Uint8Array>({
						start(controller) {
							controller.enqueue(pdf.slice(0, 4))
							controller.enqueue(pdf.slice(4))
							controller.close()
						}
					})
				)
		)
		expect(await client.downloadPackingSlipBytes({ po_number: 'CS123', max_bytes: pdf.byteLength })).toEqual({
			bytes: pdf,
			media_type: 'application/octet-stream',
			byte_length: pdf.byteLength
		})
	})

	test('artifact persistence failure does not redownload the document or retry the write', async () => {
		let creates = 0
		const { client, requests } = mockClient(
			() => new Response(pdf, { headers: { 'Content-Type': 'application/pdf' } }),
			{
				...auth,
				artifacts: hostStorage(() => {
					creates += 1
					throw new ToolError('Bound store unavailable', { code: 'upstream' })
				})
			}
		)
		expect(
			await rejectionOf(client.downloadPackingSlip({ po_number: 'CS123', max_bytes: 100, output_key: 'document.pdf' }))
		).toMatchObject({ code: 'upstream' })
		expect(creates).toBe(1)
		expect(requests).toHaveLength(2)
	})
})

describe('wayfair sandbox routing and token lifecycle', () => {
	test('uses sandbox order and supplier origins with sandbox audience, including all document routes', async () => {
		const requests: Request[] = []
		const client = new WayfairClient(
			{ ...auth, environment: 'sandbox' },
			{
				fetch: async (input, init) => {
					const request = new Request(input, init)
					requests.push(request)
					if (request.url === tokenUrl) {
						expect(request.method).toBe('POST')
						expect(await request.json()).toEqual({
							grant_type: 'client_credentials',
							client_id: 'shipping-client',
							client_secret: 'shipping-secret',
							audience: 'https://sandbox.api.wayfair.com/'
						})
						return tokenResponse()
					}
					expect(request.headers.get('Authorization')).toBe('Bearer shipping-access-token')
					if (request.method === 'GET') {
						expect(new URL(request.url).origin).toBe('https://sandbox.api.wayfair.com')
						return new Response(pdf, { headers: { 'Content-Type': 'application/pdf' } })
					}
					if (request.url === 'https://api.wayfair.io/sandbox/v1/supplier-order-api/graphql') {
						expect((await graphqlBody(request, request.url)).variables).toEqual({
							supplierId: 2683,
							date: '2026-09-09'
						})
						return Response.json({ data: { consolidatedBolDocument: missingBol } })
					}
					const body = await graphqlBody(request, 'https://sandbox.api.wayfair.com/v1/graphql')
					if (body.query.includes('inventory {')) return Response.json({ data: writes[0]?.data })
					if (body.query.includes('register(registrationInput:'))
						return Response.json({ data: { purchaseOrders: { register: event } } })
					if (body.query.includes('labelGenerationEvents('))
						return Response.json({ data: { labelGenerationEvents: [] } })
					if (body.query.includes('getCastleGatePurchaseOrders(')) {
						expect(body.query).not.toContain('isCancelled')
						return Response.json({ data: { getCastleGatePurchaseOrders: null } })
					}
					if (body.query.includes('getCastleGateWarehouseShippingAdvice('))
						return Response.json({ data: { getCastleGateWarehouseShippingAdvice: null } })
					if (body.query.includes('acknowledgeCastleGateWarehouseShippingAdvice('))
						return Response.json({
							data: { purchaseOrders: { acknowledgeCastleGateWarehouseShippingAdvice: transaction } }
						})
					if (body.query.includes('acknowledgeCastleGate('))
						return Response.json({ data: { purchaseOrders: { acknowledgeCastleGate: transaction } } })
					throw new Error('unexpected sandbox operation')
				}
			}
		)
		await client.saveInventory(inventory)
		await client.registerShipment(registration)
		await client.listLabelGenerationEvents()
		await client.listCastleGateOrders()
		await client.listCastleGateShippingAdvices()
		await client.acknowledgeCastleGateOrder({ po_number: 'CS123' })
		await client.acknowledgeCastleGateShippingAdvices({ wsa_ids: ['WSA-1'] })
		await client.getConsolidatedBol({ date: '2026-09-09' })
		for (const document of documents) {
			await document.bytes(client, { po_number: 'CS123', max_bytes: 100 })
			expect(requests.at(-1)?.url).toBe(`https://sandbox.api.wayfair.com/v1/${document.path}/CS123`)
		}
		expect(requests.filter((request) => request.url === tokenUrl)).toHaveLength(1)
		expect(requests).toHaveLength(12)
	})

	test('refuses sandbox differential feeds and 501 lines before authentication; sends all 500 allowed lines once', async () => {
		const lines = Array.from({ length: 500 }, (_, index) => ({
			...inventoryLine,
			supplier_part_number: `PART-${index}`
		}))
		const { client, requests } = mockClient(
			async (request) => {
				const body = await graphqlBody(request, 'https://sandbox.api.wayfair.com/v1/graphql')
				expect(body.variables.inventory).toHaveLength(500)
				expect(body.variables.feedKind).toBe('TRUE_UP')
				return Response.json({ data: { inventory: { save: transaction } } })
			},
			{ ...auth, environment: 'sandbox' }
		)
		expect(await rejectionOf(client.saveInventory({ ...inventory, feed_kind: 'DIFFERENTIAL' }))).toMatchObject({
			code: 'bad_input'
		})
		expect(
			await rejectionOf(client.saveInventory({ ...inventory, inventory: [...lines, inventoryLine] }))
		).toMatchObject({ code: 'bad_input' })
		expect(requests).toHaveLength(0)
		await client.saveInventory({ ...inventory, inventory: lines })
		expect(requests).toHaveLength(2)
	})

	test('does not apply sandbox-only feed limits in production', async () => {
		const { client } = mockClient(async (request) => {
			const body = await graphqlBody(request)
			expect(body.variables.inventory).toHaveLength(501)
			expect(body.variables.feedKind).toBe('DIFFERENTIAL')
			return Response.json({ data: { inventory: { save: transaction } } })
		})
		await client.saveInventory({
			...inventory,
			feed_kind: 'DIFFERENTIAL',
			inventory: Array.from({ length: 501 }, () => inventoryLine)
		})
	})

	test('deduplicates concurrent token acquisition across vendor origins and binary downloads, then refreshes before expiry', async () => {
		let now = 1_000_000
		const clock = spyOn(Date, 'now').mockImplementation(() => now)
		let tokens = 0
		let operations = 0
		try {
			const client = new WayfairClient(auth, {
				fetch: async (input, init) => {
					const request = new Request(input, init)
					if (request.url === tokenUrl) {
						tokens += 1
						expect(await request.json()).toMatchObject({ audience: 'https://api.wayfair.com/' })
						await Promise.resolve()
						return Response.json({ access_token: `token-${tokens}`, expires_in: 900 })
					}
					operations += 1
					expect(request.headers.get('Authorization')).toBe(`Bearer token-${tokens}`)
					if (request.method === 'GET') return new Response(pdf)
					if (request.url === supplierUrl) return Response.json({ data: { consolidatedBolDocument: bol } })
					return Response.json({ data: { inventory: { save: transaction } } })
				}
			})
			await Promise.all([
				client.saveInventory(inventory),
				client.getConsolidatedBol({ date: '2026-09-09' }),
				client.downloadPackingSlipBytes({ po_number: 'CS123', max_bytes: 100 })
			])
			expect(tokens).toBe(1)
			now += 839_000
			await client.saveInventory(inventory)
			expect(tokens).toBe(1)
			now += 2000
			await client.getConsolidatedBol({ date: '2026-09-09' })
			expect(tokens).toBe(2)
			expect(operations).toBe(5)
		} finally {
			clock.mockRestore()
		}
	})

	test('clears a failed shared token promise so a later explicit call can authenticate without replaying prior writes', async () => {
		let tokens = 0
		let operations = 0
		const client = new WayfairClient(auth, {
			fetch: async (input, init) => {
				const request = new Request(input, init)
				if (request.url === tokenUrl) {
					tokens += 1
					await Promise.resolve()
					if (tokens === 1) return Response.json({ access_token: 'shipping-secret', expires_in: 0 })
					return tokenResponse()
				}
				operations += 1
				return Response.json({ data: { inventory: { save: transaction } } })
			}
		})
		const failures = await Promise.all([
			rejectionOf(client.saveInventory(inventory)),
			rejectionOf(client.registerShipment(registration))
		])
		for (const error of failures) {
			expect(error.code).toBe('upstream')
			expectSanitized(error)
		}
		expect(tokens).toBe(1)
		expect(operations).toBe(0)
		await client.saveInventory(inventory)
		expect(tokens).toBe(2)
		expect(operations).toBe(1)
	})

	test('cancels token acquisition without sending writes or downloads', async () => {
		const controller = new AbortController()
		controller.abort()
		let operations = 0
		const client = new WayfairClient(auth, {
			signal: controller.signal,
			fetch: async (input, init) => {
				const request = new Request(input, init)
				expect(request.signal.aborted).toBe(true)
				if (request.url !== tokenUrl) operations += 1
				throw new DOMException('Aborted', 'AbortError')
			}
		})
		for (const operation of writes)
			expect(await rejectionOf(operation.invoke(client))).toMatchObject({ code: 'timeout' })
		for (const document of documents)
			expect(await rejectionOf(document.bytes(client, { po_number: 'CS123', max_bytes: 100 }))).toMatchObject({
				code: 'timeout'
			})
		expect(operations).toBe(0)
	})
})

describe('wayfair shipping tool binding', () => {
	test('projects explicit write confirmation and read metadata without exposing byte-returning tools', () => {
		for (const id of [
			'wayfair-save-inventory',
			'wayfair-register-shipment',
			'wayfair-acknowledge-castlegate-order',
			'wayfair-acknowledge-castlegate-shipping-advices'
		]) {
			const tool = wayfairModule.tools.find((entry) => entry.id === id)
			expect(tool?.meta).toMatchObject({
				sideEffect: 'write',
				idempotent: false,
				requiresConfirmation: true,
				network: true,
				supportsCancel: true
			})
		}
		for (const id of [
			'wayfair-list-label-generation-events',
			'wayfair-get-consolidated-bol',
			'wayfair-list-castlegate-orders',
			'wayfair-list-castlegate-shipping-advices'
		]) {
			expect(wayfairModule.tools.find((entry) => entry.id === id)?.meta).toMatchObject({
				sideEffect: 'read',
				idempotent: true,
				network: true,
				supportsCancel: true
			})
		}
		for (const id of [
			'wayfair-download-bill-of-lading',
			'wayfair-download-packing-slip',
			'wayfair-download-shipping-label'
		]) {
			expect(wayfairModule.tools.find((entry) => entry.id === id)?.meta).toMatchObject({
				sideEffect: 'write',
				idempotent: false,
				network: true,
				supportsCancel: true
			})
		}
		expect(wayfairModule.tools.filter((entry) => entry.id.includes('download') && entry.id.endsWith('-bytes'))).toEqual(
			[]
		)
	})

	test('requires explicit inventory feed_kind and dry_run and rejects authentication overrides as tool input', async () => {
		const tool = withAuth(wayfairModule, auth).tools.find((entry) => entry.id === 'wayfair-save-inventory')
		if (!tool) throw new Error('missing inventory submission tool')
		for (const input of [
			{ inventory: [inventoryLine] },
			{ inventory: [inventoryLine], feed_kind: 'TRUE_UP' },
			{ inventory: [inventoryLine], dry_run: true },
			{ ...inventory, client_secret: 'injected' },
			{ ...inventory, environment: 'sandbox' },
			{ ...inventory, supplier_id: 99 }
		]) {
			const error = await rejectionOf(
				runTool(tool, input, {
					fetch: async () => {
						throw new Error('unexpected HTTP')
					}
				})
			)
			expect(error.code).toBe('bad_input')
		}
	})

	test('binds inventory submissions to the host OAuth identity and returns the native transaction', async () => {
		const tool = withAuth(wayfairModule, auth).tools.find((entry) => entry.id === 'wayfair-save-inventory')
		if (!tool) throw new Error('missing inventory submission tool')
		const result = await runTool(tool, inventory, {
			auth: { ...auth, client_id: 'must-not-override', environment: 'sandbox' },
			fetch: async (input, init) => {
				const request = new Request(input, init)
				if (request.url === tokenUrl) {
					expect(await request.json()).toMatchObject({
						client_id: 'shipping-client',
						audience: 'https://api.wayfair.com/'
					})
					return tokenResponse()
				}
				await graphqlBody(request)
				return Response.json({ data: { inventory: { save: transaction } } })
			}
		})
		expect(result).toEqual(transaction)
	})

	for (const document of documents) {
		test(`${document.name} tool returns only a bound ArtifactRef and rejects caller-supplied document URLs`, async () => {
			let creates = 0
			const tool = withAuth(wayfairModule, {
				...auth,
				artifacts: hostStorage(() => {
					creates += 1
				})
			}).tools.find((entry) => entry.id === document.toolId)
			if (!tool) throw new Error('missing document tool')
			const input = { po_number: 'CS123', max_bytes: 100, output_key: 'document.pdf' }
			for (const extra of [
				{ url: 'https://untrusted.example/doc' },
				{ client_secret: 'injected' },
				{ artifacts: {} }
			]) {
				expect(
					await rejectionOf(
						runTool(
							tool,
							{ ...input, ...extra },
							{
								fetch: async () => {
									throw new Error('unexpected HTTP')
								}
							}
						)
					)
				).toMatchObject({ code: 'bad_input' })
			}
			const result = await runTool(tool, input, {
				fetch: async (requestInput, init) => {
					const request = new Request(requestInput, init)
					if (request.url === tokenUrl) return tokenResponse()
					expect(request.url).toBe(`https://api.wayfair.com/v1/${document.path}/CS123`)
					return new Response(pdf, { headers: { 'Content-Type': 'application/pdf' } })
				}
			})
			expect(result).toEqual({
				artifact: { store: 'host', key: 'document.pdf', media_type: 'application/pdf', byte_length: pdf.byteLength }
			})
			expect(creates).toBe(1)
		})
	}
})
