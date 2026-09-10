import { describe, expect, test } from 'bun:test'
import { z } from 'zod'

import { isToolError, runTool, validateModule, withAuth } from '../../src/core'
import type { ToolErrorCode } from '../../src/core/errors'
import type { FetchLike } from '../../src/core/types'
import type { ArtifactsAuth, ArtifactsCreateInput } from '../../src/modules/artifacts/contracts'
import { base64ToBytes, bytesToUtf8, toArrayBuffer, utf8ToBytes } from '../../src/shared/bytes'
import {
	SpsCommerceClient,
	SPS_RENDER_MAX_BYTES,
	spsCommerceModule,
	spsCreateTradingPartnersInputSchema,
	spsFilePathSchema,
	spsDirectoryPathSchema,
	spsSubmissionFormSchema,
	spsAvailableSubmissionFormFieldsSchema
} from '../../src/vendors/sps-commerce'
import type { SpsCommerceAuth, SpsCreateTradingPartnersInput } from '../../src/vendors/sps-commerce'

const boundAuth = { access_token: 'sps-private-bearer' }
const template = {
	id: 'T-123',
	name: 'Retailer template',
	canRender: true,
	ownerName: 'SPS Commerce',
	description: null,
	versions: [{ version: '1.01', tags: [], versionNotes: '' }],
	aliases: null
}
const transactionPage = {
	results: [
		{
			path: '/out/Order.xml',
			type: 'file' as const,
			url: 'https://api.spscommerce.com/transactions/v5/data/out/Order.xml'
		}
	],
	paging: {
		limit: 1,
		next: { cursor: 'opaque/+==', url: 'https://api.spscommerce.com/transactions/v5/data/out/?cursor=opaque' },
		previous: null
	}
}
const partnerInput: SpsCreateTradingPartnersInput = {
	submissionFormId: 'form-1',
	tradingPartnerName: 'Supplier',
	tradingPartnerId: 'supplier-1',
	country: 'USA',
	businessContact: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' },
	includedDataExchanges: { order: true, item: false, salesData: null }
}
const partnerResult = {
	tradingPartnerName: 'Supplier',
	createdTradingPartners: [
		{ solution: 'Order', id: 'partner-1' },
		{ solution: 'Item', id: 'partner-2' }
	]
}

function response(data: unknown, status = 200, headers: HeadersInit = {}) {
	const responseHeaders = new Headers(headers)
	responseHeaders.set('Content-Type', 'application/json')
	return new Response(JSON.stringify(data), { status, headers: responseHeaders })
}

function mockFetch(handler: (url: URL, init: RequestInit) => Response | Promise<Response>): FetchLike {
	return async (input, init) => {
		const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
		return handler(url, init ?? {})
	}
}

function body(init: RequestInit): unknown {
	if (typeof init.body !== 'string') throw new Error('Expected JSON body')
	return JSON.parse(init.body)
}

function tool(id: string) {
	const found = spsCommerceModule.tools.find((candidate) => candidate.id === `sps-commerce-${id}`)
	if (!found) throw new Error(`Missing ${id}`)
	return found
}

async function code(promise: Promise<unknown>, expected: ToolErrorCode) {
	try {
		await promise
		expect.unreachable(`Expected ${expected}`)
	} catch (error) {
		expect(isToolError(error)).toBe(true)
		if (!isToolError(error)) throw error
		expect(error.code).toBe(expected)
		return error
	}
}

function artifactStorage(source = utf8ToBytes('<Order/>')) {
	const writes: ArtifactsCreateInput[] = []
	const artifactsAuth: ArtifactsAuth = {
		provider: 'host',
		backend: {
			create: async (input) => {
				writes.push(input)
				return {
					artifact: {
						store: 'host',
						key: input.key,
						media_type: input.media_type,
						byte_length: base64ToBytes(input.body).byteLength
					}
				}
			},
			readRange: async () => {
				throw new Error('Not used')
			},
			readLines: async () => {
				throw new Error('Not used')
			},
			resolve: async ({ source: ref }) => ({ artifact: ref, bytes: source })
		}
	}
	return { artifactsAuth, writes }
}

function submissionForm() {
	const fields = Object.fromEntries(
		Object.entries(spsAvailableSubmissionFormFieldsSchema.shape).map(([key, schema]) => [
			key,
			schema instanceof z.ZodArray ? [] : false
		])
	)
	return spsSubmissionFormSchema.parse({
		id: 'form-1',
		name: 'Onboarding',
		description: null,
		retailerInstructions: null,
		createdDateTime: '2026-09-09T00:00:00Z',
		modifiedDateTime: null,
		availableFields: fields,
		includedSalesDataDataExchange: false,
		salesDataCampaignId: null,
		salesDataCampaignName: null,
		salesDataTradingPartnerSource: null,
		salesDataDefaultSelection: false,
		includedItemDataExchange: false,
		itemCampaignId: null,
		itemCampaignName: null,
		itemTradingPartnerSource: null,
		itemDefaultSelection: false,
		includedOrderDataExchange: true,
		orderCampaignId: 'campaign-1',
		orderCampaignName: 'Order',
		orderTradingPartnerSource: null,
		orderDefaultSelection: true,
		includedItemAndOrderDataExchange: false,
		itemAndOrderCampaignId: null,
		itemAndOrderCampaignName: null,
		itemAndOrderTradingPartnerSource: null,
		itemAndOrderDefaultSelection: false,
		sponsoredSolution: false,
		sponsoredSolutionDefaultSelection: false
	})
}

