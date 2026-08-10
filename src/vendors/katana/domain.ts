/**
 * Katana MRP payload helpers (no HTTP).
 */

import { isString } from 'es-toolkit'
import { z } from 'zod'

import { ToolError } from '../../core/errors'
import type {
	KatanaCreateCustomerInput,
	KatanaCreateManufacturingOrderInput,
	KatanaCreateProductInput,
	KatanaCreatePurchaseOrderInput,
	KatanaCreateSalesOrderInput,
	KatanaCreateSupplierInput,
	KatanaCustomer,
	KatanaInventory,
	KatanaPagination,
	KatanaRateLimit,
	KatanaManufacturingOrder,
	KatanaMaterial,
	KatanaProduct,
	KatanaProductVariantInput,
	KatanaPurchaseOrder,
	KatanaPurchaseOrderRowInput,
	KatanaNormalizedSalesOrder,
	KatanaNormalizedSalesOrderRow,
	KatanaQuerySalesOrderScope,
	KatanaSalesOrder,
	KatanaSalesOrderRowInput,
	KatanaSupplier,
	KatanaUpdateCustomerInput,
	KatanaUpdateManufacturingOrderInput,
	KatanaUpdateProductInput,
	KatanaUpdatePurchaseOrderInput,
	KatanaUpdateSalesOrderInput
} from './contracts'
import {
	katanaInventoryRawSchema,
	katanaPaginationSchema,
	katanaRateLimitSchema,
	katanaRawRecordSchema
} from './contracts'

export const KATANA_API_BASE = 'https://api.katanamrp.com/v1'

const katanaRateLimitHeadersSchema = z.object({
	limit: z.coerce.number().int().nonnegative(),
	remaining: z.coerce.number().int().nonnegative(),
	reset_at_ms: z.coerce.number().int().nonnegative()
})

function parseKatanaPaginationHeader(headers: Headers): KatanaPagination {
	const raw = headers.get('x-pagination')
	if (raw === null) {
		throw new ToolError('Katana response is missing X-Pagination', { code: 'upstream' })
	}
	let value: unknown
	try {
		value = JSON.parse(raw)
	} catch (error) {
		throw new ToolError('Katana returned malformed X-Pagination JSON', { code: 'upstream', cause: error })
	}
	const parsed = katanaPaginationSchema.safeParse(value)
	if (!parsed.success) {
		throw new ToolError('Katana returned invalid X-Pagination metadata', {
			code: 'upstream',
			details: { issues: parsed.error.issues.map((issue) => issue.message) }
		})
	}
	return parsed.data
}

function parseKatanaRateLimitHeaders(headers: Headers): KatanaRateLimit | undefined {
	const limit = headers.get('x-ratelimit-limit')
	const remaining = headers.get('x-ratelimit-remaining')
	const resetAtMs = headers.get('x-ratelimit-reset')
	if (limit === null && remaining === null && resetAtMs === null) return undefined
	if (limit === null || remaining === null || resetAtMs === null) {
		throw new ToolError('Katana returned incomplete rate-limit metadata', { code: 'upstream' })
	}
	const parsed = katanaRateLimitHeadersSchema.safeParse({ limit, remaining, reset_at_ms: resetAtMs })
	if (!parsed.success) {
		throw new ToolError('Katana returned invalid rate-limit metadata', { code: 'upstream' })
	}
	return katanaRateLimitSchema.parse(parsed.data)
}

export function parseKatanaPage<T>(
	data: unknown,
	headers: Headers,
	itemSchema: z.ZodType<T>,
	label: string
): { items: T[]; pagination: KatanaPagination; rate_limit?: KatanaRateLimit } {
	const parsedItems = z.array(itemSchema).safeParse(data)
	if (!parsedItems.success) {
		throw new ToolError(`Katana returned an invalid ${label} array`, {
			code: 'upstream',
			details: { issues: parsedItems.error.issues.map((issue) => issue.message) }
		})
	}
	const rateLimit = parseKatanaRateLimitHeaders(headers)
	return {
		items: parsedItems.data,
		pagination: parseKatanaPaginationHeader(headers),
		...(rateLimit && { rate_limit: rateLimit })
	}
}

