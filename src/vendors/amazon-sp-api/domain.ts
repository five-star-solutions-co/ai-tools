/**
 * Amazon SP-API: LWA body, order/inventory/report/catalog parse (no HTTP).
 */

import { isPlainObject, isString } from 'es-toolkit'

import { ToolError } from '../../core/errors'
import type {
	AmazonSpApiCatalogItem,
	AmazonSpApiInventorySummary,
	AmazonSpApiOrder,
	AmazonSpApiOrderItem,
	AmazonSpApiReport,
	AmazonSpApiSearchOrder
} from './contracts'

export const LWA_TOKEN_URL = 'https://api.amazon.com/auth/o2/token'

export function lwaTokenBody(auth: { client_id: string; client_secret: string; refresh_token: string }): string {
	const params = new URLSearchParams({
		grant_type: 'refresh_token',
		refresh_token: auth.refresh_token,
		client_id: auth.client_id,
		client_secret: auth.client_secret
	})
	return params.toString()
}

export function parseLwaAccessToken(data: unknown): string {
	if (!isPlainObject(data) || !isString(data['access_token']) || data['access_token'].length === 0) {
		throw new ToolError('Amazon LWA did not return an access_token', { code: 'bad_auth' })
	}
	return data['access_token']
}

export function parseOrder(value: unknown): AmazonSpApiOrder {
	if (!isPlainObject(value) || !isString(value['AmazonOrderId']) || value['AmazonOrderId'].length === 0) {
		throw new ToolError('Amazon SP-API returned an invalid order', { code: 'upstream' })
	}
	const total = value['OrderTotal']
	const amount = isPlainObject(total) && isString(total['Amount']) ? total['Amount'] : undefined
	const currency = isPlainObject(total) && isString(total['CurrencyCode']) ? total['CurrencyCode'] : undefined
	return {
		amazon_order_id: value['AmazonOrderId'],
		...(isString(value['OrderStatus']) && { order_status: value['OrderStatus'] }),
		...(isString(value['PurchaseDate']) && { purchase_date: value['PurchaseDate'] }),
		...(isString(value['LastUpdateDate']) && { last_update_date: value['LastUpdateDate'] }),
		...(isString(value['MarketplaceId']) && { marketplace_id: value['MarketplaceId'] }),
		...(amount && { order_total_amount: amount }),
		...(currency && { order_total_currency: currency }),
		...(isString(value['FulfillmentChannel']) && { fulfillment_channel: value['FulfillmentChannel'] })
	}
}

export function parseOrdersPayload(data: unknown): {
	items: AmazonSpApiOrder[]
	nextToken?: string
} {
	if (!isPlainObject(data)) {
		throw new ToolError('Amazon SP-API orders payload invalid', { code: 'upstream' })
	}
	const payload = data['payload']
	if (!isPlainObject(payload)) {
		throw new ToolError('Amazon SP-API orders missing payload', { code: 'upstream' })
	}
	const orders = payload['Orders']
	if (!Array.isArray(orders)) {
		throw new ToolError('Amazon SP-API orders missing Orders array', { code: 'upstream' })
	}
	const nextToken = isString(payload['NextToken']) && payload['NextToken'].length > 0 ? payload['NextToken'] : undefined
	return { items: orders.map(parseOrder), ...(nextToken && { nextToken }) }
}

export function parseOrderPayload(data: unknown): AmazonSpApiOrder {
	if (!isPlainObject(data) || !isPlainObject(data['payload'])) {
		throw new ToolError('Amazon SP-API get order payload invalid', { code: 'upstream' })
	}
	return parseOrder(data['payload'])
}

/** Orders API v2026-01-01 SearchOrders — camelCase body, not v0 payload wrapper. */
export function parseSearchOrder(value: unknown): AmazonSpApiSearchOrder {
	if (!isPlainObject(value) || !isString(value['orderId']) || value['orderId'].length === 0) {
		throw new ToolError('Amazon SP-API searchOrders returned an invalid order', { code: 'upstream' })
	}
	const fulfillment = value['fulfillment']
	const fulfillmentStatus =
		isPlainObject(fulfillment) && isString(fulfillment['fulfillmentStatus'])
			? fulfillment['fulfillmentStatus']
			: undefined
	return {
		order_id: value['orderId'],
		...(isString(value['createdTime']) && { created_time: value['createdTime'] }),
		...(fulfillmentStatus && { fulfillment_status: fulfillmentStatus })
	}
}

export function parseSearchOrdersPayload(data: unknown): {
	items: AmazonSpApiSearchOrder[]
	nextToken?: string
} {
	if (!isPlainObject(data)) {
		throw new ToolError('Amazon SP-API searchOrders payload invalid', { code: 'upstream' })
	}
	// Some gateways still wrap; accept both shapes.
	const root = isPlainObject(data['payload']) ? data['payload'] : data
	if (!isPlainObject(root)) {
		throw new ToolError('Amazon SP-API searchOrders missing body', { code: 'upstream' })
	}
	const orders = root['orders']
	if (!Array.isArray(orders)) {
		throw new ToolError('Amazon SP-API searchOrders missing orders array', { code: 'upstream' })
	}
	const pagination = root['pagination']
	const nextToken =
		isPlainObject(pagination) && isString(pagination['nextToken']) && pagination['nextToken'].length > 0
			? pagination['nextToken']
			: undefined
	return { items: orders.map(parseSearchOrder), ...(nextToken && { nextToken }) }
}

