import { describe, expect, test } from 'bun:test'

import { ToolError } from '../../src/core/errors'
import {
	KatanaClient,
	katanaListManufacturingOrderRecipeRowsPageInputSchema,
	katanaListManufacturingOrderRecipeRowsPageOutputSchema,
	katanaListPurchaseOrderRowsPageInputSchema,
	katanaListPurchaseOrderRowsPageOutputSchema,
	katanaListSalesOrderRowsPageInputSchema,
	katanaListSalesOrderRowsPageOutputSchema
} from '../../src/vendors/katana'
import type { KatanaPagination } from '../../src/vendors/katana'

const auth = { api_key: 'katana-component-test-key' }
const timestamps = {
	created_at: '2026-01-01T00:00:00.000Z',
	updated_at: '2026-09-06T00:00:00.000Z',
	deleted_at: '2026-09-06T00:00:00.000Z'
}
const commonRow = {
	id: 101,
	variant_id: 42,
	...timestamps,
	provider_added_field: { nested: ['preserve', 0, false] }
}
const pageCases = [
	{
		method: 'listSalesOrderRowsPage' as const,
		path: '/v1/sales_order_rows',
		inputSchema: katanaListSalesOrderRowsPageInputSchema,
		outputSchema: katanaListSalesOrderRowsPageOutputSchema,
		row: {
			...commonRow,
			sales_order_id: 10,
			quantity: '2.0000000001',
			price_per_unit: '9007199254740993.00001',
			total_discount: 0,
			cogs_value: null,
			variant: { sku: 'PART-42' }
		}
	},
	{
		method: 'listPurchaseOrderRowsPage' as const,
		path: '/v1/purchase_order_rows',
		inputSchema: katanaListPurchaseOrderRowsPageInputSchema,
		outputSchema: katanaListPurchaseOrderRowsPageOutputSchema,
		row: {
			...commonRow,
			purchase_order_id: 20,
			quantity: '3.2500000001',
			price_per_unit: '9007199254740993.00001',
			purchase_uom_conversion_rate: '0.0001',
			group_id: 5,
			purchase_uom: 'kg',
			batch_transactions: [{ batch_id: 8, quantity: '3.2500000001' }]
		}
	},
	{
		method: 'listManufacturingOrderRecipeRowsPage' as const,
		path: '/v1/manufacturing_order_recipe_rows',
		inputSchema: katanaListManufacturingOrderRecipeRowsPageInputSchema,
		outputSchema: katanaListManufacturingOrderRecipeRowsPageOutputSchema,
		row: {
			...commonRow,
			manufacturing_order_id: 30,
			planned_quantity_per_unit: '0.0000000001',
			total_actual_quantity: 0,
			cost: null,
			ingredient_availability: 'PROCESSED',
			notes: 'Keep the provider record unchanged'
		}
	}
]

function paginationHeaders(overrides: Partial<KatanaPagination> = {}) {
	return {
		'X-Pagination': JSON.stringify({
			total_records: 1,
			total_pages: 1,
			offset: 0,
			page: 1,
			first_page: true,
			last_page: true,
			...overrides
		})
	}
}

const windowFilters = {
	created_at_min: '2025-01-01T00:00:00.000Z',
	created_at_max: '2026-09-06T00:00:00.000Z',
	updated_at_min: '2026-09-05T00:00:00.000Z',
	updated_at_max: '2026-09-06T00:00:00.000Z'
}

