import { z } from 'zod'

export const woocommerceAuthSchema = z.object({
	store_url: z.url().describe('WooCommerce store origin, for example https://shop.example.com (no trailing path)'),
	consumer_key: z.string().min(1).describe('WooCommerce REST API consumer key'),
	consumer_secret: z.string().min(1).describe('WooCommerce REST API consumer secret')
})

export type WoocommerceAuth = z.infer<typeof woocommerceAuthSchema>

// ── Shared ──────────────────────────────────────────────────────────────────

const listCursorFields = {
	cursor: z.string().min(1).optional().describe('Page number from a prior next_cursor'),
	limit: z.int().min(1).max(100).optional().describe('Page size (1-100, default 10)')
}

export const woocommerceAddressSchema = z.object({
	first_name: z.string().optional().describe('First name'),
	last_name: z.string().optional().describe('Last name'),
	company: z.string().optional().describe('Company name'),
	address_1: z.string().optional().describe('Address line 1'),
	address_2: z.string().optional().describe('Address line 2'),
	city: z.string().optional().describe('City'),
	state: z.string().optional().describe('State / province code'),
	postcode: z.string().optional().describe('Postal / ZIP code'),
	country: z.string().optional().describe('ISO country code'),
	email: z.string().optional().describe('Email (billing)'),
	phone: z.string().optional().describe('Phone')
})

export const woocommerceMetaDataSchema = z.object({
	key: z.string().min(1).describe('Meta key'),
	value: z.string().describe('Meta value as string')
})

export const woocommerceLineItemInputSchema = z.object({
	id: z.int().positive().optional().describe('Existing line item id (updates)'),
	product_id: z.int().positive().optional().describe('Product id'),
	variation_id: z.int().positive().optional().describe('Variation id when applicable'),
	quantity: z.int().min(0).optional().describe('Quantity'),
	name: z.string().min(1).optional().describe('Line item name override'),
	sku: z.string().min(1).optional().describe('SKU'),
	price: z.string().min(1).optional().describe('Unit price as string'),
	total: z.string().min(1).optional().describe('Line total as string')
})

/** Order line item on read responses (list/get order). */
export const woocommerceOrderLineItemSchema = z.object({
	id: z.number().describe('Order line item id'),
	product_id: z.number().optional().describe('Product id'),
	variation_id: z.number().optional().describe('Variation id when applicable'),
	quantity: z.number().optional().describe('Quantity'),
	name: z.string().optional().describe('Line item name'),
	sku: z.string().optional().describe('SKU'),
	price: z.string().optional().describe('Unit price as string'),
	total: z.string().optional().describe('Line total as string')
})

/** Nested category on product read responses. */
export const woocommerceProductCategoryRefSchema = z.object({
	id: z.number().describe('Category id'),
	name: z.string().optional().describe('Category name'),
	slug: z.string().optional().describe('Category slug')
})

// ── Orders ──────────────────────────────────────────────────────────────────

export const woocommerceOrderSchema = z.object({
	id: z.number(),
	number: z.string(),
	status: z.string(),
	currency: z.string(),
	total: z.string(),
	date_created: z.string().optional(),
	customer_id: z.number().optional(),
	payment_method: z.string().optional(),
	payment_method_title: z.string().optional(),
	customer_note: z.string().optional(),
	line_items: z.array(woocommerceOrderLineItemSchema).optional().describe('Order line items when returned by the store')
})

export const woocommerceListOrdersInputSchema = z.object({
	status: z.string().min(1).optional().describe('Order status filter (e.g. processing, completed)'),
	after: z.string().min(1).optional().describe('ISO 8601 datetime; orders created after this'),
	before: z.string().min(1).optional().describe('ISO 8601 datetime; orders created before this'),
	search: z.string().min(1).optional().describe('Search term (order number, customer, …)'),
	customer_id: z.int().positive().optional().describe('Filter by customer id'),
	...listCursorFields
})

export const woocommerceListOrdersOutputSchema = z.object({
	items: z.array(woocommerceOrderSchema),
	next_cursor: z.string().optional(),
	truncated: z.boolean()
})

