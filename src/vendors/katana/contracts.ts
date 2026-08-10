import { z } from 'zod'

export const katanaAuthSchema = z.object({
	api_key: z.string().min(1).describe('Katana MRP Bearer access token')
})

export type KatanaAuth = z.infer<typeof katanaAuthSchema>

// ── Shared ──────────────────────────────────────────────────────────────────

const listCursorFields = {
	cursor: z.string().min(1).optional().describe('Page number from a prior next_cursor'),
	limit: z.int().min(1).max(250).optional().describe('Page size (1-250, default 50)')
}

const listOutputMeta = {
	next_cursor: z.string().optional(),
	truncated: z.boolean()
}

const katanaPageSchema = z.int().min(1).optional()
const katanaPageLimitSchema = z.int().min(1).max(250).optional()
const katanaTimestampFilterSchema = z.iso.datetime({ offset: true }).optional()

export const katanaRawRecordSchema = z.looseObject({
	id: z.number().int(),
	created_at: z.string().optional(),
	updated_at: z.string().optional(),
	deleted_at: z.string().nullable().optional()
})

export const katanaSalesOrderRawSchema = katanaRawRecordSchema
export const katanaProductRawSchema = katanaRawRecordSchema
export const katanaMaterialRawSchema = katanaRawRecordSchema
export const katanaCustomerRawSchema = katanaRawRecordSchema
export const katanaSupplierRawSchema = katanaRawRecordSchema
export const katanaPurchaseOrderRawSchema = katanaRawRecordSchema
export const katanaManufacturingOrderRawSchema = katanaRawRecordSchema

export const katanaInventoryRawSchema = z.looseObject({
	variant_id: z.number().int(),
	location_id: z.number().int(),
	created_at: z.string().optional(),
	updated_at: z.string().optional(),
	deleted_at: z.string().nullable().optional()
})

export const katanaPaginationSchema = z.object({
	total_records: z.number().int().nonnegative(),
	total_pages: z.number().int().nonnegative(),
	offset: z.number().int().nonnegative(),
	page: z.number().int().min(1),
	first_page: z.boolean(),
	last_page: z.boolean()
})

export const katanaRateLimitSchema = z.object({
	limit: z.number().int().nonnegative(),
	remaining: z.number().int().nonnegative(),
	reset_at_ms: z.number().int().nonnegative()
})

export const katanaListSalesOrdersPageInputSchema = z.strictObject({
	page: katanaPageSchema,
	limit: katanaPageLimitSchema,
	status: z.string().min(1).optional(),
	customer_id: z.int().positive().optional(),
	order_no: z.string().min(1).optional(),
	location_id: z.int().positive().optional(),
	created_at_min: katanaTimestampFilterSchema,
	created_at_max: katanaTimestampFilterSchema,
	updated_at_min: katanaTimestampFilterSchema,
	updated_at_max: katanaTimestampFilterSchema,
	include_deleted: z.boolean().optional()
})

export const katanaListProductsPageInputSchema = z.strictObject({
	page: katanaPageSchema,
	limit: katanaPageLimitSchema,
	name: z.string().min(1).optional(),
	is_sellable: z.boolean().optional(),
	is_producible: z.boolean().optional(),
	is_purchasable: z.boolean().optional(),
	created_at_min: katanaTimestampFilterSchema,
	created_at_max: katanaTimestampFilterSchema,
	updated_at_min: katanaTimestampFilterSchema,
	updated_at_max: katanaTimestampFilterSchema,
	include_deleted: z.boolean().optional(),
	include_archived: z.boolean().optional()
})

export const katanaListMaterialsPageInputSchema = z.strictObject({
	page: katanaPageSchema,
	limit: katanaPageLimitSchema,
	name: z.string().min(1).optional(),
	created_at_min: katanaTimestampFilterSchema,
	created_at_max: katanaTimestampFilterSchema,
	updated_at_min: katanaTimestampFilterSchema,
	updated_at_max: katanaTimestampFilterSchema,
	include_deleted: z.boolean().optional(),
	include_archived: z.boolean().optional()
})

export const katanaListCustomersPageInputSchema = z.strictObject({
	page: katanaPageSchema,
	limit: katanaPageLimitSchema,
	name: z.string().min(1).optional(),
	email: z.string().min(1).optional(),
	created_at_min: katanaTimestampFilterSchema,
	created_at_max: katanaTimestampFilterSchema,
	updated_at_min: katanaTimestampFilterSchema,
	updated_at_max: katanaTimestampFilterSchema,
	include_deleted: z.boolean().optional()
})

export const katanaListSuppliersPageInputSchema = z.strictObject({
	page: katanaPageSchema,
	limit: katanaPageLimitSchema,
	name: z.string().min(1).optional(),
	created_at_min: katanaTimestampFilterSchema,
	created_at_max: katanaTimestampFilterSchema,
	updated_at_min: katanaTimestampFilterSchema,
	updated_at_max: katanaTimestampFilterSchema,
	include_deleted: z.boolean().optional()
})