export function pageFromCursor(cursor: string | undefined): number {
	if (!cursor) return 1
	const n = Number.parseInt(cursor, 10)
	if (!Number.isFinite(n) || n < 1) {
		throw new ToolError('Invalid list cursor', { code: 'bad_input', details: { cursor } })
	}
	return n
}

function optionalString(value: unknown): string | undefined {
	return isString(value) ? value : undefined
}

function optionalNumber(value: unknown): number | undefined {
	if (typeof value === 'number' && Number.isFinite(value)) return value
	// Katana often returns decimal quantities/money as strings (e.g. "1.00000").
	if (isString(value) && value.trim().length > 0) {
		const n = Number(value)
		if (Number.isFinite(n)) return n
	}
	return undefined
}

function optionalBoolean(value: unknown): boolean | undefined {
	return typeof value === 'boolean' ? value : undefined
}

export function unwrapResource(data: unknown): unknown {
	const parsed = z.looseObject({ data: z.unknown().optional() }).safeParse(data)
	if (parsed.success && 'data' in parsed.data) {
		return parsed.data.data
	}
	return data
}

// ── Resource parsers ────────────────────────────────────────────────────────

export function parseSalesOrder(input: unknown): KatanaSalesOrder {
	const parsed = katanaRawRecordSchema.safeParse(input)
	if (!parsed.success) {
		throw new ToolError('Katana returned an invalid sales order', { code: 'upstream' })
	}
	const value = parsed.data
	const totalRaw = value['total'] ?? value['total_price']
	const total = optionalNumber(totalRaw)
	const orderNo = optionalString(value['order_no'])
	const status = optionalString(value['status'])
	const customerId = optionalNumber(value['customer_id'])
	const orderCreatedDate = optionalString(value['order_created_date'])
	const deliveryDate = optionalString(value['delivery_date'])
	const locationId = optionalNumber(value['location_id'])
	const currency = optionalString(value['currency'])
	const additionalInfo = optionalString(value['additional_info'])
	const customerRef = optionalString(value['customer_ref'])
	const createdAt = optionalString(value['created_at'])
	return {
		id: value['id'],
		...(orderNo && { order_no: orderNo }),
		...(status && { status }),
		...(customerId !== undefined && { customer_id: customerId }),
		...(orderCreatedDate && { order_created_date: orderCreatedDate }),
		...(deliveryDate && { delivery_date: deliveryDate }),
		...(locationId !== undefined && { location_id: locationId }),
		...(currency && { currency }),
		...(total !== undefined && { total }),
		...(additionalInfo !== undefined && { additional_info: additionalInfo }),
		...(customerRef !== undefined && { customer_ref: customerRef }),
		...(createdAt && { created_at: createdAt })
	}
}

/**
 * Wire query params for GET /sales_orders date windows.
 * Spike (Katana docs): `created_at_min` / `created_at_max` only — no `order_created_date` list filter.
 * `order_created_*` scopes are applied client-side after list (see matchOrderCreatedDateScope).
 */
/** Client-side filter for order_created_date when the list endpoint cannot express it. */
export function matchOrderCreatedDateScope(
	orderCreatedDate: string | undefined,
	scope: KatanaQuerySalesOrderScope
): boolean {
	if (!scope.order_created_from && !scope.order_created_to) return true
	if (!orderCreatedDate) return false
	if (scope.order_created_from && orderCreatedDate < scope.order_created_from) return false
	if (scope.order_created_to && orderCreatedDate > scope.order_created_to) return false
	return true
}

/**
 * Convert a major-unit money amount to safe integer cents.
 * Rounds half away from zero via Math.round after * 100.
 */
export function moneyToSafeCents(amount: number): number {
	if (!Number.isFinite(amount)) {
		throw new ToolError('Invalid money amount for cents conversion', {
			code: 'upstream',
			details: { amount }
		})
	}
	const cents = Math.round(amount * 100)
	if (!Number.isSafeInteger(cents)) {
		throw new ToolError('Money amount exceeds safe integer cents range', {
			code: 'upstream',
			details: { amount }
		})
	}
	return cents
}

/** Line revenue cents: quantity * price_per_unit - total_discount (tax exclusive). */
export function lineTaxExclusiveTotalCents(quantity: number, pricePerUnit: number, totalDiscount: number): number {
	return moneyToSafeCents(quantity * pricePerUnit - totalDiscount)
}

