/**
 * Amazon SP-API: LWA body, order/inventory/report/catalog parse (no HTTP).
 */

import { z } from 'zod'

import { ToolError } from '../../core/errors'
import type {
	AmazonSpApiCatalogItem,
	AmazonSpApiInventorySummary,
	AmazonSpApiInventoryPageOutput,
	AmazonSpApiListReportsPageOutput,
	AmazonSpApiLwaTokenResponse,
	AmazonSpApiOrder,
	AmazonSpApiOrderItem,
	AmazonSpApiReport,
	AmazonSpApiSearchOrder
} from './contracts'
import { amazonInventorySummaryRawSchema, amazonReportRawSchema, amazonSpApiLwaTokenResponseSchema } from './contracts'

export const LWA_TOKEN_URL = 'https://api.amazon.com/auth/o2/token'

const amazonMoneyRawSchema = z.looseObject({
	Amount: z.string().optional(),
	CurrencyCode: z.string().optional()
})

const amazonOrderRawSchema = z.looseObject({
	AmazonOrderId: z.string().min(1),
	OrderStatus: z.string().optional(),
	PurchaseDate: z.string().optional(),
	LastUpdateDate: z.string().optional(),
	MarketplaceId: z.string().optional(),
	OrderTotal: amazonMoneyRawSchema.optional(),
	FulfillmentChannel: z.string().optional()
})

const amazonOrdersResponseSchema = z.looseObject({
	payload: z.looseObject({
		Orders: z.array(amazonOrderRawSchema),
		NextToken: z.string().min(1).optional()
	})
})

const amazonSearchOrderRawSchema = z.looseObject({
	orderId: z.string().min(1),
	createdTime: z.string().optional(),
	fulfillment: z.looseObject({ fulfillmentStatus: z.string().optional() }).optional()
})

const amazonSearchOrdersRootSchema = z.looseObject({
	orders: z.array(amazonSearchOrderRawSchema),
	pagination: z.looseObject({ nextToken: z.string().min(1).optional() }).optional()
})

const amazonSearchOrdersWrappedResponseSchema = z.looseObject({ payload: amazonSearchOrdersRootSchema })

const amazonOrderItemRawSchema = z.looseObject({
	OrderItemId: z.string().min(1),
	ASIN: z.string().optional(),
	SellerSKU: z.string().optional(),
	Title: z.string().optional(),
	QuantityOrdered: z.number().optional(),
	QuantityShipped: z.number().optional(),
	ItemPrice: amazonMoneyRawSchema.optional()
})

const amazonOrderItemsResponseSchema = z.looseObject({
	payload: z.looseObject({
		AmazonOrderId: z.string().min(1),
		OrderItems: z.array(amazonOrderItemRawSchema),
		NextToken: z.string().min(1).optional()
	})
})

const amazonCatalogItemRawSchema = z.looseObject({
	asin: z.string().min(1),
	summaries: z
		.array(
			z.looseObject({
				itemName: z.string().optional(),
				brandName: z.string().optional(),
				marketplaceId: z.string().optional()
			})
		)
		.optional(),
	productTypes: z.array(z.looseObject({ productType: z.string().optional() })).optional()
})

const amazonCatalogSearchResponseSchema = z.looseObject({
	items: z.array(amazonCatalogItemRawSchema),
	numberOfResults: z.number().optional(),
	pagination: z.looseObject({ nextToken: z.string().min(1).optional() }).optional()
})

export function lwaTokenBody(auth: { client_id: string; client_secret: string; refresh_token: string }): string {
	const params = new URLSearchParams({
		grant_type: 'refresh_token',
		refresh_token: auth.refresh_token,
		client_id: auth.client_id,
		client_secret: auth.client_secret
	})
	return params.toString()
}

export function parseLwaTokenResponse(data: unknown): AmazonSpApiLwaTokenResponse {
	const parsed = amazonSpApiLwaTokenResponseSchema.safeParse(data)
	if (!parsed.success) {
		throw new ToolError('Amazon LWA returned an invalid token response', {
			code: 'bad_auth',
			details: { issues: parsed.error.issues.map((issue) => issue.message) }
		})
	}
	return parsed.data
}

