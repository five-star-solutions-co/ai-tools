/**
 * Amazon Selling Partner API vendor client.
 * Host: `new AmazonSpApiClient(auth)`. Agent tools: `fromContext(ctx)`.
 *
 * LWA refresh provides the access token used by SP-API HTTP requests.
 */

import { ToolError } from '../../core/errors'
import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import { bytesToUtf8 } from '../../shared/bytes'
import { HttpService } from '../../transport/http-service'
import type { HttpServiceOptions } from '../../transport/http-service'
import type {
	AmazonSpApiAuth,
	AmazonSpApiCreateReportInput,
	AmazonSpApiCreateReportOutput,
	AmazonSpApiDownloadReportDocumentBytesInput,
	AmazonSpApiDownloadReportDocumentBytesOutput,
	AmazonSpApiGetOrderInput,
	AmazonSpApiGetOrderItemsInput,
	AmazonSpApiGetOrderItemsOutput,
	AmazonSpApiGetOrderOutput,
	AmazonSpApiGetReportDocumentInput,
	AmazonSpApiGetReportDocumentOutput,
	AmazonSpApiGetReportInput,
	AmazonSpApiGetReportOutput,
	AmazonSpApiGetSettlementSummaryInput,
	AmazonSpApiGetSettlementSummaryOutput,
	AmazonSpApiInventoryPageInput,
	AmazonSpApiInventoryPageOutput,
	AmazonSpApiListInventorySummariesInput,
	AmazonSpApiListInventorySummariesOutput,
	AmazonSpApiListOrdersInput,
	AmazonSpApiListOrdersOutput,
	AmazonSpApiListReportsInput,
	AmazonSpApiListReportsOutput,
	AmazonSpApiListReportsPageInput,
	AmazonSpApiListReportsPageOutput,
	AmazonSpApiSearchCatalogItemsInput,
	AmazonSpApiSearchCatalogItemsOutput,
	AmazonSpApiSearchOrdersInput,
	AmazonSpApiSearchOrdersOutput
} from './contracts'
import {
	amazonSpApiAuthSchema,
	amazonSpApiDownloadReportDocumentBytesInputSchema,
	amazonSpApiInventoryPageInputSchema,
	amazonSpApiListReportsInputSchema,
	amazonSpApiListReportsPageInputSchema
} from './contracts'
import {
	LWA_TOKEN_URL,
	lwaTokenBody,
	parseCreateReportPayload,
	parseGetReportPayload,
	parseInventoryPagePayload,
	parseInventorySummary,
	parseListReportsPagePayload,
	parseLwaTokenResponse,
	parseOrderItemsPayload,
	parseOrderPayload,
	parseOrdersPayload,
	parseReport,
	parseReportDocumentPayload,
	parseSearchCatalogItemsPayload,
	parseSearchOrdersPayload,
	requireMarketplaceIds
} from './domain'
import { decompressReportDocumentBytes } from './domain/report-document'
import {
	SETTLEMENT_MAX_COMPRESSED_BYTES,
	SETTLEMENT_REPORT_TYPE_V2,
	settlementCreatedSinceIso,
	summarizeSettlementDocument
} from './domain/settlement'

export type AmazonSpApiClientOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'>

export class AmazonSpApiClient {
	readonly #auth: AmazonSpApiAuth
	readonly #lwa: HttpService
	readonly #api: HttpService
	/** Absolute URL document download (report document URLs). */
	readonly #download: HttpService
	#accessToken: string | undefined
	#accessTokenExpiresAt = 0

