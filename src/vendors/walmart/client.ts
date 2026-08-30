/**
 * Walmart Marketplace US vendor client.
 * Host: `new WalmartClient(auth)`. Agent tools: `fromContext(ctx)`.
 */

import { z } from 'zod'
import type { output, ZodType } from 'zod'

import { ToolError } from '../../core/errors'
import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import { bytesToBase64, utf8ToBytes } from '../../shared/bytes'
import { HttpService } from '../../transport/http-service'
import type { HttpQueryValue, HttpServiceOptions } from '../../transport/http-service'
import type {
	WalmartAuth,
	WalmartDownloadReconReportBytesInput,
	WalmartDownloadReconReportBytesOutput,
	WalmartListItemsPageInput,
	WalmartListItemsPageOutput,
	WalmartListOrdersPageInput,
	WalmartListOrdersPageOutput,
	WalmartListReconReportDatesOutput,
	WalmartListReturnsPageInput,
	WalmartListReturnsPageOutput
} from './contracts'
import {
	walmartAuthSchema,
	walmartDownloadReconReportBytesInputSchema,
	walmartItemsResponseSchema,
	walmartListItemsPageInputSchema,
	walmartListOrdersPageInputSchema,
	walmartListReturnsPageInputSchema,
	walmartOrdersResponseSchema,
	walmartReconReportDatesResponseSchema,
	walmartReturnsResponseSchema
} from './contracts'

const WALMART_API_BASE = 'https://marketplace.walmartapis.com'
const WALMART_SERVICE_NAME = 'Walmart Marketplace'
const WALMART_MARKET = 'US'
const DEFAULT_ORDERS_LIMIT = 100
const DEFAULT_ITEMS_LIMIT = 20
const DEFAULT_RETURNS_LIMIT = 10

const walmartTokenResponseSchema = z.object({
	access_token: z.string().min(1),
	expires_in: z.coerce.number().int().positive()
})

export type WalmartClientOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'>

function parseInput<TSchema extends ZodType>(schema: TSchema, input: unknown, message: string): output<TSchema> {
	const parsed = schema.safeParse(input)
	if (!parsed.success) {
		throw new ToolError(message, {
			code: 'bad_input',
			details: { issues: parsed.error.issues.map((issue) => issue.message) }
		})
	}
	return parsed.data
}

function parseResponse<TSchema extends ZodType>(schema: TSchema, data: unknown, message: string): output<TSchema> {
	const parsed = schema.safeParse(data)
	if (!parsed.success) {
		throw new ToolError(message, {
			code: 'upstream',
			details: { issues: parsed.error.issues.map((issue) => issue.message) }
		})
	}
	return parsed.data
}

function basicAuthorization(auth: WalmartAuth): string {
	return `Basic ${bytesToBase64(utf8ToBytes(`${auth.client_id}:${auth.client_secret}`))}`
}

function pagePath(path: string, cursor: string | undefined): string {
	return cursor ? `${path}${cursor}` : path
}

export class WalmartClient {
	readonly #auth: WalmartAuth
	readonly #http: HttpService
	#accessToken: string | undefined
	#accessTokenExpiresAt = 0
	#accessTokenPromise: Promise<string> | undefined