export function parseOrder(value: unknown): AmazonSpApiOrder {
	const parsed = amazonOrderRawSchema.safeParse(value)
	if (!parsed.success) {
		throw new ToolError('Amazon SP-API returned an invalid order', { code: 'upstream' })
	}
	return {
		amazon_order_id: parsed.data.AmazonOrderId,
		...(parsed.data.OrderStatus && { order_status: parsed.data.OrderStatus }),
		...(parsed.data.PurchaseDate && { purchase_date: parsed.data.PurchaseDate }),
		...(parsed.data.LastUpdateDate && { last_update_date: parsed.data.LastUpdateDate }),
		...(parsed.data.MarketplaceId && { marketplace_id: parsed.data.MarketplaceId }),
		...(parsed.data.OrderTotal?.Amount && { order_total_amount: parsed.data.OrderTotal.Amount }),
		...(parsed.data.OrderTotal?.CurrencyCode && { order_total_currency: parsed.data.OrderTotal.CurrencyCode }),
		...(parsed.data.FulfillmentChannel && { fulfillment_channel: parsed.data.FulfillmentChannel })
	}
}

export function parseOrdersPayload(data: unknown): {
	items: AmazonSpApiOrder[]
	nextToken?: string
} {
	const parsed = amazonOrdersResponseSchema.safeParse(data)
	if (!parsed.success) {
		throw new ToolError('Amazon SP-API orders payload invalid', { code: 'upstream' })
	}
	return {
		items: parsed.data.payload.Orders.map(parseOrder),
		...(parsed.data.payload.NextToken && { nextToken: parsed.data.payload.NextToken })
	}
}

export function parseOrderPayload(data: unknown): AmazonSpApiOrder {
	const parsed = z.looseObject({ payload: amazonOrderRawSchema }).safeParse(data)
	if (!parsed.success) {
		throw new ToolError('Amazon SP-API get order payload invalid', { code: 'upstream' })
	}
	return parseOrder(parsed.data.payload)
}

/** Orders API v2026-01-01 SearchOrders — camelCase body, not v0 payload wrapper. */
export function parseSearchOrder(value: unknown): AmazonSpApiSearchOrder {
	const parsed = amazonSearchOrderRawSchema.safeParse(value)
	if (!parsed.success) {
		throw new ToolError('Amazon SP-API searchOrders returned an invalid order', { code: 'upstream' })
	}
	return {
		order_id: parsed.data.orderId,
		...(parsed.data.createdTime && { created_time: parsed.data.createdTime }),
		...(parsed.data.fulfillment?.fulfillmentStatus && {
			fulfillment_status: parsed.data.fulfillment.fulfillmentStatus
		})
	}
}

export function parseSearchOrdersPayload(data: unknown): {
	items: AmazonSpApiSearchOrder[]
	nextToken?: string
} {
	const wrapped = amazonSearchOrdersWrappedResponseSchema.safeParse(data)
	const direct = amazonSearchOrdersRootSchema.safeParse(data)
	const root = wrapped.success ? wrapped.data.payload : direct.success ? direct.data : undefined
	if (!root) {
		throw new ToolError('Amazon SP-API searchOrders payload invalid', { code: 'upstream' })
	}
	return {
		items: root.orders.map(parseSearchOrder),
		...(root.pagination?.nextToken && { nextToken: root.pagination.nextToken })
	}
}

export function parseOrderItem(value: unknown): AmazonSpApiOrderItem {
	const parsed = amazonOrderItemRawSchema.safeParse(value)
	if (!parsed.success) {
		throw new ToolError('Amazon SP-API returned an invalid order item', { code: 'upstream' })
	}
	return {
		order_item_id: parsed.data.OrderItemId,
		...(parsed.data.ASIN && { asin: parsed.data.ASIN }),
		...(parsed.data.SellerSKU && { seller_sku: parsed.data.SellerSKU }),
		...(parsed.data.Title && { title: parsed.data.Title }),
		...(parsed.data.QuantityOrdered !== undefined && { quantity_ordered: parsed.data.QuantityOrdered }),
		...(parsed.data.QuantityShipped !== undefined && { quantity_shipped: parsed.data.QuantityShipped }),
		...(parsed.data.ItemPrice?.Amount && { item_price_amount: parsed.data.ItemPrice.Amount }),
		...(parsed.data.ItemPrice?.CurrencyCode && { item_price_currency: parsed.data.ItemPrice.CurrencyCode })
	}
}