	constructor(auth: AmazonSpApiAuth, options: AmazonSpApiClientOptions = {}) {
		const parsed = amazonSpApiAuthSchema.safeParse(auth)
		if (!parsed.success) {
			throw new ToolError('Invalid Amazon SP-API auth credentials', {
				code: 'bad_auth',
				details: { issues: parsed.error.issues.map((issue) => issue.message) }
			})
		}
		this.#auth = parsed.data
		this.#lwa = new HttpService({
			...options,
			label: 'Amazon LWA'
		})
		this.#api = new HttpService({
			...options,
			baseURL: this.#auth.endpoint,
			headers: { 'user-agent': this.#auth.user_agent },
			label: 'Amazon SP-API'
		})
		this.#download = new HttpService({
			...options,
			label: 'Amazon SP-API report download'
		})
	}

	static fromContext(ctx: ToolContext): AmazonSpApiClient {
		const auth = requireAuth(ctx, amazonSpApiAuthSchema)
		return new AmazonSpApiClient(auth, {
			...(ctx.fetch && { fetch: ctx.fetch }),
			...(ctx.signal && { signal: ctx.signal })
		})
	}

	async #ensureAccessToken(): Promise<string> {
		const now = Date.now()
		if (this.#accessToken && now < this.#accessTokenExpiresAt) {
			return this.#accessToken
		}
		const { data } = await this.#lwa.post(LWA_TOKEN_URL, lwaTokenBody(this.#auth), {
			label: 'Amazon LWA token',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
		})
		const token = parseLwaTokenResponse(data)
		this.#accessToken = token.access_token
		this.#accessTokenExpiresAt = now + Math.max(0, token.expires_in * 1000 - 60_000)
		return token.access_token
	}

	async #spGet(path: string, label: string, query?: Record<string, string | number | boolean | undefined>) {
		const token = await this.#ensureAccessToken()
		return this.#api.get(path, {
			label,
			headers: { 'x-amz-access-token': token },
			...(query && { query })
		})
	}

	async #spPost(path: string, label: string, body: Record<string, unknown>) {
		const token = await this.#ensureAccessToken()
		return this.#api.post(path, body, {
			label,
			headers: {
				'x-amz-access-token': token,
				'Content-Type': 'application/json'
			}
		})
	}

	/** GET /orders/v0/orders */
	async listOrders(input: AmazonSpApiListOrdersInput = {}): Promise<AmazonSpApiListOrdersOutput> {
		const marketplaceIds = requireMarketplaceIds(
			input.marketplace_ids,
			this.#auth.marketplace_ids,
			'Amazon SP-API listOrders'
		)
		const { data } = await this.#spGet('/orders/v0/orders', 'Amazon SP-API listOrders', {
			MarketplaceIds: marketplaceIds.join(','),
			...(input.created_after && { CreatedAfter: input.created_after }),
			...(input.created_before && { CreatedBefore: input.created_before }),
			...(input.last_updated_after && { LastUpdatedAfter: input.last_updated_after }),
			...(input.order_statuses &&
				input.order_statuses.length > 0 && {
					OrderStatuses: input.order_statuses.join(',')
				}),
			...(input.cursor && { NextToken: input.cursor }),
			...(input.max_results !== undefined && { MaxResultsPerPage: input.max_results })
		})
		const parsed = parseOrdersPayload(data)
		return {
			items: parsed.items,
			truncated: Boolean(parsed.nextToken),
			...(parsed.nextToken && { next_cursor: parsed.nextToken })
		}
	}

	/** GET /orders/v0/orders/{orderId} */
	async getOrder(input: AmazonSpApiGetOrderInput): Promise<AmazonSpApiGetOrderOutput> {
		const { data } = await this.#spGet(
			`/orders/v0/orders/${encodeURIComponent(input.amazon_order_id)}`,
			'Amazon SP-API getOrder'
		)
		return { order: parseOrderPayload(data) }
	}

	/** GET /orders/v0/orders/{orderId}/orderItems */
	async getOrderItems(input: AmazonSpApiGetOrderItemsInput): Promise<AmazonSpApiGetOrderItemsOutput> {
		const query = input.cursor ? { NextToken: input.cursor } : undefined
		const { data } = await this.#spGet(
			`/orders/v0/orders/${encodeURIComponent(input.amazon_order_id)}/orderItems`,
			'Amazon SP-API getOrderItems',
			query
		)
		const parsed = parseOrderItemsPayload(data)
		return {
			amazon_order_id: parsed.amazon_order_id,
			items: parsed.items,
			truncated: Boolean(parsed.nextToken),
			...(parsed.nextToken && { next_cursor: parsed.nextToken })
		}
	}

	/**
	 * GET /orders/2026-01-01/orders (searchOrders).
	 * Always requests includedData=FULFILLMENT for fulfillmentStatus.
	 * Optional max_pages drains pages sequentially (bounded).
	 */
	async searchOrders(input: AmazonSpApiSearchOrdersInput): Promise<AmazonSpApiSearchOrdersOutput> {
		const marketplaceIds = requireMarketplaceIds(
			input.marketplace_ids,
			this.#auth.marketplace_ids,
			'Amazon SP-API searchOrders'
		)
		const maxPages = input.max_pages ?? 1
		const pageSize = input.max_results ?? 100
		const items: AmazonSpApiSearchOrdersOutput['items'] = []
		let cursor: string | undefined = input.cursor
		let pages = 0
		let nextToken: string | undefined

		while (pages < maxPages) {
			pages += 1
			const { data } = await this.#spGet('/orders/2026-01-01/orders', 'Amazon SP-API searchOrders', {
				createdAfter: input.created_after,
				...(input.created_before && { createdBefore: input.created_before }),
				marketplaceIds: marketplaceIds.join(','),
				includedData: 'FULFILLMENT',
				maxResultsPerPage: pageSize,
				...(cursor && { paginationToken: cursor })
			})
			const parsed = parseSearchOrdersPayload(data)
			items.push(...parsed.items)
			nextToken = parsed.nextToken
			if (!nextToken) break
			cursor = nextToken
		}

		return {
			items,
			truncated: Boolean(nextToken),
			...(nextToken && { next_cursor: nextToken })
		}
	}

	/** GET /fba/inventory/v1/summaries */
	async getInventorySummariesPage(input: AmazonSpApiInventoryPageInput): Promise<AmazonSpApiInventoryPageOutput> {
		const parsedInput = amazonSpApiInventoryPageInputSchema.safeParse(input)
		if (!parsedInput.success) {
			throw new ToolError('Invalid Amazon SP-API inventory page input', {
				code: 'bad_input',
				details: { issues: parsedInput.error.issues.map((issue) => issue.message) }
			})
		}
		return await this.#requestInventorySummariesPage({
			marketplace_id: parsedInput.data.marketplace_id,
			...(parsedInput.data.mode === 'incremental' && { start_date_time: parsedInput.data.start_date_time }),
			...(parsedInput.data.next_token && { next_token: parsedInput.data.next_token })
		})
	}

	async #requestInventorySummariesPage(input: {
		marketplace_id: string
		start_date_time?: string
		next_token?: string
		seller_skus?: string[]
	}): Promise<AmazonSpApiInventoryPageOutput> {
		const result = await this.#spGet('/fba/inventory/v1/summaries', 'Amazon SP-API getInventorySummariesPage', {
			details: true,
			granularityType: 'Marketplace',
			granularityId: input.marketplace_id,
			marketplaceIds: input.marketplace_id,
			...(input.start_date_time && { startDateTime: input.start_date_time }),
			...(input.next_token && { nextToken: input.next_token }),
			...(input.seller_skus && input.seller_skus.length > 0 && { sellerSkus: input.seller_skus.join(',') })
		})
		return parseInventoryPagePayload(result.data, result.headers)
	}

	/** Existing slim agent-facing projection over one raw inventory page. */
	async listInventorySummaries(
		input: AmazonSpApiListInventorySummariesInput = {}
	): Promise<AmazonSpApiListInventorySummariesOutput> {
		const marketplaceIds = requireMarketplaceIds(
			input.marketplace_id ? [input.marketplace_id] : undefined,
			this.#auth.marketplace_ids,
			'Amazon SP-API listInventorySummaries'
		)
		const marketplaceId = marketplaceIds[0]
		if (!marketplaceId) {
			throw new ToolError('Amazon SP-API listInventorySummaries requires a marketplace_id', {
				code: 'bad_input'
			})
		}
		const pageInput: AmazonSpApiInventoryPageInput = input.start_date_time
			? {
					mode: 'incremental',
					marketplace_id: marketplaceId,
					start_date_time: input.start_date_time,
					...(input.cursor && { next_token: input.cursor })
				}
			: {
					mode: 'full',
					marketplace_id: marketplaceId,
					...(input.cursor && { next_token: input.cursor })
				}
		const parsedInput = amazonSpApiInventoryPageInputSchema.safeParse(pageInput)
		if (!parsedInput.success) {
			throw new ToolError('Invalid Amazon SP-API inventory page input', {
				code: 'bad_input',
				details: { issues: parsedInput.error.issues.map((issue) => issue.message) }
			})
		}
		const page = await this.#requestInventorySummariesPage({
			marketplace_id: marketplaceId,
			...(input.start_date_time && { start_date_time: input.start_date_time }),
			...(input.cursor && { next_token: input.cursor }),
			...(input.seller_skus && input.seller_skus.length > 0 && { seller_skus: input.seller_skus })
		})
		return {
			items: page.items.map(parseInventorySummary),
			truncated: Boolean(page.next_token),
			...(page.next_token && { next_cursor: page.next_token })
		}
	}

	/** POST /reports/2021-06-30/reports */
	async createReport(input: AmazonSpApiCreateReportInput): Promise<AmazonSpApiCreateReportOutput> {
		const marketplaceIds = requireMarketplaceIds(
			input.marketplace_ids,
			this.#auth.marketplace_ids,
			'Amazon SP-API createReport'
		)
		const body: Record<string, unknown> = {
			reportType: input.report_type,
			marketplaceIds,
			...(input.data_start_time && { dataStartTime: input.data_start_time }),
			...(input.data_end_time && { dataEndTime: input.data_end_time }),
			...(input.report_options && { reportOptions: input.report_options })
		}
		const { data } = await this.#spPost('/reports/2021-06-30/reports', 'Amazon SP-API createReport', body)
		return parseCreateReportPayload(data)
	}

	/** GET /reports/2021-06-30/reports/{reportId} */
	async getReport(input: AmazonSpApiGetReportInput): Promise<AmazonSpApiGetReportOutput> {
		const { data } = await this.#spGet(
			`/reports/2021-06-30/reports/${encodeURIComponent(input.report_id)}`,
			'Amazon SP-API getReport'
		)
		return { report: parseGetReportPayload(data) }
	}

	/** GET /reports/2021-06-30/reports */
	async listReports(input: AmazonSpApiListReportsInput): Promise<AmazonSpApiListReportsOutput> {
		const parsedInput = amazonSpApiListReportsInputSchema.safeParse(input)
		if (!parsedInput.success) {
			throw new ToolError('Invalid Amazon SP-API listReports input', {
				code: 'bad_input',
				details: { issues: parsedInput.error.issues.map((issue) => issue.message) }
			})
		}
		const page =
			'cursor' in parsedInput.data
				? await this.listReportsPage({ next_token: parsedInput.data.cursor })
				: await this.listReportsPage({
						report_types: parsedInput.data.report_types,
						...(parsedInput.data.processing_statuses && {
							processing_statuses: parsedInput.data.processing_statuses
						}),
						...(parsedInput.data.marketplace_ids && { marketplace_ids: parsedInput.data.marketplace_ids }),
						...(parsedInput.data.page_size !== undefined && { page_size: parsedInput.data.page_size }),
						...(parsedInput.data.created_since && { created_since: parsedInput.data.created_since }),
						...(parsedInput.data.created_until && { created_until: parsedInput.data.created_until })
					})
		return {
			items: page.items.map(parseReport),
			truncated: Boolean(page.next_token),
			...(page.next_token && { next_cursor: page.next_token })
		}
	}

	/** One GET /reports/2021-06-30/reports request. Continuations send only nextToken. */
	async listReportsPage(input: AmazonSpApiListReportsPageInput): Promise<AmazonSpApiListReportsPageOutput> {
		const parsedInput = amazonSpApiListReportsPageInputSchema.safeParse(input)
		if (!parsedInput.success) {
			throw new ToolError('Invalid Amazon SP-API reports page input', {
				code: 'bad_input',
				details: { issues: parsedInput.error.issues.map((issue) => issue.message) }
			})
		}
		let query: Record<string, string | number | boolean | undefined>
		if ('next_token' in parsedInput.data) {
			query = { nextToken: parsedInput.data.next_token }
		} else {
			const marketplaceIds = parsedInput.data.marketplace_ids ?? this.#auth.marketplace_ids
			query = {
				reportTypes: parsedInput.data.report_types.join(','),
				...(parsedInput.data.processing_statuses && {
					processingStatuses: parsedInput.data.processing_statuses.join(',')
				}),
				...(marketplaceIds && { marketplaceIds: marketplaceIds.join(',') }),
				...(parsedInput.data.page_size !== undefined && { pageSize: parsedInput.data.page_size }),
				...(parsedInput.data.created_since && { createdSince: parsedInput.data.created_since }),
				...(parsedInput.data.created_until && { createdUntil: parsedInput.data.created_until })
			}
		}
		const result = await this.#spGet('/reports/2021-06-30/reports', 'Amazon SP-API listReportsPage', query)
		return parseListReportsPagePayload(result.data, result.headers)
	}

	/** GET /reports/2021-06-30/documents/{reportDocumentId} */
	async getReportDocument(input: AmazonSpApiGetReportDocumentInput): Promise<AmazonSpApiGetReportDocumentOutput> {
		const { data } = await this.#spGet(
			`/reports/2021-06-30/documents/${encodeURIComponent(input.report_document_id)}`,
			'Amazon SP-API getReportDocument'
		)
		return parseReportDocumentPayload(data)
	}

	/** Resolve and privately download an Amazon report document by id. */
	async downloadReportDocumentBytes(
		input: AmazonSpApiDownloadReportDocumentBytesInput
	): Promise<AmazonSpApiDownloadReportDocumentBytesOutput> {
		const parsedInput = amazonSpApiDownloadReportDocumentBytesInputSchema.safeParse(input)
		if (!parsedInput.success) {
			throw new ToolError('Invalid Amazon report document download input', {
				code: 'bad_input',
				details: { issues: parsedInput.error.issues.map((issue) => issue.message) }
			})
		}
		const document = await this.getReportDocument({ report_document_id: parsedInput.data.report_document_id })
		return this.#downloadReportDocumentDescriptor(document, parsedInput.data.max_bytes)
	}

	async #downloadReportDocumentDescriptor(
		document: AmazonSpApiGetReportDocumentOutput,
		maxBytes: number
	): Promise<AmazonSpApiDownloadReportDocumentBytesOutput> {
		let compressionAlgorithm: 'GZIP' | undefined
		if (document.compression_algorithm) {
			if (document.compression_algorithm.toUpperCase() !== 'GZIP') {
				throw new ToolError(`Unsupported Amazon report compression: ${document.compression_algorithm}`, {
					code: 'unsupported'
				})
			}
			compressionAlgorithm = 'GZIP'
		}
		const result = await this.#download.bytes('GET', document.url, {
			label: 'Amazon SP-API report document',
			maxBytes
		})
		const bytes = decompressReportDocumentBytes(result.bytes, compressionAlgorithm, maxBytes)
		const contentType = result.headers.get('content-type') ?? undefined
		const contentEncoding = result.headers.get('content-encoding') ?? undefined
		return {
			bytes,
			text: bytesToUtf8(bytes),
			byte_length: bytes.byteLength,
			...(contentType && { content_type: contentType }),
			...(contentEncoding && { content_encoding: contentEncoding }),
			...(compressionAlgorithm && { compression_algorithm: compressionAlgorithm })
		}
	}

	/**
	 * Composite: newest DONE Flat File V2 settlement report (or `report_id`) →
	 * one document download → eight summary fields in safe integer cents.
	 * Never returns raw TSV rows, order ids, skus, or document URLs.
	 */
	async getSettlementSummary(
		input: AmazonSpApiGetSettlementSummaryInput = {}
	): Promise<AmazonSpApiGetSettlementSummaryOutput> {
		const reportDocumentId = await this.#resolveSettlementReportDocumentId(input)
		const doc = await this.getReportDocument({ report_document_id: reportDocumentId })
		// Download uses absolute URL from Amazon; do not put URL in errors downstream.
		const { bytes } = await this.#download.bytes('GET', doc.url, {
			label: 'Amazon SP-API settlement document',
			maxBytes: SETTLEMENT_MAX_COMPRESSED_BYTES
		})
		return summarizeSettlementDocument(bytes, doc.compression_algorithm)
	}

	async #resolveSettlementReportDocumentId(input: AmazonSpApiGetSettlementSummaryInput): Promise<string> {
		if (input.report_id) {
			const { report } = await this.getReport({ report_id: input.report_id })
			if (report.processing_status && report.processing_status !== 'DONE') {
				throw new ToolError('Settlement report is not DONE', {
					code: 'bad_input',
					details: { processing_status: report.processing_status }
				})
			}
			if (!report.report_document_id) {
				throw new ToolError('Settlement report has no document id', { code: 'upstream' })
			}
			return report.report_document_id
		}

		const createdSince = input.created_since ?? settlementCreatedSinceIso()
		// Drain a few list pages; Amazon returns newest first for this endpoint.
		let cursor: string | undefined
		for (let page = 0; page < 5; page += 1) {
			const listed = cursor
				? await this.listReports({ cursor })
				: await this.listReports({
						report_types: [SETTLEMENT_REPORT_TYPE_V2],
						processing_statuses: ['DONE'],
						created_since: createdSince,
						page_size: 100
					})
			for (const report of listed.items) {
				if (report.report_document_id) {
					return report.report_document_id
				}
			}
			if (!listed.next_cursor) break
			cursor = listed.next_cursor
		}

		throw new ToolError('No completed settlement report found in the retention window', {
			code: 'not_found'
		})
	}

	/** GET /catalog/2022-04-01/items */
	async searchCatalogItems(input: AmazonSpApiSearchCatalogItemsInput): Promise<AmazonSpApiSearchCatalogItemsOutput> {
		const marketplaceIds = requireMarketplaceIds(
			input.marketplace_ids,
			this.#auth.marketplace_ids,
			'Amazon SP-API searchCatalogItems'
		)
		const { data } = await this.#spGet('/catalog/2022-04-01/items', 'Amazon SP-API searchCatalogItems', {
			keywords: input.keywords.join(','),
			marketplaceIds: marketplaceIds.join(','),
			...(input.included_data &&
				input.included_data.length > 0 && {
					includedData: input.included_data.join(',')
				}),
			...(input.page_size !== undefined && { pageSize: input.page_size }),
			...(input.cursor && { pageToken: input.cursor })
		})
		const parsed = parseSearchCatalogItemsPayload(data)
		return {
			items: parsed.items,
			truncated: Boolean(parsed.nextToken),
			...(parsed.numberOfResults !== undefined && { number_of_results: parsed.numberOfResults }),
			...(parsed.nextToken && { next_cursor: parsed.nextToken })
		}
	}
}