export const katanaListPurchaseOrdersPageInputSchema = z.strictObject({
	page: katanaPageSchema,
	limit: katanaPageLimitSchema,
	status: z.string().min(1).optional(),
	supplier_id: z.int().positive().optional(),
	order_no: z.string().min(1).optional(),
	location_id: z.int().positive().optional(),
	created_at_min: katanaTimestampFilterSchema,
	created_at_max: katanaTimestampFilterSchema,
	updated_at_min: katanaTimestampFilterSchema,
	updated_at_max: katanaTimestampFilterSchema,
	include_deleted: z.boolean().optional()
})

export const katanaListManufacturingOrdersPageInputSchema = z.strictObject({
	page: katanaPageSchema,
	limit: katanaPageLimitSchema,
	status: z.string().min(1).optional(),
	variant_id: z.int().positive().optional(),
	location_id: z.int().positive().optional(),
	order_no: z.string().min(1).optional(),
	created_at_min: katanaTimestampFilterSchema,
	created_at_max: katanaTimestampFilterSchema,
	updated_at_min: katanaTimestampFilterSchema,
	updated_at_max: katanaTimestampFilterSchema,
	include_deleted: z.boolean().optional()
})

export const katanaListInventoryPageInputSchema = z.strictObject({
	page: katanaPageSchema,
	limit: katanaPageLimitSchema,
	location_id: z.int().positive().optional(),
	variant_id: z.array(z.int().positive()).min(1).optional(),
	include_archived: z.boolean().optional(),
	extend: z
		.array(z.enum(['variant', 'location']))
		.min(1)
		.optional()
})

const katanaPageOutputMeta = {
	pagination: katanaPaginationSchema,
	rate_limit: katanaRateLimitSchema.optional()
}

export const katanaListSalesOrdersPageOutputSchema = z.object({
	items: z.array(katanaSalesOrderRawSchema),
	...katanaPageOutputMeta
})
export const katanaListProductsPageOutputSchema = z.object({
	items: z.array(katanaProductRawSchema),
	...katanaPageOutputMeta
})
export const katanaListMaterialsPageOutputSchema = z.object({
	items: z.array(katanaMaterialRawSchema),
	...katanaPageOutputMeta
})
export const katanaListCustomersPageOutputSchema = z.object({
	items: z.array(katanaCustomerRawSchema),
	...katanaPageOutputMeta
})
export const katanaListSuppliersPageOutputSchema = z.object({
	items: z.array(katanaSupplierRawSchema),
	...katanaPageOutputMeta
})
export const katanaListPurchaseOrdersPageOutputSchema = z.object({
	items: z.array(katanaPurchaseOrderRawSchema),
	...katanaPageOutputMeta
})
export const katanaListManufacturingOrdersPageOutputSchema = z.object({
	items: z.array(katanaManufacturingOrderRawSchema),
	...katanaPageOutputMeta
})
export const katanaListInventoryPageOutputSchema = z.object({
	items: z.array(katanaInventoryRawSchema),
	...katanaPageOutputMeta
})

// ── Sales orders ────────────────────────────────────────────────────────────

export const katanaSalesOrderRowInputSchema = z.object({
	quantity: z.number().positive().describe('Line quantity'),
	variant_id: z.int().positive().describe('Product variant id'),
	tax_rate_id: z.int().positive().optional().describe('Tax rate id'),
	location_id: z.int().positive().optional().describe('Ship-from location id for this row'),
	price_per_unit: z.number().min(0).optional().describe('Unit price excluding tax'),
	total_discount: z.number().min(0).optional().describe('Line discount total')
})

export const katanaSalesOrderSchema = z.object({
	id: z.number(),
	order_no: z.string().optional(),
	status: z.string().optional(),
	customer_id: z.number().optional(),
	order_created_date: z.string().optional(),
	delivery_date: z.string().optional(),
	location_id: z.number().optional(),
	currency: z.string().optional(),
	total: z.number().optional(),
	additional_info: z.string().optional(),
	customer_ref: z.string().optional(),
	created_at: z.string().optional().describe('Resource created_at timestamp when returned by Katana')
})

export const katanaListSalesOrdersInputSchema = z.object({
	status: z.string().min(1).optional().describe('Sales order status filter'),
	customer_id: z.int().positive().optional().describe('Filter by customer id'),
	order_no: z.string().min(1).optional().describe('Filter by order number'),
	location_id: z.int().positive().optional().describe('Filter by location id'),
	...listCursorFields
})

export const katanaListSalesOrdersOutputSchema = z.object({
	items: z.array(katanaSalesOrderSchema),
	...listOutputMeta
})

export const katanaGetSalesOrderInputSchema = z.object({
	sales_order_id: z.int().positive().describe('Sales order id')
})

export const katanaGetSalesOrderOutputSchema = z.object({
	sales_order: katanaSalesOrderSchema
})

