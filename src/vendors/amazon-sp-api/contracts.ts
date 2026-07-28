import { z } from 'zod'

/** SP-API regional endpoints. */
export const amazonSpApiEndpointSchema = z.enum([
	'https://sellingpartnerapi-na.amazon.com',
	'https://sellingpartnerapi-eu.amazon.com',
	'https://sellingpartnerapi-fe.amazon.com'
])

export const amazonSpApiAuthSchema = z.object({
	client_id: z.string().min(1).describe('LWA client id'),
	client_secret: z.string().min(1).describe('LWA client secret'),
	refresh_token: z.string().min(1).describe('LWA refresh token for the selling partner'),
	access_key_id: z.string().min(1).describe('AWS access key id for SP-API SigV4'),
	secret_access_key: z.string().min(1).describe('AWS secret access key for SP-API SigV4'),
	region: z
		.string()
		.min(1)
		.describe('AWS region used for SigV4 (typically us-east-1 for NA, eu-west-1 for EU, us-west-2 for FE)'),
	endpoint: amazonSpApiEndpointSchema.describe('SP-API regional endpoint'),
	session_token: z.string().min(1).optional().describe('Optional AWS session token'),
	marketplace_ids: z
		.array(z.string().min(1))
		.min(1)
		.optional()
		.describe('Default marketplace ids when a tool call omits marketplace_ids')
})

export type AmazonSpApiAuth = z.infer<typeof amazonSpApiAuthSchema>

// ─── Orders ───────────────────────────────────────────────────────────────────

export const amazonSpApiListOrdersInputSchema = z.object({
	marketplace_ids: z
		.array(z.string().min(1))
		.min(1)
		.optional()
		.describe('Marketplace ids (defaults to auth.marketplace_ids)'),
	created_after: z.string().min(1).optional().describe('ISO 8601; orders created after'),
	created_before: z.string().min(1).optional().describe('ISO 8601; orders created before'),
	last_updated_after: z.string().min(1).optional().describe('ISO 8601; orders updated after'),
	order_statuses: z.array(z.string().min(1)).optional().describe('Order status filter list'),
	cursor: z.string().min(1).optional().describe('NextToken from a prior page'),
	max_results: z.int().min(1).max(100).optional().describe('Page size (1-100)')
})

export const amazonSpApiOrderSchema = z.object({
	amazon_order_id: z.string(),
	order_status: z.string().optional(),
	purchase_date: z.string().optional(),
	last_update_date: z.string().optional(),
	marketplace_id: z.string().optional(),
	order_total_amount: z.string().optional(),
	order_total_currency: z.string().optional(),
	fulfillment_channel: z.string().optional()
})

export const amazonSpApiListOrdersOutputSchema = z.object({
	items: z.array(amazonSpApiOrderSchema),
	next_cursor: z.string().optional(),
	truncated: z.boolean()
})

export const amazonSpApiGetOrderInputSchema = z.object({
	amazon_order_id: z.string().min(1).describe('Amazon order id')
})

export const amazonSpApiGetOrderOutputSchema = z.object({
	order: amazonSpApiOrderSchema
})

export const amazonSpApiGetOrderItemsInputSchema = z.object({
	amazon_order_id: z.string().min(1).describe('Amazon order id'),
	cursor: z.string().min(1).optional().describe('NextToken from a prior page')
})

export const amazonSpApiOrderItemSchema = z.object({
	order_item_id: z.string(),
	asin: z.string().optional(),
	seller_sku: z.string().optional(),
	title: z.string().optional(),
	quantity_ordered: z.number().optional(),
	quantity_shipped: z.number().optional(),
	item_price_amount: z.string().optional(),
	item_price_currency: z.string().optional()
})

export const amazonSpApiGetOrderItemsOutputSchema = z.object({
	amazon_order_id: z.string(),
	items: z.array(amazonSpApiOrderItemSchema),
	next_cursor: z.string().optional(),
	truncated: z.boolean()
})

// ─── Orders v2026-01-01 SearchOrders ──────────────────────────────────────────

export const amazonSpApiSearchOrdersInputSchema = z.object({
	created_after: z
		.string()
		.min(1)
		.describe('ISO 8601; orders created at or after this time (required for reconciliation)'),
	created_before: z.string().min(1).optional().describe('ISO 8601; orders created at or before this time'),
	marketplace_ids: z
		.array(z.string().min(1))
		.min(1)
		.optional()
		.describe('Marketplace ids (defaults to auth.marketplace_ids)'),
	max_results: z.int().min(1).max(100).optional().describe('Page size (1-100, default 100)'),
	cursor: z.string().min(1).optional().describe('paginationToken from a prior page'),
	max_pages: z
		.int()
		.min(1)
		.max(50)
		.optional()
		.describe('When set, drains up to this many pages and returns a combined list (default 1)')
})

