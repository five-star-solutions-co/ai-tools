/**
 * WooCommerce REST payload helpers (no HTTP).
 */

import { isPlainObject, isString } from 'es-toolkit'

import { ToolError } from '../../core/errors'
import { bytesToBase64, utf8ToBytes } from '../../shared/bytes'
import type {
	WoocommerceAddress,
	WoocommerceAuth,
	WoocommerceCoupon,
	WoocommerceCreateCouponInput,
	WoocommerceCreateCustomerInput,
	WoocommerceCreateOrderInput,
	WoocommerceCreateOrderNoteInput,
	WoocommerceCreateOrderRefundInput,
	WoocommerceCreateProductInput,
	WoocommerceCustomer,
	WoocommerceDeleteOrderOutput,
	WoocommerceDeleteProductOutput,
	WoocommerceLineItemInput,
	WoocommerceMetaData,
	WoocommerceOrder,
	WoocommerceOrderNote,
	WoocommerceOrderRefund,
	WoocommerceProduct,
	WoocommerceProductCategory,
	WoocommerceProductVariation,
	WoocommerceUpdateCouponInput,
	WoocommerceUpdateCustomerInput,
	WoocommerceUpdateOrderInput,
	WoocommerceUpdateProductInput
} from './contracts'

export function storeOrigin(auth: WoocommerceAuth): string {
	return auth.store_url.replace(/\/+$/, '')
}

export function apiBaseUrl(auth: WoocommerceAuth): string {
	return `${storeOrigin(auth)}/wp-json/wc/v3`
}

export function basicAuthHeader(auth: WoocommerceAuth): string {
	const token = bytesToBase64(utf8ToBytes(`${auth.consumer_key}:${auth.consumer_secret}`))
	return `Basic ${token}`
}

export function pageFromCursor(cursor: string | undefined): number {
	if (!cursor) return 1
	const n = Number.parseInt(cursor, 10)
	if (!Number.isFinite(n) || n < 1) {
		throw new ToolError('Invalid list cursor', { code: 'bad_input', details: { cursor } })
	}
	return n
}

export function listPageMeta(
	page: number,
	limit: number,
	itemCount: number,
	totalPagesHeader: string | null
): { next_cursor?: string; truncated: boolean } {
	const totalPages = totalPagesHeader ? Number.parseInt(totalPagesHeader, 10) : undefined
	if (typeof totalPages === 'number' && Number.isFinite(totalPages) && totalPages > page) {
		return { next_cursor: String(page + 1), truncated: true }
	}
	if (itemCount >= limit && (totalPages === undefined || !Number.isFinite(totalPages))) {
		return { next_cursor: String(page + 1), truncated: true }
	}
	return { truncated: false }
}

function optionalString(value: unknown): string | undefined {
	return isString(value) ? value : undefined
}

function optionalNonEmptyString(value: unknown): string | undefined {
	return isString(value) && value.length > 0 ? value : undefined
}

