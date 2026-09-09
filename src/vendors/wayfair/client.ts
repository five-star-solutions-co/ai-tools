/**
 * Wayfair Supplier production client.
 * Host: `new WayfairClient(auth)`. Agent tools: `fromContext(ctx)`.
 */

import { isPlainObject } from 'es-toolkit'
import { z } from 'zod'
import type { output, ZodType } from 'zod'

import { ToolError } from '../../core/errors'
import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import { HttpService } from '../../transport/http-service'
import type { HttpServiceOptions } from '../../transport/http-service'
import type {
	WayfairAcceptDropshipOrderInput,
	WayfairAuth,
	WayfairConfirmCancellationRequestsInput,
	WayfairDropshipOrderDetails,
	WayfairGetDropshipOrderInput,
	WayfairListCatalogPageInput,
	WayfairListCatalogPageOutput,
	WayfairListDropshipOrdersInput,
	WayfairListDropshipOrdersOutput,
	WayfairListCancellationRequestsByOrdersInput,
	WayfairListCancellationRequestsByWarehousesInput,
	WayfairListCancellationRequestsOutput,
	WayfairRejectCancellationRequestsInput,
	WayfairRespondCancellationRequestsOutput,
	WayfairSendShipmentNoticeInput,
	WayfairTransactionStatus
} from './contracts'
import {
	wayfairAcceptDropshipOrderInputSchema,
	wayfairAcceptDropshipOrderResponseSchema,
	wayfairAuthSchema,
	wayfairCatalogResponseSchema,
	wayfairCancellationRequestsByOrdersResponseSchema,
	wayfairCancellationRequestsByWarehousesResponseSchema,
	wayfairConfirmCancellationRequestsInputSchema,
	wayfairConfirmCancellationRequestsResponseSchema,
	wayfairDropshipPurchaseOrdersResponseSchema,
	wayfairGetDropshipOrderInputSchema,
	wayfairGetDropshipOrderResponseSchema,
	wayfairListCatalogPageInputSchema,
	wayfairListDropshipOrdersInputSchema,
	wayfairListCancellationRequestsByOrdersInputSchema,
	wayfairListCancellationRequestsByWarehousesInputSchema,
	wayfairRejectCancellationRequestsInputSchema,
	wayfairRejectCancellationRequestsResponseSchema,
	wayfairSendShipmentNoticeInputSchema,
	wayfairSendShipmentNoticeResponseSchema
} from './contracts'
import { acceptOrderVariables, shipmentNoticeVariables } from './domain'

const WAYFAIR_TOKEN_BASE = 'https://sso.auth.wayfair.com'
const WAYFAIR_SUPPLIER_BASE = 'https://api.wayfair.io'
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

const DROPSHIP_ORDER_DETAILS_QUERY = `
query DropshipOrderDetails($poNumber: String!) {
  getDropshipPurchaseOrders(poNumbers: [$poNumber], limit: 2) {
    id
    storePrefix
    poNumber
    poDate
    orderId
    supplierId
    estimatedShipDate
    scheduledDeliveryDate
    deliveryMethodCode
    customerName
    customerEmail
    salesChannelName
    orderType
    shippingInfo {
      shipSpeed
      carrierCode
      poolPointAgent { id name }
      crossDockAgent { id name }
      deliveryAgent { id name }
    }
    warehouse {
      id
      name
      address { name address1 address2 address3 city state country postalCode phoneNumber }
    }
    products {
      partNumber quantity price pieceCount totalCost name weight totalWeight
      estShipDate fillDate sku isCancelled isTscaCompliant
      twoDayGuaranteeDeliveryDeadline customComment
    }
    shipTo { name address1 address2 address3 city state country postalCode phoneNumber }
    billTo { name address1 address2 address3 city state country postalCode phoneNumber }
    billingInfo { vatNumber }
  }
}`

// Item arrays default to ten entries upstream; counts describe the complete transaction.
const TRANSACTION_FIELDS = `
  id handle status submittedAt completedAt
  itemCount errorCount errors { key message }
  completedCount completed { key message }
  processingCount processing { key message }
`