export const amazonSpApiSearchOrderSchema = z.object({
	order_id: z.string().describe('Amazon order id'),
	created_time: z.string().optional().describe('Order created time (ISO 8601)'),
	fulfillment_status: z.string().optional().describe('Fulfillment status when FULFILLMENT data is included')
})

export const amazonSpApiSearchOrdersOutputSchema = z.object({
	items: z.array(amazonSpApiSearchOrderSchema),
	next_cursor: z.string().optional().describe('paginationToken for the next page when not fully drained'),
	truncated: z.boolean()
})

// ─── Inventory ────────────────────────────────────────────────────────────────

export const amazonSpApiListInventorySummariesInputSchema = z.object({
	marketplace_id: z.string().min(1).optional().describe('Marketplace id (defaults to first auth.marketplace_ids)'),
	seller_skus: z.array(z.string().min(1)).max(50).optional().describe('Optional seller SKU filter (max 50)'),
	start_date_time: z.string().min(1).optional().describe('ISO 8601; summaries changed after'),
	cursor: z.string().min(1).optional().describe('nextToken from a prior page')
})

export const amazonSpApiInventorySummarySchema = z.object({
	seller_sku: z.string().optional(),
	asin: z.string().optional(),
	fn_sku: z.string().optional(),
	condition: z.string().optional(),
	total_quantity: z.number().optional(),
	product_name: z.string().optional()
})

export const amazonSpApiListInventorySummariesOutputSchema = z.object({
	items: z.array(amazonSpApiInventorySummarySchema),
	next_cursor: z.string().optional(),
	truncated: z.boolean()
})

// ─── Reports (2021-06-30) ─────────────────────────────────────────────────────

export const amazonSpApiCreateReportInputSchema = z.object({
	report_type: z.string().min(1).describe('Report type (e.g. GET_FLAT_FILE_OPEN_LISTINGS_DATA)'),
	marketplace_ids: z
		.array(z.string().min(1))
		.min(1)
		.optional()
		.describe('Marketplace ids (defaults to auth.marketplace_ids)'),
	data_start_time: z.string().min(1).optional().describe('ISO 8601 report data start'),
	data_end_time: z.string().min(1).optional().describe('ISO 8601 report data end'),
	report_options: z.record(z.string(), z.string()).optional().describe('Optional report-type-specific options map')
})

export const amazonSpApiCreateReportOutputSchema = z.object({
	report_id: z.string()
})

export const amazonSpApiGetReportInputSchema = z.object({
	report_id: z.string().min(1).describe('Report id from createReport or listReports')
})

export const amazonSpApiReportSchema = z.object({
	report_id: z.string(),
	report_type: z.string().optional(),
	processing_status: z.string().optional(),
	marketplace_ids: z.array(z.string()).optional(),
	data_start_time: z.string().optional(),
	data_end_time: z.string().optional(),
	report_document_id: z.string().optional(),
	created_time: z.string().optional()
})

export const amazonSpApiGetReportOutputSchema = z.object({
	report: amazonSpApiReportSchema
})

export const amazonSpApiListReportsInputSchema = z.object({
	report_types: z.array(z.string().min(1)).optional().describe('Filter by report type(s)'),
	processing_statuses: z
		.array(z.string().min(1))
		.optional()
		.describe('Filter by processing status (e.g. DONE, IN_QUEUE, IN_PROGRESS, CANCELLED, FATAL)'),
	marketplace_ids: z
		.array(z.string().min(1))
		.min(1)
		.optional()
		.describe('Marketplace ids filter (defaults to auth.marketplace_ids when set)'),
	page_size: z.int().min(1).max(100).optional().describe('Page size (1-100)'),
	created_since: z.string().min(1).optional().describe('ISO 8601; reports created after'),
	created_until: z.string().min(1).optional().describe('ISO 8601; reports created before'),
	cursor: z.string().min(1).optional().describe('nextToken from a prior page')
})

export const amazonSpApiListReportsOutputSchema = z.object({
	items: z.array(amazonSpApiReportSchema),
	next_cursor: z.string().optional(),
	truncated: z.boolean()
})

export const amazonSpApiGetReportDocumentInputSchema = z.object({
	report_document_id: z.string().min(1).describe('Report document id from a completed report')
})