export function parseOrderItem(value: unknown): AmazonSpApiOrderItem {
	if (!isPlainObject(value) || !isString(value['OrderItemId']) || value['OrderItemId'].length === 0) {
		throw new ToolError('Amazon SP-API returned an invalid order item', { code: 'upstream' })
	}
	const price = value['ItemPrice']
	const amount = isPlainObject(price) && isString(price['Amount']) ? price['Amount'] : undefined
	const currency = isPlainObject(price) && isString(price['CurrencyCode']) ? price['CurrencyCode'] : undefined
	return {
		order_item_id: value['OrderItemId'],
		...(isString(value['ASIN']) && { asin: value['ASIN'] }),
		...(isString(value['SellerSKU']) && { seller_sku: value['SellerSKU'] }),
		...(isString(value['Title']) && { title: value['Title'] }),
		...(typeof value['QuantityOrdered'] === 'number' && { quantity_ordered: value['QuantityOrdered'] }),
		...(typeof value['QuantityShipped'] === 'number' && { quantity_shipped: value['QuantityShipped'] }),
		...(amount && { item_price_amount: amount }),
		...(currency && { item_price_currency: currency })
	}
}

export function parseOrderItemsPayload(data: unknown): {
	amazon_order_id: string
	items: AmazonSpApiOrderItem[]
	nextToken?: string
} {
	if (!isPlainObject(data)) {
		throw new ToolError('Amazon SP-API order items payload invalid', { code: 'upstream' })
	}
	const payload = data['payload']
	if (!isPlainObject(payload)) {
		throw new ToolError('Amazon SP-API order items missing payload', { code: 'upstream' })
	}
	if (!isString(payload['AmazonOrderId']) || payload['AmazonOrderId'].length === 0) {
		throw new ToolError('Amazon SP-API order items missing AmazonOrderId', { code: 'upstream' })
	}
	const orderItems = payload['OrderItems']
	if (!Array.isArray(orderItems)) {
		throw new ToolError('Amazon SP-API order items missing OrderItems array', { code: 'upstream' })
	}
	const nextToken = isString(payload['NextToken']) && payload['NextToken'].length > 0 ? payload['NextToken'] : undefined
	return {
		amazon_order_id: payload['AmazonOrderId'],
		items: orderItems.map(parseOrderItem),
		...(nextToken && { nextToken })
	}
}

export function parseInventorySummary(value: unknown): AmazonSpApiInventorySummary {
	if (!isPlainObject(value)) {
		throw new ToolError('Amazon SP-API returned an invalid inventory summary', { code: 'upstream' })
	}
	const totals = value['inventoryDetails']
	let totalQuantity: number | undefined
	if (isPlainObject(totals) && typeof totals['fulfillableQuantity'] === 'number') {
		totalQuantity = totals['fulfillableQuantity']
	} else if (typeof value['totalQuantity'] === 'number') {
		totalQuantity = value['totalQuantity']
	}
	return {
		...(isString(value['sellerSku']) && { seller_sku: value['sellerSku'] }),
		...(isString(value['asin']) && { asin: value['asin'] }),
		...(isString(value['fnSku']) && { fn_sku: value['fnSku'] }),
		...(isString(value['condition']) && { condition: value['condition'] }),
		...(totalQuantity !== undefined && { total_quantity: totalQuantity }),
		...(isString(value['productName']) && { product_name: value['productName'] })
	}
}

export function parseInventoryPayload(data: unknown): {
	items: AmazonSpApiInventorySummary[]
	nextToken?: string
} {
	if (!isPlainObject(data)) {
		throw new ToolError('Amazon SP-API inventory payload invalid', { code: 'upstream' })
	}
	const payload = data['payload']
	if (!isPlainObject(payload)) {
		throw new ToolError('Amazon SP-API inventory missing payload', { code: 'upstream' })
	}
	const summaries = payload['inventorySummaries']
	if (!Array.isArray(summaries)) {
		throw new ToolError('Amazon SP-API inventory missing inventorySummaries', { code: 'upstream' })
	}
	const pagination = payload['pagination']
	const nextToken =
		isPlainObject(pagination) && isString(pagination['nextToken']) && pagination['nextToken'].length > 0
			? pagination['nextToken']
			: undefined
	return { items: summaries.map(parseInventorySummary), ...(nextToken && { nextToken }) }
}

export function parseCreateReportPayload(data: unknown): { report_id: string } {
	if (!isPlainObject(data) || !isString(data['reportId']) || data['reportId'].length === 0) {
		throw new ToolError('Amazon SP-API create report response invalid', { code: 'upstream' })
	}
	return { report_id: data['reportId'] }
}