export const katanaCreateSalesOrderInputSchema = z.object({
	customer_id: z.int().positive().describe('Customer id'),
	sales_order_rows: z
		.array(katanaSalesOrderRowInputSchema)
		.min(1)
		.describe('Order line items (variant_id + quantity required)'),
	order_no: z.string().min(1).optional().describe('Order number'),
	order_created_date: z.string().min(1).optional().describe('Order created date (ISO 8601)'),
	delivery_date: z.string().min(1).optional().describe('Delivery date (ISO 8601)'),
	currency: z.string().min(1).optional().describe('ISO 4217 currency code'),
	location_id: z.int().positive().optional().describe('Default ship-from location id'),
	status: z.string().min(1).optional().describe('NOT_SHIPPED (default) or PENDING for quotes'),
	additional_info: z.string().optional().describe('Internal notes'),
	customer_ref: z.string().optional().describe('Customer reference')
})

export const katanaCreateSalesOrderOutputSchema = katanaGetSalesOrderOutputSchema

export const katanaUpdateSalesOrderInputSchema = z.object({
	sales_order_id: z.int().positive().describe('Sales order id'),
	order_no: z.string().min(1).optional().describe('Order number'),
	customer_id: z.int().positive().optional().describe('Customer id'),
	order_created_date: z.string().min(1).optional().describe('Order created date (ISO 8601)'),
	delivery_date: z.string().min(1).optional().describe('Delivery date (ISO 8601)'),
	location_id: z.int().positive().optional().describe('Default ship-from location id'),
	status: z.string().min(1).optional().describe('Order status (e.g. NOT_SHIPPED, PENDING, PACKED, DELIVERED)'),
	currency: z.string().min(1).optional().describe('ISO 4217 currency code'),
	additional_info: z.string().optional().describe('Internal notes'),
	customer_ref: z.string().optional().describe('Customer reference')
})

export const katanaUpdateSalesOrderOutputSchema = katanaGetSalesOrderOutputSchema

export const katanaDeleteSalesOrderInputSchema = z.object({
	sales_order_id: z.int().positive().describe('Sales order id')
})

export const katanaDeleteSalesOrderOutputSchema = z.object({
	deleted: z.boolean(),
	id: z.number()
})

// ── Sales order composite query ─────────────────────────────────────────────

export const katanaQuerySalesOrderScopeSchema = z.object({
	created_from: z
		.string()
		.min(1)
		.optional()
		.describe('ISO 8601 lower bound on resource created_at (maps to created_at_min)'),
	order_created_from: z
		.string()
		.min(1)
		.optional()
		.describe('ISO 8601 lower bound on order_created_date (client-side; list API has no order_created filter)'),
	order_created_to: z
		.string()
		.min(1)
		.optional()
		.describe('ISO 8601 upper bound on order_created_date (client-side; list API has no order_created filter)'),
	statuses: z
		.array(z.string().min(1))
		.min(1)
		.max(20)
		.optional()
		.describe('Sales order statuses to include for this scope (one API list pass each; single status per call)'),
	customer_id: z.int().positive().optional().describe('Filter by customer id'),
	location_id: z.int().positive().optional().describe('Filter by location id')
})

export const katanaQuerySalesOrdersInputSchema = z.object({
	scopes: z
		.array(katanaQuerySalesOrderScopeSchema)
		.min(1)
		.max(20)
		.describe('Independent filter scopes; results are unioned and deduplicated by order id'),
	max_pages_per_list: z
		.int()
		.min(1)
		.max(100)
		.optional()
		.describe('Max sequential pages per scope×status list call (default 20)'),
	page_size: z.int().min(1).max(250).optional().describe('Page size for list calls (default 50)')
})

export const katanaNormalizedSalesOrderRowSchema = z.object({
	sku: z.string().optional().describe('Variant SKU when known'),
	quantity: z.number().describe('Line quantity'),
	tax_exclusive_total_cents: z
		.number()
		.int()
		.describe('Line revenue in safe integer cents: (quantity * price_per_unit - total_discount)'),
	cogs_value_cents: z
		.number()
		.int()
		.describe('Line COGS in safe integer cents when variant cost is available; otherwise 0')
})

export const katanaNormalizedSalesOrderSchema = z.object({
	id: z.number(),
	created_at: z.string().optional().describe('Resource created_at when returned by Katana'),
	order_created_date: z.string().optional(),
	order_no: z.string().optional(),
	status: z.string().optional(),
	customer_id: z.number().optional(),
	customer_name: z.string().optional().describe('Enriched from customers API when available'),
	rows: z.array(katanaNormalizedSalesOrderRowSchema)
})

export const katanaQuerySalesOrdersOutputSchema = z.object({
	orders: z.array(katanaNormalizedSalesOrderSchema),
	order_count: z.number().int().describe('Number of unique orders after deduplication')
})

// ── Products ────────────────────────────────────────────────────────────────

export const katanaProductVariantInputSchema = z.object({
	sku: z.string().min(1).optional().describe('Variant SKU'),
	sales_price: z.number().min(0).optional().describe('Sales price'),
	purchase_price: z.number().min(0).optional().describe('Purchase price')
})