export type ParsedSalesOrderRow = {
	sales_order_id: number
	quantity: number
	variant_id?: number
	price_per_unit: number
	total_discount: number
	sku?: string
	/** Unit cost from extended variant when present. */
	unit_cost?: number
}

export function parseSalesOrderRow(input: unknown): ParsedSalesOrderRow {
	const parsed = z.looseObject({}).safeParse(input)
	if (!parsed.success) {
		throw new ToolError('Katana returned an invalid sales order row', { code: 'upstream' })
	}
	const value = parsed.data
	const salesOrderId = optionalNumber(value['sales_order_id'])
	const quantity = optionalNumber(value['quantity'])
	if (salesOrderId === undefined || quantity === undefined) {
		throw new ToolError('Katana sales order row missing sales_order_id or quantity', { code: 'upstream' })
	}
	const pricePerUnit = optionalNumber(value['price_per_unit']) ?? 0
	const totalDiscount = optionalNumber(value['total_discount']) ?? 0
	const variantId = optionalNumber(value['variant_id'])
	const variant = value['variant']
	let sku = optionalString(value['sku'])
	let unitCost: number | undefined
	const parsedVariant = z.looseObject({}).safeParse(variant)
	if (parsedVariant.success) {
		sku = sku ?? optionalString(parsedVariant.data['sku'])
		unitCost =
			optionalNumber(parsedVariant.data['purchase_price']) ??
			optionalNumber(parsedVariant.data['average_cost']) ??
			optionalNumber(parsedVariant.data['cost_per_unit'])
	}
	return {
		sales_order_id: salesOrderId,
		quantity,
		price_per_unit: pricePerUnit,
		total_discount: totalDiscount,
		...(variantId !== undefined && { variant_id: variantId }),
		...(sku && { sku }),
		...(unitCost !== undefined && { unit_cost: unitCost })
	}
}

export function normalizeSalesOrderRow(rows: readonly ParsedSalesOrderRow[]): KatanaNormalizedSalesOrderRow[] {
	return rows.map((row) => ({
		quantity: row.quantity,
		tax_exclusive_total_cents: lineTaxExclusiveTotalCents(row.quantity, row.price_per_unit, row.total_discount),
		cogs_value_cents: moneyToSafeCents((row.unit_cost ?? 0) * row.quantity),
		...(row.sku && { sku: row.sku })
	}))
}

export function normalizeSalesOrderHeader(
	order: KatanaSalesOrder,
	customerName: string | undefined,
	rows: KatanaNormalizedSalesOrderRow[]
): KatanaNormalizedSalesOrder {
	return {
		id: order.id,
		...(order.created_at && { created_at: order.created_at }),
		...(order.order_created_date && { order_created_date: order.order_created_date }),
		...(order.order_no && { order_no: order.order_no }),
		...(order.status && { status: order.status }),
		...(order.customer_id !== undefined && { customer_id: order.customer_id }),
		...(customerName && { customer_name: customerName }),
		rows
	}
}

/** Parse optional created_at onto a sales order (used by composite enrichment). */
export function parseSalesOrderCreatedAt(value: unknown): string | undefined {
	const parsed = z.looseObject({ created_at: z.string().optional() }).safeParse(value)
	return parsed.success ? parsed.data.created_at : undefined
}

export function parseProduct(input: unknown): KatanaProduct {
	const parsed = katanaRawRecordSchema.safeParse(input)
	if (!parsed.success) {
		throw new ToolError('Katana returned an invalid product', { code: 'upstream' })
	}
	const value = parsed.data
	const name = optionalString(value['name'])
	const uom = optionalString(value['uom'])
	const categoryName = optionalString(value['category_name'])
	const isSellable = optionalBoolean(value['is_sellable'])
	const isProducible = optionalBoolean(value['is_producible'])
	const isPurchasable = optionalBoolean(value['is_purchasable'])
	const type = optionalString(value['type'])
	const defaultSupplierId = optionalNumber(value['default_supplier_id'])
	const additionalInfo = optionalString(value['additional_info'])
	return {
		id: value['id'],
		...(name && { name }),
		...(uom && { uom }),
		...(categoryName && { category_name: categoryName }),
		...(isSellable !== undefined && { is_sellable: isSellable }),
		...(isProducible !== undefined && { is_producible: isProducible }),
		...(isPurchasable !== undefined && { is_purchasable: isPurchasable }),
		...(type && { type }),
		...(defaultSupplierId !== undefined && { default_supplier_id: defaultSupplierId }),
		...(additionalInfo !== undefined && { additional_info: additionalInfo })
	}
}