export const woocommerceGetOrderInputSchema = z.object({
	order_id: z.int().positive().describe('WooCommerce order id')
})

export const woocommerceGetOrderOutputSchema = z.object({
	order: woocommerceOrderSchema
})

export const woocommerceCreateOrderInputSchema = z.object({
	status: z.string().min(1).optional().describe('Order status (pending, processing, …)'),
	customer_id: z.int().positive().optional().describe('Existing customer id'),
	payment_method: z.string().min(1).optional().describe('Payment method id'),
	payment_method_title: z.string().min(1).optional().describe('Payment method title'),
	set_paid: z.boolean().optional().describe('Mark order as paid'),
	customer_note: z.string().optional().describe('Customer note'),
	billing: woocommerceAddressSchema.optional().describe('Billing address'),
	shipping: woocommerceAddressSchema.optional().describe('Shipping address'),
	line_items: z.array(woocommerceLineItemInputSchema).min(1).optional().describe('Order line items'),
	meta_data: z.array(woocommerceMetaDataSchema).optional().describe('Order meta data')
})

export const woocommerceCreateOrderOutputSchema = woocommerceGetOrderOutputSchema

export const woocommerceUpdateOrderInputSchema = z.object({
	order_id: z.int().positive().describe('WooCommerce order id'),
	status: z.string().min(1).optional().describe('Order status'),
	customer_id: z.int().nonnegative().optional().describe('Customer id (0 clears guest link)'),
	payment_method: z.string().min(1).optional().describe('Payment method id'),
	payment_method_title: z.string().min(1).optional().describe('Payment method title'),
	set_paid: z.boolean().optional().describe('Mark order as paid'),
	customer_note: z.string().optional().describe('Customer note'),
	billing: woocommerceAddressSchema.optional().describe('Billing address'),
	shipping: woocommerceAddressSchema.optional().describe('Shipping address'),
	line_items: z.array(woocommerceLineItemInputSchema).optional().describe('Line items (include id to update)'),
	meta_data: z.array(woocommerceMetaDataSchema).optional().describe('Order meta data')
})

export const woocommerceUpdateOrderOutputSchema = woocommerceGetOrderOutputSchema

export const woocommerceDeleteOrderInputSchema = z.object({
	order_id: z.int().positive().describe('WooCommerce order id'),
	force: z.boolean().optional().describe('Permanently delete when true (default true)')
})

export const woocommerceDeleteOrderOutputSchema = z.object({
	deleted: z.boolean(),
	id: z.number()
})

// ── Order notes ─────────────────────────────────────────────────────────────

export const woocommerceOrderNoteSchema = z.object({
	id: z.number(),
	note: z.string(),
	customer_note: z.boolean().optional(),
	date_created: z.string().optional(),
	added_by_user: z.boolean().optional()
})

export const woocommerceListOrderNotesInputSchema = z.object({
	order_id: z.int().positive().describe('WooCommerce order id'),
	type: z.enum(['any', 'customer', 'internal']).optional().describe('Note type filter (default any)'),
	...listCursorFields
})

export const woocommerceListOrderNotesOutputSchema = z.object({
	items: z.array(woocommerceOrderNoteSchema),
	next_cursor: z.string().optional(),
	truncated: z.boolean()
})

export const woocommerceCreateOrderNoteInputSchema = z.object({
	order_id: z.int().positive().describe('WooCommerce order id'),
	note: z.string().min(1).describe('Note text'),
	customer_note: z.boolean().optional().describe('When true, note is visible to the customer'),
	added_by_user: z.boolean().optional().describe('When true, note is attributed to a user')
})

export const woocommerceCreateOrderNoteOutputSchema = z.object({
	note: woocommerceOrderNoteSchema
})

// ── Order refunds ───────────────────────────────────────────────────────────

export const woocommerceOrderRefundSchema = z.object({
	id: z.number(),
	amount: z.string().optional(),
	reason: z.string().optional(),
	date_created: z.string().optional(),
	refunded_by: z.number().optional()
})

export const woocommerceListOrderRefundsInputSchema = z.object({
	order_id: z.int().positive().describe('WooCommerce order id'),
	...listCursorFields
})