describe('SPS public pack contracts', () => {
	test('25 explicit model tools, correct metadata, no credential inputs', () => {
		expect(validateModule(spsCommerceModule)).toMatchObject({ ok: true })
		expect(spsCommerceModule.tools).toHaveLength(25)
		expect(new Set(spsCommerceModule.tools.map((item) => item.id)).size).toBe(25)
		for (const item of spsCommerceModule.tools) {
			expect(item.id).toMatch(/^sps-commerce-/)
			expect(item.meta.network).toBe(true)
			expect(item.meta.supportsCancel).toBe(true)
			const schema = z.toJSONSchema(item.inputSchema)
			expect(JSON.stringify(schema)).not.toMatch(/access_token|client_secret|"artifacts"/)
			for (const property of Object.values(schema.properties ?? {})) {
				if (typeof property === 'object') expect(property.description).toBeTruthy()
			}
		}
		expect(tool('delete-transaction').meta).toMatchObject({
			sideEffect: 'delete',
			requiresConfirmation: true,
			idempotent: false
		})
		expect(tool('upload-transaction').meta).toMatchObject({ sideEffect: 'write', artifacts: true, idempotent: false })
		expect(tool('create-trading-partners').meta.requiresConfirmation).toBe(true)
		expect(tool('render-label-pdf').meta.artifacts).toBe(true)
	})

	test('invalid constructor auth fails without leaking values', () => {
		expect(() => new SpsCommerceClient({ access_token: '\r\nsecret' })).toThrow('Invalid SPS input')
	})

	test.each([
		'../secret',
		'/out/../secret',
		'out/./x',
		'//evil.example/x',
		'https://evil.example/x',
		'out/%2e%2e/x',
		'out/%252e%252e/x',
		'out/a?x=1',
		'out/a#frag',
		'out\\a',
		'/out//x',
		'out/a\nb'
	])('unsafe file path rejected: %s', (path) => {
		expect(spsFilePathSchema.safeParse(path).success).toBe(false)
	})

	test('root and case-sensitive directory/file path distinctions', () => {
		for (const path of ['', '/', '/Out/', 'Out/']) expect(spsDirectoryPathSchema.safeParse(path).success).toBe(true)
		for (const path of ['', '/', 'Out/']) expect(spsFilePathSchema.safeParse(path).success).toBe(false)
		expect(spsDirectoryPathSchema.safeParse('/Out').success).toBe(false)
		expect(spsFilePathSchema.safeParse('/Out/Case-Sensitive.xml').success).toBe(true)
	})
})

describe('SPS authentication', () => {
	test('M2M exact audience, dedupe, reuse, expiry, no credentials on API calls', async () => {
		let tokenCalls = 0
		let apiCalls = 0
		let now = 0
		const auth = { client_id: 'client-secret-id', client_secret: 'client-secret-value' }
		const fetch = mockFetch(async (url, init) => {
			expect(init.redirect).toBe('error')
			if (url.origin === 'https://auth.spscommerce.com') {
				tokenCalls += 1
				expect(url.pathname).toBe('/oauth/token')
				expect(init.method).toBe('POST')
				expect(new Headers(init.headers).get('authorization')).toBeNull()
				expect(body(init)).toEqual({
					client_id: auth.client_id,
					client_secret: auth.client_secret,
					audience: 'https://spscommerce.com',
					grant_type: 'client_credentials'
				})
				await Promise.resolve()
				return response({ access_token: `token-${tokenCalls}`, expires_in: 100, token_type: 'Bearer' })
			}
			apiCalls += 1
			expect(new Headers(init.headers).get('authorization')).toBe(`Bearer token-${tokenCalls}`)
			expect(JSON.stringify(init)).not.toContain('client-secret-value')
			return response(transactionPage)
		})
		const client = new SpsCommerceClient(auth, { fetch, now: () => new Date(now) })
		await Promise.all([client.listTransactions({ path: '' }), client.listTransactions({ path: '/' })])
		await client.listTransactions({ path: 'out/' })
		expect(tokenCalls).toBe(1)
		now = 91_000
		await client.listTransactions({ path: '' })
		expect(tokenCalls).toBe(2)
		expect(apiCalls).toBe(4)
	})

	test('bound tools reuse tokens across fromContext clients, but never across accounts', async () => {
		let tokenCalls = 0
		const fetch = mockFetch((url) => {
			if (url.hostname === 'auth.spscommerce.com') {
				tokenCalls += 1
				return response({ access_token: `t-${tokenCalls}`, expires_in: 3600 })
			}
			return response(transactionPage)
		})
		const auth = { client_id: 'one', client_secret: 'one-secret' }
		const bound = withAuth(spsCommerceModule, auth)
		const list = bound.tools.find((item) => item.id === 'sps-commerce-list-transactions')
		if (!list) throw new Error('Missing list')
		await runTool(list, { path: '' }, { fetch })
		await runTool(list, { path: '' }, { fetch })
		expect(tokenCalls).toBe(1)
		await new SpsCommerceClient({ client_id: 'two', client_secret: 'two-secret' }, { fetch }).listTransactions({
			path: ''
		})
		expect(tokenCalls).toBe(2)
	})

	test('credential mutation invalidates object-keyed cache', async () => {
		let tokenCalls = 0
		const auth = { client_id: 'one', client_secret: 'old' }
		const fetch = mockFetch((url) => {
			if (url.hostname === 'auth.spscommerce.com') {
				tokenCalls += 1
				return response({ access_token: `token-${tokenCalls}`, expires_in: 3600 })
			}
			return response(transactionPage)
		})
		await new SpsCommerceClient(auth, { fetch }).listTransactions({ path: '' })
		auth.client_secret = 'new'
		await new SpsCommerceClient(auth, { fetch }).listTransactions({ path: '' })
		expect(tokenCalls).toBe(2)
	})

	test.each([
		{ access_token: '', expires_in: 100 },
		{ access_token: 'token', expires_in: 0 },
		{ access_token: 'token', expires_in: '100' },
		{ access_token: 'token', expires_in: 100, token_type: 'MAC' }
	])('malformed token response is safe bad_auth', async (data) => {
		const client = new SpsCommerceClient(
			{ client_id: 'client', client_secret: 'secret' },
			{ fetch: mockFetch(() => response(data)) }
		)
		await code(client.listLabels(), 'bad_auth')
	})

	test('failed refresh is not retained, replayed, or leaked', async () => {
		let tokenCalls = 0
		const client = new SpsCommerceClient(
			{ client_id: 'client', client_secret: 'private' },
			{
				fetch: mockFetch((url) => {
					if (url.hostname === 'auth.spscommerce.com') {
						tokenCalls += 1
						if (tokenCalls === 1) return response({ secret: 'private' }, 429, { 'Retry-After': '7' })
						return response({ access_token: 'refreshed', expires_in: 100 })
					}
					return response({ status: 'ok', templates: [] })
				})
			}
		)
		const error = await code(client.listLabels(), 'rate_limited')
		expect(error.details?.retry_after_ms).toBe(7000)
		expect(error.retryable).toBe(false)
		expect(JSON.stringify(error)).not.toContain('private')
		expect(tokenCalls).toBe(1)
		await client.listLabels()
		expect(tokenCalls).toBe(2)
	})

	test('pre-aborted request performs no auth or business I/O', async () => {
		let calls = 0
		const controller = new AbortController()
		controller.abort()
		const client = new SpsCommerceClient(
			{ client_id: 'a', client_secret: 'b' },
			{
				signal: controller.signal,
				fetch: mockFetch(() => {
					calls += 1
					return response({})
				})
			}
		)
		await code(client.listLabels(), 'timeout')
		expect(calls).toBe(0)
	})
})