export function parseMaterial(input: unknown): KatanaMaterial {
	const parsed = katanaRawRecordSchema.safeParse(input)
	if (!parsed.success) {
		throw new ToolError('Katana returned an invalid material', { code: 'upstream' })
	}
	const value = parsed.data
	const name = optionalString(value['name'])
	const uom = optionalString(value['uom'])
	const categoryName = optionalString(value['category_name'])
	const isSellable = optionalBoolean(value['is_sellable'])
	const type = optionalString(value['type'])
	const defaultSupplierId = optionalNumber(value['default_supplier_id'])
	const additionalInfo = optionalString(value['additional_info'])
	return {
		id: value['id'],
		...(name && { name }),
		...(uom && { uom }),
		...(categoryName && { category_name: categoryName }),
		...(isSellable !== undefined && { is_sellable: isSellable }),
		...(type && { type }),
		...(defaultSupplierId !== undefined && { default_supplier_id: defaultSupplierId }),
		...(additionalInfo !== undefined && { additional_info: additionalInfo })
	}
}

export function parseCustomer(input: unknown): KatanaCustomer {
	const parsed = katanaRawRecordSchema.safeParse(input)
	if (!parsed.success) {
		throw new ToolError('Katana returned an invalid customer', { code: 'upstream' })
	}
	const value = parsed.data
	const name = optionalString(value['name'])
	const firstName = optionalString(value['first_name'])
	const lastName = optionalString(value['last_name'])
	const company = optionalString(value['company'])
	const email = optionalString(value['email'])
	const phone = optionalString(value['phone'])
	const currency = optionalString(value['currency'])
	const comment = optionalString(value['comment'])
	const referenceId = optionalString(value['reference_id'])
	const category = optionalString(value['category'])
	return {
		id: value['id'],
		...(name && { name }),
		...(firstName !== undefined && { first_name: firstName }),
		...(lastName !== undefined && { last_name: lastName }),
		...(company !== undefined && { company }),
		...(email !== undefined && { email }),
		...(phone !== undefined && { phone }),
		...(currency && { currency }),
		...(comment !== undefined && { comment }),
		...(referenceId !== undefined && { reference_id: referenceId }),
		...(category !== undefined && { category })
	}
}

export function parseSupplier(input: unknown): KatanaSupplier {
	const parsed = katanaRawRecordSchema.safeParse(input)
	if (!parsed.success) {
		throw new ToolError('Katana returned an invalid supplier', { code: 'upstream' })
	}
	const value = parsed.data
	const name = optionalString(value['name'])
	const email = optionalString(value['email'])
	const phone = optionalString(value['phone'])
	const currency = optionalString(value['currency'])
	const comment = optionalString(value['comment'])
	return {
		id: value['id'],
		...(name && { name }),
		...(email !== undefined && { email }),
		...(phone !== undefined && { phone }),
		...(currency && { currency }),
		...(comment !== undefined && { comment })
	}
}

export function parsePurchaseOrder(input: unknown): KatanaPurchaseOrder {
	const parsed = katanaRawRecordSchema.safeParse(input)
	if (!parsed.success) {
		throw new ToolError('Katana returned an invalid purchase order', { code: 'upstream' })
	}
	const value = parsed.data
	const orderNo = optionalString(value['order_no'])
	const status = optionalString(value['status'])
	const supplierId = optionalNumber(value['supplier_id'])
	const locationId = optionalNumber(value['location_id'])
	const currency = optionalString(value['currency'])
	const entityType = optionalString(value['entity_type'])
	const orderCreatedDate = optionalString(value['order_created_date'])
	const expectedArrivalDate = optionalString(value['expected_arrival_date'])
	const total = optionalNumber(value['total'])
	const additionalInfo = optionalString(value['additional_info'])
	return {
		id: value['id'],
		...(orderNo && { order_no: orderNo }),
		...(status && { status }),
		...(supplierId !== undefined && { supplier_id: supplierId }),
		...(locationId !== undefined && { location_id: locationId }),
		...(currency && { currency }),
		...(entityType && { entity_type: entityType }),
		...(orderCreatedDate && { order_created_date: orderCreatedDate }),
		...(expectedArrivalDate && { expected_arrival_date: expectedArrivalDate }),
		...(total !== undefined && { total }),
		...(additionalInfo !== undefined && { additional_info: additionalInfo })
	}
}