export const woocommerceListOrderRefundsOutputSchema = z.object({
	items: z.array(woocommerceOrderRefundSchema),
	next_cursor: z.string().optional(),
	truncated: z.boolean()
})

export const woocommerceCreateOrderRefundInputSchema = z.object({
	order_id: z.int().positive().describe('WooCommerce order id'),
	amount: z.string().min(1).optional().describe('Refund amount as string'),
	reason: z.string().optional().describe('Refund reason'),
	api_refund: z.boolean().optional().describe('When true, attempt payment gateway refund'),
	line_items: z
		.array(
			z.object({
				id: z.int().positive().describe('Order line item id to refund'),
				quantity: z.int().min(0).optional().describe('Quantity to refund'),
				refund_total: z.string().min(1).optional().describe('Amount to refund for this line')
			})
		)
		.optional()
		.describe('Optional per-line refunds')
})

export const woocommerceCreateOrderRefundOutputSchema = z.object({
	refund: woocommerceOrderRefundSchema
})

// ── Products ────────────────────────────────────────────────────────────────

export const woocommerceProductSchema = z.object({
	id: z.number(),
	name: z.string(),
	sku: z.string().optional(),
	type: z.string(),
	status: z.string(),
	price: z.string().optional(),
	regular_price: z.string().optional(),
	sale_price: z.string().optional(),
	stock_status: z.string().optional(),
	stock_quantity: z.number().optional(),
	manage_stock: z.boolean().optional(),
	categories: z
		.array(woocommerceProductCategoryRefSchema)
		.optional()
		.describe('Product categories when returned by the store')
})

export const woocommerceListProductsInputSchema = z.object({
	status: z.string().min(1).optional().describe('Product status (publish, draft, …)'),
	search: z.string().min(1).optional().describe('Search term'),
	sku: z.string().min(1).optional().describe('Exact SKU filter'),
	category: z.int().positive().optional().describe('Product category id'),
	type: z.string().min(1).optional().describe('Product type (simple, variable, …)'),
	include: z
		.array(z.int().positive())
		.min(1)
		.max(100)
		.optional()
		.describe('Limit results to these product ids (WooCommerce include parameter)'),
	...listCursorFields
})

export const woocommerceListProductsOutputSchema = z.object({
	items: z.array(woocommerceProductSchema),
	next_cursor: z.string().optional(),
	truncated: z.boolean()
})

export const woocommerceGetProductInputSchema = z.object({
	product_id: z.int().positive().describe('WooCommerce product id')
})

export const woocommerceGetProductOutputSchema = z.object({
	product: woocommerceProductSchema
})

export const woocommerceCreateProductInputSchema = z.object({
	name: z.string().min(1).describe('Product name'),
	type: z.string().min(1).optional().describe('Product type (simple, variable, grouped, external)'),
	status: z.string().min(1).optional().describe('Product status (draft, publish, …)'),
	sku: z.string().min(1).optional().describe('SKU'),
	regular_price: z.string().min(1).optional().describe('Regular price as string'),
	sale_price: z.string().optional().describe('Sale price as string'),
	description: z.string().optional().describe('Full HTML description'),
	short_description: z.string().optional().describe('Short description'),
	manage_stock: z.boolean().optional().describe('Whether stock is managed'),
	stock_quantity: z.int().optional().describe('Stock quantity when manage_stock is true'),
	stock_status: z.string().min(1).optional().describe('instock, outofstock, onbackorder'),
	categories: z
		.array(z.object({ id: z.int().positive().describe('Category id') }))
		.optional()
		.describe('Category associations'),
	meta_data: z.array(woocommerceMetaDataSchema).optional().describe('Product meta data')
})

export const woocommerceCreateProductOutputSchema = woocommerceGetProductOutputSchema