describe('SPS Transaction v5', () => {
	test('list preserves native cursor and nulls without auto-pagination', async () => {
		let calls = 0
		const client = new SpsCommerceClient(boundAuth, {
			fetch: mockFetch((url, init) => {
				calls += 1
				expect(url.origin).toBe('https://api.spscommerce.com')
				expect(url.pathname).toBe('/transactions/v5/data/Out/')
				expect(Object.fromEntries(url.searchParams)).toEqual({
					limit: '1',
					cursor: 'opaque/+==',
					entryNamePrefix: 'PO'
				})
				expect(new Headers(init.headers).get('authorization')).toBe(`Bearer ${boundAuth.access_token}`)
				expect(init.method).toBe('GET')
				return response(transactionPage)
			})
		})
		expect(
			await client.listTransactions({ path: '/Out/', limit: 1, cursor: 'opaque/+==', entryNamePrefix: 'PO' })
		).toEqual(transactionPage)
		expect(calls).toBe(1)
	})

	test.each([200, 201])('upload sends exact bytes and metadata; accepts documented success %i', async (status) => {
		let calls = 0
		const upload = { path: '/in/Order.xml', url: 'https://api.spscommerce.com/transactions/v5/data/in/Order.xml' }
		const bytes = new Uint8Array([0, 1, 127, 255])
		const client = new SpsCommerceClient(boundAuth, {
			fetch: mockFetch((url, init) => {
				calls += 1
				expect(url.pathname).toBe('/transactions/v5/data/in/Order.xml')
				expect(init.method).toBe('POST')
				expect(init.body).toEqual(bytes.buffer)
				const headers = new Headers(init.headers)
				expect(headers.get('content-type')).toBe('application/octet-stream')
				expect(headers.get('sps-meta-order_id')).toBe('PO-1')
				return response(upload, status)
			})
		})
		expect(await client.uploadTransactionBytes({ path: upload.path, bytes, metadata: { order_id: 'PO-1' } })).toEqual(
			upload
		)
		expect(calls).toBe(1)
	})

	test('artifact upload resolves bounded bytes before sending', async () => {
		const storage = artifactStorage()
		let calls = 0
		const client = new SpsCommerceClient(
			{ ...boundAuth, artifacts: storage.artifactsAuth },
			{
				fetch: mockFetch((_url, init) => {
					calls += 1
					expect(init.body).toEqual(toArrayBuffer(utf8ToBytes('<Order/>')))
					return response(
						{ path: '/in/order.xml', url: 'https://api.spscommerce.com/transactions/v5/data/in/order.xml' },
						201
					)
				})
			}
		)
		await client.uploadTransaction({ path: 'in/order.xml', source: { store: 'host', key: 'source' }, max_bytes: 100 })
		expect(calls).toBe(1)
		await code(
			client.uploadTransaction({ path: 'in/order.xml', source: { store: 'host', key: 'source' }, max_bytes: 1 }),
			'too_large'
		)
		expect(calls).toBe(1)
	})

	test('read stores an artifact and never deletes on read or storage failure', async () => {
		const storage = artifactStorage()
		const methods: string[] = []
		const client = new SpsCommerceClient(
			{ ...boundAuth, artifacts: storage.artifactsAuth },
			{
				fetch: mockFetch((_url, init) => {
					methods.push(init.method ?? '')
					return new Response('<Order/>', { headers: { 'Content-Type': 'application/xml' } })
				})
			}
		)
		const result = await client.readTransaction({
			path: '/out/order.xml',
			destination: 'received/order.xml',
			max_bytes: 100
		})
		expect(result.artifact).toMatchObject({ store: 'host', key: 'received/order.xml', byte_length: 8 })
		expect(storage.writes[0]?.body).toBe(btoa('<Order/>'))
		expect(methods).toEqual(['GET'])
		const failedStorage = artifactStorage()
		if (failedStorage.artifactsAuth.provider !== 'host') throw new Error('Expected host')
		failedStorage.artifactsAuth.backend.create = async () => {
			throw new Error('private storage details')
		}
		const failing = new SpsCommerceClient(
			{ ...boundAuth, artifacts: failedStorage.artifactsAuth },
			{
				fetch: mockFetch((_url, init) => {
					methods.push(init.method ?? '')
					return new Response('x')
				})
			}
		)
		const error = await code(
			failing.readTransaction({ path: '/out/order.xml', destination: 'x', max_bytes: 100 }),
			'upstream'
		)
		expect(error.message).not.toContain('private')
		expect(methods).toEqual(['GET', 'GET'])
	})

	test('delete is separate and supports an empty 204 response', async () => {
		let calls = 0
		const client = new SpsCommerceClient(boundAuth, {
			fetch: mockFetch((url, init) => {
				calls += 1
				expect(url.pathname).toBe('/transactions/v5/data/out/Order.xml')
				expect(init.method).toBe('DELETE')
				return new Response(null, { status: 204 })
			})
		})
		expect(await client.deleteTransaction({ path: '/out/Order.xml' })).toEqual({ deleted: true })
		expect(calls).toBe(1)
	})

	test('history preserves native status logs and contradictory paging offsets', async () => {
		const history = {
			results: [
				{
					id: 'report',
					path: 'out/a.xml',
					direction: 'out',
					status_log: [
						{ status: 'uploaded', timestamp: '2026-09-09T00:00:00Z' },
						{ status: 'deleted', timestamp: '2026-09-09T00:01:00Z', message: null }
					]
				}
			],
			paging: {
				limit: 20,
				offset: 10,
				total_count: 10658,
				next: { url: 'https://api.spscommerce.com/transactions/v5/history?offset=11&limit=20' },
				previous: null
			}
		}
		const client = new SpsCommerceClient(boundAuth, {
			fetch: mockFetch((url) => {
				expect(url.pathname).toBe('/transactions/v5/history')
				expect(Object.fromEntries(url.searchParams)).toEqual({
					limit: '20',
					offset: '10',
					after: '2026-09-01T00:00:00',
					until: '2026-09-09T00:00:00'
				})
				return response(history)
			})
		})
		expect(
			await client.listTransactionHistory({
				limit: 20,
				offset: 10,
				after: '2026-09-01T00:00:00',
				until: '2026-09-09T00:00:00'
			})
		).toEqual(history)
	})

	test('malformed reads fail upstream; explicit null collections remain null', async () => {
		const bad = new SpsCommerceClient(boundAuth, { fetch: mockFetch(() => response({ results: [{}] })) })
		await code(bad.listTransactions({ path: '' }), 'upstream')
		const empty = new SpsCommerceClient(boundAuth, {
			fetch: mockFetch(() => response({ results: null, paging: null }))
		})
		expect(await empty.listTransactions({ path: '' })).toEqual({ results: null, paging: null })
	})

	test('preflight rejects invalid path, metadata, and history time before network', async () => {
		let calls = 0
		const client = new SpsCommerceClient(boundAuth, {
			fetch: mockFetch(() => {
				calls += 1
				return response({})
			})
		})
		await code(client.readTransactionBytes({ path: '../secret', max_bytes: 1 }), 'bad_input')
		await code(
			client.uploadTransactionBytes({
				path: 'in/x',
				bytes: new Uint8Array(),
				metadata: { 'x\r\nAuthorization': 'evil' }
			}),
			'bad_input'
		)
		await code(
			client.uploadTransactionBytes({ path: 'in/x', bytes: new Uint8Array(), metadata: { x: 'a\r\nb' } }),
			'bad_input'
		)
		await code(client.listTransactionHistory({ after: '2026-09-09T00:00:00Z' }), 'bad_input')
		expect(calls).toBe(0)
	})
})