export const amazonSpApiGetReportDocumentOutputSchema = z.object({
	document_id: z.string(),
	url: z.string(),
	compression_algorithm: z.string().optional()
})

// ─── Catalog (2022-04-01) ─────────────────────────────────────────────────────

export const amazonSpApiSearchCatalogItemsInputSchema = z.object({
	keywords: z.array(z.string().min(1)).min(1).describe('Search keywords'),
	marketplace_ids: z
		.array(z.string().min(1))
		.min(1)
		.optional()
		.describe('Marketplace ids (defaults to auth.marketplace_ids)'),
	included_data: z
		.array(z.string().min(1))
		.optional()
		.describe('Data sets to include (e.g. summaries, images, attributes)'),
	page_size: z.int().min(1).max(20).optional().describe('Page size (1-20)'),
	cursor: z.string().min(1).optional().describe('pageToken from a prior page')
})

export const amazonSpApiCatalogItemSchema = z.object({
	asin: z.string(),
	title: z.string().optional(),
	brand: z.string().optional(),
	product_type: z.string().optional(),
	marketplace_id: z.string().optional()
})

export const amazonSpApiSearchCatalogItemsOutputSchema = z.object({
	items: z.array(amazonSpApiCatalogItemSchema),
	number_of_results: z.number().optional(),
	next_cursor: z.string().optional(),
	truncated: z.boolean()
})

// ─── Types ────────────────────────────────────────────────────────────────────

export type AmazonSpApiListOrdersInput = z.infer<typeof amazonSpApiListOrdersInputSchema>
export type AmazonSpApiListOrdersOutput = z.infer<typeof amazonSpApiListOrdersOutputSchema>
export type AmazonSpApiGetOrderInput = z.infer<typeof amazonSpApiGetOrderInputSchema>
export type AmazonSpApiGetOrderOutput = z.infer<typeof amazonSpApiGetOrderOutputSchema>
export type AmazonSpApiGetOrderItemsInput = z.infer<typeof amazonSpApiGetOrderItemsInputSchema>
export type AmazonSpApiGetOrderItemsOutput = z.infer<typeof amazonSpApiGetOrderItemsOutputSchema>
export type AmazonSpApiListInventorySummariesInput = z.infer<typeof amazonSpApiListInventorySummariesInputSchema>
export type AmazonSpApiListInventorySummariesOutput = z.infer<typeof amazonSpApiListInventorySummariesOutputSchema>
export type AmazonSpApiCreateReportInput = z.infer<typeof amazonSpApiCreateReportInputSchema>
export type AmazonSpApiCreateReportOutput = z.infer<typeof amazonSpApiCreateReportOutputSchema>
export type AmazonSpApiGetReportInput = z.infer<typeof amazonSpApiGetReportInputSchema>
export type AmazonSpApiGetReportOutput = z.infer<typeof amazonSpApiGetReportOutputSchema>
export type AmazonSpApiListReportsInput = z.infer<typeof amazonSpApiListReportsInputSchema>
export type AmazonSpApiListReportsOutput = z.infer<typeof amazonSpApiListReportsOutputSchema>
export type AmazonSpApiGetReportDocumentInput = z.infer<typeof amazonSpApiGetReportDocumentInputSchema>
export type AmazonSpApiGetReportDocumentOutput = z.infer<typeof amazonSpApiGetReportDocumentOutputSchema>
export type AmazonSpApiSearchCatalogItemsInput = z.infer<typeof amazonSpApiSearchCatalogItemsInputSchema>
export type AmazonSpApiSearchCatalogItemsOutput = z.infer<typeof amazonSpApiSearchCatalogItemsOutputSchema>
export type AmazonSpApiSearchOrdersInput = z.infer<typeof amazonSpApiSearchOrdersInputSchema>
export type AmazonSpApiSearchOrdersOutput = z.infer<typeof amazonSpApiSearchOrdersOutputSchema>
export type AmazonSpApiSearchOrder = z.infer<typeof amazonSpApiSearchOrderSchema>
export type AmazonSpApiOrder = z.infer<typeof amazonSpApiOrderSchema>
export type AmazonSpApiOrderItem = z.infer<typeof amazonSpApiOrderItemSchema>
export type AmazonSpApiInventorySummary = z.infer<typeof amazonSpApiInventorySummarySchema>
export type AmazonSpApiReport = z.infer<typeof amazonSpApiReportSchema>
export type AmazonSpApiCatalogItem = z.infer<typeof amazonSpApiCatalogItemSchema>