export const woocommerceUpdateProductInputSchema = z.object({
	product_id: z.int().positive().describe('WooCommerce product id'),
	name: z.string().min(1).optional().describe('Product name'),
	type: z.string().min(1).optional().describe('Product type'),
	status: z.string().min(1).optional().describe('Product status'),
	sku: z.string().optional().describe('SKU (empty string clears)'),
	regular_price: z.string().optional().describe('Regular price as string'),
	sale_price: z.string().optional().describe('Sale price as string'),
	description: z.string().optional().describe('Full HTML description'),
	short_description: z.string().optional().describe('Short description'),
	manage_stock: z.boolean().optional().describe('Whether stock is managed'),
	stock_quantity: z.int().optional().describe('Stock quantity'),
	stock_status: z.string().min(1).optional().describe('instock, outofstock, onbackorder'),
	categories: z
		.array(z.object({ id: z.int().positive().describe('Category id') }))
		.optional()
		.describe('Category associations'),
	meta_data: z.array(woocommerceMetaDataSchema).optional().describe('Product meta data')
})

export const woocommerceUpdateProductOutputSchema = woocommerceGetProductOutputSchema

export const woocommerceDeleteProductInputSchema = z.object({
	product_id: z.int().positive().describe('WooCommerce product id'),
	force: z.boolean().optional().describe('Permanently delete when true (default true)')
})

export const woocommerceDeleteProductOutputSchema = z.object({
	deleted: z.boolean(),
	id: z.number()
})

// ── Product variations ──────────────────────────────────────────────────────

export const woocommerceProductVariationSchema = z.object({
	id: z.number(),
	sku: z.string().optional(),
	price: z.string().optional(),
	regular_price: z.string().optional(),
	sale_price: z.string().optional(),
	status: z.string().optional(),
	stock_status: z.string().optional(),
	stock_quantity: z.number().optional(),
	manage_stock: z.boolean().optional()
})

export const woocommerceListProductVariationsInputSchema = z.object({
	product_id: z.int().positive().describe('Parent product id'),
	status: z.string().min(1).optional().describe('Variation status filter'),
	sku: z.string().min(1).optional().describe('Exact SKU filter'),
	...listCursorFields
})

export const woocommerceListProductVariationsOutputSchema = z.object({
	items: z.array(woocommerceProductVariationSchema),
	next_cursor: z.string().optional(),
	truncated: z.boolean()
})

export const woocommerceGetProductVariationInputSchema = z.object({
	product_id: z.int().positive().describe('Parent product id'),
	variation_id: z.int().positive().describe('Variation id')
})

export const woocommerceGetProductVariationOutputSchema = z.object({
	variation: woocommerceProductVariationSchema
})

// ── Customers ───────────────────────────────────────────────────────────────

export const woocommerceCustomerSchema = z.object({
	id: z.number(),
	email: z.string(),
	first_name: z.string().optional(),
	last_name: z.string().optional(),
	username: z.string().optional(),
	role: z.string().optional(),
	date_created: z.string().optional()
})

export const woocommerceListCustomersInputSchema = z.object({
	search: z.string().min(1).optional().describe('Search term (email, name, …)'),
	email: z.string().min(1).optional().describe('Exact email filter'),
	role: z.string().min(1).optional().describe('Customer role filter'),
	...listCursorFields
})

export const woocommerceListCustomersOutputSchema = z.object({
	items: z.array(woocommerceCustomerSchema),
	next_cursor: z.string().optional(),
	truncated: z.boolean()
})

export const woocommerceGetCustomerInputSchema = z.object({
	customer_id: z.int().positive().describe('WooCommerce customer id')
})

export const woocommerceGetCustomerOutputSchema = z.object({
	customer: woocommerceCustomerSchema
})

export const woocommerceCreateCustomerInputSchema = z.object({
	email: z.string().min(1).describe('Customer email'),
	first_name: z.string().optional().describe('First name'),
	last_name: z.string().optional().describe('Last name'),
	username: z.string().min(1).optional().describe('Username (auto-generated when omitted)'),
	password: z.string().min(1).optional().describe('Account password when creating a login'),
	billing: woocommerceAddressSchema.optional().describe('Billing address'),
	shipping: woocommerceAddressSchema.optional().describe('Shipping address'),
	meta_data: z.array(woocommerceMetaDataSchema).optional().describe('Customer meta data')
})

export const woocommerceCreateCustomerOutputSchema = woocommerceGetCustomerOutputSchema