export function parseOrderItemsPayload(data: unknown): {
	amazon_order_id: string
	items: AmazonSpApiOrderItem[]
	nextToken?: string
} {
	const parsed = amazonOrderItemsResponseSchema.safeParse(data)
	if (!parsed.success) {
		throw new ToolError('Amazon SP-API order items payload invalid', { code: 'upstream' })
	}
	return {
		amazon_order_id: parsed.data.payload.AmazonOrderId,
		items: parsed.data.payload.OrderItems.map(parseOrderItem),
		...(parsed.data.payload.NextToken && { nextToken: parsed.data.payload.NextToken })
	}
}

export function parseInventorySummary(value: unknown): AmazonSpApiInventorySummary {
	const parsed = amazonInventorySummaryRawSchema.safeParse(value)
	if (!parsed.success) {
		throw new ToolError('Amazon SP-API returned an invalid inventory summary', {
			code: 'upstream',
			details: { issues: parsed.error.issues.map((issue) => issue.message) }
		})
	}
	return {
		...(parsed.data.sellerSku && { seller_sku: parsed.data.sellerSku }),
		...(parsed.data.asin && { asin: parsed.data.asin }),
		...(parsed.data.fnSku && { fn_sku: parsed.data.fnSku }),
		...(parsed.data.condition && { condition: parsed.data.condition }),
		...(parsed.data.totalQuantity !== undefined && { total_quantity: parsed.data.totalQuantity }),
		...(parsed.data.productName && { product_name: parsed.data.productName })
	}
}

const inventoryPageResponseSchema = z.looseObject({
	payload: z.looseObject({
		inventorySummaries: z.array(amazonInventorySummaryRawSchema)
	}),
	pagination: z.looseObject({ nextToken: z.string().min(1).optional() }).optional()
})

const optionalAmazonRateLimitSchema = z.coerce.number().positive()

export function parseAmazonResponseMetadata(headers: Headers): {
	rate_limit_per_second?: number
	request_id?: string
} {
	const rawRateLimit = headers.get('x-amzn-ratelimit-limit')
	let rateLimit: number | undefined
	if (rawRateLimit !== null) {
		const parsedRateLimit = optionalAmazonRateLimitSchema.safeParse(rawRateLimit)
		if (!parsedRateLimit.success) {
			throw new ToolError('Amazon SP-API returned an invalid rate-limit header', { code: 'upstream' })
		}
		rateLimit = parsedRateLimit.data
	}
	const requestId = headers.get('x-amzn-requestid') ?? headers.get('x-amzn-request-id') ?? undefined
	return {
		...(rateLimit !== undefined && { rate_limit_per_second: rateLimit }),
		...(requestId && { request_id: requestId })
	}
}

export function parseInventoryPagePayload(data: unknown, headers: Headers): AmazonSpApiInventoryPageOutput {
	const parsed = inventoryPageResponseSchema.safeParse(data)
	if (!parsed.success) {
		throw new ToolError('Amazon SP-API inventory page response invalid', {
			code: 'upstream',
			details: { issues: parsed.error.issues.map((issue) => issue.message) }
		})
	}
	return {
		items: parsed.data.payload.inventorySummaries,
		...(parsed.data.pagination?.nextToken && { next_token: parsed.data.pagination.nextToken }),
		...parseAmazonResponseMetadata(headers)
	}
}

export function parseInventoryPayload(data: unknown): {
	items: AmazonSpApiInventorySummary[]
	nextToken?: string
} {
	const page = parseInventoryPagePayload(data, new Headers())
	return { items: page.items.map(parseInventorySummary), ...(page.next_token && { nextToken: page.next_token }) }
}

export function parseCreateReportPayload(data: unknown): { report_id: string } {
	const parsed = z.looseObject({ reportId: z.string().min(1) }).safeParse(data)
	if (!parsed.success) {
		throw new ToolError('Amazon SP-API create report response invalid', { code: 'upstream' })
	}
	return { report_id: parsed.data.reportId }
}