describe('SPS labels and packing slips', () => {
	test('lists expose every verified filter and retain native templates', async () => {
		const paths: string[] = []
		const client = new SpsCommerceClient(boundAuth, {
			fetch: mockFetch((url) => {
				paths.push(url.pathname)
				expect(Object.fromEntries(url.searchParams)).toEqual({
					newest: 'false',
					limit: '10',
					offset: '0',
					name: 'Retail',
					name__EQ: 'Retailer template',
					ownerName: 'SPS',
					ownerName__EQ: 'SPS Commerce',
					ownerID: '12',
					ownerID__EQ: '123',
					canRender: 'false'
				})
				return response({ status: 'ok', templates: [template], count: 1 })
			})
		})
		const input = {
			newest: false,
			limit: 10,
			offset: 0,
			name: 'Retail',
			name__EQ: 'Retailer template',
			ownerName: 'SPS',
			ownerName__EQ: 'SPS Commerce',
			ownerID: '12',
			ownerID__EQ: '123',
			canRender: false
		}
		expect((await client.listLabels(input)).templates).toEqual([template])
		expect((await client.listPackingSlips(input)).count).toBe(1)
		expect(paths).toEqual(['/label/v1/', '/packing-slip/v1/'])
	})

	test('template detail, dynamic schemas and sample JSON use exact routes', async () => {
		const paths: string[] = []
		const dynamic = {
			$schema: 'http://json-schema.org/draft-07/schema#',
			type: 'object',
			properties: { RetailerField: { type: 'string' } }
		}
		const client = new SpsCommerceClient(boundAuth, {
			fetch: mockFetch((url) => {
				paths.push(url.pathname)
				if (url.pathname.endsWith('/schema')) {
					expect(Object.fromEntries(url.searchParams)).toEqual({
						download: 'true',
						pretty: 'false',
						pendingChange: 'true'
					})
					return response(dynamic)
				}
				if (url.pathname.endsWith('/sample-json')) return response({ RetailerField: 'sample', Optional: null })
				return response(template)
			})
		})
		expect(await client.getLabel({ id: 'T-123' })).toEqual(template)
		expect(await client.getPackingSlip({ id: 'T-123' })).toEqual(template)
		expect(await client.getLabelSchema({ id: 'T-123', download: true, pretty: false, pendingChange: true })).toEqual(
			dynamic
		)
		expect(
			await client.getPackingSlipSchema({ id: 'T-123', download: true, pretty: false, pendingChange: true })
		).toEqual(dynamic)
		expect(await client.getLabelSample({ id: 'T-123' })).toEqual({ RetailerField: 'sample', Optional: null })
		expect(await client.getPackingSlipSample({ id: 'T-123' })).toEqual({ RetailerField: 'sample', Optional: null })
		expect(paths).toEqual([
			'/label/v1/T-123',
			'/packing-slip/v1/T-123',
			'/label/v1/T-123/schema',
			'/packing-slip/v1/T-123/schema',
			'/label/v1/T-123/sample-json',
			'/packing-slip/v1/T-123/sample-json'
		])
	})

	test('all four sample PDF endpoints return bounded host bytes', async () => {
		const paths: string[] = []
		const client = new SpsCommerceClient(boundAuth, {
			fetch: mockFetch((url, init) => {
				paths.push(url.pathname)
				expect(init.method).toBe('GET')
				expect(url.searchParams.get('pendingChange')).toBe('false')
				return new Response('%PDF-sample')
			})
		})
		for (const sample_uid of [undefined, 'sample-1']) {
			const input = { id: 'T-123', max_bytes: 100, pendingChange: false, ...(sample_uid && { sample_uid }) }
			expect(bytesToUtf8((await client.getLabelSamplePdfBytes({ ...input, perPage: 4 })).bytes)).toBe('%PDF-sample')
			expect((await client.getPackingSlipSamplePdfBytes(input)).media_type).toBe('application/pdf')
		}
		expect(paths).toEqual([
			'/label/v1/T-123/sample-pdf',
			'/packing-slip/v1/T-123/sample-pdf',
			'/label/v1/T-123/sample/sample-1/sample-pdf',
			'/packing-slip/v1/T-123/sample/sample-1/sample-pdf'
		])
	})

	test('PDF render maps every public layout option and preserves arbitrary template JSON', async () => {
		const data = { RetailerSpecific: [{ nullable: null, count: 0, enabled: false }], Header: {} }
		const client = new SpsCommerceClient(boundAuth, {
			fetch: mockFetch((url, init) => {
				expect(url.pathname).toBe('/label/v1/T-123/pdf')
				expect(init.method).toBe('POST')
				expect(body(init)).toEqual(data)
				expect(new Headers(init.headers).get('content-type')).toBe('application/json')
				expect(Object.fromEntries(url.searchParams)).toEqual({
					perPage: '4',
					pendingChange: 'false',
					startPackCount: '5',
					totalPackCount: '100',
					collate: 'false',
					copies: '2',
					pages: '[2,5]',
					url: 'false'
				})
				return new Response('%PDF-label')
			})
		})
		const result = await client.renderLabelPdfBytes({
			id: 'T-123',
			data,
			max_bytes: 100,
			perPage: 4,
			pendingChange: false,
			startPackCount: 5,
			totalPackCount: 100,
			collate: false,
			copies: 2,
			pages: [2, 5]
		})
		expect(result.media_type).toBe('application/pdf')
		expect(bytesToUtf8(result.bytes)).toBe('%PDF-label')
	})

	test('ZPL retains the native per-label zplData array and printer options', async () => {
		const data = { zplData: ['^XA^FO0,0^FDone^FS^XZ', '^XA^FO0,0^FDtwo^FS^XZ'] }
		const client = new SpsCommerceClient(boundAuth, {
			fetch: mockFetch((url) => {
				expect(url.pathname).toBe('/label/v1/T-123/zpl')
				expect(Object.fromEntries(url.searchParams)).toEqual({
					url: 'false',
					perPage: '1',
					mediaType: 'D',
					printMode: 'C',
					dpi: '600',
					zplCommand: 'DY'
				})
				return response(data)
			})
		})
		const document = await client.renderLabelZplBytes({
			id: 'T-123',
			data: {},
			max_bytes: 1000,
			perPage: 1,
			mediaType: 'D',
			printMode: 'C',
			dpi: 600,
			zplCommand: 'DY'
		})
		expect(document.media_type).toBe('application/json')
		expect(JSON.parse(bytesToUtf8(document.bytes))).toEqual(data)
	})

	test('packing slip PDF uses only its documented options', async () => {
		const client = new SpsCommerceClient(boundAuth, {
			fetch: mockFetch((url, init) => {
				expect(url.pathname).toBe('/packing-slip/v1/T-123/pdf')
				expect(body(init)).toEqual({ Shipment: [{ Item: [] }] })
				expect(Object.fromEntries(url.searchParams)).toEqual({ pendingChange: 'true', url: 'false' })
				return new Response('%PDF-slip')
			})
		})
		expect(
			bytesToUtf8(
				(
					await client.renderPackingSlipPdfBytes({
						id: 'T-123',
						data: { Shipment: [{ Item: [] }] },
						pendingChange: true,
						max_bytes: 100
					})
				).bytes
			)
		).toBe('%PDF-slip')
	})

	test('native asynchronous PDF/ZPL batch submissions do not auto-poll', async () => {
		const paths: string[] = []
		const accepted = { batchId: 'batch-1', statusURL: 'https://api.spscommerce.com/label/v1/batches/batch-1' }
		const client = new SpsCommerceClient(boundAuth, {
			fetch: mockFetch((url, init) => {
				paths.push(url.pathname)
				expect(init.method).toBe('POST')
				expect(url.searchParams.get('asyncValidation')).toBe('false')
				expect(url.searchParams.get('pages')).toBe('[1,2]')
				expect(url.searchParams.has('url')).toBe(false)
				expect(body(init)).toEqual({ Pack: [{ a: 1 }, { a: 2 }] })
				return response(accepted)
			})
		})
		const input = { id: 'T-123', data: { Pack: [{ a: 1 }, { a: 2 }] }, pages: [1, 2], asyncValidation: false }
		expect(await client.createLabelPdfBatch(input)).toEqual(accepted)
		expect(await client.createLabelZplBatch({ ...input, dpi: 203, zplCommand: 'GFA' })).toEqual(accepted)
		expect(paths).toEqual(['/label/v1/T-123/pdf/batches', '/label/v1/T-123/zpl/batches'])
	})

	test.each(['In Progress', 'Completed', 'Failed'])(
		'batch status preserves %s and per-item failures without signed links',
		async (status) => {
			const state = {
				batchId: 'batch-1',
				status,
				ownerName: null,
				resultURL: 'https://cdn.test.spsapps.net/result?Signature=private',
				validationErrors: [{ oneOf: [[{ path: 'Pack[1].Item[0]', message: 'Required', validatorValue: ['Code'] }]] }]
			}
			const fetch = mockFetch((url) => {
				expect(url.pathname).toBe('/label/v1/batches/batch-1')
				return response(state)
			})
			const result = await runTool(tool('get-label-batch-status'), { batch_id: 'batch-1' }, { auth: boundAuth, fetch })
			expect(result).toMatchObject({
				batchId: 'batch-1',
				status,
				ownerName: null,
				validationErrors: state.validationErrors
			})
			expect(JSON.stringify(result)).not.toContain('Signature')
			expect(JSON.stringify(result)).not.toContain('resultURL')
		}
	)

	test('document origin is host-approved and never receives SPS credentials', async () => {
		const methods: string[] = []
		const fetch = mockFetch((url, init) => {
			methods.push(`${init.method} ${url.origin}`)
			if (url.hostname === 'api.spscommerce.com') {
				expect(new Headers(init.headers).get('authorization')).toBe(`Bearer ${boundAuth.access_token}`)
				return response({
					batchId: 'b1',
					status: 'Completed',
					resultURL: 'https://cdn.test.spsapps.net/label.pdf?Signature=private'
				})
			}
			expect(url.origin).toBe('https://cdn.test.spsapps.net')
			expect(new Headers(init.headers).get('authorization')).toBeNull()
			expect(new Headers(init.headers).get('sps-meta-x')).toBeNull()
			expect(init.redirect).toBe('error')
			return new Response('%PDF-batch', { headers: { 'Content-Type': 'application/pdf' } })
		})
		const client = new SpsCommerceClient(
			{ ...boundAuth, document_origins: ['https://cdn.test.spsapps.net'] },
			{ fetch }
		)
		expect(bytesToUtf8((await client.getLabelBatchResultBytes({ batch_id: 'b1', max_bytes: 100 })).bytes)).toBe(
			'%PDF-batch'
		)
		expect(methods).toEqual(['GET https://api.spscommerce.com', 'GET https://cdn.test.spsapps.net'])
	})

	test.each([
		'https://evil.example/doc',
		'http://cdn.test.spsapps.net/doc',
		'https://cdn.test.spsapps.net.evil.example/doc',
		'https://user:secret@cdn.test.spsapps.net/doc'
	])('rejects unapproved or malformed result origin %s', async (resultURL) => {
		let calls = 0
		const client = new SpsCommerceClient(
			{ ...boundAuth, document_origins: ['https://cdn.test.spsapps.net'] },
			{
				fetch: mockFetch(() => {
					calls += 1
					return response({ batchId: 'b1', status: 'Completed', resultURL })
				})
			}
		)
		await code(client.getLabelBatchResultBytes({ batch_id: 'b1', max_bytes: 100 }), 'forbidden')
		expect(calls).toBe(1)
	})

	test.each(['In Progress', 'Failed'])('no document fetch for %s batch', async (status) => {
		let calls = 0
		const client = new SpsCommerceClient(boundAuth, {
			fetch: mockFetch(() => {
				calls += 1
				return response({ batchId: 'b1', status, resultURL: '' })
			})
		})
		await code(client.getLabelBatchResultBytes({ batch_id: 'b1', max_bytes: 100 }), 'bad_input')
		expect(calls).toBe(1)
	})

	test('missing artifact backend fails before render I/O', async () => {
		let calls = 0
		const fetch = mockFetch(() => {
			calls += 1
			return new Response('%PDF')
		})
		await code(
			runTool(
				tool('render-label-pdf'),
				{ id: 'T-123', data: {}, destination: 'x', max_bytes: 100 },
				{ auth: boundAuth, fetch }
			),
			'bad_auth'
		)
		expect(calls).toBe(0)
	})

	test('all binary tools store artifacts rather than document bodies', async () => {
		const storage = artifactStorage()
		const auth: SpsCommerceAuth = {
			...boundAuth,
			artifacts: storage.artifactsAuth,
			document_origins: ['https://cdn.test.spsapps.net']
		}
		const fetch = mockFetch((url) => {
			if (url.pathname.includes('/batches/'))
				return response({ batchId: 'b1', status: 'Completed', resultURL: 'https://cdn.test.spsapps.net/file' })
			if (url.pathname.endsWith('/zpl')) return response({ zplData: ['^XA^XZ'] })
			return new Response('%PDF-private')
		})
		const base = { id: 'T-123', max_bytes: 1000, destination: 'labels/result' }
		for (const [name, input] of [
			['get-label-sample-pdf', base],
			['get-packing-slip-sample-pdf', base],
			['render-label-pdf', { ...base, data: {} }],
			['render-label-zpl', { ...base, data: {} }],
			['render-packing-slip-pdf', { ...base, data: {} }],
			['get-label-batch-result', { batch_id: 'b1', max_bytes: 1000, destination: 'labels/batch' }]
		] as const) {
			const result = await runTool(tool(name), input, { auth, fetch })
			expect(result).toHaveProperty('artifact')
			expect(JSON.stringify(result)).not.toContain('%PDF-private')
			expect(JSON.stringify(result)).not.toContain('^XA')
		}
		expect(storage.writes).toHaveLength(6)
	})

	test('render byte-size, DPI, and malformed ZPL validation', async () => {
		let calls = 0
		const client = new SpsCommerceClient(boundAuth, {
			fetch: mockFetch(() => {
				calls += 1
				return response({ zplData: [42] })
			})
		})
		await code(
			client.renderLabelZplBytes({ id: 'T-123', data: {}, max_bytes: 100, dpi: 600, zplCommand: 'DG' }),
			'bad_input'
		)
		await code(
			client.renderLabelPdfBytes({
				id: 'T-123',
				data: { oversized: 'x'.repeat(SPS_RENDER_MAX_BYTES) },
				max_bytes: 100
			}),
			'too_large'
		)
		expect(calls).toBe(0)
		await code(client.renderLabelZplBytes({ id: 'T-123', data: {}, max_bytes: 100 }), 'upstream')
		expect(calls).toBe(1)
	})
})