export const woocommerceUpdateCustomerInputSchema = z.object({
	customer_id: z.int().positive().describe('WooCommerce customer id'),
	email: z.string().min(1).optional().describe('Customer email'),
	first_name: z.string().optional().describe('First name'),
	last_name: z.string().optional().describe('Last name'),
	username: z.string().min(1).optional().describe('Username'),
	password: z.string().min(1).optional().describe('New password'),
	billing: woocommerceAddressSchema.optional().describe('Billing address'),
	shipping: woocommerceAddressSchema.optional().describe('Shipping address'),
	meta_data: z.array(woocommerceMetaDataSchema).optional().describe('Customer meta data')
})

export const woocommerceUpdateCustomerOutputSchema = woocommerceGetCustomerOutputSchema

// ── Coupons ─────────────────────────────────────────────────────────────────

export const woocommerceCouponSchema = z.object({
	id: z.number(),
	code: z.string(),
	amount: z.string().optional(),
	discount_type: z.string().optional(),
	description: z.string().optional(),
	date_expires: z.string().optional(),
	usage_count: z.number().optional(),
	usage_limit: z.number().optional(),
	free_shipping: z.boolean().optional()
})

export const woocommerceListCouponsInputSchema = z.object({
	search: z.string().min(1).optional().describe('Search term (code, description, …)'),
	code: z.string().min(1).optional().describe('Exact coupon code filter'),
	...listCursorFields
})

export const woocommerceListCouponsOutputSchema = z.object({
	items: z.array(woocommerceCouponSchema),
	next_cursor: z.string().optional(),
	truncated: z.boolean()
})

export const woocommerceGetCouponInputSchema = z.object({
	coupon_id: z.int().positive().describe('WooCommerce coupon id')
})

export const woocommerceGetCouponOutputSchema = z.object({
	coupon: woocommerceCouponSchema
})

export const woocommerceCreateCouponInputSchema = z.object({
	code: z.string().min(1).describe('Coupon code'),
	discount_type: z.string().min(1).optional().describe('percent, fixed_cart, or fixed_product'),
	amount: z.string().min(1).optional().describe('Discount amount as string'),
	description: z.string().optional().describe('Coupon description'),
	individual_use: z.boolean().optional().describe('Cannot combine with other coupons'),
	exclude_sale_items: z.boolean().optional().describe('Exclude sale items'),
	minimum_amount: z.string().min(1).optional().describe('Minimum cart amount'),
	maximum_amount: z.string().min(1).optional().describe('Maximum cart amount'),
	usage_limit: z.int().positive().optional().describe('Total usage limit'),
	usage_limit_per_user: z.int().positive().optional().describe('Per-user usage limit'),
	free_shipping: z.boolean().optional().describe('Enable free shipping'),
	date_expires: z.string().min(1).optional().describe('ISO 8601 expiry datetime'),
	meta_data: z.array(woocommerceMetaDataSchema).optional().describe('Coupon meta data')
})

export const woocommerceCreateCouponOutputSchema = woocommerceGetCouponOutputSchema

export const woocommerceUpdateCouponInputSchema = z.object({
	coupon_id: z.int().positive().describe('WooCommerce coupon id'),
	code: z.string().min(1).optional().describe('Coupon code'),
	discount_type: z.string().min(1).optional().describe('percent, fixed_cart, or fixed_product'),
	amount: z.string().min(1).optional().describe('Discount amount as string'),
	description: z.string().optional().describe('Coupon description'),
	individual_use: z.boolean().optional().describe('Cannot combine with other coupons'),
	exclude_sale_items: z.boolean().optional().describe('Exclude sale items'),
	minimum_amount: z.string().optional().describe('Minimum cart amount'),
	maximum_amount: z.string().optional().describe('Maximum cart amount'),
	usage_limit: z.int().nonnegative().optional().describe('Total usage limit (0 unlimited)'),
	usage_limit_per_user: z.int().nonnegative().optional().describe('Per-user usage limit'),
	free_shipping: z.boolean().optional().describe('Enable free shipping'),
	date_expires: z.string().optional().describe('ISO 8601 expiry datetime'),
	meta_data: z.array(woocommerceMetaDataSchema).optional().describe('Coupon meta data')
})