for (const entry of pageCases) {
	describe(entry.method, () => {
		for (const envelope of [false, true]) {
			test(`preserves raw component fields and metadata, envelope=${envelope}`, async () => {
				let calls = 0
				const client = new KatanaClient(auth, {
					fetch: async (input, init) => {
						calls += 1
						const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
						expect(url.origin).toBe('https://api.katanamrp.com')
						expect(url.pathname).toBe(entry.path)
						expect(init?.method).toBe('GET')
						expect(new Headers(init?.headers).get('authorization')).toBe(`Bearer ${auth.api_key}`)
						expect(url.searchParams.get('page')).toBe('2')
						expect(url.searchParams.get('limit')).toBe('250')
						expect(url.searchParams.getAll('ids')).toEqual(['101', '102'])
						expect(url.searchParams.get('variant_id')).toBe('42')
						expect(url.searchParams.get('include_deleted')).toBe('true')
						for (const [key, value] of Object.entries(windowFilters)) expect(url.searchParams.get(key)).toBe(value)
						return Response.json(envelope ? { data: [entry.row] } : [entry.row], {
							headers: {
								...paginationHeaders({
									page: 2,
									total_pages: 3,
									total_records: 501,
									offset: 250,
									first_page: false,
									last_page: false
								}),
								'X-Ratelimit-Limit': '60',
								'X-Ratelimit-Remaining': '0',
								'X-Ratelimit-Reset': '1788650460000'
							}
						})
					}
				})
				const result = await client[entry.method]({
					page: 2,
					limit: 250,
					ids: [101, 102],
					variant_id: 42,
					include_deleted: true,
					...windowFilters
				})
				expect(calls).toBe(1)
				expect(result.items).toHaveLength(1)
				expect(result.items[0]).toEqual(entry.row)
				expect(result.pagination).toEqual({
					page: 2,
					total_pages: 3,
					total_records: 501,
					offset: 250,
					first_page: false,
					last_page: false
				})
				expect(result.rate_limit).toEqual({ limit: 60, remaining: 0, reset_at_ms: 1788650460000 })
				expect(entry.outputSchema.parse(result)).toEqual(result)
			})
		}

		test('uses provider page defaults without adding filters or auto-pagination', async () => {
			let calls = 0
			const client = new KatanaClient(auth, {
				fetch: async (input) => {
					calls += 1
					const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
					expect(Object.fromEntries(url.searchParams)).toEqual({ page: '1', limit: '50' })
					return Response.json([], {
						headers: paginationHeaders({ total_records: 51, total_pages: 2, last_page: false })
					})
				}
			})
			const result = await client[entry.method]()
			expect(result.items).toEqual([])
			expect(result.pagination.last_page).toBe(false)
			expect(result.rate_limit).toBeUndefined()
			expect(calls).toBe(1)
		})

		test('accepts an empty terminal page and preserves explicit include_deleted=false', async () => {
			const client = new KatanaClient(auth, {
				fetch: async (input) => {
					const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
					expect(url.searchParams.get('include_deleted')).toBe('false')
					return Response.json({ data: [] }, { headers: paginationHeaders({ total_records: 0, total_pages: 0 }) })
				}
			})
			expect((await client[entry.method]({ include_deleted: false })).pagination.last_page).toBe(true)
		})

		test('leaves page advancement to the caller and parses string-encoded metadata', async () => {
			const requestedPages: string[] = []
			const client = new KatanaClient(auth, {
				fetch: async (input) => {
					const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
					const page = url.searchParams.get('page') ?? ''
					requestedPages.push(page)
					return Response.json([entry.row], {
						headers: {
							'X-Pagination': JSON.stringify({
								total_records: '2',
								total_pages: '2',
								offset: page === '1' ? '0' : '1',
								page,
								first_page: String(page === '1'),
								last_page: String(page === '2')
							})
						}
					})
				}
			})
			const first = await client[entry.method]({ page: 1, limit: 1 })
			expect(requestedPages).toEqual(['1'])
			expect(first.pagination.last_page).toBe(false)
			const last = await client[entry.method]({ page: first.pagination.page + 1, limit: 1 })
			expect(last.pagination.last_page).toBe(true)
			expect(requestedPages).toEqual(['1', '2'])
		})

		for (const invalid of [
			{ page: 0 },
			{ page: 1.5 },
			{ limit: 251 },
			{ ids: [] },
			{ variant_id: -1 },
			{ updated_at_min: 'yesterday' }
		]) {
			test(`rejects invalid input before I/O: ${JSON.stringify(invalid)}`, async () => {
				let calls = 0
				const client = new KatanaClient(auth, {
					fetch: async () => {
						calls += 1
						return Response.json([])
					}
				})
				const error = await client[entry.method](invalid).catch((cause: unknown) => cause)
				expect(error).toMatchObject({ code: 'bad_input' })
				expect(calls).toBe(0)
			})
		}
		test('rejects unsupported filters rather than silently ignoring them', () => {
			expect(entry.inputSchema.safeParse({ arbitrary_filter: 'unused' }).success).toBe(false)
		})

		for (const body of [{ data: null }, { data: {} }, [{ id: 1 }], [{ ...commonRow, id: '101' }]]) {
			test(`rejects malformed data or missing component identity: ${JSON.stringify(body)}`, async () => {
				const client = new KatanaClient(auth, {
					fetch: async () => Response.json(body, { headers: paginationHeaders() })
				})
				const error = await client[entry.method]().catch((cause: unknown) => cause)
				expect(error).toMatchObject({ code: 'upstream' })
			})
		}
		test('does not return a successful subset when one row is invalid', async () => {
			const client = new KatanaClient(auth, {
				fetch: async () => Response.json([entry.row, { id: 2 }], { headers: paginationHeaders() })
			})
			const error = await client[entry.method]().catch((cause: unknown) => cause)
			expect(error).toMatchObject({ code: 'upstream' })
		})
		for (const headers of [
			{},
			{ 'X-Pagination': 'broken' },
			{ 'X-Pagination': '{}' },
			{ ...paginationHeaders(), 'X-Ratelimit-Limit': '60' }
		]) {
			test(`rejects unusable response metadata: ${JSON.stringify(headers)}`, async () => {
				const client = new KatanaClient(auth, { fetch: async () => Response.json([entry.row], { headers }) })
				const error = await client[entry.method]().catch((cause: unknown) => cause)
				expect(error).toMatchObject({ code: 'upstream' })
			})
		}
		for (const [status, code, retryable] of [
			[401, 'bad_auth', false],
			[403, 'forbidden', false],
			[422, 'upstream', false],
			[429, 'rate_limited', true],
			[500, 'upstream', true]
		] as const) {
			test(`propagates HTTP ${status}, preserving retry information without leaking response data`, async () => {
				let calls = 0
				const client = new KatanaClient(auth, {
					fetch: async () => {
						calls += 1
						return Response.json({ secret: 'provider-private-detail' }, { status, headers: { 'Retry-After': '3' } })
					}
				})
				const error = await client[entry.method]().catch((cause: unknown) => cause)
				expect(error).toBeInstanceOf(ToolError)
				expect(error).toMatchObject({ code, retryable, details: { status, retry_after_ms: 3000 } })
				expect(JSON.stringify(error)).not.toContain('provider-private-detail')
				expect(JSON.stringify(error)).not.toContain(auth.api_key)
				expect(calls).toBe(1)
			})
		}
	})
}