function optionalNumber(value: unknown): number | undefined {
	return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function optionalBoolean(value: unknown): boolean | undefined {
	return typeof value === 'boolean' ? value : undefined
}

function addressBody(address: WoocommerceAddress): Record<string, string> {
	return {
		...(address.first_name !== undefined && { first_name: address.first_name }),
		...(address.last_name !== undefined && { last_name: address.last_name }),
		...(address.company !== undefined && { company: address.company }),
		...(address.address_1 !== undefined && { address_1: address.address_1 }),
		...(address.address_2 !== undefined && { address_2: address.address_2 }),
		...(address.city !== undefined && { city: address.city }),
		...(address.state !== undefined && { state: address.state }),
		...(address.postcode !== undefined && { postcode: address.postcode }),
		...(address.country !== undefined && { country: address.country }),
		...(address.email !== undefined && { email: address.email }),
		...(address.phone !== undefined && { phone: address.phone })
	}
}

function metaDataBody(meta: WoocommerceMetaData[]): { key: string; value: string }[] {
	return meta.map((item) => ({ key: item.key, value: item.value }))
}

function lineItemBody(item: WoocommerceLineItemInput): Record<string, string | number> {
	return {
		...(item.id !== undefined && { id: item.id }),
		...(item.product_id !== undefined && { product_id: item.product_id }),
		...(item.variation_id !== undefined && { variation_id: item.variation_id }),
		...(item.quantity !== undefined && { quantity: item.quantity }),
		...(item.name && { name: item.name }),
		...(item.sku && { sku: item.sku }),
		...(item.price && { price: item.price }),
		...(item.total && { total: item.total })
	}
}

export function orderWriteBody(
	input: WoocommerceCreateOrderInput | Omit<WoocommerceUpdateOrderInput, 'order_id'>
): Record<string, unknown> {
	return {
		...(input.status && { status: input.status }),
		...(input.customer_id !== undefined && { customer_id: input.customer_id }),
		...(input.payment_method && { payment_method: input.payment_method }),
		...(input.payment_method_title && { payment_method_title: input.payment_method_title }),
		...(input.set_paid !== undefined && { set_paid: input.set_paid }),
		...(input.customer_note !== undefined && { customer_note: input.customer_note }),
		...(input.billing && { billing: addressBody(input.billing) }),
		...(input.shipping && { shipping: addressBody(input.shipping) }),
		...(input.line_items &&
			input.line_items.length > 0 && {
				line_items: input.line_items.map(lineItemBody)
			}),
		...(input.meta_data && input.meta_data.length > 0 && { meta_data: metaDataBody(input.meta_data) })
	}
}

export function productWriteBody(
	input: WoocommerceCreateProductInput | Omit<WoocommerceUpdateProductInput, 'product_id'>
): Record<string, unknown> {
	const name = 'name' in input ? input.name : undefined
	return {
		...(name && { name }),
		...(input.type && { type: input.type }),
		...(input.status && { status: input.status }),
		...(input.sku !== undefined && { sku: input.sku }),
		...(input.regular_price !== undefined && { regular_price: input.regular_price }),
		...(input.sale_price !== undefined && { sale_price: input.sale_price }),
		...(input.description !== undefined && { description: input.description }),
		...(input.short_description !== undefined && { short_description: input.short_description }),
		...(input.manage_stock !== undefined && { manage_stock: input.manage_stock }),
		...(input.stock_quantity !== undefined && { stock_quantity: input.stock_quantity }),
		...(input.stock_status && { stock_status: input.stock_status }),
		...(input.categories &&
			input.categories.length > 0 && {
				categories: input.categories.map((c) => ({ id: c.id }))
			}),
		...(input.meta_data && input.meta_data.length > 0 && { meta_data: metaDataBody(input.meta_data) })
	}
}

export function customerWriteBody(
	input: WoocommerceCreateCustomerInput | Omit<WoocommerceUpdateCustomerInput, 'customer_id'>
): Record<string, unknown> {
	const email = 'email' in input ? input.email : undefined
	return {
		...(email && { email }),
		...(input.first_name !== undefined && { first_name: input.first_name }),
		...(input.last_name !== undefined && { last_name: input.last_name }),
		...(input.username && { username: input.username }),
		...(input.password && { password: input.password }),
		...(input.billing && { billing: addressBody(input.billing) }),
		...(input.shipping && { shipping: addressBody(input.shipping) }),
		...(input.meta_data && input.meta_data.length > 0 && { meta_data: metaDataBody(input.meta_data) })
	}
}

export function couponWriteBody(
	input: WoocommerceCreateCouponInput | Omit<WoocommerceUpdateCouponInput, 'coupon_id'>
): Record<string, unknown> {
	const code = 'code' in input ? input.code : undefined
	return {
		...(code && { code }),
		...(input.discount_type && { discount_type: input.discount_type }),
		...(input.amount && { amount: input.amount }),
		...(input.description !== undefined && { description: input.description }),
		...(input.individual_use !== undefined && { individual_use: input.individual_use }),
		...(input.exclude_sale_items !== undefined && { exclude_sale_items: input.exclude_sale_items }),
		...(input.minimum_amount !== undefined && { minimum_amount: input.minimum_amount }),
		...(input.maximum_amount !== undefined && { maximum_amount: input.maximum_amount }),
		...(input.usage_limit !== undefined && { usage_limit: input.usage_limit }),
		...(input.usage_limit_per_user !== undefined && {
			usage_limit_per_user: input.usage_limit_per_user
		}),
		...(input.free_shipping !== undefined && { free_shipping: input.free_shipping }),
		...(input.date_expires !== undefined && { date_expires: input.date_expires }),
		...(input.meta_data && input.meta_data.length > 0 && { meta_data: metaDataBody(input.meta_data) })
	}
}

export function orderNoteWriteBody(input: Omit<WoocommerceCreateOrderNoteInput, 'order_id'>): Record<string, unknown> {
	return {
		note: input.note,
		...(input.customer_note !== undefined && { customer_note: input.customer_note }),
		...(input.added_by_user !== undefined && { added_by_user: input.added_by_user })
	}
}

export function orderRefundWriteBody(
	input: Omit<WoocommerceCreateOrderRefundInput, 'order_id'>
): Record<string, unknown> {
	return {
		...(input.amount && { amount: input.amount }),
		...(input.reason !== undefined && { reason: input.reason }),
		...(input.api_refund !== undefined && { api_refund: input.api_refund }),
		...(input.line_items &&
			input.line_items.length > 0 && {
				line_items: input.line_items.map((item) => ({
					id: item.id,
					...(item.quantity !== undefined && { quantity: item.quantity }),
					...(item.refund_total && { refund_total: item.refund_total })
				}))
			})
	}
}

function parseOrderLineItem(value: unknown): {
	id: number
	product_id?: number
	variation_id?: number
	quantity?: number
	name?: string
	sku?: string
	price?: string
	total?: string
} {
	if (!isPlainObject(value) || typeof value['id'] !== 'number') {
		throw new ToolError('WooCommerce returned an invalid order line item', { code: 'upstream' })
	}
	const productId = optionalNumber(value['product_id'])
	const variationId = optionalNumber(value['variation_id'])
	const quantity = optionalNumber(value['quantity'])
	const name = optionalNonEmptyString(value['name'])
	const sku = optionalNonEmptyString(value['sku'])
	// WC may return price/total as string or number
	const priceRaw = value['price']
	const totalRaw = value['total']
	const price =
		isString(priceRaw) && priceRaw.length > 0
			? priceRaw
			: typeof priceRaw === 'number' && Number.isFinite(priceRaw)
				? String(priceRaw)
				: undefined
	const total =
		isString(totalRaw) && totalRaw.length > 0
			? totalRaw
			: typeof totalRaw === 'number' && Number.isFinite(totalRaw)
				? String(totalRaw)
				: undefined
	return {
		id: value['id'],
		...(productId !== undefined && { product_id: productId }),
		...(variationId !== undefined && { variation_id: variationId }),
		...(quantity !== undefined && { quantity }),
		...(name && { name }),
		...(sku && { sku }),
		...(price && { price }),
		...(total && { total })
	}
}

function parseOrderLineItems(value: unknown): ReturnType<typeof parseOrderLineItem>[] | undefined {
	if (!Array.isArray(value) || value.length === 0) return undefined
	return value.map(parseOrderLineItem)
}

export function parseOrder(value: unknown): WoocommerceOrder {
	if (!isPlainObject(value) || typeof value['id'] !== 'number') {
		throw new ToolError('WooCommerce returned an invalid order', { code: 'upstream' })
	}
	const number = value['number']
	const status = value['status']
	const currency = value['currency']
	const total = value['total']
	if (!isString(number) || !isString(status) || !isString(currency) || !isString(total)) {
		throw new ToolError('WooCommerce order missing required fields', { code: 'upstream' })
	}
	const dateCreated = optionalString(value['date_created'])
	const customerId = optionalNumber(value['customer_id'])
	const paymentMethod = optionalNonEmptyString(value['payment_method'])
	const paymentMethodTitle = optionalNonEmptyString(value['payment_method_title'])
	const customerNote = optionalString(value['customer_note'])
	const lineItems = parseOrderLineItems(value['line_items'])
	return {
		id: value['id'],
		number,
		status,
		currency,
		total,
		...(dateCreated && { date_created: dateCreated }),
		...(customerId !== undefined && { customer_id: customerId }),
		...(paymentMethod && { payment_method: paymentMethod }),
		...(paymentMethodTitle && { payment_method_title: paymentMethodTitle }),
		...(customerNote !== undefined && { customer_note: customerNote }),
		...(lineItems && { line_items: lineItems })
	}
}

export function parseOrders(value: unknown): WoocommerceOrder[] {
	if (!Array.isArray(value)) {
		throw new ToolError('WooCommerce list orders returned a non-array body', { code: 'upstream' })
	}
	return value.map(parseOrder)
}

export function parseOrderNote(value: unknown): WoocommerceOrderNote {
	if (!isPlainObject(value) || typeof value['id'] !== 'number' || !isString(value['note'])) {
		throw new ToolError('WooCommerce returned an invalid order note', { code: 'upstream' })
	}
	const customerNote = optionalBoolean(value['customer_note'])
	const dateCreated = optionalString(value['date_created'])
	const addedByUser = optionalBoolean(value['added_by_user'])
	return {
		id: value['id'],
		note: value['note'],
		...(customerNote !== undefined && { customer_note: customerNote }),
		...(dateCreated && { date_created: dateCreated }),
		...(addedByUser !== undefined && { added_by_user: addedByUser })
	}
}

export function parseOrderNotes(value: unknown): WoocommerceOrderNote[] {
	if (!Array.isArray(value)) {
		throw new ToolError('WooCommerce list order notes returned a non-array body', { code: 'upstream' })
	}
	return value.map(parseOrderNote)
}

export function parseOrderRefund(value: unknown): WoocommerceOrderRefund {
	if (!isPlainObject(value) || typeof value['id'] !== 'number') {
		throw new ToolError('WooCommerce returned an invalid order refund', { code: 'upstream' })
	}
	const amount = optionalString(value['amount'])
	const reason = optionalString(value['reason'])
	const dateCreated = optionalString(value['date_created'])
	const refundedBy = optionalNumber(value['refunded_by'])
	return {
		id: value['id'],
		...(amount && { amount }),
		...(reason !== undefined && { reason }),
		...(dateCreated && { date_created: dateCreated }),
		...(refundedBy !== undefined && { refunded_by: refundedBy })
	}
}

export function parseOrderRefunds(value: unknown): WoocommerceOrderRefund[] {
	if (!Array.isArray(value)) {
		throw new ToolError('WooCommerce list order refunds returned a non-array body', { code: 'upstream' })
	}
	return value.map(parseOrderRefund)
}

function parseProductCategoryRef(value: unknown): { id: number; name?: string; slug?: string } {
	if (!isPlainObject(value) || typeof value['id'] !== 'number') {
		throw new ToolError('WooCommerce returned an invalid product category ref', { code: 'upstream' })
	}
	const name = optionalNonEmptyString(value['name'])
	const slug = optionalNonEmptyString(value['slug'])
	return {
		id: value['id'],
		...(name && { name }),
		...(slug && { slug })
	}
}

function parseProductCategoryRefs(value: unknown): ReturnType<typeof parseProductCategoryRef>[] | undefined {
	if (!Array.isArray(value) || value.length === 0) return undefined
	return value.map(parseProductCategoryRef)
}

export function parseProduct(value: unknown): WoocommerceProduct {
	if (
		!isPlainObject(value) ||
		typeof value['id'] !== 'number' ||
		!isString(value['name']) ||
		!isString(value['type'])
	) {
		throw new ToolError('WooCommerce returned an invalid product', { code: 'upstream' })
	}
	const status = value['status']
	if (!isString(status)) {
		throw new ToolError('WooCommerce product missing status', { code: 'upstream' })
	}
	const sku = optionalNonEmptyString(value['sku'])
	const price = optionalString(value['price'])
	const regularPrice = optionalString(value['regular_price'])
	const salePrice = optionalString(value['sale_price'])
	const stockStatus = optionalString(value['stock_status'])
	const stockQuantity = optionalNumber(value['stock_quantity'])
	const manageStock = optionalBoolean(value['manage_stock'])
	const categories = parseProductCategoryRefs(value['categories'])
	return {
		id: value['id'],
		name: value['name'],
		type: value['type'],
		status,
		...(sku && { sku }),
		...(price && { price }),
		...(regularPrice && { regular_price: regularPrice }),
		...(salePrice && { sale_price: salePrice }),
		...(stockStatus && { stock_status: stockStatus }),
		...(stockQuantity !== undefined && { stock_quantity: stockQuantity }),
		...(manageStock !== undefined && { manage_stock: manageStock }),
		...(categories && { categories })
	}
}

export function parseProducts(value: unknown): WoocommerceProduct[] {
	if (!Array.isArray(value)) {
		throw new ToolError('WooCommerce list products returned a non-array body', { code: 'upstream' })
	}
	return value.map(parseProduct)
}

export function parseProductVariation(value: unknown): WoocommerceProductVariation {
	if (!isPlainObject(value) || typeof value['id'] !== 'number') {
		throw new ToolError('WooCommerce returned an invalid product variation', { code: 'upstream' })
	}
	const sku = optionalNonEmptyString(value['sku'])
	const price = optionalString(value['price'])
	const regularPrice = optionalString(value['regular_price'])
	const salePrice = optionalString(value['sale_price'])
	const status = optionalString(value['status'])
	const stockStatus = optionalString(value['stock_status'])
	const stockQuantity = optionalNumber(value['stock_quantity'])
	const manageStock = optionalBoolean(value['manage_stock'])
	return {
		id: value['id'],
		...(sku && { sku }),
		...(price && { price }),
		...(regularPrice && { regular_price: regularPrice }),
		...(salePrice && { sale_price: salePrice }),
		...(status && { status }),
		...(stockStatus && { stock_status: stockStatus }),
		...(stockQuantity !== undefined && { stock_quantity: stockQuantity }),
		...(manageStock !== undefined && { manage_stock: manageStock })
	}
}

export function parseProductVariations(value: unknown): WoocommerceProductVariation[] {
	if (!Array.isArray(value)) {
		throw new ToolError('WooCommerce list product variations returned a non-array body', { code: 'upstream' })
	}
	return value.map(parseProductVariation)
}

export function parseCustomer(value: unknown): WoocommerceCustomer {
	if (!isPlainObject(value) || typeof value['id'] !== 'number' || !isString(value['email'])) {
		throw new ToolError('WooCommerce returned an invalid customer', { code: 'upstream' })
	}
	const firstName = optionalString(value['first_name'])
	const lastName = optionalString(value['last_name'])
	const username = optionalNonEmptyString(value['username'])
	const role = optionalNonEmptyString(value['role'])
	const dateCreated = optionalString(value['date_created'])
	return {
		id: value['id'],
		email: value['email'],
		...(firstName !== undefined && { first_name: firstName }),
		...(lastName !== undefined && { last_name: lastName }),
		...(username && { username }),
		...(role && { role }),
		...(dateCreated && { date_created: dateCreated })
	}
}

export function parseCustomers(value: unknown): WoocommerceCustomer[] {
	if (!Array.isArray(value)) {
		throw new ToolError('WooCommerce list customers returned a non-array body', { code: 'upstream' })
	}
	return value.map(parseCustomer)
}

export function parseCoupon(value: unknown): WoocommerceCoupon {
	if (!isPlainObject(value) || typeof value['id'] !== 'number' || !isString(value['code'])) {
		throw new ToolError('WooCommerce returned an invalid coupon', { code: 'upstream' })
	}
	const amount = optionalString(value['amount'])
	const discountType = optionalNonEmptyString(value['discount_type'])
	const description = optionalString(value['description'])
	const dateExpires = optionalString(value['date_expires'])
	const usageCount = optionalNumber(value['usage_count'])
	const usageLimit = optionalNumber(value['usage_limit'])
	const freeShipping = optionalBoolean(value['free_shipping'])
	return {
		id: value['id'],
		code: value['code'],
		...(amount && { amount }),
		...(discountType && { discount_type: discountType }),
		...(description !== undefined && { description }),
		...(dateExpires && { date_expires: dateExpires }),
		...(usageCount !== undefined && { usage_count: usageCount }),
		...(usageLimit !== undefined && { usage_limit: usageLimit }),
		...(freeShipping !== undefined && { free_shipping: freeShipping })
	}
}

export function parseCoupons(value: unknown): WoocommerceCoupon[] {
	if (!Array.isArray(value)) {
		throw new ToolError('WooCommerce list coupons returned a non-array body', { code: 'upstream' })
	}
	return value.map(parseCoupon)
}

export function parseProductCategory(value: unknown): WoocommerceProductCategory {
	if (!isPlainObject(value) || typeof value['id'] !== 'number' || !isString(value['name'])) {
		throw new ToolError('WooCommerce returned an invalid product category', { code: 'upstream' })
	}
	const slug = optionalNonEmptyString(value['slug'])
	const parent = optionalNumber(value['parent'])
	const description = optionalString(value['description'])
	const count = optionalNumber(value['count'])
	return {
		id: value['id'],
		name: value['name'],
		...(slug && { slug }),
		...(parent !== undefined && { parent }),
		...(description !== undefined && { description }),
		...(count !== undefined && { count })
	}
}

export function parseProductCategories(value: unknown): WoocommerceProductCategory[] {
	if (!Array.isArray(value)) {
		throw new ToolError('WooCommerce list product categories returned a non-array body', {
			code: 'upstream'
		})
	}
	return value.map(parseProductCategory)
}

export function parseDeleteResult(value: unknown, fallbackId: number): WoocommerceDeleteOrderOutput {
	if (isPlainObject(value)) {
		const previous = value['previous']
		if (isPlainObject(previous) && typeof previous['id'] === 'number') {
			return { deleted: true, id: previous['id'] }
		}
		if (typeof value['id'] === 'number') {
			return { deleted: true, id: value['id'] }
		}
	}
	return { deleted: true, id: fallbackId }
}

export function parseProductDeleteResult(value: unknown, fallbackId: number): WoocommerceDeleteProductOutput {
	return parseDeleteResult(value, fallbackId)
}
