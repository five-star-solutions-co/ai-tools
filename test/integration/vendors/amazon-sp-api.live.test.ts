/**
 * Amazon SP-API live IT — full read/search surface only (no createReport or other writes).
 *
 * Read methods exercised:
 * - listOrders, getOrder, getOrderItems
 * - searchOrders (Orders API v2026-01-01)
 * - listInventorySummaries, getInventorySummariesPage
 * - listReports, listReportsPage, getReport, getReportDocument, downloadReportDocumentBytes
 * - getSettlementSummary (soft-pass when no DONE settlement report in window)
 * - searchCatalogItems (when AI_TOOLS_AMAZON_CATALOG_KEYWORDS is set)
 */
import { describe, expect, test } from 'bun:test'

import { ToolError } from '../../../src/core/errors'
import { AmazonSpApiClient } from '../../../src/vendors/amazon-sp-api'
import { env } from '../env'

const clientId = env('AI_TOOLS_AMAZON_CLIENT_ID')
const clientSecret = env('AI_TOOLS_AMAZON_CLIENT_SECRET')
const refreshToken = env('AI_TOOLS_AMAZON_REFRESH_TOKEN')
const endpoint = env('AI_TOOLS_AMAZON_ENDPOINT')
const marketplaceIds = env('AI_TOOLS_AMAZON_MARKETPLACE_IDS')
const catalogKeywords = env('AI_TOOLS_AMAZON_CATALOG_KEYWORDS')
const run = clientId && clientSecret && refreshToken && endpoint && marketplaceIds ? describe : describe.skip

function client() {
	const ep = endpoint!
	if (
		ep !== 'https://sellingpartnerapi-na.amazon.com' &&
		ep !== 'https://sellingpartnerapi-eu.amazon.com' &&
		ep !== 'https://sellingpartnerapi-fe.amazon.com'
	) {
		throw new Error('AI_TOOLS_AMAZON_ENDPOINT must be a sellingpartnerapi-{na,eu,fe}.amazon.com URL')
	}
	return new AmazonSpApiClient({
		client_id: clientId!,
		client_secret: clientSecret!,
		refresh_token: refreshToken!,
		endpoint: ep,
		marketplace_ids: marketplaceIds!.split(',').map((s) => s.trim())
	})
}

function primaryMarketplaceId(): string {
	const id = marketplaceIds!
		.split(',')
		.map((s) => s.trim())
		.find(Boolean)
	if (!id) throw new Error('AI_TOOLS_AMAZON_MARKETPLACE_IDS has no marketplace id')
	return id
}

run('live vendor amazon-sp-api (read-only)', () => {
	test(
		'listOrders + optional getOrder/getOrderItems',
		async () => {
			const c = client()
			const out = await c.listOrders({
				created_after: new Date(Date.now() - 30 * 24 * 3600_000).toISOString(),
				max_results: 1
			})
			expect(out).toBeDefined()
			expect(Array.isArray(out.items)).toBe(true)
			const order = out.items[0]
			if (order && typeof order === 'object' && 'amazon_order_id' in order) {
				const id = order.amazon_order_id
				if (typeof id === 'string' && id.length > 0) {
					const got = await c.getOrder({ amazon_order_id: id })
					expect(got.order).toBeDefined()
					const items = await c.getOrderItems({ amazon_order_id: id })
					expect(Array.isArray(items.items)).toBe(true)
				}
			}
		},
		{ timeout: 60_000 }
	)

	test(
		'searchOrders (Orders API v2026-01-01 + FULFILLMENT)',
		async () => {
			const c = client()
			const out = await c.searchOrders({
				created_after: new Date(Date.now() - 30 * 24 * 3600_000).toISOString(),
				max_results: 1,
				max_pages: 1
			})
			expect(out).toBeDefined()
			expect(Array.isArray(out.items)).toBe(true)
		},
		{ timeout: 60_000 }
	)

	test(
		'listInventorySummaries + getInventorySummariesPage',
		async () => {
			const c = client()
			const slim = await c.listInventorySummaries()
			expect(slim).toBeDefined()
			expect(Array.isArray(slim.items)).toBe(true)

			const page = await c.getInventorySummariesPage({
				mode: 'full',
				marketplace_id: primaryMarketplaceId()
			})
			expect(page).toBeDefined()
			expect(Array.isArray(page.items)).toBe(true)
		},
		{ timeout: 60_000 }
	)

	test(
		'listReports + listReportsPage + optional getReport/getReportDocument/downloadReportDocumentBytes',
		async () => {
			const c = client()
			const out = await c.listReports({
				report_types: ['GET_FLAT_FILE_OPEN_LISTINGS_DATA'],
				page_size: 1
			})
			expect(out).toBeDefined()
			expect(Array.isArray(out.items)).toBe(true)

			const page = await c.listReportsPage({
				report_types: ['GET_FLAT_FILE_OPEN_LISTINGS_DATA'],
				page_size: 1
			})
			expect(page).toBeDefined()
			expect(Array.isArray(page.items)).toBe(true)

			const report = out.items[0]
			if (report && typeof report === 'object' && 'report_id' in report) {
				const reportId = report.report_id
				if (typeof reportId === 'string' && reportId.length > 0) {
					const got = await c.getReport({ report_id: reportId })
					expect(got.report).toBeDefined()
					const docId =
						got.report && typeof got.report === 'object' && 'report_document_id' in got.report
							? got.report.report_document_id
							: undefined
					if (typeof docId === 'string' && docId.length > 0) {
						const doc = await c.getReportDocument({ report_document_id: docId })
						expect(doc).toBeDefined()
						const bytes = await c.downloadReportDocumentBytes({
							report_document_id: docId,
							max_bytes: 256_000
						})
						expect(bytes).toBeDefined()
						expect(bytes.bytes).toBeInstanceOf(Uint8Array)
					}
				}
			}
		},
		{ timeout: 90_000 }
	)

	test(
		'getSettlementSummary (soft-pass when no DONE settlement in window)',
		async () => {
			const c = client()
			try {
				const out = await c.getSettlementSummary({})
				expect(out.settlement_id).toBeDefined()
				expect(typeof out.total_amount_cents).toBe('number')
				expect(typeof out.row_count).toBe('number')
			} catch (error) {
				if (error instanceof ToolError && error.code === 'not_found') return
				throw error
			}
		},
		{ timeout: 120_000 }
	)

	test(
		'searchCatalogItems (optional keywords env)',
		async () => {
			if (!catalogKeywords) return
			const c = client()
			const keywords = catalogKeywords
				.split(',')
				.map((s) => s.trim())
				.filter(Boolean)
			if (keywords.length === 0) return
			const out = await c.searchCatalogItems({ keywords })
			expect(out).toBeDefined()
			expect(Array.isArray(out.items)).toBe(true)
		},
		{ timeout: 60_000 }
	)
})
