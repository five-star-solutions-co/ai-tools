import { z } from 'zod'

export const walmartAuthSchema = z.object({
	client_id: z.string().min(1).describe('Walmart Marketplace OAuth client id'),
	client_secret: z.string().min(1).describe('Walmart Marketplace OAuth client secret')
})

export type WalmartAuth = z.infer<typeof walmartAuthSchema>

const walmartDateFilterSchema = z
	.union([z.iso.date(), z.iso.datetime({ offset: true })])
	.describe('ISO 8601 date or date-time')

const walmartPageCursorSchema = z
	.string()
	.min(1)
	.refine((value) => value.startsWith('?') && !value.includes('#'), {
		message: 'cursor must be the provider query fragment returned by next_cursor'
	})
	.optional()

export const walmartOrderRawSchema = z.looseObject({
	purchaseOrderId: z.string().min(1),
	customerOrderId: z.string().nullable().optional(),
	orderDate: z.number().nullable().optional()
})

export const walmartItemRawSchema = z.looseObject({
	sku: z.string().min(1),
	wpid: z.string().nullable().optional(),
	gtin: z.string().nullable().optional(),
	productName: z.string().nullable().optional(),
	publishedStatus: z.string().nullable().optional(),
	lifecycleStatus: z.string().nullable().optional()
})

export const walmartReturnOrderRawSchema = z.looseObject({
	returnOrderId: z.string().min(1),
	customerOrderId: z.string().nullable().optional(),
	returnOrderDate: z.string().nullable().optional(),
	status: z.string().nullable().optional()
})

const walmartOrderCollectionSchema = z
	.union([z.array(walmartOrderRawSchema), walmartOrderRawSchema])
	.transform((value) => (Array.isArray(value) ? value : [value]))

export const walmartOrdersResponseSchema = z.looseObject({
	list: z.looseObject({
		meta: z.looseObject({
			totalCount: z.int().nonnegative(),
			limit: z.int().positive(),
			nextCursor: z.string().nullable().optional()
		}),
		elements: z.looseObject({
			order: walmartOrderCollectionSchema
		})
	})
})

const walmartItemsResponseFields = {
	totalItems: z.int().nonnegative(),
	nextCursor: z.string().nullable().optional()
}

export const walmartItemsResponseSchema = z.union([
	z
		.looseObject({
			...walmartItemsResponseFields,
			ItemResponse: z.array(walmartItemRawSchema)
		})
		.transform((response) => ({
			items: response.ItemResponse,
			total_items: response.totalItems,
			next_cursor: response.nextCursor
		})),
	z
		.looseObject({
			...walmartItemsResponseFields,
			itemResponse: z.array(walmartItemRawSchema)
		})
		.transform((response) => ({
			items: response.itemResponse,
			total_items: response.totalItems,
			next_cursor: response.nextCursor
		}))
])

export const walmartReturnsResponseSchema = z.looseObject({
	meta: z.looseObject({
		totalCount: z.int().nonnegative(),
		limit: z.int().positive(),
		nextCursor: z.string().nullable().optional()
	}),
	returnOrders: z.array(walmartReturnOrderRawSchema)
})

export const walmartReconReportDatesResponseSchema = z.looseObject({
	availableApReportDates: z.array(z.string().min(1))
})

export const walmartListOrdersPageInputSchema = z.strictObject({
	cursor: walmartPageCursorSchema.describe('Provider next_cursor from a prior orders page'),
	limit: z.int().min(1).max(200).optional().describe('Orders per page, from 1 to 200; defaults to 100'),
	sku: z.string().min(1).optional().describe('Seller SKU filter'),
	customer_order_id: z.string().min(1).optional().describe('Walmart customer order id filter'),
	purchase_order_id: z.string().min(1).optional().describe('Walmart purchase order id filter'),
	status: z
		.enum(['Created', 'Acknowledged', 'Shipped', 'Delivered', 'Cancelled'])
		.optional()
		.describe('Purchase order line status filter'),
	created_start_date: walmartDateFilterSchema.optional().describe('Orders created on or after this date'),
	created_end_date: walmartDateFilterSchema.optional().describe('Orders created on or before this date'),
	expected_ship_start_date: walmartDateFilterSchema.optional().describe('Expected ship date on or after this date'),
	expected_ship_end_date: walmartDateFilterSchema.optional().describe('Expected ship date on or before this date'),
	last_modified_start_date: walmartDateFilterSchema.optional().describe('Orders modified on or after this date'),
	last_modified_end_date: walmartDateFilterSchema.optional().describe('Orders modified on or before this date'),
	product_info: z.boolean().optional().describe('Include product image URL and weight'),
	ship_node_type: z
		.enum(['SellerFulfilled', 'WFSFulfilled', '3PLFulfilled'])
		.optional()
		.describe('Order fulfillment node type'),
	shipping_program_type: z.enum(['TWO_DAY', 'ONE_DAY']).optional().describe('Expedited shipping program type'),
	replacement_info: z.boolean().optional().describe('Include replacement order attributes'),
	order_type: z.enum(['REGULAR', 'REPLACEMENT', 'PREORDER']).optional().describe('Walmart order type'),
	incentive_info: z.boolean().optional().describe('Include incentive attributes')
})

export const walmartListOrdersPageOutputSchema = z.object({
	items: z.array(walmartOrderRawSchema),
	total_count: z.int().nonnegative(),
	limit: z.int().positive(),
	next_cursor: z.string().optional(),
	truncated: z.boolean()
})