export function parseReport(value: unknown): AmazonSpApiReport {
	const parsed = amazonReportRawSchema.safeParse(value)
	if (!parsed.success) {
		throw new ToolError('Amazon SP-API returned an invalid report', {
			code: 'upstream',
			details: { issues: parsed.error.issues.map((issue) => issue.message) }
		})
	}
	return {
		report_id: parsed.data.reportId,
		...(parsed.data.reportType && { report_type: parsed.data.reportType }),
		...(parsed.data.processingStatus && { processing_status: parsed.data.processingStatus }),
		...(parsed.data.marketplaceIds &&
			parsed.data.marketplaceIds.length > 0 && {
				marketplace_ids: parsed.data.marketplaceIds
			}),
		...(parsed.data.dataStartTime && { data_start_time: parsed.data.dataStartTime }),
		...(parsed.data.dataEndTime && { data_end_time: parsed.data.dataEndTime }),
		...(parsed.data.reportDocumentId && { report_document_id: parsed.data.reportDocumentId }),
		...(parsed.data.createdTime && { created_time: parsed.data.createdTime })
	}
}

export function parseGetReportPayload(data: unknown): AmazonSpApiReport {
	return parseReport(data)
}

export function parseListReportsPayload(data: unknown): {
	items: AmazonSpApiReport[]
	nextToken?: string
} {
	const page = parseListReportsPagePayload(data, new Headers())
	return { items: page.items.map(parseReport), ...(page.next_token && { nextToken: page.next_token }) }
}

const listReportsPageResponseSchema = z.looseObject({
	reports: z.array(amazonReportRawSchema),
	nextToken: z.string().min(1).optional()
})

export function parseListReportsPagePayload(data: unknown, headers: Headers): AmazonSpApiListReportsPageOutput {
	const parsed = listReportsPageResponseSchema.safeParse(data)
	if (!parsed.success) {
		throw new ToolError('Amazon SP-API list reports page response invalid', {
			code: 'upstream',
			details: { issues: parsed.error.issues.map((issue) => issue.message) }
		})
	}
	return {
		items: parsed.data.reports,
		...(parsed.data.nextToken && { next_token: parsed.data.nextToken }),
		...parseAmazonResponseMetadata(headers)
	}
}

export function parseReportDocumentPayload(data: unknown): {
	document_id: string
	url: string
	compression_algorithm?: string
} {
	const parsed = z
		.looseObject({
			reportDocumentId: z.string().min(1),
			url: z.url(),
			compressionAlgorithm: z.string().min(1).optional()
		})
		.safeParse(data)
	if (!parsed.success) {
		throw new ToolError('Amazon SP-API report document response invalid', { code: 'upstream' })
	}
	return {
		document_id: parsed.data.reportDocumentId,
		url: parsed.data.url,
		...(parsed.data.compressionAlgorithm && { compression_algorithm: parsed.data.compressionAlgorithm })
	}
}

export function parseCatalogItem(value: unknown): AmazonSpApiCatalogItem {
	const parsed = amazonCatalogItemRawSchema.safeParse(value)
	if (!parsed.success) {
		throw new ToolError('Amazon SP-API returned an invalid catalog item', { code: 'upstream' })
	}
	const summary = parsed.data.summaries?.[0]
	const productType = parsed.data.productTypes?.[0]
	return {
		asin: parsed.data.asin,
		...(summary?.itemName && { title: summary.itemName }),
		...(summary?.brandName && { brand: summary.brandName }),
		...(productType?.productType && { product_type: productType.productType }),
		...(summary?.marketplaceId && { marketplace_id: summary.marketplaceId })
	}
}

export function parseSearchCatalogItemsPayload(data: unknown): {
	items: AmazonSpApiCatalogItem[]
	numberOfResults?: number
	nextToken?: string
} {
	const parsed = amazonCatalogSearchResponseSchema.safeParse(data)
	if (!parsed.success) {
		throw new ToolError('Amazon SP-API catalog search payload invalid', { code: 'upstream' })
	}
	return {
		items: parsed.data.items.map(parseCatalogItem),
		...(parsed.data.numberOfResults !== undefined && { numberOfResults: parsed.data.numberOfResults }),
		...(parsed.data.pagination?.nextToken && { nextToken: parsed.data.pagination.nextToken })
	}
}

export function requireMarketplaceIds(
	inputIds: string[] | undefined,
	authIds: string[] | undefined,
	label: string
): string[] {
	const ids = inputIds ?? authIds
	if (!ids || ids.length === 0) {
		throw new ToolError(`${label} requires marketplace_ids on the call or auth`, { code: 'bad_input' })
	}
	return ids
}