export const woocommerceUpdateCouponOutputSchema = woocommerceGetCouponOutputSchema

// ── Product categories ──────────────────────────────────────────────────────

export const woocommerceProductCategorySchema = z.object({
	id: z.number(),
	name: z.string(),
	slug: z.string().optional(),
	parent: z.number().optional(),
	description: z.string().optional(),
	count: z.number().optional()
})

export const woocommerceListProductCategoriesInputSchema = z.object({
	search: z.string().min(1).optional().describe('Search term'),
	parent: z.int().nonnegative().optional().describe('Parent category id (0 for top-level)'),
	hide_empty: z.boolean().optional().describe('Hide categories with no products'),
	...listCursorFields
})

export const woocommerceListProductCategoriesOutputSchema = z.object({
	items: z.array(woocommerceProductCategorySchema),
	next_cursor: z.string().optional(),
	truncated: z.boolean()
})

export const woocommerceGetProductCategoryInputSchema = z.object({
	category_id: z.int().positive().describe('Product category id')
})

export const woocommerceGetProductCategoryOutputSchema = z.object({
	category: woocommerceProductCategorySchema
})

// ── Types ───────────────────────────────────────────────────────────────────

export type WoocommerceAddress = z.infer<typeof woocommerceAddressSchema>
export type WoocommerceMetaData = z.infer<typeof woocommerceMetaDataSchema>
export type WoocommerceLineItemInput = z.infer<typeof woocommerceLineItemInputSchema>

export type WoocommerceOrder = z.infer<typeof woocommerceOrderSchema>
export type WoocommerceListOrdersInput = z.infer<typeof woocommerceListOrdersInputSchema>
export type WoocommerceListOrdersOutput = z.infer<typeof woocommerceListOrdersOutputSchema>
export type WoocommerceGetOrderInput = z.infer<typeof woocommerceGetOrderInputSchema>
export type WoocommerceGetOrderOutput = z.infer<typeof woocommerceGetOrderOutputSchema>
export type WoocommerceCreateOrderInput = z.infer<typeof woocommerceCreateOrderInputSchema>
export type WoocommerceCreateOrderOutput = z.infer<typeof woocommerceCreateOrderOutputSchema>
export type WoocommerceUpdateOrderInput = z.infer<typeof woocommerceUpdateOrderInputSchema>
export type WoocommerceUpdateOrderOutput = z.infer<typeof woocommerceUpdateOrderOutputSchema>
export type WoocommerceDeleteOrderInput = z.infer<typeof woocommerceDeleteOrderInputSchema>
export type WoocommerceDeleteOrderOutput = z.infer<typeof woocommerceDeleteOrderOutputSchema>

export type WoocommerceOrderNote = z.infer<typeof woocommerceOrderNoteSchema>
export type WoocommerceListOrderNotesInput = z.infer<typeof woocommerceListOrderNotesInputSchema>
export type WoocommerceListOrderNotesOutput = z.infer<typeof woocommerceListOrderNotesOutputSchema>
export type WoocommerceCreateOrderNoteInput = z.infer<typeof woocommerceCreateOrderNoteInputSchema>
export type WoocommerceCreateOrderNoteOutput = z.infer<typeof woocommerceCreateOrderNoteOutputSchema>

export type WoocommerceOrderRefund = z.infer<typeof woocommerceOrderRefundSchema>
export type WoocommerceListOrderRefundsInput = z.infer<typeof woocommerceListOrderRefundsInputSchema>
export type WoocommerceListOrderRefundsOutput = z.infer<typeof woocommerceListOrderRefundsOutputSchema>
export type WoocommerceCreateOrderRefundInput = z.infer<typeof woocommerceCreateOrderRefundInputSchema>
export type WoocommerceCreateOrderRefundOutput = z.infer<typeof woocommerceCreateOrderRefundOutputSchema>

