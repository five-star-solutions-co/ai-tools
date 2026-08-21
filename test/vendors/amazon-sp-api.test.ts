import { describe, expect, test } from 'bun:test'

import { ToolError, validateModule } from '../../src/core'
import {
	AmazonSpApiClient,
	amazonInventorySummaryRawSchema,
	amazonSpApiDownloadReportDocumentBytesInputSchema,
	amazonSpApiListReportsInputSchema,
	amazonSpApiModule
} from '../../src/vendors/amazon-sp-api'
import { parseSettlementV2Tsv, parseUsMoneyToSafeCents } from '../../src/vendors/amazon-sp-api/domain/settlement'

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
			'amazon-sp-api-get-settlement-summary',
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
				return new Response(JSON.stringify({ access_token: 'Atza|access', token_type: 'bearer', expires_in: 3600 }), {
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
				return new Response(JSON.stringify({ access_token: 'Atza|access', token_type: 'bearer', expires_in: 3600 }), {
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
				return new Response(JSON.stringify({ access_token: 'Atza|access', token_type: 'bearer', expires_in: 3600 }), {
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

	test('getSettlementSummary lists DONE report, downloads once, returns eight fields', async () => {
		const header = [
			'settlement-id',
			'settlement-start-date',
			'settlement-end-date',
			'deposit-date',
			'total-amount',
			'currency',
			'transaction-type',
			'order-id',
			'merchant-order-id',
			'adjustment-id',
			'shipment-id',
			'marketplace-name',
			'amount-type',
			'amount-description',
			'amount',
			'fulfillment-id',
			'posted-date',
			'order-item-code',
			'merchant-order-item-id',
			'merchant-adjustment-item-id',
			'sku',
			'quantity-purchased',
			'promotion-id'
		].join('\t')
		const row = (amount: string) =>
			[
				'12345678901',
				'2026-01-01 00:00:00 UTC',
				'2026-01-15 23:59:59 UTC',
				'2026-01-17 00:00:00 UTC',
				'25.50',
				'USD',
				'Order',
				'111-SECRET',
				'',
				'',
				'',
				'Amazon.com',
				'ItemPrice',
				'Principal',
				amount,
				'',
				'2026-01-02',
				'',
				'',
				'',
				'SKU-SECRET',
				'1',
				''
			].join('\t')
		// 10 + 15.50 = 25.50
		const tsv = `${header}\n${row('10.00')}\n${row('15.50')}\n`

		const restore = mockFetch((url) => {
			if (url.includes('api.amazon.com/auth/o2/token')) {
				return new Response(JSON.stringify({ access_token: 'Atza|access', token_type: 'bearer', expires_in: 3600 }), {
					status: 200
				})
			}
			if (url.includes('/reports/2021-06-30/reports') && !url.includes('/documents/')) {
				expect(url).toContain('GET_V2_SETTLEMENT_REPORT_DATA_FLAT_FILE_V2')
				expect(url).toContain('DONE')
				return new Response(
					JSON.stringify({
						reports: [
							{
								reportId: 'rep-1',
								reportType: 'GET_V2_SETTLEMENT_REPORT_DATA_FLAT_FILE_V2',
								processingStatus: 'DONE',
								reportDocumentId: 'doc-1',
								createdTime: '2026-01-18T00:00:00Z'
							}
						]
					}),
					{ status: 200 }
				)
			}
			if (url.includes('/reports/2021-06-30/documents/doc-1')) {
				return new Response(
					JSON.stringify({
						reportDocumentId: 'doc-1',
						url: 'https://tortuga.amazon.com/settlement-doc-body'
					}),
					{ status: 200 }
				)
			}
			if (url.includes('tortuga.amazon.com/settlement-doc-body')) {
				return new Response(tsv, {
					status: 200,
					headers: { 'content-type': 'text/tab-separated-values' }
				})
			}
			return new Response(`unexpected ${url}`, { status: 404 })
		})

		try {
			const client = new AmazonSpApiClient(auth)
			const result = await client.getSettlementSummary({})
			expect(result).toEqual({
				settlement_id: '12345678901',
				settlement_start_date: '2026-01-01 00:00:00 UTC',
				settlement_end_date: '2026-01-15 23:59:59 UTC',
				deposit_date: '2026-01-17 00:00:00 UTC',
				currency: 'USD',
				total_amount_cents: 2550,
				amount_sum_cents: 2550,
				row_count: 2
			})
			// Output must not leak order/sku secrets from the TSV.
			expect(JSON.stringify(result)).not.toContain('111-SECRET')
			expect(JSON.stringify(result)).not.toContain('SKU-SECRET')
			expect(JSON.stringify(result)).not.toContain('tortuga')
		} finally {
			restore()
		}
	})

	test('uses LWA only, sends required headers, and refreshes from expires_in', async () => {
		let lwaCalls = 0
		let apiCalls = 0
		const restore = mockFetch((url, headers) => {
			if (url.includes('api.amazon.com/auth/o2/token')) {
				lwaCalls += 1
				return new Response(
					JSON.stringify({ access_token: `token-${lwaCalls}`, token_type: 'bearer', expires_in: 30 }),
					{ status: 200 }
				)
			}
			apiCalls += 1
			expect(headers.get('x-amz-access-token')).toBe(`token-${apiCalls}`)
			expect(headers.has('authorization')).toBe(false)
			expect(headers.has('x-amz-date')).toBe(false)
			expect(url).not.toContain('X-Amz-Signature')
			return new Response(JSON.stringify({ payload: { Orders: [] } }), { status: 200 })
		})

		try {
			const client = new AmazonSpApiClient(auth)
			await client.listOrders({ created_after: '2026-01-01T00:00:00Z' })
			await client.listOrders({ created_after: '2026-01-01T00:00:00Z' })
			expect(lwaCalls).toBe(2)
			expect(apiCalls).toBe(2)
		} finally {
			restore()
		}
	})

	test('returns a lossless inventory page with top-level pagination and exact quantity semantics', async () => {
		let inventoryCalls = 0
		const raw = amazonInventorySummaryRawSchema.parse({
			asin: 'B001',
			fnSku: 'FN-1',
			sellerSku: 'SKU-1',
			condition: 'NewItem',
			productName: 'Widget',
			totalQuantity: 17,
			lastUpdatedTime: '2026-08-01T10:00:00Z',
			stores: ['US'],
			inventoryDetails: {
				fulfillableQuantity: 5,
				inboundWorkingQuantity: 1,
				inboundShippedQuantity: 2,
				inboundReceivingQuantity: 3,
				reservedQuantity: {
					totalReservedQuantity: 4,
					pendingCustomerOrderQuantity: 1,
					pendingTransshipmentQuantity: 1,
					fcProcessingQuantity: 2,
					providerAddedReservedField: true
				},
				researchingQuantity: {
					totalResearchingQuantity: 1,
					researchingQuantityBreakdown: [
						{ name: 'researchingQuantityInShortTerm', quantity: 1, providerAddedBreakdownField: 'kept' }
					]
				},
				unfulfillableQuantity: {
					totalUnfulfillableQuantity: 2,
					customerDamagedQuantity: 1,
					warehouseDamagedQuantity: 1,
					distributorDamagedQuantity: 0,
					carrierDamagedQuantity: 0,
					defectiveQuantity: 0,
					expiredQuantity: 0
				},
				providerAddedDetailsField: 'kept'
			},
			providerAddedRecordField: { nested: true }
		})
		const restore = mockFetch((url) => {
			if (url.includes('api.amazon.com/auth/o2/token')) {
				return new Response(JSON.stringify({ access_token: 'Atza|access', token_type: 'bearer', expires_in: 3600 }), {
					status: 200
				})
			}
			inventoryCalls += 1
			const query = new URL(url).searchParams
			expect(query.get('details')).toBe('true')
			expect(query.get('granularityType')).toBe('Marketplace')
			expect(query.get('granularityId')).toBe('ATVPDKIKX0DER')
			expect(query.get('marketplaceIds')).toBe('ATVPDKIKX0DER')
			return new Response(
				JSON.stringify({
					payload: { inventorySummaries: [raw], pagination: { nextToken: 'wrong-location' } },
					pagination: { nextToken: inventoryCalls === 1 ? 'page-2' : undefined }
				}),
				{
					status: 200,
					headers: { 'x-amzn-RateLimit-Limit': '2.0', 'x-amzn-RequestId': 'request-1' }
				}
			)
		})

		try {
			const client = new AmazonSpApiClient(auth)
			const page = await client.getInventorySummariesPage({
				mode: 'full',
				marketplace_id: 'ATVPDKIKX0DER'
			})
			expect(page.items[0]).toEqual(raw)
			expect(page.next_token).toBe('page-2')
			expect(page.rate_limit_per_second).toBe(2)
			expect(page.request_id).toBe('request-1')

			const slim = await client.listInventorySummaries({ marketplace_id: 'ATVPDKIKX0DER' })
			expect(slim.items[0]?.total_quantity).toBe(17)
			expect(slim.items[0]?.total_quantity).not.toBe(5)
		} finally {
			restore()
		}
	})

	test('serializes full and incremental inventory continuations without hidden page loops', async () => {
		const seen: URLSearchParams[] = []
		const startDateTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
		const restore = mockFetch((url) => {
			if (url.includes('api.amazon.com/auth/o2/token')) {
				return new Response(JSON.stringify({ access_token: 'Atza|access', token_type: 'bearer', expires_in: 3600 }), {
					status: 200
				})
			}
			seen.push(new URL(url).searchParams)
			return new Response(JSON.stringify({ payload: { inventorySummaries: [] } }), { status: 200 })
		})

		try {
			const client = new AmazonSpApiClient(auth)
			await client.getInventorySummariesPage({
				mode: 'full',
				marketplace_id: 'ATVPDKIKX0DER',
				next_token: 'full-next'
			})
			await client.getInventorySummariesPage({
				mode: 'incremental',
				marketplace_id: 'ATVPDKIKX0DER',
				start_date_time: startDateTime
			})
			await client.getInventorySummariesPage({
				mode: 'incremental',
				marketplace_id: 'ATVPDKIKX0DER',
				start_date_time: startDateTime,
				next_token: 'incremental-next'
			})
			expect(seen).toHaveLength(3)
			expect(seen[0]?.get('nextToken')).toBe('full-next')
			expect(seen[0]?.has('startDateTime')).toBe(false)
			expect(seen[1]?.get('startDateTime')).toBe(startDateTime)
			expect(seen[1]?.has('nextToken')).toBe(false)
			expect(seen[2]?.get('startDateTime')).toBe(startDateTime)
			expect(seen[2]?.get('nextToken')).toBe('incremental-next')
		} finally {
			restore()
		}
	})

	test('rejects incremental inventory windows older than 18 months before making a request', async () => {
		let fetchCalled = false
		const restore = mockFetch(() => {
			fetchCalled = true
			return new Response('{}', { status: 200 })
		})
		const tooOld = new Date()
		tooOld.setUTCFullYear(tooOld.getUTCFullYear() - 2)

		try {
			const client = new AmazonSpApiClient(auth)
			try {
				await client.getInventorySummariesPage({
					mode: 'incremental',
					marketplace_id: 'ATVPDKIKX0DER',
					start_date_time: tooOld.toISOString()
				})
				throw new Error('expected old inventory window rejection')
			} catch (error) {
				expect(error).toBeInstanceOf(ToolError)
				if (error instanceof ToolError) expect(error.code).toBe('bad_input')
			}
			expect(fetchCalled).toBe(false)
		} finally {
			restore()
		}
	})

	test('requires strict initial or cursor-only report input and sends only nextToken for continuation', async () => {
		const apiQueries: URLSearchParams[] = []
		const restore = mockFetch((url) => {
			if (url.includes('api.amazon.com/auth/o2/token')) {
				return new Response(JSON.stringify({ access_token: 'Atza|access', token_type: 'bearer', expires_in: 3600 }), {
					status: 200
				})
			}
			apiQueries.push(new URL(url).searchParams)
			return new Response(
				JSON.stringify({
					reports: [{ reportId: 'report-1', reportType: 'TYPE_A', providerAddedField: 'kept' }],
					nextToken: 'next-report-page'
				}),
				{ status: 200, headers: { 'x-amzn-RateLimit-Limit': '0.0222', 'x-amzn-RequestId': 'report-request' } }
			)
		})

		try {
			const client = new AmazonSpApiClient(auth)
			expect(amazonSpApiListReportsInputSchema.safeParse({}).success).toBe(false)
			expect(
				amazonSpApiListReportsInputSchema.safeParse({ cursor: 'next-report-page', report_types: ['TYPE_A'] }).success
			).toBe(false)
			const initial = await client.listReportsPage({
				report_types: ['TYPE_A'],
				processing_statuses: ['DONE'],
				marketplace_ids: ['ATVPDKIKX0DER'],
				page_size: 100,
				created_since: '2026-08-01T00:00:00Z'
			})
			expect(initial.items[0]?.providerAddedField).toBe('kept')
			expect(initial.rate_limit_per_second).toBe(0.0222)
			expect(initial.request_id).toBe('report-request')
			await client.listReportsPage({ next_token: 'next-report-page' })
			await client.listReports({ cursor: 'slim-next-report-page' })
			expect(apiQueries[0]?.get('reportTypes')).toBe('TYPE_A')
			expect(apiQueries[1] && Array.from(apiQueries[1].keys())).toEqual(['nextToken'])
			expect(apiQueries[1]?.get('nextToken')).toBe('next-report-page')
			expect(apiQueries[2] && Array.from(apiQueries[2].keys())).toEqual(['nextToken'])
			expect(apiQueries[2]?.get('nextToken')).toBe('slim-next-report-page')
		} finally {
			restore()
		}
	})

	test('preserves Retry-After and downloads presigned documents without SP-API auth', async () => {
		let mode: 'rate-limit' | 'download' = 'rate-limit'
		const restore = mockFetch((url, headers) => {
			if (url.includes('api.amazon.com/auth/o2/token')) {
				return new Response(JSON.stringify({ access_token: 'Atza|access', token_type: 'bearer', expires_in: 3600 }), {
					status: 200
				})
			}
			if (mode === 'rate-limit') {
				return new Response(JSON.stringify({ errors: [] }), { status: 429, headers: { 'Retry-After': '3' } })
			}
			if (url.includes('/reports/2021-06-30/documents/document-1')) {
				expect(headers.get('x-amz-access-token')).toBe('Atza|access')
				return new Response(
					JSON.stringify({
						reportDocumentId: 'document-1',
						url: 'https://example.com/presigned-report'
					}),
					{ status: 200 }
				)
			}
			expect(url).toBe('https://example.com/presigned-report')
			expect(headers.has('x-amz-access-token')).toBe(false)
			expect(headers.has('authorization')).toBe(false)
			return new Response('report-body', { status: 200, headers: { 'content-type': 'text/plain' } })
		})

		try {
			const client = new AmazonSpApiClient(auth)
			try {
				await client.getInventorySummariesPage({ mode: 'full', marketplace_id: 'ATVPDKIKX0DER' })
				throw new Error('expected rate limit error')
			} catch (error) {
				expect(error).toBeInstanceOf(ToolError)
				if (error instanceof ToolError) expect(error.details?.retry_after_ms).toBe(3000)
			}
			mode = 'download'
			expect(
				amazonSpApiDownloadReportDocumentBytesInputSchema.safeParse({
					url: 'https://example.com/attacker-controlled',
					max_bytes: 100
				}).success
			).toBe(false)
			const document = await client.downloadReportDocumentBytes({
				report_document_id: 'document-1',
				max_bytes: 100
			})
			expect(document.text).toBe('report-body')
			expect(document.byte_length).toBe(11)
			expect(document.content_type).toBe('text/plain')
		} finally {
			restore()
		}
	})

	test('decompresses GZIP with fflate and enforces max_bytes on expanded output', async () => {
		const text = 'inventory-row\n'.repeat(200)
		const compressedStream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))
		const compressed = new Uint8Array(await new Response(compressedStream).arrayBuffer())
		const restore = mockFetch((url, headers) => {
			if (url.includes('api.amazon.com/auth/o2/token')) {
				return new Response(JSON.stringify({ access_token: 'Atza|access', token_type: 'bearer', expires_in: 3600 }), {
					status: 200
				})
			}
			if (url.includes('/reports/2021-06-30/documents/gzip-document')) {
				return new Response(
					JSON.stringify({
						reportDocumentId: 'gzip-document',
						url: 'https://example.com/gzip-report',
						compressionAlgorithm: 'GZIP'
					}),
					{ status: 200 }
				)
			}
			expect(url).toBe('https://example.com/gzip-report')
			expect(headers.has('x-amz-access-token')).toBe(false)
			return new Response(compressed.buffer, { status: 200 })
		})

		try {
			const client = new AmazonSpApiClient(auth)
			const document = await client.downloadReportDocumentBytes({
				report_document_id: 'gzip-document',
				max_bytes: 10_000
			})
			expect(document.text).toBe(text)
			expect(document.byte_length).toBe(new TextEncoder().encode(text).byteLength)
			expect(document.compression_algorithm).toBe('GZIP')

			expect(
				client.downloadReportDocumentBytes({
					report_document_id: 'gzip-document',
					max_bytes: 100
				})
			).rejects.toMatchObject({ code: 'too_large' })
		} finally {
			restore()
		}
	})
})

describe('amazon-sp-api settlement domain', () => {
	const header = [
		'settlement-id',
		'settlement-start-date',
		'settlement-end-date',
		'deposit-date',
		'total-amount',
		'currency',
		'transaction-type',
		'order-id',
		'merchant-order-id',
		'adjustment-id',
		'shipment-id',
		'marketplace-name',
		'amount-type',
		'amount-description',
		'amount',
		'fulfillment-id',
		'posted-date',
		'order-item-code',
		'merchant-order-item-id',
		'merchant-adjustment-item-id',
		'sku',
		'quantity-purchased',
		'promotion-id'
	].join('\t')

	test('parseUsMoneyToSafeCents and sum mismatch', () => {
		expect(parseUsMoneyToSafeCents('12.34')).toBe(1234)
		expect(parseUsMoneyToSafeCents('-1.00')).toBe(-100)
		expect(parseUsMoneyToSafeCents('1,234.56')).toBe(123456)

		const bad = `${header}\n${[
			'1',
			's',
			'e',
			'd',
			'10.00',
			'USD',
			't',
			'',
			'',
			'',
			'',
			'',
			'',
			'',
			'9.00',
			'',
			'',
			'',
			'',
			'',
			'',
			'',
			''
		].join('\t')}\n`
		expect(() => parseSettlementV2Tsv(bad)).toThrow(ToolError)
		try {
			parseSettlementV2Tsv(bad)
		} catch (error) {
			expect(error).toBeInstanceOf(ToolError)
			if (error instanceof ToolError) {
				expect(error.message).toContain('does not match total-amount')
				expect(JSON.stringify(error.details ?? {})).not.toContain('order')
			}
		}
	})

	test('rejects wrong header columns', () => {
		expect(() => parseSettlementV2Tsv('a\tb\n1\t2\n')).toThrow(ToolError)
	})
})