export function parseManufacturingOrder(input: unknown): KatanaManufacturingOrder {
	const parsed = katanaRawRecordSchema.safeParse(input)
	if (!parsed.success) {
		throw new ToolError('Katana returned an invalid manufacturing order', { code: 'upstream' })
	}
	const value = parsed.data
	const orderNo = optionalString(value['order_no'])
	const status = optionalString(value['status'])
	const variantId = optionalNumber(value['variant_id'])
	const locationId = optionalNumber(value['location_id'])
	const plannedQuantity = optionalNumber(value['planned_quantity'])
	const actualQuantity = optionalNumber(value['actual_quantity'])
	const orderCreatedDate = optionalString(value['order_created_date'])
	const productionDeadlineDate = optionalString(value['production_deadline_date'])
	const ingredientAvailability = optionalString(value['ingredient_availability'])
	const additionalInfo = optionalString(value['additional_info'])
	const salesOrderId = optionalNumber(value['sales_order_id'])
	return {
		id: value['id'],
		...(orderNo && { order_no: orderNo }),
		...(status && { status }),
		...(variantId !== undefined && { variant_id: variantId }),
		...(locationId !== undefined && { location_id: locationId }),
		...(plannedQuantity !== undefined && { planned_quantity: plannedQuantity }),
		...(actualQuantity !== undefined && { actual_quantity: actualQuantity }),
		...(orderCreatedDate && { order_created_date: orderCreatedDate }),
		...(productionDeadlineDate && { production_deadline_date: productionDeadlineDate }),
		...(ingredientAvailability && { ingredient_availability: ingredientAvailability }),
		...(additionalInfo !== undefined && { additional_info: additionalInfo }),
		...(salesOrderId !== undefined && { sales_order_id: salesOrderId })
	}
}

export function parseInventory(input: unknown): KatanaInventory {
	const parsed = katanaInventoryRawSchema.safeParse(input)
	if (!parsed.success) {
		throw new ToolError('Katana returned an invalid inventory row', { code: 'upstream' })
	}
	const value = parsed.data
	const quantityInStock = optionalNumber(value['quantity_in_stock'])
	const quantityCommitted = optionalNumber(value['quantity_committed'])
	const quantityExpected = optionalNumber(value['quantity_expected'])
	const quantityMissingOrExcess = optionalNumber(value['quantity_missing_or_excess'])
	const safetyStockLevel = optionalNumber(value['safety_stock_level'])
	const averageCost = optionalNumber(value['average_cost'])
	const valueInStock = optionalNumber(value['value_in_stock'])
	return {
		variant_id: value['variant_id'],
		location_id: value['location_id'],
		...(quantityInStock !== undefined && { quantity_in_stock: quantityInStock }),
		...(quantityCommitted !== undefined && { quantity_committed: quantityCommitted }),
		...(quantityExpected !== undefined && { quantity_expected: quantityExpected }),
		...(quantityMissingOrExcess !== undefined && {
			quantity_missing_or_excess: quantityMissingOrExcess
		}),
		...(safetyStockLevel !== undefined && { safety_stock_level: safetyStockLevel }),
		...(averageCost !== undefined && { average_cost: averageCost }),
		...(valueInStock !== undefined && { value_in_stock: valueInStock })
	}
}

// ── Write bodies ────────────────────────────────────────────────────────────

function salesOrderRowBody(row: KatanaSalesOrderRowInput): Record<string, number> {
	return {
		quantity: row.quantity,
		variant_id: row.variant_id,
		...(row.tax_rate_id !== undefined && { tax_rate_id: row.tax_rate_id }),
		...(row.location_id !== undefined && { location_id: row.location_id }),
		...(row.price_per_unit !== undefined && { price_per_unit: row.price_per_unit }),
		...(row.total_discount !== undefined && { total_discount: row.total_discount })
	}
}