export const katanaProductSchema = z.object({
	id: z.number(),
	name: z.string().optional(),
	uom: z.string().optional(),
	category_name: z.string().optional(),
	is_sellable: z.boolean().optional(),
	is_producible: z.boolean().optional(),
	is_purchasable: z.boolean().optional(),
	type: z.string().optional(),
	default_supplier_id: z.number().optional(),
	additional_info: z.string().optional()
})

export const katanaListProductsInputSchema = z.object({
	name: z.string().min(1).optional().describe('Filter by product name'),
	is_sellable: z.boolean().optional().describe('Filter sellable products'),
	is_producible: z.boolean().optional().describe('Filter producible products'),
	is_purchasable: z.boolean().optional().describe('Filter purchasable products'),
	...listCursorFields
})

export const katanaListProductsOutputSchema = z.object({
	items: z.array(katanaProductSchema),
	...listOutputMeta
})

export const katanaGetProductInputSchema = z.object({
	product_id: z.int().positive().describe('Product id')
})

export const katanaGetProductOutputSchema = z.object({
	product: katanaProductSchema
})

export const katanaCreateProductInputSchema = z.object({
	name: z.string().min(1).describe('Product name'),
	variants: z.array(katanaProductVariantInputSchema).min(1).describe('At least one variant (sku/prices optional)'),
	uom: z.string().min(1).optional().describe('Unit of measure (e.g. pcs)'),
	category_name: z.string().min(1).optional().describe('Category name'),
	is_sellable: z.boolean().optional().describe('Can be sold on sales orders'),
	is_producible: z.boolean().optional().describe('Can be manufactured'),
	is_purchasable: z.boolean().optional().describe('Can be purchased'),
	is_auto_assembly: z.boolean().optional().describe('Bundle/kit auto-assembly'),
	default_supplier_id: z.int().positive().optional().describe('Default supplier id'),
	additional_info: z.string().optional().describe('Internal notes'),
	batch_tracked: z.boolean().optional().describe('Enable batch tracking'),
	serial_tracked: z.boolean().optional().describe('Enable serial tracking')
})

export const katanaCreateProductOutputSchema = katanaGetProductOutputSchema

export const katanaUpdateProductInputSchema = z.object({
	product_id: z.int().positive().describe('Product id'),
	name: z.string().min(1).optional().describe('Product name'),
	uom: z.string().min(1).optional().describe('Unit of measure'),
	category_name: z.string().optional().describe('Category name'),
	is_sellable: z.boolean().optional().describe('Can be sold on sales orders'),
	is_producible: z.boolean().optional().describe('Can be manufactured'),
	is_purchasable: z.boolean().optional().describe('Can be purchased'),
	is_auto_assembly: z.boolean().optional().describe('Bundle/kit auto-assembly'),
	default_supplier_id: z.int().positive().optional().describe('Default supplier id'),
	additional_info: z.string().optional().describe('Internal notes'),
	batch_tracked: z.boolean().optional().describe('Enable batch tracking'),
	serial_tracked: z.boolean().optional().describe('Enable serial tracking')
})

export const katanaUpdateProductOutputSchema = katanaGetProductOutputSchema

// ── Materials ───────────────────────────────────────────────────────────────

export const katanaMaterialSchema = z.object({
	id: z.number(),
	name: z.string().optional(),
	uom: z.string().optional(),
	category_name: z.string().optional(),
	is_sellable: z.boolean().optional(),
	type: z.string().optional(),
	default_supplier_id: z.number().optional(),
	additional_info: z.string().optional()
})

export const katanaListMaterialsInputSchema = z.object({
	name: z.string().min(1).optional().describe('Filter by material name'),
	...listCursorFields
})

export const katanaListMaterialsOutputSchema = z.object({
	items: z.array(katanaMaterialSchema),
	...listOutputMeta
})

export const katanaGetMaterialInputSchema = z.object({
	material_id: z.int().positive().describe('Material id')
})

export const katanaGetMaterialOutputSchema = z.object({
	material: katanaMaterialSchema
})

// ── Customers ───────────────────────────────────────────────────────────────

export const katanaCustomerSchema = z.object({
	id: z.number(),
	name: z.string().optional(),
	first_name: z.string().optional(),
	last_name: z.string().optional(),
	company: z.string().optional(),
	email: z.string().optional(),
	phone: z.string().optional(),
	currency: z.string().optional(),
	comment: z.string().optional(),
	reference_id: z.string().optional(),
	category: z.string().optional()
})

export const katanaListCustomersInputSchema = z.object({
	name: z.string().min(1).optional().describe('Filter by customer name'),
	email: z.string().min(1).optional().describe('Filter by email'),
	...listCursorFields
})

export const katanaListCustomersOutputSchema = z.object({
	items: z.array(katanaCustomerSchema),
	...listOutputMeta
})

export const katanaGetCustomerInputSchema = z.object({
	customer_id: z.int().positive().describe('Customer id')
})

export const katanaGetCustomerOutputSchema = z.object({
	customer: katanaCustomerSchema
})