export type WoocommerceProduct = z.infer<typeof woocommerceProductSchema>
export type WoocommerceListProductsInput = z.infer<typeof woocommerceListProductsInputSchema>
export type WoocommerceListProductsOutput = z.infer<typeof woocommerceListProductsOutputSchema>
export type WoocommerceGetProductInput = z.infer<typeof woocommerceGetProductInputSchema>
export type WoocommerceGetProductOutput = z.infer<typeof woocommerceGetProductOutputSchema>
export type WoocommerceCreateProductInput = z.infer<typeof woocommerceCreateProductInputSchema>
export type WoocommerceCreateProductOutput = z.infer<typeof woocommerceCreateProductOutputSchema>
export type WoocommerceUpdateProductInput = z.infer<typeof woocommerceUpdateProductInputSchema>
export type WoocommerceUpdateProductOutput = z.infer<typeof woocommerceUpdateProductOutputSchema>
export type WoocommerceDeleteProductInput = z.infer<typeof woocommerceDeleteProductInputSchema>
export type WoocommerceDeleteProductOutput = z.infer<typeof woocommerceDeleteProductOutputSchema>

export type WoocommerceProductVariation = z.infer<typeof woocommerceProductVariationSchema>
export type WoocommerceListProductVariationsInput = z.infer<typeof woocommerceListProductVariationsInputSchema>
export type WoocommerceListProductVariationsOutput = z.infer<typeof woocommerceListProductVariationsOutputSchema>
export type WoocommerceGetProductVariationInput = z.infer<typeof woocommerceGetProductVariationInputSchema>
export type WoocommerceGetProductVariationOutput = z.infer<typeof woocommerceGetProductVariationOutputSchema>

export type WoocommerceCustomer = z.infer<typeof woocommerceCustomerSchema>
export type WoocommerceListCustomersInput = z.infer<typeof woocommerceListCustomersInputSchema>
export type WoocommerceListCustomersOutput = z.infer<typeof woocommerceListCustomersOutputSchema>
export type WoocommerceGetCustomerInput = z.infer<typeof woocommerceGetCustomerInputSchema>
export type WoocommerceGetCustomerOutput = z.infer<typeof woocommerceGetCustomerOutputSchema>
export type WoocommerceCreateCustomerInput = z.infer<typeof woocommerceCreateCustomerInputSchema>
export type WoocommerceCreateCustomerOutput = z.infer<typeof woocommerceCreateCustomerOutputSchema>
export type WoocommerceUpdateCustomerInput = z.infer<typeof woocommerceUpdateCustomerInputSchema>
export type WoocommerceUpdateCustomerOutput = z.infer<typeof woocommerceUpdateCustomerOutputSchema>

export type WoocommerceCoupon = z.infer<typeof woocommerceCouponSchema>
export type WoocommerceListCouponsInput = z.infer<typeof woocommerceListCouponsInputSchema>
export type WoocommerceListCouponsOutput = z.infer<typeof woocommerceListCouponsOutputSchema>
export type WoocommerceGetCouponInput = z.infer<typeof woocommerceGetCouponInputSchema>
export type WoocommerceGetCouponOutput = z.infer<typeof woocommerceGetCouponOutputSchema>
export type WoocommerceCreateCouponInput = z.infer<typeof woocommerceCreateCouponInputSchema>
export type WoocommerceCreateCouponOutput = z.infer<typeof woocommerceCreateCouponOutputSchema>
export type WoocommerceUpdateCouponInput = z.infer<typeof woocommerceUpdateCouponInputSchema>
export type WoocommerceUpdateCouponOutput = z.infer<typeof woocommerceUpdateCouponOutputSchema>

export type WoocommerceProductCategory = z.infer<typeof woocommerceProductCategorySchema>
export type WoocommerceListProductCategoriesInput = z.infer<typeof woocommerceListProductCategoriesInputSchema>
export type WoocommerceListProductCategoriesOutput = z.infer<typeof woocommerceListProductCategoriesOutputSchema>
export type WoocommerceGetProductCategoryInput = z.infer<typeof woocommerceGetProductCategoryInputSchema>
export type WoocommerceGetProductCategoryOutput = z.infer<typeof woocommerceGetProductCategoryOutputSchema>
