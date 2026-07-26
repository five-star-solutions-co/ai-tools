/**
 * Amazon SP-API live IT — read-only only (no createReport or other writes).
 * SigV4 IAM uses shared AI_TOOLS_AWS_*; LWA app credentials stay Amazon-specific.
 */
import { describe, expect, test } from 'bun:test'

import { AmazonSpApiClient } from '../../../src/vendors/amazon-sp-api'
import { awsCredentialsFromEnv, env } from '../env'

const clientId = env('AI_TOOLS_AMAZON_CLIENT_ID')
const clientSecret = env('AI_TOOLS_AMAZON_CLIENT_SECRET')
const refreshToken = env('AI_TOOLS_AMAZON_REFRESH_TOKEN')
const aws = awsCredentialsFromEnv()
const endpoint = env('AI_TOOLS_AMAZON_ENDPOINT')
const marketplaceIds = env('AI_TOOLS_AMAZON_MARKETPLACE_IDS')
const catalogKeywords = env('AI_TOOLS_AMAZON_CATALOG_KEYWORDS')
const run = clientId && clientSecret && refreshToken && aws && endpoint && marketplaceIds ? describe : describe.skip

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
		access_key_id: aws!.access_key_id,
		secret_access_key: aws!.secret_access_key,
		region: aws!.region,
		endpoint: ep,
		marketplace_ids: marketplaceIds!.split(',').map((s) => s.trim()),
		...(aws!.session_token && { session_token: aws!.session_token })
	})
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
		'listInventorySummaries',
		async () => {
			const c = client()
			const out = await c.listInventorySummaries()
			expect(out).toBeDefined()
			expect(Array.isArray(out.items)).toBe(true)
		},
		{ timeout: 60_000 }
	)

	test(
		'listReports + optional getReport/getReportDocument',
		async () => {
			const c = client()
			const out = await c.listReports({ page_size: 1 })
			expect(out).toBeDefined()
			expect(Array.isArray(out.items)).toBe(true)
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
					}
				}
			}
		},
		{ timeout: 60_000 }
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
		},
		{ timeout: 60_000 }
	)
})