	constructor(auth: WalmartAuth, options: WalmartClientOptions = {}) {
		const parsed = walmartAuthSchema.safeParse(auth)
		if (!parsed.success) {
			throw new ToolError('Invalid Walmart Marketplace auth credentials', {
				code: 'bad_auth',
				details: { issues: parsed.error.issues.map((issue) => issue.message) }
			})
		}
		this.#auth = parsed.data
		this.#http = new HttpService({
			...options,
			baseURL: WALMART_API_BASE,
			label: 'Walmart Marketplace'
		})
	}

	static fromContext(ctx: ToolContext): WalmartClient {
		const auth = requireAuth(ctx, walmartAuthSchema)
		return new WalmartClient(auth, {
			...(ctx.fetch && { fetch: ctx.fetch }),
			...(ctx.signal && { signal: ctx.signal })
		})
	}

	async #refreshAccessToken(): Promise<string> {
		const requestedAt = Date.now()
		const body = new URLSearchParams({ grant_type: 'client_credentials' })
		const { data } = await this.#http.post('/v3/token', body, {
			label: 'Walmart Marketplace token',
			headers: {
				Accept: 'application/json',
				Authorization: basicAuthorization(this.#auth),
				'Content-Type': 'application/x-www-form-urlencoded',
				'WM_QOS.CORRELATION_ID': crypto.randomUUID(),
				'WM_SVC.NAME': WALMART_SERVICE_NAME
			}
		})
		const token = parseResponse(
			walmartTokenResponseSchema,
			data,
			'Walmart Marketplace returned an invalid token response'
		)
		this.#accessToken = token.access_token
		this.#accessTokenExpiresAt = requestedAt + Math.max(0, token.expires_in * 1000 - 60_000)
		return token.access_token
	}

	async #ensureAccessToken(): Promise<string> {
		if (this.#accessToken && Date.now() < this.#accessTokenExpiresAt) return this.#accessToken

		const pending = this.#accessTokenPromise ?? this.#refreshAccessToken()
		this.#accessTokenPromise = pending
		try {
			return await pending
		} finally {
			if (this.#accessTokenPromise === pending) this.#accessTokenPromise = undefined
		}
	}

	async #headers(accept: string): Promise<Record<string, string>> {
		return {
			Accept: accept,
			WM_MARKET: WALMART_MARKET,
			'WM_QOS.CORRELATION_ID': crypto.randomUUID(),
			'WM_SEC.ACCESS_TOKEN': await this.#ensureAccessToken(),
			'WM_SVC.NAME': WALMART_SERVICE_NAME
		}
	}

	async #get(path: string, label: string, query?: Record<string, HttpQueryValue>) {
		return this.#http.get(path, {
			label,
			headers: await this.#headers('application/json'),
			...(query && { query })
		})
	}

	/** One GET /v3/orders request. Provider nextCursor fragments are appended verbatim on subsequent pages. */
	async listOrdersPage(input: WalmartListOrdersPageInput = {}): Promise<WalmartListOrdersPageOutput> {
		const parsedInput = parseInput(walmartListOrdersPageInputSchema, input, 'Invalid Walmart orders page input')
		const { data } = await this.#get(
			pagePath('/v3/orders', parsedInput.cursor),
			'Walmart Marketplace listOrdersPage',
			parsedInput.cursor
				? undefined
				: {
						limit: parsedInput.limit ?? DEFAULT_ORDERS_LIMIT,
						...(parsedInput.sku && { sku: parsedInput.sku }),
						...(parsedInput.customer_order_id && { customerOrderId: parsedInput.customer_order_id }),
						...(parsedInput.purchase_order_id && { purchaseOrderId: parsedInput.purchase_order_id }),
						...(parsedInput.status && { status: parsedInput.status }),
						...(parsedInput.created_start_date && { createdStartDate: parsedInput.created_start_date }),
						...(parsedInput.created_end_date && { createdEndDate: parsedInput.created_end_date }),
						...(parsedInput.expected_ship_start_date && {
							fromExpectedShipDate: parsedInput.expected_ship_start_date
						}),
						...(parsedInput.expected_ship_end_date && { toExpectedShipDate: parsedInput.expected_ship_end_date }),
						...(parsedInput.last_modified_start_date && {
							lastModifiedStartDate: parsedInput.last_modified_start_date
						}),
						...(parsedInput.last_modified_end_date && {
							lastModifiedEndDate: parsedInput.last_modified_end_date
						}),
						...(parsedInput.product_info !== undefined && { productInfo: parsedInput.product_info }),
						...(parsedInput.ship_node_type && { shipNodeType: parsedInput.ship_node_type }),
						...(parsedInput.shipping_program_type && {
							shippingProgramType: parsedInput.shipping_program_type
						}),
						...(parsedInput.replacement_info !== undefined && { replacementInfo: parsedInput.replacement_info }),
						...(parsedInput.order_type && { orderType: parsedInput.order_type }),
						...(parsedInput.incentive_info !== undefined && { incentiveInfo: parsedInput.incentive_info })
					}
		)
		const response = parseResponse(
			walmartOrdersResponseSchema,
			data,
			'Walmart Marketplace returned an invalid orders page'
		)
		const nextCursor = response.list.meta.nextCursor ?? undefined
		return {
			items: response.list.elements.order,
			total_count: response.list.meta.totalCount,
			limit: response.list.meta.limit,
			truncated: Boolean(nextCursor),
			...(nextCursor && { next_cursor: nextCursor })
		}
	}

	/** One GET /v3/items request. Cursor and offset are both exposed because Walmart's item cursor is reusable. */
	async listItemsPage(input: WalmartListItemsPageInput = {}): Promise<WalmartListItemsPageOutput> {
		const parsedInput = parseInput(walmartListItemsPageInputSchema, input, 'Invalid Walmart items page input')
		const offset = parsedInput.offset ?? 0
		const limit = parsedInput.limit ?? DEFAULT_ITEMS_LIMIT
		const { data } = await this.#get('/v3/items', 'Walmart Marketplace listItemsPage', {
			nextCursor: parsedInput.cursor ?? '*',
			offset,
			limit,
			...(parsedInput.cursor
				? {}
				: {
						...(parsedInput.sku && { sku: parsedInput.sku }),
						...(parsedInput.gtin && { gtin: parsedInput.gtin }),
						...(parsedInput.lifecycle_status && { lifecycleStatus: parsedInput.lifecycle_status }),
						...(parsedInput.published_status && { publishedStatus: parsedInput.published_status }),
						...(parsedInput.variant_group_id && { variantGroupId: parsedInput.variant_group_id }),
						...(parsedInput.condition && { condition: parsedInput.condition }),
						...(parsedInput.availability && { availability: parsedInput.availability }),
						...(parsedInput.show_duplicate_item_info !== undefined && {
							showDuplicateItemInfo: parsedInput.show_duplicate_item_info
						}),
						...(parsedInput.include_customer_favorites_status !== undefined && {
							includeCustomerFavoritesStatus: parsedInput.include_customer_favorites_status
						}),
						...(parsedInput.bundle_type && { bundleType: parsedInput.bundle_type })
					})
		})
		const response = parseResponse(
			walmartItemsResponseSchema,
			data,
			'Walmart Marketplace returned an invalid items page'
		)
		const nextOffset = offset + response.items.length
		const truncated = nextOffset < response.total_items
		const nextCursor = response.next_cursor ?? undefined
		return {
			items: response.items,
			total_count: response.total_items,
			offset,
			limit,
			truncated,
			...(nextCursor && { next_cursor: nextCursor }),
			...(truncated && { next_offset: nextOffset })
		}
	}

	/** One GET /v3/returns request. Provider nextCursor fragments are appended verbatim on subsequent pages. */
	async listReturnsPage(input: WalmartListReturnsPageInput = {}): Promise<WalmartListReturnsPageOutput> {
		const parsedInput = parseInput(walmartListReturnsPageInputSchema, input, 'Invalid Walmart returns page input')
		const { data } = await this.#get(
			pagePath('/v3/returns', parsedInput.cursor),
			'Walmart Marketplace listReturnsPage',
			parsedInput.cursor
				? undefined
				: {
						limit: parsedInput.limit ?? DEFAULT_RETURNS_LIMIT,
						...(parsedInput.return_order_id && { returnOrderId: parsedInput.return_order_id }),
						...(parsedInput.customer_order_id && { customerOrderId: parsedInput.customer_order_id }),
						...(parsedInput.status && { status: parsedInput.status }),
						...(parsedInput.replacement_info !== undefined && { replacementInfo: parsedInput.replacement_info }),
						...(parsedInput.return_type && { returnType: parsedInput.return_type }),
						...(parsedInput.is_wfs_enabled !== undefined && {
							isWFSEnabled: parsedInput.is_wfs_enabled ? 'Y' : 'N'
						}),
						...(parsedInput.return_creation_start_date && {
							returnCreationStartDate: parsedInput.return_creation_start_date
						}),
						...(parsedInput.return_creation_end_date && {
							returnCreationEndDate: parsedInput.return_creation_end_date
						}),
						...(parsedInput.return_last_modified_start_date && {
							returnLastModifiedStartDate: parsedInput.return_last_modified_start_date
						}),
						...(parsedInput.return_last_modified_end_date && {
							returnLastModifiedEndDate: parsedInput.return_last_modified_end_date
						})
					}
		)
		const response = parseResponse(
			walmartReturnsResponseSchema,
			data,
			'Walmart Marketplace returned an invalid returns page'
		)
		const nextCursor = response.meta.nextCursor ?? undefined
		return {
			items: response.returnOrders,
			total_count: response.meta.totalCount,
			limit: response.meta.limit,
			truncated: Boolean(nextCursor),
			...(nextCursor && { next_cursor: nextCursor })
		}
	}

	/** GET /v3/report/reconreport/availableReconFiles?reportVersion=v1. */
	async listReconReportDates(): Promise<WalmartListReconReportDatesOutput> {
		const { data } = await this.#get(
			'/v3/report/reconreport/availableReconFiles',
			'Walmart Marketplace listReconReportDates',
			{ reportVersion: 'v1' }
		)
		const response = parseResponse(
			walmartReconReportDatesResponseSchema,
			data,
			'Walmart Marketplace returned invalid recon report dates'
		)
		return { dates: response.availableApReportDates }
	}

	/** Host-facing raw recon report bytes. The caller may set max_bytes; no package-owned cap is imposed. */
	async downloadReconReportBytes(
		input: WalmartDownloadReconReportBytesInput
	): Promise<WalmartDownloadReconReportBytesOutput> {
		const parsedInput = parseInput(
			walmartDownloadReconReportBytesInputSchema,
			input,
			'Invalid Walmart recon report input'
		)
		const result = await this.#http.bytes('GET', '/v3/report/reconreport/reconFile', {
			label: 'Walmart Marketplace downloadReconReportBytes',
			headers: await this.#headers('application/octet-stream'),
			query: { reportDate: parsedInput.report_date, reportVersion: 'v1' },
			...(parsedInput.max_bytes !== undefined && { maxBytes: parsedInput.max_bytes })
		})
		return {
			report_date: parsedInput.report_date,
			content_type: result.headers.get('content-type'),
			byte_length: result.bytes.byteLength,
			bytes: result.bytes
		}
	}
}
