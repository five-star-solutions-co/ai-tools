/**
 * Wayfair Supplier production read client.
 * Host: `new WayfairClient(auth)`. Agent tools: `fromContext(ctx)`.
 */

import { z } from 'zod'
import type { output, ZodType } from 'zod'

import { ToolError } from '../../core/errors'
import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import { HttpService } from '../../transport/http-service'
import type { HttpServiceOptions } from '../../transport/http-service'
import type {
	WayfairAuth,
	WayfairListCatalogPageInput,
	WayfairListCatalogPageOutput,
	WayfairListDropshipOrdersInput,
	WayfairListDropshipOrdersOutput
} from './contracts'
import {
	wayfairAuthSchema,
	wayfairCatalogResponseSchema,
	wayfairDropshipPurchaseOrdersResponseSchema,
	wayfairListCatalogPageInputSchema,
	wayfairListDropshipOrdersInputSchema
} from './contracts'

const WAYFAIR_TOKEN_BASE = 'https://sso.auth.wayfair.com'
const WAYFAIR_CATALOG_BASE = 'https://api.wayfair.io'
const WAYFAIR_ORDER_BASE = 'https://api.wayfair.com'
const WAYFAIR_AUDIENCE = 'https://api.wayfair.com/'
const DEFAULT_CATALOG_PAGE_SIZE = 25
const DEFAULT_ORDER_LIMIT = 100

const wayfairTokenResponseSchema = z.object({
	access_token: z.string().min(1),
	expires_in: z.coerce.number().int().positive()
})

const SUPPLIER_CATALOG_QUERY = `
query SupplierCatalog($supplierId: Int!, $paginationOptions: PaginationOptions) {
  supplierCatalog(supplierId: $supplierId, paginationOptions: $paginationOptions) {
    supplierId
    pageInfo {
      page
      pageSize
      hasNextPage
      totalPages
    }
    products {
      productId
      upc
      supplierPartNumber
      status
      skus {
        sku
        productName
        className
        classId
        status
        isLive
        collectionName
        displaySku
        minimumOrderQuantity
      }
    }
  }
}`

export type WayfairClientOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'>

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

function graphqlError(message: string, issues: readonly string[]): never {
	throw new ToolError(message, { code: 'upstream', details: { issues } })
}

function graphqlString(value: string): string {
	return JSON.stringify(value)
}

function dropshipPurchaseOrdersQuery(input: {
	limit: number
	from_date?: string
	has_response?: boolean
	po_numbers?: string[]
	sort_order: 'ASC' | 'DESC'
}): string {
	const argumentsList = [`limit: ${input.limit}`, `sortOrder: ${input.sort_order}`]
	if (input.from_date) argumentsList.push(`fromDate: ${graphqlString(input.from_date)}`)
	if (input.has_response !== undefined) argumentsList.push(`hasResponse: ${input.has_response}`)
	if (input.po_numbers) {
		argumentsList.push(`poNumbers: [${input.po_numbers.map(graphqlString).join(', ')}]`)
	}

	return `
query DropshipPurchaseOrders {
  getDropshipPurchaseOrders(${argumentsList.join(', ')}) {
    id
    poNumber
    poDate
    orderId
    estimatedShipDate
    salesChannelName
    orderType
    warehouse { id }
    products { partNumber quantity }
  }
}`
}

export class WayfairClient {
	readonly #auth: WayfairAuth
	readonly #tokenHttp: HttpService
	readonly #catalogHttp: HttpService
	readonly #orderHttp: HttpService
	#accessToken: string | undefined
	#accessTokenExpiresAt = 0
	#accessTokenPromise: Promise<string> | undefined

	constructor(auth: WayfairAuth, options: WayfairClientOptions = {}) {
		const parsed = wayfairAuthSchema.safeParse(auth)
		if (!parsed.success) {
			throw new ToolError('Invalid Wayfair Supplier auth credentials', {
				code: 'bad_auth',
				details: { issues: parsed.error.issues.map((issue) => issue.message) }
			})
		}
		this.#auth = parsed.data
		this.#tokenHttp = new HttpService({ ...options, baseURL: WAYFAIR_TOKEN_BASE, label: 'Wayfair Supplier' })
		this.#catalogHttp = new HttpService({ ...options, baseURL: WAYFAIR_CATALOG_BASE, label: 'Wayfair Supplier' })
		this.#orderHttp = new HttpService({ ...options, baseURL: WAYFAIR_ORDER_BASE, label: 'Wayfair Supplier' })
	}