export function salesOrderCreateBody(input: KatanaCreateSalesOrderInput): Record<string, unknown> {
	return {
		customer_id: input.customer_id,
		sales_order_rows: input.sales_order_rows.map(salesOrderRowBody),
		...(input.order_no && { order_no: input.order_no }),
		...(input.order_created_date && { order_created_date: input.order_created_date }),
		...(input.delivery_date && { delivery_date: input.delivery_date }),
		...(input.currency && { currency: input.currency }),
		...(input.location_id !== undefined && { location_id: input.location_id }),
		...(input.status && { status: input.status }),
		...(input.additional_info !== undefined && { additional_info: input.additional_info }),
		...(input.customer_ref !== undefined && { customer_ref: input.customer_ref })
	}
}

export function salesOrderUpdateBody(
	input: Omit<KatanaUpdateSalesOrderInput, 'sales_order_id'>
): Record<string, unknown> {
	return {
		...(input.order_no && { order_no: input.order_no }),
		...(input.customer_id !== undefined && { customer_id: input.customer_id }),
		...(input.order_created_date && { order_created_date: input.order_created_date }),
		...(input.delivery_date && { delivery_date: input.delivery_date }),
		...(input.location_id !== undefined && { location_id: input.location_id }),
		...(input.status && { status: input.status }),
		...(input.currency && { currency: input.currency }),
		...(input.additional_info !== undefined && { additional_info: input.additional_info }),
		...(input.customer_ref !== undefined && { customer_ref: input.customer_ref })
	}
}

function productVariantBody(variant: KatanaProductVariantInput): Record<string, string | number> {
	return {
		...(variant.sku && { sku: variant.sku }),
		...(variant.sales_price !== undefined && { sales_price: variant.sales_price }),
		...(variant.purchase_price !== undefined && { purchase_price: variant.purchase_price })
	}
}

export function productCreateBody(input: KatanaCreateProductInput): Record<string, unknown> {
	return {
		name: input.name,
		variants: input.variants.map(productVariantBody),
		...(input.uom && { uom: input.uom }),
		...(input.category_name && { category_name: input.category_name }),
		...(input.is_sellable !== undefined && { is_sellable: input.is_sellable }),
		...(input.is_producible !== undefined && { is_producible: input.is_producible }),
		...(input.is_purchasable !== undefined && { is_purchasable: input.is_purchasable }),
		...(input.is_auto_assembly !== undefined && { is_auto_assembly: input.is_auto_assembly }),
		...(input.default_supplier_id !== undefined && {
			default_supplier_id: input.default_supplier_id
		}),
		...(input.additional_info !== undefined && { additional_info: input.additional_info }),
		...(input.batch_tracked !== undefined && { batch_tracked: input.batch_tracked }),
		...(input.serial_tracked !== undefined && { serial_tracked: input.serial_tracked })
	}
}

export function productUpdateBody(input: Omit<KatanaUpdateProductInput, 'product_id'>): Record<string, unknown> {
	return {
		...(input.name && { name: input.name }),
		...(input.uom && { uom: input.uom }),
		...(input.category_name !== undefined && { category_name: input.category_name }),
		...(input.is_sellable !== undefined && { is_sellable: input.is_sellable }),
		...(input.is_producible !== undefined && { is_producible: input.is_producible }),
		...(input.is_purchasable !== undefined && { is_purchasable: input.is_purchasable }),
		...(input.is_auto_assembly !== undefined && { is_auto_assembly: input.is_auto_assembly }),
		...(input.default_supplier_id !== undefined && {
			default_supplier_id: input.default_supplier_id
		}),
		...(input.additional_info !== undefined && { additional_info: input.additional_info }),
		...(input.batch_tracked !== undefined && { batch_tracked: input.batch_tracked }),
		...(input.serial_tracked !== undefined && { serial_tracked: input.serial_tracked })
	}
}

