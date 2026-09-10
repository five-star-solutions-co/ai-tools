import { describe, expect, test } from 'bun:test'
import { ToolError } from '../../src/core'
import {
	WayfairClient,
	wayfairGenerateAdvertisingReportInputSchema,
	wayfairUpdateAdvertisingCampaignInputSchema,
	wayfairModule
} from '../../src/vendors/wayfair'
import type { WayfairGenerateAdvertisingReportInput } from '../../src/vendors/wayfair'

const auth = { client_id: 'test-client', client_secret: 'test-secret', supplier_id: 2683 }
const reportInput: WayfairGenerateAdvertisingReportInput = {
	name: 'Performance',
	report_type: 'LISTING_REPORT',
	file_type: 'CSV',
	filters: { start_date: '2026-09-01', end_date: '2026-09-02 12:30:00' },
	group_by: 'DAY',
	program: 'WSP'
}
function clientFor(
	handler: (request: Request) => Response | Promise<Response>,
	environment: 'production' | 'sandbox' = 'production'
) {
	return new WayfairClient(
		{ ...auth, environment },
		{
			fetch: async (input, init) => {
				const request = new Request(input, init)
				if (new URL(request.url).pathname === '/oauth/token')
					return Response.json({ access_token: 'test-token', expires_in: 900 })
				expect(request.headers.get('Authorization')).toBe('Bearer test-token')
				return handler(request)
			}
		}
	)
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

describe('Wayfair advertising', () => {
	test('starts a report using fixed REST route, bound supplier and published defaults', async () => {
		let calls = 0
		const client = clientFor(async (request) => {
			calls++
			expect(request.url).toBe('https://api.wayfair.io/advertising/v1/reports')
			expect(request.method).toBe('POST')
			expect(await request.json()).toEqual({
				name: 'Performance',
				reportType: 'LISTING_REPORT',
				fileType: 'CSV',
				filters: { startDate: '2026-09-01', endDate: '2026-09-02 12:30:00' },
				groupBy: 'DAY',
				program: 'WSP',
				attributionWindow: 14,
				supplierId: 2683
			})
			return Response.json({ id: 'report-123' })
		})
		expect(await client.generateAdvertisingReport(reportInput)).toEqual({ id: 'report-123' })
		expect(calls).toBe(1)
	})

	test('encodes report identifiers in query and does not fetch the temporary document URL', async () => {
		let calls = 0
		const client = clientFor((request) => {
			calls++
			const url = new URL(request.url)
			expect(url.origin).toBe('https://api.wayfair.io')
			expect(url.pathname).toBe('/advertising/v1/reports')
			expect(url.searchParams.get('reportId')).toBe('id&supplierId=999')
			expect(url.searchParams.getAll('supplierId')).toEqual(['2683'])
			expect(request.method).toBe('GET')
			return Response.json({ status: 'COMPLETED', url: 'https://documents.example/report.csv?temporary=reference' })
		})
		expect(await client.getAdvertisingReport({ report_id: 'id&supplierId=999' })).toEqual({
			status: 'COMPLETED',
			url: 'https://documents.example/report.csv?temporary=reference'
		})
		expect(calls).toBe(1)
	})

	test('preserves asynchronous and failed status without manufacturing a URL', async () => {
		for (const status of ['QUEUED', 'PROCESSING', 'FAILED', 'COMPLETED']) {
			const client = clientFor(() => Response.json({ status, url: null }))
			expect(await client.getAdvertisingReport({ report_id: 'report-123' })).toEqual({ status, url: null })
		}
	})

	test('updates listing intent and preserves per-listing outcomes and decimal bid strings', async () => {
		const result = {
			campaignId: '42',
			listingChanges: [
				{ listing: 'ONE', bid: '0.55', isActive: true, status: 'SUCCESS' },
				{ listing: 'TWO', isActive: false, status: 'FAILURE' }
			]
		}
		const client = clientFor(async (request) => {
			expect(request.url).toBe('https://api.wayfair.io/advertising/v1/campaign/42')
			expect(request.method).toBe('POST')
			expect(await request.json()).toEqual({
				campaignProductData: {
					listings: {
						ONE: { bid: '0.55', isActive: true },
						TWO: { status: 'PAUSE', isActive: false },
						THREE: { status: 'ADD' }
					}
				}
			})
			return Response.json(result)
		})
		expect(
			await client.updateAdvertisingCampaign({
				campaign_id: 42,
				listings: {
					ONE: { bid: '0.55', is_active: true },
					TWO: { status: 'PAUSE', is_active: false },
					THREE: { status: 'ADD' }
				}
			})
		).toEqual(result)
	})

	test('supports strategy-aware bid omission without guessing account bidding strategy', () => {
		for (const listing of [
			{ status: 'ADD' },
			{ status: 'ADD', bid: '0.05' },
			{ is_active: true },
			{ is_active: false, bid: '10000' },
			{ status: 'ARCHIVE', is_active: false },
			{ status: 'ACTIVATE', is_active: true }
		])
			expect(
				wayfairUpdateAdvertisingCampaignInputSchema.safeParse({ campaign_id: 1, listings: { ONE: listing } }).success
			).toBe(true)
	})

	test('rejects contradictory intents, invalid bids, empty maps and wrong identifiers', () => {
		for (const listing of [
			{},
			{ bid: '1' },
			{ status: 'PAUSE', bid: '1' },
			{ status: 'ACTIVATE', bid: '1' },
			{ status: 'ARCHIVE', bid: '1' },
			{ status: 'ADD', is_active: false },
			{ status: 'PAUSE', is_active: true },
			{ is_active: true, bid: '0.049' },
			{ is_active: true, bid: '10000.01' },
			{ is_active: true, bid: 'NaN' },
			{ is_active: true, bid: 0.55 }
		])
			expect(
				wayfairUpdateAdvertisingCampaignInputSchema.safeParse({ campaign_id: 42, listings: { ONE: listing } }).success
			).toBe(false)
		for (const input of [
			{ campaign_id: 0, listings: { ONE: { status: 'PAUSE' } } },
			{ campaign_id: 42, listings: {} },
			{ campaign_id: 42, listings: [] },
			{ campaign_id: 42, listings: { ' ': { status: 'PAUSE' } } },
			{ campaign_id: '../42', listings: { ONE: { status: 'PAUSE' } } }
		])
			expect(wayfairUpdateAdvertisingCampaignInputSchema.safeParse(input).success).toBe(false)
	})

	test('validates actual calendar dates, date order, formats and report enums', () => {
		for (const input of [
			{ ...reportInput, name: 'n'.repeat(251) },
			{ ...reportInput, report_type: 'ORDERS' },
			{ ...reportInput, attribution_window: 7 },
			{ ...reportInput, filters: { start_date: '2026-02-30' } },
			{ ...reportInput, filters: { start_date: '2026-09-01 24:00:00' } },
			{ ...reportInput, filters: { start_date: '2026-09-01T00:00:00Z' } },
			{ ...reportInput, filters: { start_date: '2026-09-02', end_date: '2026-09-01' } },
			{ ...reportInput, supplier_id: 999 }
		])
			expect(wayfairGenerateAdvertisingReportInputSchema.safeParse(input).success).toBe(false)
	})

	test('validates inputs before requesting a token', async () => {
		let calls = 0
		const client = new WayfairClient(auth, {
			fetch: async () => {
				calls++
				throw new Error('Unexpected HTTP')
			}
		})
		expect((await rejectionOf(client.generateAdvertisingReport({ ...reportInput, name: '' }))).code).toBe('bad_input')
		expect((await rejectionOf(client.updateAdvertisingCampaign({ campaign_id: 42, listings: {} }))).code).toBe(
			'bad_input'
		)
		expect(calls).toBe(0)
	})

	test('compares equivalent date-only and midnight report bounds consistently', () => {
		expect(
			wayfairGenerateAdvertisingReportInputSchema.safeParse({
				...reportInput,
				filters: { start_date: '2026-09-01 00:00:00', end_date: '2026-09-01' }
			}).success
		).toBe(true)
	})

	test('uses sandbox prefix exactly once for all advertising routes', async () => {
		const paths: string[] = []
		const client = clientFor((request) => {
			const url = new URL(request.url)
			paths.push(url.pathname)
			if (request.method === 'GET') return Response.json({ status: 'PROCESSING' })
			return url.pathname.endsWith('/reports')
				? Response.json({ id: 'report-123' })
				: Response.json({ campaignId: '42', listingChanges: [] })
		}, 'sandbox')
		await client.generateAdvertisingReport({ ...reportInput, attribution_window: 56 })
		await client.getAdvertisingReport({ report_id: 'report-123' })
		await client.updateAdvertisingCampaign({ campaign_id: 42, listings: { ONE: { status: 'PAUSE' } } })
		expect(paths).toEqual([
			'/sandbox/advertising/v1/reports',
			'/sandbox/advertising/v1/reports',
			'/sandbox/advertising/v1/campaign/42'
		])
	})

	test('rejects malformed report results', async () => {
		for (const data of [null, {}, { id: 123 }, { id: '' }]) {
			const client = clientFor(() => Response.json(data))
			expect((await rejectionOf(client.generateAdvertisingReport(reportInput))).code).toBe('upstream')
		}
		for (const data of [null, {}, { status: null }, { status: 'COMPLETE', url: 123 }]) {
			const client = clientFor(() => Response.json(data))
			expect((await rejectionOf(client.getAdvertisingReport({ report_id: 'report-123' }))).code).toBe('upstream')
		}
	})

	test('does not replay report generation or campaign writes after transport errors', async () => {
		for (const status of [0, 401, 403, 429, 500, 503]) {
			let calls = 0
			const client = clientFor(() => {
				calls++
				if (!status) throw new TypeError('Connection lost')
				return new Response(null, { status, headers: { 'Retry-After': '2' } })
			})
			const reportError = await rejectionOf(client.generateAdvertisingReport(reportInput))
			const campaignError = await rejectionOf(
				client.updateAdvertisingCampaign({ campaign_id: 42, listings: { ONE: { status: 'PAUSE' } } })
			)
			if (status === 429) {
				expect(reportError.details?.retry_after_ms).toBe(2000)
				expect(campaignError.retryable).toBe(true)
			}
			expect(calls).toBe(2)
		}
	})

	test('marks report generation and campaign updates as explicit non-idempotent writes', () => {
		for (const id of ['wayfair-generate-advertising-report', 'wayfair-update-advertising-campaign']) {
			expect(wayfairModule.tools.find((tool) => tool.id === id)?.meta).toMatchObject({
				sideEffect: 'write',
				idempotent: false,
				requiresConfirmation: true,
				supportsCancel: true
			})
		}
		expect(wayfairModule.tools.find((tool) => tool.id === 'wayfair-get-advertising-report')?.meta).toMatchObject({
			sideEffect: 'read',
			idempotent: true
		})
	})
})