export const katanaCreateCustomerInputSchema = z.object({
	name: z.string().min(1).describe('Customer display name'),
	first_name: z.string().optional().describe('First name'),
	last_name: z.string().optional().describe('Last name'),
	company: z.string().optional().describe('Company name'),
	email: z.string().optional().describe('Email'),
	phone: z.string().optional().describe('Phone'),
	currency: z.string().min(1).optional().describe('ISO 4217 currency code'),
	reference_id: z.string().optional().describe('External reference id'),
	category: z.string().optional().describe('Customer category'),
	comment: z.string().optional().describe('Internal comment'),
	discount_rate: z.number().optional().describe('Default discount rate')
})

export const katanaCreateCustomerOutputSchema = katanaGetCustomerOutputSchema

export const katanaUpdateCustomerInputSchema = z.object({
	customer_id: z.int().positive().describe('Customer id'),
	name: z.string().min(1).optional().describe('Customer display name'),
	first_name: z.string().optional().describe('First name'),
	last_name: z.string().optional().describe('Last name'),
	company: z.string().optional().describe('Company name'),
	email: z.string().optional().describe('Email'),
	phone: z.string().optional().describe('Phone'),
	currency: z.string().min(1).optional().describe('ISO 4217 currency code'),
	reference_id: z.string().optional().describe('External reference id'),
	category: z.string().optional().describe('Customer category'),
	comment: z.string().optional().describe('Internal comment'),
	discount_rate: z.number().optional().describe('Default discount rate')
})

export const katanaUpdateCustomerOutputSchema = katanaGetCustomerOutputSchema

// ── Suppliers ───────────────────────────────────────────────────────────────

export const katanaSupplierSchema = z.object({
	id: z.number(),
	name: z.string().optional(),
	email: z.string().optional(),
	phone: z.string().optional(),
	currency: z.string().optional(),
	comment: z.string().optional()
})

export const katanaListSuppliersInputSchema = z.object({
	name: z.string().min(1).optional().describe('Filter by supplier name'),
	...listCursorFields
})

export const katanaListSuppliersOutputSchema = z.object({
	items: z.array(katanaSupplierSchema),
	...listOutputMeta
})

export const katanaGetSupplierInputSchema = z.object({
	supplier_id: z.int().positive().describe('Supplier id')
})

export const katanaGetSupplierOutputSchema = z.object({
	supplier: katanaSupplierSchema
})

export const katanaCreateSupplierInputSchema = z.object({
	name: z.string().min(1).describe('Supplier name'),
	currency: z.string().min(1).optional().describe('ISO 4217 currency code'),
	email: z.string().optional().describe('Email'),
	phone: z.string().optional().describe('Phone'),
	comment: z.string().optional().describe('Internal comment')
})

export const katanaCreateSupplierOutputSchema = katanaGetSupplierOutputSchema

// ── Purchase orders ─────────────────────────────────────────────────────────

export const katanaPurchaseOrderRowInputSchema = z.object({
	quantity: z.number().positive().describe('Line quantity'),
	variant_id: z.int().positive().describe('Product or material variant id'),
	price_per_unit: z.number().min(0).describe('Unit price excluding tax'),
	tax_rate_id: z.int().positive().optional().describe('Tax rate id'),
	purchase_uom: z.string().min(1).optional().describe('Purchase unit of measure'),
	purchase_uom_conversion_rate: z.number().min(0).optional().describe('Conversion rate to stock UoM'),
	arrival_date: z.string().min(1).optional().describe('Expected arrival date (ISO 8601)')
})

export const katanaPurchaseOrderSchema = z.object({
	id: z.number(),
	order_no: z.string().optional(),
	status: z.string().optional(),
	supplier_id: z.number().optional(),
	location_id: z.number().optional(),
	currency: z.string().optional(),
	entity_type: z.string().optional(),
	order_created_date: z.string().optional(),
	expected_arrival_date: z.string().optional(),
	total: z.number().optional(),
	additional_info: z.string().optional()
})

export const katanaListPurchaseOrdersInputSchema = z.object({
	status: z.string().min(1).optional().describe('Purchase order status filter'),
	supplier_id: z.int().positive().optional().describe('Filter by supplier id'),
	order_no: z.string().min(1).optional().describe('Filter by order number'),
	location_id: z.int().positive().optional().describe('Filter by location id'),
	...listCursorFields
})

export const katanaListPurchaseOrdersOutputSchema = z.object({
	items: z.array(katanaPurchaseOrderSchema),
	...listOutputMeta
})

export const katanaGetPurchaseOrderInputSchema = z.object({
	purchase_order_id: z.int().positive().describe('Purchase order id')
})

export const katanaGetPurchaseOrderOutputSchema = z.object({
	purchase_order: katanaPurchaseOrderSchema
})