export function customerWriteBody(
	input: KatanaCreateCustomerInput | Omit<KatanaUpdateCustomerInput, 'customer_id'>
): Record<string, unknown> {
	const name = 'name' in input ? input.name : undefined
	return {
		...(name && { name }),
		...(input.first_name !== undefined && { first_name: input.first_name }),
		...(input.last_name !== undefined && { last_name: input.last_name }),
		...(input.company !== undefined && { company: input.company }),
		...(input.email !== undefined && { email: input.email }),
		...(input.phone !== undefined && { phone: input.phone }),
		...(input.currency && { currency: input.currency }),
		...(input.reference_id !== undefined && { reference_id: input.reference_id }),
		...(input.category !== undefined && { category: input.category }),
		...(input.comment !== undefined && { comment: input.comment }),
		...(input.discount_rate !== undefined && { discount_rate: input.discount_rate })
	}
}

export function supplierCreateBody(input: KatanaCreateSupplierInput): Record<string, unknown> {
	return {
		name: input.name,
		...(input.currency && { currency: input.currency }),
		...(input.email !== undefined && { email: input.email }),
		...(input.phone !== undefined && { phone: input.phone }),
		...(input.comment !== undefined && { comment: input.comment })
	}
}

function purchaseOrderRowBody(row: KatanaPurchaseOrderRowInput): Record<string, string | number> {
	return {
		quantity: row.quantity,
		variant_id: row.variant_id,
		price_per_unit: row.price_per_unit,
		...(row.tax_rate_id !== undefined && { tax_rate_id: row.tax_rate_id }),
		...(row.purchase_uom && { purchase_uom: row.purchase_uom }),
		...(row.purchase_uom_conversion_rate !== undefined && {
			purchase_uom_conversion_rate: row.purchase_uom_conversion_rate
		}),
		...(row.arrival_date && { arrival_date: row.arrival_date })
	}
}

export function purchaseOrderCreateBody(input: KatanaCreatePurchaseOrderInput): Record<string, unknown> {
	return {
		supplier_id: input.supplier_id,
		location_id: input.location_id,
		purchase_order_rows: input.purchase_order_rows.map(purchaseOrderRowBody),
		...(input.order_no && { order_no: input.order_no }),
		...(input.entity_type && { entity_type: input.entity_type }),
		...(input.currency && { currency: input.currency }),
		...(input.status && { status: input.status }),
		...(input.expected_arrival_date && { expected_arrival_date: input.expected_arrival_date }),
		...(input.order_created_date && { order_created_date: input.order_created_date }),
		...(input.additional_info !== undefined && { additional_info: input.additional_info })
	}
}

export function purchaseOrderUpdateBody(
	input: Omit<KatanaUpdatePurchaseOrderInput, 'purchase_order_id'>
): Record<string, unknown> {
	return {
		...(input.order_no && { order_no: input.order_no }),
		...(input.supplier_id !== undefined && { supplier_id: input.supplier_id }),
		...(input.location_id !== undefined && { location_id: input.location_id }),
		...(input.currency && { currency: input.currency }),
		...(input.status && { status: input.status }),
		...(input.expected_arrival_date && { expected_arrival_date: input.expected_arrival_date }),
		...(input.order_created_date && { order_created_date: input.order_created_date }),
		...(input.additional_info !== undefined && { additional_info: input.additional_info })
	}
}

export function manufacturingOrderCreateBody(input: KatanaCreateManufacturingOrderInput): Record<string, unknown> {
	return {
		variant_id: input.variant_id,
		location_id: input.location_id,
		planned_quantity: input.planned_quantity,
		...(input.order_no && { order_no: input.order_no }),
		...(input.order_created_date && { order_created_date: input.order_created_date }),
		...(input.production_deadline_date && {
			production_deadline_date: input.production_deadline_date
		}),
		...(input.additional_info !== undefined && { additional_info: input.additional_info }),
		...(input.status && { status: input.status })
	}
}

export function manufacturingOrderUpdateBody(
	input: Omit<KatanaUpdateManufacturingOrderInput, 'manufacturing_order_id'>
): Record<string, unknown> {
	return {
		...(input.order_no && { order_no: input.order_no }),
		...(input.planned_quantity !== undefined && { planned_quantity: input.planned_quantity }),
		...(input.actual_quantity !== undefined && { actual_quantity: input.actual_quantity }),
		...(input.order_created_date && { order_created_date: input.order_created_date }),
		...(input.production_deadline_date && {
			production_deadline_date: input.production_deadline_date
		}),
		...(input.additional_info !== undefined && { additional_info: input.additional_info }),
		...(input.status && { status: input.status })
	}
}
