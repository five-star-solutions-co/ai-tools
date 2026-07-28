/**
 * Amazon Selling Partner API vendor client.
 * Host: `new AmazonSpApiClient(auth)`. Agent tools: `fromContext(ctx)`.
 *
 * LWA refresh → access token; SP-API calls use AwsService (SigV4 execute-api)
 * plus x-amz-access-token.
 */

import { ToolError } from '../../core/errors'
import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import { AwsService } from '../../transport/aws-service'
import { HttpService } from '../../transport/http-service'
import type { HttpServiceOptions } from '../../transport/http-service'
import type {
	AmazonSpApiAuth,
	AmazonSpApiCreateReportInput,
	AmazonSpApiCreateReportOutput,
	AmazonSpApiGetOrderInput,
	AmazonSpApiGetOrderItemsInput,
	AmazonSpApiGetOrderItemsOutput,
	AmazonSpApiGetOrderOutput,
	AmazonSpApiGetReportDocumentInput,
	AmazonSpApiGetReportDocumentOutput,
	AmazonSpApiGetReportInput,
	AmazonSpApiGetReportOutput,
	AmazonSpApiListInventorySummariesInput,
	AmazonSpApiListInventorySummariesOutput,
	AmazonSpApiListOrdersInput,
	AmazonSpApiListOrdersOutput,
	AmazonSpApiListReportsInput,
	AmazonSpApiListReportsOutput,
	AmazonSpApiSearchCatalogItemsInput,
	AmazonSpApiSearchCatalogItemsOutput,
	AmazonSpApiSearchOrdersInput,
	AmazonSpApiSearchOrdersOutput
} from './contracts'
import { amazonSpApiAuthSchema } from './contracts'
import {
	LWA_TOKEN_URL,
	lwaTokenBody,
	parseCreateReportPayload,
	parseGetReportPayload,
	parseInventoryPayload,
	parseListReportsPayload,
	parseLwaAccessToken,
	parseOrderItemsPayload,
	parseOrderPayload,
	parseOrdersPayload,
	parseReportDocumentPayload,
	parseSearchCatalogItemsPayload,
	parseSearchOrdersPayload,
	requireMarketplaceIds
} from './domain'

export type AmazonSpApiClientOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'>

export class AmazonSpApiClient {
	readonly #auth: AmazonSpApiAuth
	readonly #lwa: HttpService
	readonly #api: AwsService
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
		this.#api = new AwsService({
			...options,
			accessKeyId: this.#auth.access_key_id,
			secretAccessKey: this.#auth.secret_access_key,
			region: this.#auth.region,
			service: 'execute-api',
			baseURL: this.#auth.endpoint,
			label: 'Amazon SP-API',
			...(this.#auth.session_token && { sessionToken: this.#auth.session_token })
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
		if (this.#accessToken && now < this.#accessTokenExpiresAt - 60_000) {
			return this.#accessToken
		}
		const { data } = await this.#lwa.post(LWA_TOKEN_URL, lwaTokenBody(this.#auth), {
			label: 'Amazon LWA token',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
		})
		const token = parseLwaAccessToken(data)
		this.#accessToken = token
		// LWA tokens last ~1h; refresh early without relying on expires_in type noise
		this.#accessTokenExpiresAt = now + 3_000_000
		return token
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
		const { data } = await this.#spGet('/fba/inventory/v1/summaries', 'Amazon SP-API listInventorySummaries', {
			details: true,
			granularityType: 'Marketplace',
			granularityId: marketplaceId,
			marketplaceIds: marketplaceId,
			...(input.seller_skus && input.seller_skus.length > 0 && { sellerSkus: input.seller_skus.join(',') }),
			...(input.start_date_time && { startDateTime: input.start_date_time }),
			...(input.cursor && { nextToken: input.cursor })
		})
		const parsed = parseInventoryPayload(data)
		return {
			items: parsed.items,
			truncated: Boolean(parsed.nextToken),
			...(parsed.nextToken && { next_cursor: parsed.nextToken })
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
	async listReports(input: AmazonSpApiListReportsInput = {}): Promise<AmazonSpApiListReportsOutput> {
		const marketplaceIds = input.marketplace_ids ?? this.#auth.marketplace_ids
		const { data } = await this.#spGet('/reports/2021-06-30/reports', 'Amazon SP-API listReports', {
			...(input.report_types &&
				input.report_types.length > 0 && {
					reportTypes: input.report_types.join(',')
				}),
			...(input.processing_statuses &&
				input.processing_statuses.length > 0 && {
					processingStatuses: input.processing_statuses.join(',')
				}),
			...(marketplaceIds && marketplaceIds.length > 0 && { marketplaceIds: marketplaceIds.join(',') }),
			...(input.page_size !== undefined && { pageSize: input.page_size }),
			...(input.created_since && { createdSince: input.created_since }),
			...(input.created_until && { createdUntil: input.created_until }),
			...(input.cursor && { nextToken: input.cursor })
		})
		const parsed = parseListReportsPayload(data)
		return {
			items: parsed.items,
			truncated: Boolean(parsed.nextToken),
			...(parsed.nextToken && { next_cursor: parsed.nextToken })
		}
	}

	/** GET /reports/2021-06-30/documents/{reportDocumentId} */
	async getReportDocument(input: AmazonSpApiGetReportDocumentInput): Promise<AmazonSpApiGetReportDocumentOutput> {
		const { data } = await this.#spGet(
			`/reports/2021-06-30/documents/${encodeURIComponent(input.report_document_id)}`,
			'Amazon SP-API getReportDocument'
		)
		return parseReportDocumentPayload(data)
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