export const katanaCreatePurchaseOrderInputSchema = z.object({
	supplier_id: z.int().positive().describe('Supplier id'),
	location_id: z.int().positive().describe('Receive-to location id'),
	purchase_order_rows: z
		.array(katanaPurchaseOrderRowInputSchema)
		.min(1)
		.describe('Order line items (variant_id, quantity, price_per_unit required)'),
	order_no: z.string().min(1).optional().describe('Order number'),
	entity_type: z.string().min(1).optional().describe('regular or outsourced'),
	currency: z.string().min(1).optional().describe('ISO 4217 currency code'),
	status: z.string().min(1).optional().describe('DRAFT or NOT_RECEIVED'),
	expected_arrival_date: z.string().min(1).optional().describe('Expected arrival date (ISO 8601)'),
	order_created_date: z.string().min(1).optional().describe('Order created date (ISO 8601)'),
	additional_info: z.string().optional().describe('Internal notes')
})

export const katanaCreatePurchaseOrderOutputSchema = katanaGetPurchaseOrderOutputSchema

export const katanaUpdatePurchaseOrderInputSchema = z.object({
	purchase_order_id: z.int().positive().describe('Purchase order id'),
	order_no: z.string().min(1).optional().describe('Order number'),
	supplier_id: z.int().positive().optional().describe('Supplier id'),
	location_id: z.int().positive().optional().describe('Receive-to location id'),
	currency: z.string().min(1).optional().describe('ISO 4217 currency code'),
	status: z.string().min(1).optional().describe('Purchase order status'),
	expected_arrival_date: z.string().min(1).optional().describe('Expected arrival date (ISO 8601)'),
	order_created_date: z.string().min(1).optional().describe('Order created date (ISO 8601)'),
	additional_info: z.string().optional().describe('Internal notes')
})

export const katanaUpdatePurchaseOrderOutputSchema = katanaGetPurchaseOrderOutputSchema

// ── Manufacturing orders ────────────────────────────────────────────────────

export const katanaManufacturingOrderSchema = z.object({
	id: z.number(),
	order_no: z.string().optional(),
	status: z.string().optional(),
	variant_id: z.number().optional(),
	location_id: z.number().optional(),
	planned_quantity: z.number().optional(),
	actual_quantity: z.number().optional(),
	order_created_date: z.string().optional(),
	production_deadline_date: z.string().optional(),
	ingredient_availability: z.string().optional(),
	additional_info: z.string().optional(),
	sales_order_id: z.number().optional()
})

export const katanaListManufacturingOrdersInputSchema = z.object({
	status: z.string().min(1).optional().describe('Manufacturing order status filter'),
	variant_id: z.int().positive().optional().describe('Filter by product variant id'),
	location_id: z.int().positive().optional().describe('Filter by location id'),
	order_no: z.string().min(1).optional().describe('Filter by order number'),
	...listCursorFields
})

export const katanaListManufacturingOrdersOutputSchema = z.object({
	items: z.array(katanaManufacturingOrderSchema),
	...listOutputMeta
})

export const katanaGetManufacturingOrderInputSchema = z.object({
	manufacturing_order_id: z.int().positive().describe('Manufacturing order id')
})

export const katanaGetManufacturingOrderOutputSchema = z.object({
	manufacturing_order: katanaManufacturingOrderSchema
})

export const katanaCreateManufacturingOrderInputSchema = z.object({
	variant_id: z.int().positive().describe('Product variant id to manufacture'),
	location_id: z.int().positive().describe('Production location id'),
	planned_quantity: z.number().positive().describe('Planned production quantity'),
	order_no: z.string().min(1).optional().describe('Order number'),
	order_created_date: z.string().min(1).optional().describe('Order created date (ISO 8601)'),
	production_deadline_date: z.string().min(1).optional().describe('Production deadline (ISO 8601)'),
	additional_info: z.string().optional().describe('Internal notes'),
	status: z.string().min(1).optional().describe('Initial status (NOT_STARTED)')
})

export const katanaCreateManufacturingOrderOutputSchema = katanaGetManufacturingOrderOutputSchema

export const katanaUpdateManufacturingOrderInputSchema = z.object({
	manufacturing_order_id: z.int().positive().describe('Manufacturing order id'),
	order_no: z.string().min(1).optional().describe('Order number'),
	planned_quantity: z.number().positive().optional().describe('Planned production quantity'),
	actual_quantity: z.number().min(0).optional().describe('Actual produced quantity'),
	order_created_date: z.string().min(1).optional().describe('Order created date (ISO 8601)'),
	production_deadline_date: z.string().min(1).optional().describe('Production deadline (ISO 8601)'),
	additional_info: z.string().optional().describe('Internal notes'),
	status: z.string().min(1).optional().describe('Manufacturing order status')
})

export const katanaUpdateManufacturingOrderOutputSchema = katanaGetManufacturingOrderOutputSchema

// ── Inventory ───────────────────────────────────────────────────────────────

export const katanaInventorySchema = z.object({
	variant_id: z.number(),
	location_id: z.number(),
	quantity_in_stock: z.number().optional(),
	quantity_committed: z.number().optional(),
	quantity_expected: z.number().optional(),
	quantity_missing_or_excess: z.number().optional(),
	safety_stock_level: z.number().optional(),
	average_cost: z.number().optional(),
	value_in_stock: z.number().optional()
})