test('forwards endpoint-specific parent and component filters', async () => {
	const requests: URL[] = []
	const client = new KatanaClient(auth, {
		fetch: async (input) => {
			requests.push(new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url))
			return Response.json([], { headers: paginationHeaders({ total_records: 0, total_pages: 0 }) })
		}
	})
	await client.listSalesOrderRowsPage({
		sales_order_ids: [10, 11],
		extend: ['variant'],
		location_id: 7,
		tax_rate_id: 2,
		linked_manufacturing_order_id: 30,
		product_availability: 'PICKED'
	})
	await client.listPurchaseOrderRowsPage({ purchase_order_id: 20, group_id: 5, tax_rate_id: 2, location_id: 7 })
	await client.listManufacturingOrderRecipeRowsPage({
		manufacturing_order_id: 30,
		ingredient_availability: 'NO_RECIPE'
	})
	expect(requests[0]?.searchParams.getAll('sales_order_ids')).toEqual(['10', '11'])
	expect(Object.fromEntries(requests[0]?.searchParams ?? [])).toMatchObject({
		extend: 'variant',
		location_id: '7',
		tax_rate_id: '2',
		linked_manufacturing_order_id: '30',
		product_availability: 'PICKED'
	})
	expect(Object.fromEntries(requests[1]?.searchParams ?? [])).toEqual({
		page: '1',
		limit: '50',
		purchase_order_id: '20',
		group_id: '5',
		tax_rate_id: '2',
		location_id: '7'
	})
	expect(Object.fromEntries(requests[2]?.searchParams ?? [])).toEqual({
		page: '1',
		limit: '50',
		manufacturing_order_id: '30',
		ingredient_availability: 'NO_RECIPE'
	})
})

test('restricts expansions and availability filters to their provider contracts', () => {
	expect(katanaListSalesOrderRowsPageInputSchema.safeParse({ sales_order_id: 10 }).success).toBe(false)
	expect(katanaListSalesOrderRowsPageInputSchema.safeParse({ extend: ['customer'] }).success).toBe(false)
	expect(katanaListSalesOrderRowsPageInputSchema.safeParse({ product_availability: 'PROCESSED' }).success).toBe(false)
	expect(katanaListPurchaseOrderRowsPageInputSchema.safeParse({ purchase_order_ids: [20] }).success).toBe(false)
	expect(
		katanaListManufacturingOrderRecipeRowsPageInputSchema.safeParse({ ingredient_availability: 'PICKED' }).success
	).toBe(false)
})