const ACCEPT_DROPSHIP_ORDER_MUTATION = `
mutation AcceptDropshipOrder(
  $poNumber: String!,
  $shipSpeed: ShipSpeed!,
  $lineItems: [AcceptedLineItemInput!]!
) {
  purchaseOrders {
    accept(poNumber: $poNumber, shipSpeed: $shipSpeed, lineItems: $lineItems) {
      ${TRANSACTION_FIELDS}
    }
  }
}`

const SHIPMENT_NOTICE_MUTATION = `
mutation SendShipmentNotice($notice: ShipNoticeInput!) {
  purchaseOrders {
    shipment(notice: $notice) {
      ${TRANSACTION_FIELDS}
    }
  }
}`

const CANCELLATION_REQUEST_FIELDS = `
  requestId status requestedAt
  cancellationReason { reason }
  purchaseOrder { poNumber warehouse { warehouseId } }
  cancelledProduct { partNumber cancellationQuantity { originalQuantity cancelledQuantity } }
`

const CANCELLATION_REQUESTS_BY_ORDERS_QUERY = `
query CancellationRequestsByOrders($poInput: LineItemCancellationRequestByPurchaseOrdersInput!) {
  lineItemCancellationRequestByPurchaseOrders(poInput: $poInput) {
    ${CANCELLATION_REQUEST_FIELDS}
  }
}`

const CANCELLATION_REQUESTS_BY_WAREHOUSES_QUERY = `
query CancellationRequestsByWarehouses($warehouseInput: LineItemCancellationRequestByWarehousesInput!) {
  lineItemCancellationRequestByWarehouses(warehouseInput: $warehouseInput) {
    ${CANCELLATION_REQUEST_FIELDS}
  }
}`

const CONFIRM_CANCELLATION_REQUESTS_MUTATION = `
mutation ConfirmCancellationRequests($confirmationInputs: [ConfirmLineItemCancellationRequestInput!]!) {
  confirmLineItemCancellationRequest(confirmationInputs: $confirmationInputs) {
    requestId status errorCode errorMessage
  }
}`