export function parseReport(value: unknown): AmazonSpApiReport {
	if (!isPlainObject(value) || !isString(value['reportId']) || value['reportId'].length === 0) {
		throw new ToolError('Amazon SP-API returned an invalid report', { code: 'upstream' })
	}
	const marketplaceIds = value['marketplaceIds']
	const marketplace_ids =
		Array.isArray(marketplaceIds) && marketplaceIds.every((id) => isString(id))
			? marketplaceIds.filter((id): id is string => isString(id) && id.length > 0)
			: undefined
	return {
		report_id: value['reportId'],
		...(isString(value['reportType']) && { report_type: value['reportType'] }),
		...(isString(value['processingStatus']) && { processing_status: value['processingStatus'] }),
		...(marketplace_ids && marketplace_ids.length > 0 && { marketplace_ids }),
		...(isString(value['dataStartTime']) && { data_start_time: value['dataStartTime'] }),
		...(isString(value['dataEndTime']) && { data_end_time: value['dataEndTime'] }),
		...(isString(value['reportDocumentId']) && { report_document_id: value['reportDocumentId'] }),
		...(isString(value['createdTime']) && { created_time: value['createdTime'] })
	}
}

export function parseGetReportPayload(data: unknown): AmazonSpApiReport {
	return parseReport(data)
}

export function parseListReportsPayload(data: unknown): {
	items: AmazonSpApiReport[]
	nextToken?: string
} {
	if (!isPlainObject(data)) {
		throw new ToolError('Amazon SP-API list reports payload invalid', { code: 'upstream' })
	}
	const reports = data['reports']
	if (!Array.isArray(reports)) {
		throw new ToolError('Amazon SP-API list reports missing reports array', { code: 'upstream' })
	}
	const nextToken = isString(data['nextToken']) && data['nextToken'].length > 0 ? data['nextToken'] : undefined
	return { items: reports.map(parseReport), ...(nextToken && { nextToken }) }
}

export function parseReportDocumentPayload(data: unknown): {
	document_id: string
	url: string
	compression_algorithm?: string
} {
	if (
		!isPlainObject(data) ||
		!isString(data['reportDocumentId']) ||
		data['reportDocumentId'].length === 0 ||
		!isString(data['url']) ||
		data['url'].length === 0
	) {
		throw new ToolError('Amazon SP-API report document response invalid', { code: 'upstream' })
	}
	return {
		document_id: data['reportDocumentId'],
		url: data['url'],
		...(isString(data['compressionAlgorithm']) &&
			data['compressionAlgorithm'].length > 0 && {
				compression_algorithm: data['compressionAlgorithm']
			})
	}
}

export function parseCatalogItem(value: unknown): AmazonSpApiCatalogItem {
	if (!isPlainObject(value) || !isString(value['asin']) || value['asin'].length === 0) {
		throw new ToolError('Amazon SP-API returned an invalid catalog item', { code: 'upstream' })
	}
	const summaries = value['summaries']
	let title: string | undefined
	let brand: string | undefined
	let marketplace_id: string | undefined
	if (Array.isArray(summaries) && summaries.length > 0 && isPlainObject(summaries[0])) {
		const summary = summaries[0]
		if (isString(summary['itemName'])) title = summary['itemName']
		if (isString(summary['brandName'])) brand = summary['brandName']
		if (isString(summary['marketplaceId'])) marketplace_id = summary['marketplaceId']
	}
	const productTypes = value['productTypes']
	let product_type: string | undefined
	if (Array.isArray(productTypes) && productTypes.length > 0 && isPlainObject(productTypes[0])) {
		const pt = productTypes[0]
		if (isString(pt['productType'])) product_type = pt['productType']
	}
	return {
		asin: value['asin'],
		...(title && { title }),
		...(brand && { brand }),
		...(product_type && { product_type }),
		...(marketplace_id && { marketplace_id })
	}
}

export function parseSearchCatalogItemsPayload(data: unknown): {
	items: AmazonSpApiCatalogItem[]
	numberOfResults?: number
	nextToken?: string
} {
	if (!isPlainObject(data)) {
		throw new ToolError('Amazon SP-API catalog search payload invalid', { code: 'upstream' })
	}
	const items = data['items']
	if (!Array.isArray(items)) {
		throw new ToolError('Amazon SP-API catalog search missing items array', { code: 'upstream' })
	}
	const pagination = data['pagination']
	const nextToken =
		isPlainObject(pagination) && isString(pagination['nextToken']) && pagination['nextToken'].length > 0
			? pagination['nextToken']
			: undefined
	const numberOfResults = typeof data['numberOfResults'] === 'number' ? data['numberOfResults'] : undefined
	return {
		items: items.map(parseCatalogItem),
		...(numberOfResults !== undefined && { numberOfResults }),
		...(nextToken && { nextToken })
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