	static fromContext(ctx: ToolContext): WayfairClient {
		const auth = requireAuth(ctx, wayfairAuthSchema)
		return new WayfairClient(auth, {
			...(ctx.fetch && { fetch: ctx.fetch }),
			...(ctx.signal && { signal: ctx.signal })
		})
	}

	async #refreshAccessToken(): Promise<string> {
		const requestedAt = Date.now()
		const { data } = await this.#tokenHttp.post(
			'/oauth/token',
			{
				grant_type: 'client_credentials',
				client_id: this.#auth.client_id,
				client_secret: this.#auth.client_secret,
				audience: WAYFAIR_AUDIENCE
			},
			{ label: 'Wayfair Supplier token', headers: { 'Content-Type': 'application/json' } }
		)
		const token = parseResponse(wayfairTokenResponseSchema, data, 'Wayfair Supplier returned an invalid token response')
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

	async #headers(): Promise<Record<string, string>> {
		return {
			Accept: 'application/json',
			Authorization: `Bearer ${await this.#ensureAccessToken()}`,
			'Content-Type': 'application/json'
		}
	}

	/** One supplier catalog page. Wayfair accepts page sizes 10, 20, or 25. */
	async listCatalogPage(input: WayfairListCatalogPageInput = {}): Promise<WayfairListCatalogPageOutput> {
		const parsedInput = parseInput(wayfairListCatalogPageInputSchema, input, 'Invalid Wayfair catalog page input')
		const page = parsedInput.page ?? 1
		const pageSize = parsedInput.page_size ?? DEFAULT_CATALOG_PAGE_SIZE
		const { data } = await this.#catalogHttp.post(
			'/v1/supplier-catalog-api/graphql',
			{
				query: SUPPLIER_CATALOG_QUERY,
				variables: {
					supplierId: this.#auth.supplier_id,
					paginationOptions: { page, pageSize }
				}
			},
			{
				label: 'Wayfair Supplier listCatalogPage',
				headers: {
					...(await this.#headers()),
					'X-SELECTED-SUPPLIER-ID': String(this.#auth.supplier_id)
				}
			}
		)
		const response = parseResponse(
			wayfairCatalogResponseSchema,
			data,
			'Wayfair Supplier returned an invalid catalog page'
		)
		if (response.errors?.length) {
			graphqlError(
				'Wayfair Supplier catalog query failed',
				response.errors.map((error) => error.message)
			)
		}
		if (!response.data) graphqlError('Wayfair Supplier returned no catalog data', [])
		const catalog = response.data.supplierCatalog
		return {
			items: catalog.products,
			page: catalog.pageInfo.page,
			page_size: catalog.pageInfo.pageSize,
			total_pages: catalog.pageInfo.totalPages,
			has_next_page: catalog.pageInfo.hasNextPage
		}
	}

	/** One bounded read of production dropship purchase orders. Customer PII is not selected. */
	async listDropshipOrders(input: WayfairListDropshipOrdersInput = {}): Promise<WayfairListDropshipOrdersOutput> {
		const parsedInput = parseInput(
			wayfairListDropshipOrdersInputSchema,
			input,
			'Invalid Wayfair dropship purchase orders input'
		)
		const limit = parsedInput.limit ?? DEFAULT_ORDER_LIMIT
		const { data } = await this.#orderHttp.post(
			'/v1/graphql',
			{
				query: dropshipPurchaseOrdersQuery({
					limit,
					sort_order: parsedInput.sort_order ?? 'ASC',
					...(parsedInput.from_date && { from_date: parsedInput.from_date }),
					...(parsedInput.has_response !== undefined && { has_response: parsedInput.has_response }),
					...(parsedInput.po_numbers && { po_numbers: parsedInput.po_numbers })
				})
			},
			{ label: 'Wayfair Supplier listDropshipOrders', headers: await this.#headers() }
		)
		const response = parseResponse(
			wayfairDropshipPurchaseOrdersResponseSchema,
			data,
			'Wayfair Supplier returned invalid dropship purchase orders'
		)
		if (response.errors?.length) {
			graphqlError(
				'Wayfair Supplier dropship purchase orders query failed',
				response.errors.map((error) => error.message)
			)
		}
		if (!response.data) graphqlError('Wayfair Supplier returned no dropship purchase order data', [])
		const items = response.data.getDropshipPurchaseOrders
		return { items, limit, limit_reached: items.length === limit }
	}
}