describe('SPS Community Submission', () => {
	test('forms preserve every enabled field and nullable value with native paging', async () => {
		const form = submissionForm()
		const paths: string[] = []
		const fetch = mockFetch((url) => {
			paths.push(url.pathname)
			if (url.pathname.endsWith('/forms')) {
				expect(Object.fromEntries(url.searchParams)).toEqual({ limit: '50', offset: '0' })
				return response({ results: [form], paging: { totalCount: 99, limit: 50, offset: 0 } })
			}
			return response(form)
		})
		const client = new SpsCommerceClient(boundAuth, { fetch })
		expect(await client.listSubmissionForms({ limit: 50, offset: 0 })).toEqual({
			results: [form],
			paging: { totalCount: 99, limit: 50, offset: 0 }
		})
		expect(await client.getSubmissionForm({ id: 'form-1' })).toEqual(form)
		expect(paths).toEqual(['/submissions/v1/forms', '/submissions/v1/forms/form-1'])
	})

	test('full nested trading-partner input maps exactly and retains false/zero/null', async () => {
		const input: SpsCreateTradingPartnersInput = {
			...partnerInput,
			tradingPartnerId4: 'x'.repeat(100),
			tpInvolvementContact: {
				tpInvolvementFirstName: null,
				tpInvolvementLastName: 'Broker',
				tpInvolvementType: 'Broker'
			},
			purchaseOrderDollars: 0,
			purchaseOrderCount: 0,
			carrierService: false,
			tradingPartnerLocation: { zipCode: '12345', address: null },
			anticipatedFirstOrderDate: '2026-10-01',
			fulfillmentModels: { shipToDcDocs: ['850', '856'], exemptDocuments: null },
			uniqueSupplierGroups: [],
			sponsoredSolution: false
		}
		const fetch = mockFetch((url, init) => {
			expect(url.pathname).toBe('/submissions/v1/trading-partners')
			expect(init.method).toBe('POST')
			expect(body(init)).toEqual(input)
			return response(partnerResult, 201)
		})
		expect(await runTool(tool('create-trading-partners'), input, { auth: boundAuth, fetch })).toEqual(partnerResult)
	})

	test.each([
		{ ...partnerInput, businessContact: { firstName: 'Ada', lastName: 'Lovelace', email: 'invalid' } },
		{ ...partnerInput, includedDataExchanges: {} },
		{ ...partnerInput, includedDataExchanges: { item: false, order: null } },
		{ ...partnerInput, country: 'US' },
		{ ...partnerInput, tradingPartnerId2: 'x'.repeat(76) },
		{ ...partnerInput, tpInvolvementContact: { tpInvolvementLastName: 'Name' } },
		{ ...partnerInput, fulfillmentModels: { shipToDcDocs: ['850'], arbitrary: true } },
		{ ...partnerInput, purchaseOrderCount: -1 },
		{ ...partnerInput, anticipatedFirstOrderDate: '2026-02-30' }
	])('rejects input violating nested OpenAPI constraints', (input) => {
		expect(spsCreateTradingPartnersInputSchema.safeParse(input).success).toBe(false)
	})

	test('malformed form/partner responses fail upstream without exposing payload', async () => {
		const client = new SpsCommerceClient(boundAuth, {
			fetch: mockFetch(() => response({ private: 'customer-details' }))
		})
		await code(client.getSubmissionForm({ id: 'form-1' }), 'upstream')
		const error = await code(client.createTradingPartners(partnerInput), 'upstream')
		expect(JSON.stringify(error)).not.toContain('customer-details')
	})
})