export const katanaListInventoryInputSchema = z.object({
	variant_id: z.int().positive().optional().describe('Filter by variant id'),
	location_id: z.int().positive().optional().describe('Filter by location id'),
	...listCursorFields
})

export const katanaListInventoryOutputSchema = z.object({
	items: z.array(katanaInventorySchema),
	...listOutputMeta
})

// ── Types ───────────────────────────────────────────────────────────────────

export type KatanaRawRecord = z.infer<typeof katanaRawRecordSchema>
export type KatanaInventoryRawRecord = z.infer<typeof katanaInventoryRawSchema>
export type KatanaPagination = z.infer<typeof katanaPaginationSchema>
export type KatanaRateLimit = z.infer<typeof katanaRateLimitSchema>
export type KatanaListSalesOrdersPageInput = z.infer<typeof katanaListSalesOrdersPageInputSchema>
export type KatanaListSalesOrdersPageOutput = z.infer<typeof katanaListSalesOrdersPageOutputSchema>
export type KatanaListProductsPageInput = z.infer<typeof katanaListProductsPageInputSchema>
export type KatanaListProductsPageOutput = z.infer<typeof katanaListProductsPageOutputSchema>
export type KatanaListMaterialsPageInput = z.infer<typeof katanaListMaterialsPageInputSchema>
export type KatanaListMaterialsPageOutput = z.infer<typeof katanaListMaterialsPageOutputSchema>
export type KatanaListCustomersPageInput = z.infer<typeof katanaListCustomersPageInputSchema>
export type KatanaListCustomersPageOutput = z.infer<typeof katanaListCustomersPageOutputSchema>
export type KatanaListSuppliersPageInput = z.infer<typeof katanaListSuppliersPageInputSchema>
export type KatanaListSuppliersPageOutput = z.infer<typeof katanaListSuppliersPageOutputSchema>
export type KatanaListPurchaseOrdersPageInput = z.infer<typeof katanaListPurchaseOrdersPageInputSchema>
export type KatanaListPurchaseOrdersPageOutput = z.infer<typeof katanaListPurchaseOrdersPageOutputSchema>
export type KatanaListManufacturingOrdersPageInput = z.infer<typeof katanaListManufacturingOrdersPageInputSchema>
export type KatanaListManufacturingOrdersPageOutput = z.infer<typeof katanaListManufacturingOrdersPageOutputSchema>
export type KatanaListInventoryPageInput = z.infer<typeof katanaListInventoryPageInputSchema>
export type KatanaListInventoryPageOutput = z.infer<typeof katanaListInventoryPageOutputSchema>

export type KatanaSalesOrderRowInput = z.infer<typeof katanaSalesOrderRowInputSchema>
export type KatanaSalesOrder = z.infer<typeof katanaSalesOrderSchema>
export type KatanaListSalesOrdersInput = z.infer<typeof katanaListSalesOrdersInputSchema>
export type KatanaListSalesOrdersOutput = z.infer<typeof katanaListSalesOrdersOutputSchema>
export type KatanaGetSalesOrderInput = z.infer<typeof katanaGetSalesOrderInputSchema>
export type KatanaGetSalesOrderOutput = z.infer<typeof katanaGetSalesOrderOutputSchema>
export type KatanaCreateSalesOrderInput = z.infer<typeof katanaCreateSalesOrderInputSchema>
export type KatanaCreateSalesOrderOutput = z.infer<typeof katanaCreateSalesOrderOutputSchema>
export type KatanaUpdateSalesOrderInput = z.infer<typeof katanaUpdateSalesOrderInputSchema>
export type KatanaUpdateSalesOrderOutput = z.infer<typeof katanaUpdateSalesOrderOutputSchema>
export type KatanaDeleteSalesOrderInput = z.infer<typeof katanaDeleteSalesOrderInputSchema>
export type KatanaDeleteSalesOrderOutput = z.infer<typeof katanaDeleteSalesOrderOutputSchema>
export type KatanaQuerySalesOrderScope = z.infer<typeof katanaQuerySalesOrderScopeSchema>
export type KatanaQuerySalesOrdersInput = z.infer<typeof katanaQuerySalesOrdersInputSchema>
export type KatanaQuerySalesOrdersOutput = z.infer<typeof katanaQuerySalesOrdersOutputSchema>
export type KatanaNormalizedSalesOrder = z.infer<typeof katanaNormalizedSalesOrderSchema>
export type KatanaNormalizedSalesOrderRow = z.infer<typeof katanaNormalizedSalesOrderRowSchema>

export type KatanaProductVariantInput = z.infer<typeof katanaProductVariantInputSchema>
export type KatanaProduct = z.infer<typeof katanaProductSchema>
export type KatanaListProductsInput = z.infer<typeof katanaListProductsInputSchema>
export type KatanaListProductsOutput = z.infer<typeof katanaListProductsOutputSchema>
export type KatanaGetProductInput = z.infer<typeof katanaGetProductInputSchema>
export type KatanaGetProductOutput = z.infer<typeof katanaGetProductOutputSchema>
export type KatanaCreateProductInput = z.infer<typeof katanaCreateProductInputSchema>
export type KatanaCreateProductOutput = z.infer<typeof katanaCreateProductOutputSchema>
export type KatanaUpdateProductInput = z.infer<typeof katanaUpdateProductInputSchema>
export type KatanaUpdateProductOutput = z.infer<typeof katanaUpdateProductOutputSchema>

