import { describe, expect, test } from 'bun:test'
import { z } from 'zod'

import { runTool, ToolError, withAuth } from '../../src/core'
import {
	WayfairClient,
	wayfairListInventoryAdjustmentsInputSchema,
	wayfairListInventorySummaryInputSchema,
	wayfairModule
} from '../../src/vendors/wayfair'
import type {
	WayfairInventoryAdjustment,
	WayfairInventoryPosition,
	WayfairInventorySummary
} from '../../src/vendors/wayfair'

const auth = { client_id: 'test-client', client_secret: 'test-secret', supplier_id: 2683 }
const graphqlBodySchema = z.object({
	query: z.string(),
	variables: z.record(z.string(), z.json())
})
const position: WayfairInventoryPosition = {
	onHandQty: 100,
	onHand: {
		allocatedQty: 20,
		unreconciledQty: 5,
		inStockQty: 75,
		inStock: {
			fulfillableQty: 70,
			unfulfillableQty: 5,
			unfulfillable: { expiredQty: 0, heldQty: 2, unpickableQty: 3, onTransferQty: 0 }
		}
	},
	warehouses: [{ warehouseId: 123, onHandQty: 100, onHand: null }]
}
const summary: WayfairInventorySummary = {
	manufacturerPartId: 99669697,
	supplierPartNumber: 'PART-001',
	sku: 'DTQ1081',
	productName: 'Example Product',
	options: null,
	inventoryPosition: { castleGate: position, physicalRetail: position }
}
const adjustment: WayfairInventoryAdjustment = {
	eventDate: '2026-09-09T10:00:00-04:00',
	adjustmentType: 'Damage Adjustment',
	supplierPartNumber: 'PART-001',
	quantity: -2,
	description: 'Adjustment out for warehouse damage',
	warehouse: {
		warehouseId: 123,
		name: 'Example Warehouse',
		address: {
			address1: '4 Example Place',
			address2: null,
			address3: null,
			city: 'Boston',
			stateShortName: 'MA',
			country: 'USA',
			postalCode: '02126'
		}
	}
}

function tokenResponse(): Response {
	return Response.json({ access_token: 'test-access-token', expires_in: 900 })
}

function summaryResponse(
	items: WayfairInventorySummary[] = [],
	hasNextPage = false,
	endCursor: string | null = null
): Response {
	return Response.json({
		data: {
			inventorySummaryList: {
				pageInfo: { hasNextPage, endCursor },
				edges: items.map((node) => ({ node }))
			}
		}
	})
}

function adjustmentsResponse(items: WayfairInventoryAdjustment[] = []): Response {
	return Response.json({
		data: {
			inventoryAdjustmentList: {
				pageInfo: { pageNumber: 0, pageSize: 50, totalPages: 1, totalElements: items.length },
				nodes: items
			}
		}
	})
}