describe('SPS safety and transport failure contracts', () => {
	test.each([401, 403, 429, 500])('writes are not retried for HTTP %i', async (status) => {
		const expected =
			status === 401 ? 'bad_auth' : status === 403 ? 'forbidden' : status === 429 ? 'rate_limited' : 'upstream'
		let calls = 0
		const client = new SpsCommerceClient(boundAuth, {
			fetch: mockFetch(() => {
				calls += 1
				return response(
					{ title: 'Secret provider body', status, requestId: 'r1', detail: boundAuth.access_token },
					status,
					{ 'Retry-After': '5' }
				)
			})
		})
		for (const operation of [
			() => client.uploadTransactionBytes({ path: '/in/x', bytes: new Uint8Array([1]) }),
			() => client.deleteTransaction({ path: '/out/x' }),
			() => client.renderLabelPdfBytes({ id: 'T-123', data: {}, max_bytes: 100 }),
			() => client.createLabelPdfBatch({ id: 'T-123', data: {} }),
			() => client.createTradingPartners(partnerInput)
		]) {
			const before = calls
			const error = await code(operation(), expected)
			expect(calls).toBe(before + 1)
			expect(error.retryable).toBe(false)
			expect(error.cause).toBeUndefined()
			expect(JSON.stringify(error)).not.toContain(boundAuth.access_token)
			if (status === 429) expect(error.details?.retry_after_ms).toBe(5000)
		}
	})

	test('read 429 retains Retry-After but does not retry automatically', async () => {
		let calls = 0
		const client = new SpsCommerceClient(boundAuth, {
			fetch: mockFetch(() => {
				calls += 1
				return response({}, 429, { 'Retry-After': '3' })
			})
		})
		const error = await code(client.listLabels(), 'rate_limited')
		expect(error.retryable).toBe(true)
		expect(error.details?.retry_after_ms).toBe(3000)
		expect(calls).toBe(1)
	})

	test('network failure sanitizes signed locations and has no nested cause', async () => {
		let calls = 0
		const client = new SpsCommerceClient(
			{ ...boundAuth, document_origins: ['https://cdn.test.spsapps.net'] },
			{
				fetch: mockFetch((url) => {
					calls += 1
					if (url.hostname === 'api.spscommerce.com')
						return response({
							batchId: 'b1',
							status: 'Completed',
							resultURL: 'https://cdn.test.spsapps.net/file?Signature=private'
						})
					throw new Error(`Failure ${url.href} ${boundAuth.access_token}`)
				})
			}
		)
		const error = await code(client.getLabelBatchResultBytes({ batch_id: 'b1', max_bytes: 100 }), 'upstream')
		expect(error.cause).toBeUndefined()
		expect(error.message).not.toContain('private')
		expect(JSON.stringify(error)).not.toContain('Signature')
		expect(calls).toBe(2)
	})

	test.each([302, 307, 308])('redirect HTTP %i cannot replay a write', async (status) => {
		let calls = 0
		const client = new SpsCommerceClient(boundAuth, {
			fetch: mockFetch((_url, init) => {
				calls += 1
				expect(init.redirect).toBe('error')
				return new Response(null, { status, headers: { Location: 'https://evil.example/upload' } })
			})
		})
		await code(client.uploadTransactionBytes({ path: 'in/x', bytes: new Uint8Array([1]) }), 'upstream')
		expect(calls).toBe(1)
	})

	test('abort maps to timeout and never replays mutation', async () => {
		const controller = new AbortController()
		let calls = 0
		const client = new SpsCommerceClient(boundAuth, {
			signal: controller.signal,
			fetch: mockFetch((_url, init) => {
				calls += 1
				expect(init.signal).toBe(controller.signal)
				controller.abort()
				throw new DOMException('private cancellation details', 'AbortError')
			})
		})
		const error = await code(client.createTradingPartners(partnerInput), 'timeout')
		expect(error.retryable).toBe(false)
		expect(error.cause).toBeUndefined()
		expect(calls).toBe(1)
	})

	test.each([true, false])('byte bounds cancel oversized stream (content-length=%s)', async (declared) => {
		let cancelled = false
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(new Uint8Array([1, 2, 3, 4]))
			},
			cancel() {
				cancelled = true
			}
		})
		const client = new SpsCommerceClient(boundAuth, {
			fetch: mockFetch(
				() =>
					new Response(stream, {
						headers: declared ? { 'Content-Length': '4' } : {}
					})
			)
		})
		await code(client.readTransactionBytes({ path: '/out/x', max_bytes: 3 }), 'too_large')
		expect(cancelled).toBe(true)
	})
})