export type KatanaMaterial = z.infer<typeof katanaMaterialSchema>
export type KatanaListMaterialsInput = z.infer<typeof katanaListMaterialsInputSchema>
export type KatanaListMaterialsOutput = z.infer<typeof katanaListMaterialsOutputSchema>
export type KatanaGetMaterialInput = z.infer<typeof katanaGetMaterialInputSchema>
export type KatanaGetMaterialOutput = z.infer<typeof katanaGetMaterialOutputSchema>

export type KatanaCustomer = z.infer<typeof katanaCustomerSchema>
export type KatanaListCustomersInput = z.infer<typeof katanaListCustomersInputSchema>
export type KatanaListCustomersOutput = z.infer<typeof katanaListCustomersOutputSchema>
export type KatanaGetCustomerInput = z.infer<typeof katanaGetCustomerInputSchema>
export type KatanaGetCustomerOutput = z.infer<typeof katanaGetCustomerOutputSchema>
export type KatanaCreateCustomerInput = z.infer<typeof katanaCreateCustomerInputSchema>
export type KatanaCreateCustomerOutput = z.infer<typeof katanaCreateCustomerOutputSchema>
export type KatanaUpdateCustomerInput = z.infer<typeof katanaUpdateCustomerInputSchema>
export type KatanaUpdateCustomerOutput = z.infer<typeof katanaUpdateCustomerOutputSchema>

export type KatanaSupplier = z.infer<typeof katanaSupplierSchema>
export type KatanaListSuppliersInput = z.infer<typeof katanaListSuppliersInputSchema>
export type KatanaListSuppliersOutput = z.infer<typeof katanaListSuppliersOutputSchema>
export type KatanaGetSupplierInput = z.infer<typeof katanaGetSupplierInputSchema>
export type KatanaGetSupplierOutput = z.infer<typeof katanaGetSupplierOutputSchema>
export type KatanaCreateSupplierInput = z.infer<typeof katanaCreateSupplierInputSchema>
export type KatanaCreateSupplierOutput = z.infer<typeof katanaCreateSupplierOutputSchema>

export type KatanaPurchaseOrderRowInput = z.infer<typeof katanaPurchaseOrderRowInputSchema>
export type KatanaPurchaseOrder = z.infer<typeof katanaPurchaseOrderSchema>
export type KatanaListPurchaseOrdersInput = z.infer<typeof katanaListPurchaseOrdersInputSchema>
export type KatanaListPurchaseOrdersOutput = z.infer<typeof katanaListPurchaseOrdersOutputSchema>
export type KatanaGetPurchaseOrderInput = z.infer<typeof katanaGetPurchaseOrderInputSchema>
export type KatanaGetPurchaseOrderOutput = z.infer<typeof katanaGetPurchaseOrderOutputSchema>
export type KatanaCreatePurchaseOrderInput = z.infer<typeof katanaCreatePurchaseOrderInputSchema>
export type KatanaCreatePurchaseOrderOutput = z.infer<typeof katanaCreatePurchaseOrderOutputSchema>
export type KatanaUpdatePurchaseOrderInput = z.infer<typeof katanaUpdatePurchaseOrderInputSchema>
export type KatanaUpdatePurchaseOrderOutput = z.infer<typeof katanaUpdatePurchaseOrderOutputSchema>

export type KatanaManufacturingOrder = z.infer<typeof katanaManufacturingOrderSchema>
export type KatanaListManufacturingOrdersInput = z.infer<typeof katanaListManufacturingOrdersInputSchema>
export type KatanaListManufacturingOrdersOutput = z.infer<typeof katanaListManufacturingOrdersOutputSchema>
export type KatanaGetManufacturingOrderInput = z.infer<typeof katanaGetManufacturingOrderInputSchema>
export type KatanaGetManufacturingOrderOutput = z.infer<typeof katanaGetManufacturingOrderOutputSchema>
export type KatanaCreateManufacturingOrderInput = z.infer<typeof katanaCreateManufacturingOrderInputSchema>
export type KatanaCreateManufacturingOrderOutput = z.infer<typeof katanaCreateManufacturingOrderOutputSchema>
export type KatanaUpdateManufacturingOrderInput = z.infer<typeof katanaUpdateManufacturingOrderInputSchema>
export type KatanaUpdateManufacturingOrderOutput = z.infer<typeof katanaUpdateManufacturingOrderOutputSchema>

export type KatanaInventory = z.infer<typeof katanaInventorySchema>
export type KatanaListInventoryInput = z.infer<typeof katanaListInventoryInputSchema>
export type KatanaListInventoryOutput = z.infer<typeof katanaListInventoryOutputSchema>