export const walmartListItemsPageInputSchema = z.strictObject({
	cursor: z.string().min(1).optional().describe('Provider next_cursor; omit for the first page'),
	offset: z.int().min(0).max(10_000).optional().describe('Zero-based item offset; defaults to 0'),
	limit: z.int().min(1).max(1000).optional().describe('Items per page, from 1 to 1000; defaults to 20'),
	sku: z.string().min(1).optional().describe('Seller SKU filter'),
	gtin: z.string().length(14).optional().describe('14-digit GTIN filter'),
	lifecycle_status: z.enum(['ACTIVE', 'ARCHIVED', 'RETIRED']).optional().describe('Item lifecycle status'),
	published_status: z.enum(['PUBLISHED', 'UNPUBLISHED', 'INPROGRESS']).optional().describe('Item publication status'),
	variant_group_id: z.string().min(1).optional().describe('Walmart variant group id filter'),
	condition: z.string().min(1).optional().describe('Walmart item condition filter'),
	availability: z.enum(['In_stock', 'Out_of_stock', 'Preorder']).optional().describe('Item availability filter'),
	show_duplicate_item_info: z.boolean().optional().describe('Include duplicate-item information'),
	include_customer_favorites_status: z.boolean().optional().describe('Include customer-favorite status'),
	bundle_type: z.literal('VIRTUALPACK').optional().describe('Restrict results to virtual packs')
})

export const walmartListItemsPageOutputSchema = z.object({
	items: z.array(walmartItemRawSchema),
	total_count: z.int().nonnegative(),
	offset: z.int().nonnegative(),
	limit: z.int().positive(),
	next_cursor: z.string().optional(),
	next_offset: z.int().nonnegative().optional(),
	truncated: z.boolean()
})

export const walmartListReturnsPageInputSchema = z.strictObject({
	cursor: walmartPageCursorSchema.describe('Provider next_cursor from a prior returns page'),
	limit: z.int().min(1).max(200).optional().describe('Return orders per page, from 1 to 200; defaults to 10'),
	return_order_id: z.string().min(1).optional().describe('Return order id or RMA filter'),
	customer_order_id: z.string().min(1).optional().describe('Customer order id filter'),
	status: z.enum(['INITIATED', 'DELIVERED', 'COMPLETED']).optional().describe('Return status filter'),
	replacement_info: z.boolean().optional().describe('Include replacement return attributes'),
	return_type: z.enum(['PREORDER', 'REPLACEMENT', 'REFUND']).optional().describe('Return type filter'),
	is_wfs_enabled: z.boolean().optional().describe('True for WFS returns; false for non-WFS returns'),
	return_creation_start_date: walmartDateFilterSchema.optional().describe('Returns created on or after this date'),
	return_creation_end_date: walmartDateFilterSchema.optional().describe('Returns created on or before this date'),
	return_last_modified_start_date: walmartDateFilterSchema
		.optional()
		.describe('Returns modified on or after this date'),
	return_last_modified_end_date: walmartDateFilterSchema.optional().describe('Returns modified on or before this date')
})

export const walmartListReturnsPageOutputSchema = z.object({
	items: z.array(walmartReturnOrderRawSchema),
	total_count: z.int().nonnegative(),
	limit: z.int().positive(),
	next_cursor: z.string().optional(),
	truncated: z.boolean()
})

export const walmartListReconReportDatesOutputSchema = z.object({
	dates: z.array(z.string().min(1))
})

export const walmartDownloadReconReportBytesInputSchema = z.strictObject({
	report_date: z
		.string()
		.regex(/^\d{8}$/)
		.describe('Available recon report date in MMDDYYYY format'),
	max_bytes: z.int().positive().optional().describe('Optional caller-owned maximum response size in bytes')
})

export const walmartDownloadReconReportBytesOutputSchema = z.object({
	report_date: z.string(),
	content_type: z.string().nullable(),
	byte_length: z.int().nonnegative(),
	bytes: z.custom<Uint8Array>((value) => value instanceof Uint8Array)
})

export type WalmartOrderRaw = z.infer<typeof walmartOrderRawSchema>
export type WalmartItemRaw = z.infer<typeof walmartItemRawSchema>
export type WalmartReturnOrderRaw = z.infer<typeof walmartReturnOrderRawSchema>
export type WalmartListOrdersPageInput = z.input<typeof walmartListOrdersPageInputSchema>
export type WalmartListOrdersPageOutput = z.infer<typeof walmartListOrdersPageOutputSchema>
export type WalmartListItemsPageInput = z.input<typeof walmartListItemsPageInputSchema>
export type WalmartListItemsPageOutput = z.infer<typeof walmartListItemsPageOutputSchema>
export type WalmartListReturnsPageInput = z.input<typeof walmartListReturnsPageInputSchema>
export type WalmartListReturnsPageOutput = z.infer<typeof walmartListReturnsPageOutputSchema>
export type WalmartListReconReportDatesOutput = z.infer<typeof walmartListReconReportDatesOutputSchema>
export type WalmartDownloadReconReportBytesInput = z.input<typeof walmartDownloadReconReportBytesInputSchema>
export type WalmartDownloadReconReportBytesOutput = z.infer<typeof walmartDownloadReconReportBytesOutputSchema>