const REJECT_CANCELLATION_REQUESTS_MUTATION = `
mutation RejectCancellationRequests($rejectionInputs: [RejectLineItemCancellationRequestInput!]!) {
  rejectLineItemCancellationRequest(rejectionInputs: $rejectionInputs) {
    requestId status errorCode errorMessage
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

function assertOrderGraphqlResult(errors: readonly unknown[] | undefined, operation: string): void {
	if (errors?.length) {
		const categories = errors.map((error) =>
			isPlainObject(error) && isPlainObject(error['extensions']) ? error['extensions']['category'] : undefined
		)
		// Mutation errors may echo addresses or other submitted data. Do not expose those messages.
		throw new ToolError(`Wayfair Supplier ${operation} failed`, {
			code: categories.includes('PERMISSION_DENIED')
				? 'forbidden'
				: categories.includes('BAD_REQUEST')
					? 'bad_input'
					: 'upstream',
			details: { error_count: errors.length }
		})
	}
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
	readonly #supplierHttp: HttpService
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
		this.#supplierHttp = new HttpService({ ...options, baseURL: WAYFAIR_SUPPLIER_BASE, label: 'Wayfair Supplier' })
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
		const { data } = await this.#supplierHttp.post(
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

	/** One exact PO read, including the customer details required for fulfillment. Never acknowledges it. */
	async getDropshipOrder(input: WayfairGetDropshipOrderInput): Promise<WayfairDropshipOrderDetails> {
		const parsedInput = parseInput(wayfairGetDropshipOrderInputSchema, input, 'Invalid Wayfair purchase order input')
		const { data } = await this.#orderHttp.post(
			'/v1/graphql',
			{
				query: DROPSHIP_ORDER_DETAILS_QUERY,
				variables: { poNumber: parsedInput.po_number }
			},
			{ label: 'Wayfair Supplier getDropshipOrder', headers: await this.#headers() }
		)
		const response = parseResponse(
			wayfairGetDropshipOrderResponseSchema,
			data,
			'Wayfair Supplier returned invalid purchase order details'
		)
		assertOrderGraphqlResult(response.errors, 'getDropshipOrder')
		if (!response.data) throw new ToolError('Wayfair Supplier returned no order data', { code: 'upstream' })
		const items = response.data.getDropshipPurchaseOrders
		const order = items[0]
		if (!order) throw new ToolError('Wayfair purchase order was not found', { code: 'not_found' })
		if (items.length !== 1 || order.poNumber !== parsedInput.po_number) {
			throw new ToolError('Wayfair Supplier returned an unexpected purchase order', { code: 'upstream' })
		}
		return order
	}

	/** purchaseOrders.accept. Submission state and per-item errors are returned without optimistic success. */
	async acceptDropshipOrder(input: WayfairAcceptDropshipOrderInput): Promise<WayfairTransactionStatus> {
		const parsedInput = parseInput(
			wayfairAcceptDropshipOrderInputSchema,
			input,
			'Invalid Wayfair order acceptance input'
		)
		const { data } = await this.#orderHttp.post(
			'/v1/graphql',
			{
				query: ACCEPT_DROPSHIP_ORDER_MUTATION,
				variables: acceptOrderVariables(parsedInput)
			},
			{ label: 'Wayfair Supplier acceptDropshipOrder', headers: await this.#headers() }
		)
		const response = parseResponse(
			wayfairAcceptDropshipOrderResponseSchema,
			data,
			'Wayfair Supplier returned an invalid order acceptance'
		)
		assertOrderGraphqlResult(response.errors, 'acceptDropshipOrder')
		const transaction = response.data?.purchaseOrders?.accept
		if (!transaction) throw new ToolError('Wayfair Supplier returned no acceptance transaction', { code: 'upstream' })
		return transaction
	}

	/** purchaseOrders.shipment. Sends one ASN; never retries or treats submission as completed processing. */
	async sendShipmentNotice(input: WayfairSendShipmentNoticeInput): Promise<WayfairTransactionStatus> {
		const parsedInput = parseInput(wayfairSendShipmentNoticeInputSchema, input, 'Invalid Wayfair shipment notice input')
		const { data } = await this.#orderHttp.post(
			'/v1/graphql',
			{
				query: SHIPMENT_NOTICE_MUTATION,
				variables: shipmentNoticeVariables(parsedInput)
			},
			{ label: 'Wayfair Supplier sendShipmentNotice', headers: await this.#headers() }
		)
		const response = parseResponse(
			wayfairSendShipmentNoticeResponseSchema,
			data,
			'Wayfair Supplier returned an invalid shipment notice transaction'
		)
		assertOrderGraphqlResult(response.errors, 'sendShipmentNotice')
		const transaction = response.data?.purchaseOrders?.shipment
		if (!transaction) throw new ToolError('Wayfair Supplier returned no shipment transaction', { code: 'upstream' })
		return transaction
	}

	/** Retrieve requests for up to 50 POs without confirming or rejecting any request. */
	async listCancellationRequestsByOrders(
		input: WayfairListCancellationRequestsByOrdersInput
	): Promise<WayfairListCancellationRequestsOutput> {
		const parsedInput = parseInput(
			wayfairListCancellationRequestsByOrdersInputSchema,
			input,
			'Invalid Wayfair cancellation purchase order input'
		)
		const { data } = await this.#supplierHttp.post(
			'/v1/supplier-order-api/graphql',
			{
				query: CANCELLATION_REQUESTS_BY_ORDERS_QUERY,
				variables: { poInput: { poNumbers: parsedInput.po_numbers } }
			},
			{ label: 'Wayfair Supplier listCancellationRequestsByOrders', headers: await this.#headers() }
		)
		const response = parseResponse(
			wayfairCancellationRequestsByOrdersResponseSchema,
			data,
			'Wayfair Supplier returned invalid cancellation requests'
		)
		assertOrderGraphqlResult(response.errors, 'listCancellationRequestsByOrders')
		if (!response.data) throw new ToolError('Wayfair Supplier returned no cancellation data', { code: 'upstream' })
		return { items: response.data.lineItemCancellationRequestByPurchaseOrders }
	}

	/** One read for up to 50 warehouses, with an explicit status and optional date window. */
	async listCancellationRequestsByWarehouses(
		input: WayfairListCancellationRequestsByWarehousesInput
	): Promise<WayfairListCancellationRequestsOutput> {
		const parsedInput = parseInput(
			wayfairListCancellationRequestsByWarehousesInputSchema,
			input,
			'Invalid Wayfair cancellation warehouse input'
		)
		const { data } = await this.#supplierHttp.post(
			'/v1/supplier-order-api/graphql',
			{
				query: CANCELLATION_REQUESTS_BY_WAREHOUSES_QUERY,
				variables: {
					warehouseInput: {
						warehouseIds: parsedInput.warehouse_ids,
						status: parsedInput.status,
						...(parsedInput.from_datetime !== undefined && { fromDatetime: parsedInput.from_datetime }),
						...(parsedInput.to_datetime !== undefined && { toDatetime: parsedInput.to_datetime })
					}
				}
			},
			{ label: 'Wayfair Supplier listCancellationRequestsByWarehouses', headers: await this.#headers() }
		)
		const response = parseResponse(
			wayfairCancellationRequestsByWarehousesResponseSchema,
			data,
			'Wayfair Supplier returned invalid warehouse cancellation requests'
		)
		assertOrderGraphqlResult(response.errors, 'listCancellationRequestsByWarehouses')
		if (!response.data) throw new ToolError('Wayfair Supplier returned no cancellation data', { code: 'upstream' })
		return { items: response.data.lineItemCancellationRequestByWarehouses }
	}

	/** One native batch, preserving SUCCESS/FAILURE for each request. Never replays the mutation. */
	async confirmCancellationRequests(
		input: WayfairConfirmCancellationRequestsInput
	): Promise<WayfairRespondCancellationRequestsOutput> {
		const parsedInput = parseInput(
			wayfairConfirmCancellationRequestsInputSchema,
			input,
			'Invalid Wayfair cancellation confirmation input'
		)
		const { data } = await this.#supplierHttp.post(
			'/v1/supplier-order-api/graphql',
			{
				query: CONFIRM_CANCELLATION_REQUESTS_MUTATION,
				variables: { confirmationInputs: parsedInput.request_ids.map((requestId) => ({ requestId })) }
			},
			{ label: 'Wayfair Supplier confirmCancellationRequests', headers: await this.#headers() }
		)
		const response = parseResponse(
			wayfairConfirmCancellationRequestsResponseSchema,
			data,
			'Wayfair Supplier returned invalid cancellation confirmations'
		)
		assertOrderGraphqlResult(response.errors, 'confirmCancellationRequests')
		if (!response.data)
			throw new ToolError('Wayfair Supplier returned no cancellation response data', { code: 'upstream' })
		return { items: response.data.confirmLineItemCancellationRequest }
	}

	/** Reject up to 100 pending cancellation requests, each with an explicit reason. */
	async rejectCancellationRequests(
		input: WayfairRejectCancellationRequestsInput
	): Promise<WayfairRespondCancellationRequestsOutput> {
		const parsedInput = parseInput(
			wayfairRejectCancellationRequestsInputSchema,
			input,
			'Invalid Wayfair cancellation rejection input'
		)
		const { data } = await this.#supplierHttp.post(
			'/v1/supplier-order-api/graphql',
			{
				query: REJECT_CANCELLATION_REQUESTS_MUTATION,
				variables: {
					rejectionInputs: parsedInput.requests.map((request) => ({
						requestId: request.request_id,
						reason: request.reason
					}))
				}
			},
			{ label: 'Wayfair Supplier rejectCancellationRequests', headers: await this.#headers() }
		)
		const response = parseResponse(
			wayfairRejectCancellationRequestsResponseSchema,
			data,
			'Wayfair Supplier returned invalid cancellation rejections'
		)
		assertOrderGraphqlResult(response.errors, 'rejectCancellationRequests')
		if (!response.data)
			throw new ToolError('Wayfair Supplier returned no cancellation response data', { code: 'upstream' })
		return { items: response.data.rejectLineItemCancellationRequest }
	}
}