function inventoryClient(handler: (request: Request) => Response | Promise<Response>): WayfairClient {
	return new WayfairClient(auth, {
		fetch: async (input, init) => {
			const request = new Request(input, init)
			if (request.url === 'https://sso.auth.wayfair.com/oauth/token') return tokenResponse()
			expect(request.url).toBe('https://api.wayfair.io/v1/supplier-order-api/graphql')
			expect(request.method).toBe('POST')
			expect(request.headers.get('Authorization')).toBe('Bearer test-access-token')
			expect(request.headers.get('Content-Type')).toBe('application/json')
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
	throw new Error('expected ToolError rejection')
}

describe('wayfair inventory visibility', () => {
	test('reads full inventory positions with defaults and does not submit inventory', async () => {
		let calls = 0
		const client = inventoryClient(async (request) => {
			calls += 1
			const body = graphqlBodySchema.parse(await request.json())
			expect(body.query).toContain('$supplierId: Int!')
			expect(body.query).toContain('$filter: InventoryFilterInput')
			expect(body.query).toContain('$page: InventoryPageInput')
			expect(body.query).toContain('inventorySummaryList(supplierId: $supplierId, filter: $filter, page: $page)')
			for (const field of [
				'castleGate',
				'physicalRetail',
				'warehouseId',
				'manufacturerPartId',
				'onHandQty',
				'allocatedQty',
				'unreconciledQty',
				'inStockQty',
				'fulfillableQty',
				'unfulfillableQty',
				'expiredQty',
				'heldQty',
				'unpickableQty',
				'onTransferQty'
			])
				expect(body.query).toContain(field)
			expect(body.query).not.toContain('mutation')
			expect(body.query).not.toContain('save(')
			expect(body.variables).toEqual({ supplierId: 2683, page: { first: 50 } })
			return summaryResponse([summary], true, 'opaque-page-2')
		})
		expect(await client.listInventorySummary()).toEqual({
			items: [summary],
			has_next_page: true,
			end_cursor: 'opaque-page-2'
		})
		expect(calls).toBe(1)
	})

	test('forwards exact filters and opaque cursors using variables', async () => {
		const part = 'PART" }) { inventory { save } } #'
		const cursor = 'opaque+/cursor=="x'
		const client = inventoryClient(async (request) => {
			const body = graphqlBodySchema.parse(await request.json())
			expect(body.variables).toEqual({
				supplierId: 2683,
				filter: { supplierPartNumbers: [part], warehouseId: 0 },
				page: { first: 100, after: cursor }
			})
			expect(body.query).not.toContain(part)
			expect(body.query).not.toContain(cursor)
			return summaryResponse([], false, 'last-page')
		})
		expect(
			await client.listInventorySummary({
				supplier_part_numbers: [part],
				warehouse_id: 0,
				limit: 100,
				cursor
			})
		).toEqual({ items: [], has_next_page: false, end_cursor: 'last-page' })
	})

	test('continues exactly one cursor page per explicit call', async () => {
		let calls = 0
		const client = inventoryClient(async (request) => {
			calls += 1
			const body = graphqlBodySchema.parse(await request.json())
			expect(body.variables.page).toEqual(calls === 1 ? { first: 50 } : { first: 50, after: 'page-2' })
			return calls === 1 ? summaryResponse([summary], true, 'page-2') : summaryResponse()
		})
		const first = await client.listInventorySummary()
		expect(calls).toBe(1)
		if (!first.end_cursor) throw new Error('missing inventory cursor')
		expect(await client.listInventorySummary({ cursor: first.end_cursor })).toEqual({
			items: [],
			has_next_page: false,
			end_cursor: null
		})
		expect(calls).toBe(2)
	})

	test('preserves nullable inventory breakdowns instead of manufacturing zero quantities', async () => {
		const items: WayfairInventorySummary[] = [
			{ ...summary, sku: null, productName: null, inventoryPosition: { castleGate: null, physicalRetail: null } },
			{
				...summary,
				inventoryPosition: {
					castleGate: { ...position, warehouses: null, onHand: { ...position.onHand, inStock: null } },
					physicalRetail: {
						...position,
						warehouses: [],
						onHand: {
							allocatedQty: 0,
							unreconciledQty: -1,
							inStockQty: 0,
							inStock: { fulfillableQty: 0, unfulfillableQty: 0, unfulfillable: null }
						}
					}
				}
			}
		]
		const client = inventoryClient(() => summaryResponse(items))
		expect((await client.listInventorySummary()).items).toEqual(items)
	})

	test('preserves integer-string Long IDs and rejects unsafe numbers or malformed quantities', async () => {
		const largeId = '9223372036854775807'
		const client = inventoryClient(() => summaryResponse([{ ...summary, manufacturerPartId: largeId }]))
		expect((await client.listInventorySummary()).items[0]?.manufacturerPartId).toBe(largeId)
		for (const node of [
			{ ...summary, manufacturerPartId: 9_007_199_254_740_992 },
			{ ...summary, manufacturerPartId: {} },
			{ ...summary, manufacturerPartId: 'not-a-number' },
			{ ...summary, inventoryPosition: { castleGate: { ...position, onHandQty: '100' }, physicalRetail: null } },
			{ ...summary, inventoryPosition: { castleGate: { ...position, onHandQty: 1.5 }, physicalRetail: null } },
			{ ...summary, inventoryPosition: { castleGate: { ...position, onHand: null }, physicalRetail: null } }
		]) {
			const malformed = inventoryClient(() =>
				Response.json({
					data: {
						inventorySummaryList: {
							pageInfo: { hasNextPage: false, endCursor: null },
							edges: [{ node }]
						}
					}
				})
			)
			expect(await rejectionOf(malformed.listInventorySummary())).toMatchObject({ code: 'upstream' })
		}
	})

	test('fails on missing or non-advancing continuation cursors', async () => {
		for (const endCursor of [null, '', 'same-page']) {
			const client = inventoryClient(() => summaryResponse([summary], true, endCursor))
			const error = await rejectionOf(client.listInventorySummary({ cursor: 'same-page' }))
			expect(error).toMatchObject({ code: 'upstream', retryable: false })
			expect(error.message).not.toContain('same-page')
		}
	})

	test('reads adjustment events with signed quantities and native zero-based paging', async () => {
		let calls = 0
		const items: WayfairInventoryAdjustment[] = [
			adjustment,
			{ ...adjustment, quantity: 3, adjustmentType: null, description: null, warehouse: null },
			{ ...adjustment, quantity: 0, warehouse: { warehouseId: null, name: null, address: null } }
		]
		const client = inventoryClient(async (request) => {
			calls += 1
			const body = graphqlBodySchema.parse(await request.json())
			expect(body.query).toContain('$filter: InventoryAdjustmentFilterInput')
			expect(body.query).toContain('$page: InventoryAdjustmentPageInput')
			expect(body.query).toContain('$sortOption: InventoryAdjustmentSortOptionsInput')
			expect(body.query).toContain(
				'inventoryAdjustmentList(supplierId: $supplierId, filter: $filter, page: $page, sortOption: $sortOption)'
			)
			expect(body.query).toContain('quantity description')
			expect(body.query).toContain('stateShortName')
			expect(body.query).not.toContain('mutation')
			expect(body.query).not.toContain('adjustmentMutationNotAvailable')
			expect(body.variables).toEqual({
				supplierId: 2683,
				page: { page: 0, pageSize: 50 },
				sortOption: { sortBy: 'EVENT_DATE', sortOrder: 'DESC' }
			})
			return adjustmentsResponse(items)
		})
		expect(await client.listInventoryAdjustments()).toEqual({
			items,
			page: 0,
			page_size: 50,
			total_pages: 1,
			total_elements: 3
		})
		expect(calls).toBe(1)
	})

	test('maps adjustment filters, date offsets and explicit sorting without interpolation', async () => {
		const part = 'PART" } #'
		const client = inventoryClient(async (request) => {
			const body = graphqlBodySchema.parse(await request.json())
			expect(body.variables).toEqual({
				supplierId: 2683,
				filter: {
					supplierPartNumber: part,
					transactionDateInterval: {
						from: '2026-09-09T10:00:00-04:00',
						to: '2026-09-09T15:00:00Z'
					}
				},
				page: { page: 2, pageSize: 3 },
				sortOption: { sortBy: 'EVENT_DATE', sortOrder: 'ASC' }
			})
			expect(body.query).not.toContain(part)
			return Response.json({
				data: {
					inventoryAdjustmentList: {
						pageInfo: { pageNumber: 2, pageSize: 3, totalPages: 84, totalElements: 4159000 },
						nodes: [adjustment]
					}
				}
			})
		})
		expect(
			await client.listInventoryAdjustments({
				supplier_part_number: part,
				from_datetime: '2026-09-09T10:00:00-04:00',
				to_datetime: '2026-09-09T15:00:00Z',
				page: 2,
				page_size: 3,
				sort_by: 'EVENT_DATE',
				sort_order: 'ASC'
			})
		).toEqual({ items: [adjustment], page: 2, page_size: 3, total_pages: 84, total_elements: 4159000 })
	})

	test('omits unspecified time bounds and does not add a default date interval', async () => {
		for (const [input, filter] of [
			[{ supplier_part_number: 'PART-001' }, { supplierPartNumber: 'PART-001' }],
			[{ from_datetime: '2023-06-01T05:00:00Z' }, { transactionDateInterval: { from: '2023-06-01T05:00:00Z' } }],
			[{ to_datetime: '2026-09-09T10:00:00Z' }, { transactionDateInterval: { to: '2026-09-09T10:00:00Z' } }]
		] as const) {
			const client = inventoryClient(async (request) => {
				const body = graphqlBodySchema.parse(await request.json())
				expect(body.variables.filter).toEqual(filter)
				return adjustmentsResponse()
			})
			await client.listInventoryAdjustments(input)
		}
	})

	test('preserves null pagination metadata instead of guessing totals or pages', async () => {
		const client = inventoryClient(() =>
			Response.json({
				data: {
					inventoryAdjustmentList: {
						pageInfo: { pageNumber: null, pageSize: 50, totalPages: null, totalElements: null },
						nodes: []
					}
				}
			})
		)
		expect(await client.listInventoryAdjustments()).toEqual({
			items: [],
			page: null,
			page_size: 50,
			total_pages: null,
			total_elements: null
		})
	})

	test('validates numeric bounds and empty filters before any authentication or network call', async () => {
		let calls = 0
		const client = new WayfairClient(auth, {
			fetch: async () => {
				calls += 1
				throw new Error('unexpected network call')
			}
		})
		for (const promise of [
			client.listInventorySummary({ limit: 0 }),
			client.listInventorySummary({ limit: 101 }),
			client.listInventorySummary({ limit: 1.5 }),
			client.listInventorySummary({ warehouse_id: 2_147_483_648 }),
			client.listInventorySummary({ warehouse_id: 1.5 }),
			client.listInventorySummary({ cursor: '' }),
			client.listInventorySummary({ supplier_part_numbers: [] }),
			client.listInventorySummary({ supplier_part_numbers: [''] }),
			client.listInventorySummary({ supplier_part_numbers: Array.from({ length: 101 }, () => 'PART-001') }),
			client.listInventoryAdjustments({ supplier_part_number: '' }),
			client.listInventoryAdjustments({ page: -1 }),
			client.listInventoryAdjustments({ page: 1.5 }),
			client.listInventoryAdjustments({ page: 2_147_483_648 }),
			client.listInventoryAdjustments({ page_size: 0 }),
			client.listInventoryAdjustments({ page_size: 101 })
		])
			expect(await rejectionOf(promise)).toMatchObject({ code: 'bad_input' })
		expect(calls).toBe(0)
		expect(
			wayfairListInventorySummaryInputSchema.safeParse({
				limit: 100,
				supplier_part_numbers: Array.from({ length: 100 }, (_, index) => `PART-${index}`)
			}).success
		).toBe(true)
		expect(wayfairListInventoryAdjustmentsInputSchema.safeParse({ page: 0, page_size: 100 }).success).toBe(true)
	})

	test('validates calendar dates, timezone, historical cutoff and chronological intervals', async () => {
		const client = new WayfairClient(auth, {
			fetch: async () => {
				throw new Error('unexpected network call')
			}
		})
		for (const input of [
			{ from_datetime: '2023-06-01T04:59:59Z' },
			{ from_datetime: '2023-05-31T23:59:59-05:00' },
			{ from_datetime: '2026-02-30T00:00:00Z' },
			{ from_datetime: '2026-09-09T10:00:00' },
			{ to_datetime: '2026-09-09' },
			{ from_datetime: '2026-09-09T10:00:00-04:00', to_datetime: '2026-09-09T14:00:00Z' },
			{ from_datetime: '2026-09-09T10:00:00-04:00', to_datetime: '2026-09-09T13:59:59Z' }
		])
			expect(await rejectionOf(client.listInventoryAdjustments(input))).toMatchObject({ code: 'bad_input' })
		expect(
			wayfairListInventoryAdjustmentsInputSchema.safeParse({
				from_datetime: '2023-06-01T00:00:00-05:00',
				to_datetime: '2023-06-01T05:00:01Z'
			}).success
		).toBe(true)
	})

	test('maps documented validation classifications and sanitizes all GraphQL error details', async () => {
		for (const [extensions, code] of [
			[{ classification: 'ValidationError' }, 'bad_input'],
			[{ classification: { type: 'ExtendedValidationError', validatedPath: ['private-part'] } }, 'bad_input'],
			[{ category: 'PERMISSION_DENIED' }, 'forbidden'],
			[{ classification: { type: 'InternalError' } }, 'upstream'],
			[{ classification: [] }, 'upstream'],
			[{ classification: null }, 'upstream']
		] as const) {
			const client = inventoryClient(() =>
				Response.json({
					data: null,
					errors: [{ message: 'private-part or private-cursor', extensions }]
				})
			)
			for (const promise of [client.listInventorySummary(), client.listInventoryAdjustments()]) {
				const error = await rejectionOf(promise)
				expect(error).toMatchObject({ code, retryable: false, details: { error_count: 1 } })
				expect(error.message + JSON.stringify(error)).not.toContain('private-')
			}
		}
	})

	test('rejects absent or malformed connections and partial top-level GraphQL errors', async () => {
		for (const [field, connection, invoke] of [
			[
				'inventorySummaryList',
				{ pageInfo: { hasNextPage: false, endCursor: null }, edges: [] },
				(client: WayfairClient) => client.listInventorySummary()
			],
			[
				'inventoryAdjustmentList',
				{ pageInfo: { pageNumber: 0, pageSize: 50, totalPages: 0, totalElements: 0 }, nodes: [] },
				(client: WayfairClient) => client.listInventoryAdjustments()
			]
		] as const) {
			for (const body of [
				{},
				{ data: null },
				{ data: {} },
				{ data: { [field]: null } },
				{ data: { [field]: {} } },
				{ data: { [field]: { ...connection, pageInfo: null } } },
				{ data: { [field]: { ...connection, nodes: null, edges: null } } },
				{ data: { [field]: { ...connection, nodes: [{}], edges: [{ node: null }] } } },
				{ data: { [field]: connection }, errors: [{ message: 'private partial failure' }] }
			]) {
				const error = await rejectionOf(invoke(inventoryClient(() => Response.json(body))))
				expect(error.code).toBe('upstream')
				expect(error.message + JSON.stringify(error)).not.toContain('private')
			}
		}
	})

	test('preserves HTTP status and retry metadata without automatically retrying', async () => {
		for (const [status, code] of [
			[401, 'bad_auth'],
			[403, 'forbidden'],
			[429, 'rate_limited'],
			[503, 'upstream']
		] as const) {
			let calls = 0
			const client = inventoryClient(() => {
				calls += 1
				return Response.json({ message: 'private upstream detail' }, { status, headers: { 'Retry-After': '17' } })
			})
			for (const promise of [client.listInventorySummary(), client.listInventoryAdjustments()]) {
				const error = await rejectionOf(promise)
				expect(error.code).toBe(code)
				if (status === 429) expect(error.details).toMatchObject({ retry_after_ms: 17_000 })
				expect(error.message + JSON.stringify(error)).not.toContain('private')
			}
			expect(calls).toBe(2)
		}
	})

	test('reuses one token across both inventory APIs', async () => {
		let tokens = 0
		const client = new WayfairClient(auth, {
			fetch: async (input, init) => {
				const request = new Request(input, init)
				if (request.url === 'https://sso.auth.wayfair.com/oauth/token') {
					tokens += 1
					return tokenResponse()
				}
				const body = graphqlBodySchema.parse(await request.json())
				expect(body.variables.supplierId).toBe(2683)
				expect(request.headers.get('Authorization')).toBe('Bearer test-access-token')
				return body.query.includes('inventorySummaryList') ? summaryResponse() : adjustmentsResponse()
			}
		})
		await client.listInventorySummary()
		await client.listInventoryAdjustments()
		expect(tokens).toBe(1)
	})

	test('binds inventory reads to host auth and rejects supplier overrides or unsupported sorting', async () => {
		for (const id of ['wayfair-list-inventory-summary', 'wayfair-list-inventory-adjustments']) {
			const tool = withAuth(wayfairModule, auth).tools.find((entry) => entry.id === id)
			if (!tool) throw new Error('missing Wayfair inventory tool')
			expect(tool.meta).toMatchObject({ sideEffect: 'read', idempotent: true, network: true, supportsCancel: true })
			expect(tool.meta.requiresConfirmation).not.toBe(true)
			const output = await runTool(
				tool,
				{},
				{
					auth: { ...auth, client_id: 'must-not-override', supplier_id: 99 },
					fetch: async (input, init) => {
						const request = new Request(input, init)
						if (request.url === 'https://sso.auth.wayfair.com/oauth/token') {
							expect(await request.json()).toMatchObject({ client_id: 'test-client' })
							return tokenResponse()
						}
						const body = graphqlBodySchema.parse(await request.json())
						expect(body.variables.supplierId).toBe(2683)
						return id === 'wayfair-list-inventory-summary'
							? summaryResponse([summary])
							: adjustmentsResponse([adjustment])
					}
				}
			)
			expect(output).toMatchObject({ items: [id === 'wayfair-list-inventory-summary' ? summary : adjustment] })
			for (const input of [{ supplier_id: 99 }, { client_secret: 'not-a-tool-input' }, { sort_by: 'QUANTITY' }]) {
				expect(
					await rejectionOf(
						runTool(tool, input, {
							fetch: async () => {
								throw new Error('unexpected network call')
							}
						})
					)
				).toMatchObject({ code: 'bad_input' })
			}
		}
	})

	test('propagates abort signals to both inventory requests', async () => {
		for (const invoke of [
			(client: WayfairClient) => client.listInventorySummary(),
			(client: WayfairClient) => client.listInventoryAdjustments()
		]) {
			const controller = new AbortController()
			let reads = 0
			const client = new WayfairClient(auth, {
				signal: controller.signal,
				fetch: async (input, init) => {
					const request = new Request(input, init)
					if (request.url === 'https://sso.auth.wayfair.com/oauth/token') {
						controller.abort()
						return tokenResponse()
					}
					reads += 1
					expect(request.signal.aborted).toBe(true)
					throw new DOMException('Aborted', 'AbortError')
				}
			})
			expect(await rejectionOf(invoke(client))).toMatchObject({ code: 'timeout' })
			expect(reads).toBe(1)
		}
	})
})
