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
	endpoint: amazonSpApiEndpointSchema.describe('SP-API regional endpoint'),
	marketplace_ids: z
		.array(z.string().min(1))
		.min(1)
		.optional()
		.describe('Default marketplace ids when a tool call omits marketplace_ids'),
	user_agent: z.string().min(1).describe('Application user agent sent with every SP-API request')
})

export type AmazonSpApiAuth = z.infer<typeof amazonSpApiAuthSchema>

export const amazonSpApiLwaTokenResponseSchema = z.object({
	access_token: z.string().min(1),
	token_type: z.string().min(1),
	expires_in: z.number().int().positive()
})

export type AmazonSpApiLwaTokenResponse = z.infer<typeof amazonSpApiLwaTokenResponseSchema>

// ─── Orders ───────────────────────────────────────────────────────────────────

export const amazonSpApiListOrdersInputSchema = z.object({
	marketplace_ids: z
		.array(z.string().min(1))
		.min(1)
		.optional()
		.describe('Marketplace ids; omit to use the configured defaults'),
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
		.describe('Marketplace ids; omit to use the configured defaults'),
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

const amazonInventoryDateTimeSchema = z.iso.datetime({ offset: true })

function eighteenMonthsBeforeNow(): number {
	const oldestAllowed = new Date()
	const currentDay = oldestAllowed.getUTCDate()
	oldestAllowed.setUTCDate(1)
	oldestAllowed.setUTCMonth(oldestAllowed.getUTCMonth() - 18)
	const lastDayOfTargetMonth = new Date(
		Date.UTC(oldestAllowed.getUTCFullYear(), oldestAllowed.getUTCMonth() + 1, 0)
	).getUTCDate()
	oldestAllowed.setUTCDate(Math.min(currentDay, lastDayOfTargetMonth))
	return oldestAllowed.getTime()
}

const amazonInventoryFullPageInputSchema = z.strictObject({
	mode: z.literal('full'),
	marketplace_id: z.string().min(1),
	next_token: z.string().min(1).optional()
})

const amazonInventoryIncrementalPageInputSchema = z.strictObject({
	mode: z.literal('incremental'),
	marketplace_id: z.string().min(1),
	start_date_time: amazonInventoryDateTimeSchema,
	next_token: z.string().min(1).optional()
})

export const amazonSpApiInventoryPageInputSchema = z
	.discriminatedUnion('mode', [amazonInventoryFullPageInputSchema, amazonInventoryIncrementalPageInputSchema])
	.superRefine((input, context) => {
		if (input.mode !== 'incremental') return
		if (Date.parse(input.start_date_time) < eighteenMonthsBeforeNow()) {
			context.addIssue({
				code: 'custom',
				path: ['start_date_time'],
				message: 'start_date_time cannot be more than 18 months in the past'
			})
		}
	})

export const amazonInventoryReservedQuantityRawSchema = z.looseObject({
	totalReservedQuantity: z.number().optional(),
	pendingCustomerOrderQuantity: z.number().optional(),
	pendingTransshipmentQuantity: z.number().optional(),
	fcProcessingQuantity: z.number().optional()
})

export const amazonInventoryResearchingQuantityBreakdownRawSchema = z.looseObject({
	name: z.enum(['researchingQuantityInShortTerm', 'researchingQuantityInMidTerm', 'researchingQuantityInLongTerm']),
	quantity: z.int()
})

export const amazonInventoryResearchingQuantityRawSchema = z.looseObject({
	totalResearchingQuantity: z.number().optional(),
	researchingQuantityBreakdown: z.array(amazonInventoryResearchingQuantityBreakdownRawSchema).optional()
})

export const amazonInventoryUnfulfillableQuantityRawSchema = z.looseObject({
	totalUnfulfillableQuantity: z.number().optional(),
	customerDamagedQuantity: z.number().optional(),
	warehouseDamagedQuantity: z.number().optional(),
	distributorDamagedQuantity: z.number().optional(),
	carrierDamagedQuantity: z.number().optional(),
	defectiveQuantity: z.number().optional(),
	expiredQuantity: z.number().optional()
})

export const amazonInventoryDetailsRawSchema = z.looseObject({
	fulfillableQuantity: z.number().optional(),
	inboundWorkingQuantity: z.number().optional(),
	inboundShippedQuantity: z.number().optional(),
	inboundReceivingQuantity: z.number().optional(),
	reservedQuantity: amazonInventoryReservedQuantityRawSchema.optional(),
	researchingQuantity: amazonInventoryResearchingQuantityRawSchema.optional(),
	unfulfillableQuantity: amazonInventoryUnfulfillableQuantityRawSchema.optional()
})

export const amazonInventorySummaryRawSchema = z.looseObject({
	asin: z.string().optional(),
	fnSku: z.string().optional(),
	sellerSku: z.string().optional(),
	condition: z.string().optional(),
	productName: z.string().optional(),
	totalQuantity: z.number().optional(),
	lastUpdatedTime: z.string().optional(),
	stores: z.array(z.string()).optional(),
	inventoryDetails: amazonInventoryDetailsRawSchema.optional()
})

export const amazonSpApiInventoryPageOutputSchema = z.object({
	items: z.array(amazonInventorySummaryRawSchema),
	next_token: z.string().optional(),
	rate_limit_per_second: z.number().optional(),
	request_id: z.string().optional()
})

export const amazonSpApiListInventorySummariesInputSchema = z.object({
	marketplace_id: z.string().min(1).optional().describe('Marketplace id; omit to use the first configured default'),
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
		.describe('Marketplace ids; omit to use the configured defaults'),
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

const amazonSpApiListReportsInitialFields = {
	report_types: z.array(z.string().min(1)).min(1).max(10).describe('Filter by 1-10 report types'),
	processing_statuses: z
		.array(z.string().min(1))
		.optional()
		.describe('Filter by processing status (e.g. DONE, IN_QUEUE, IN_PROGRESS, CANCELLED, FATAL)'),
	marketplace_ids: z
		.array(z.string().min(1))
		.min(1)
		.optional()
		.describe('Marketplace ids filter; omit to use configured defaults when available'),
	page_size: z.int().min(1).max(100).optional().describe('Page size (1-100)'),
	created_since: z.iso.datetime({ offset: true }).optional().describe('ISO 8601; reports created after'),
	created_until: z.iso.datetime({ offset: true }).optional().describe('ISO 8601; reports created before')
}

export const amazonSpApiListReportsInitialInputSchema = z.strictObject(amazonSpApiListReportsInitialFields)

const amazonSpApiListReportsCursorInputSchema = z.strictObject({
	cursor: z.string().min(1).describe('nextToken from a prior page')
})

export const amazonSpApiListReportsInputSchema = z.union([
	amazonSpApiListReportsInitialInputSchema,
	amazonSpApiListReportsCursorInputSchema
])

export const amazonReportRawSchema = z.looseObject({
	reportId: z.string().min(1),
	reportType: z.string().optional(),
	processingStatus: z.string().optional(),
	marketplaceIds: z.array(z.string()).optional(),
	dataStartTime: z.string().optional(),
	dataEndTime: z.string().optional(),
	reportScheduleId: z.string().optional(),
	createdTime: z.string().optional(),
	processingStartTime: z.string().optional(),
	processingEndTime: z.string().optional(),
	reportDocumentId: z.string().optional()
})

export const amazonSpApiListReportsContinuationInputSchema = z.strictObject({
	next_token: z.string().min(1)
})

export const amazonSpApiListReportsPageInputSchema = z.union([
	amazonSpApiListReportsInitialInputSchema,
	amazonSpApiListReportsContinuationInputSchema
])

export const amazonSpApiListReportsPageOutputSchema = z.object({
	items: z.array(amazonReportRawSchema),
	next_token: z.string().optional(),
	rate_limit_per_second: z.number().optional(),
	request_id: z.string().optional()
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

export const amazonSpApiDownloadReportDocumentBytesInputSchema = z.strictObject({
	report_document_id: z.string().min(1),
	max_bytes: z.int().positive()
})

export const amazonSpApiDownloadReportDocumentBytesOutputSchema = z.object({
	bytes: z.custom<Uint8Array>((value) => value instanceof Uint8Array),
	text: z.string(),
	byte_length: z.int().nonnegative(),
	content_type: z.string().optional(),
	content_encoding: z.string().optional(),
	compression_algorithm: z.enum(['GZIP']).optional()
})

// ─── Settlement summary (Flat File V2 composite) ──────────────────────────────

/**
 * Composite input: pick newest completed V2 settlement report in the retention
 * window (default 90d), download one document, return eight summary fields only.
 */
export const amazonSpApiGetSettlementSummaryInputSchema = z.object({
	report_id: z
		.string()
		.min(1)
		.optional()
		.describe('Optional report id; when set, uses this report instead of listing the newest DONE settlement report'),
	created_since: z
		.string()
		.min(1)
		.optional()
		.describe('ISO 8601 lower bound when listing reports (default: now minus 90 days)')
})

/** Eight summary fields only — never raw TSV rows. */
export const amazonSpApiSettlementSummarySchema = z.object({
	settlement_id: z.string().describe('Amazon settlement id'),
	settlement_start_date: z.string().describe('Settlement period start'),
	settlement_end_date: z.string().describe('Settlement period end'),
	deposit_date: z.string().describe('Deposit date when present; otherwise settlement end'),
	currency: z.string().describe('ISO currency code from the report'),
	total_amount_cents: z
		.number()
		.int()
		.describe('Report total-amount as safe integer cents (must equal amount_sum_cents)'),
	amount_sum_cents: z.number().int().describe('Sum of amount column as safe integer cents'),
	row_count: z.number().int().describe('Number of data rows in the TSV (excluding header)')
})

export const amazonSpApiGetSettlementSummaryOutputSchema = amazonSpApiSettlementSummarySchema

// ─── Catalog (2022-04-01) ─────────────────────────────────────────────────────

export const amazonSpApiSearchCatalogItemsInputSchema = z.object({
	keywords: z.array(z.string().min(1)).min(1).describe('Search keywords'),
	marketplace_ids: z
		.array(z.string().min(1))
		.min(1)
		.optional()
		.describe('Marketplace ids; omit to use the configured defaults'),
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
export type AmazonSpApiInventoryPageInput = z.infer<typeof amazonSpApiInventoryPageInputSchema>
export type AmazonSpApiInventoryPageOutput = z.infer<typeof amazonSpApiInventoryPageOutputSchema>
export type AmazonInventorySummaryRaw = z.infer<typeof amazonInventorySummaryRawSchema>
export type AmazonSpApiCreateReportInput = z.infer<typeof amazonSpApiCreateReportInputSchema>
export type AmazonSpApiCreateReportOutput = z.infer<typeof amazonSpApiCreateReportOutputSchema>
export type AmazonSpApiGetReportInput = z.infer<typeof amazonSpApiGetReportInputSchema>
export type AmazonSpApiGetReportOutput = z.infer<typeof amazonSpApiGetReportOutputSchema>
export type AmazonSpApiListReportsInput = z.infer<typeof amazonSpApiListReportsInputSchema>
export type AmazonSpApiListReportsOutput = z.infer<typeof amazonSpApiListReportsOutputSchema>
export type AmazonSpApiListReportsInitialInput = z.infer<typeof amazonSpApiListReportsInitialInputSchema>
export type AmazonSpApiListReportsContinuationInput = z.infer<typeof amazonSpApiListReportsContinuationInputSchema>
export type AmazonSpApiListReportsPageInput = z.infer<typeof amazonSpApiListReportsPageInputSchema>
export type AmazonSpApiListReportsPageOutput = z.infer<typeof amazonSpApiListReportsPageOutputSchema>
export type AmazonReportRaw = z.infer<typeof amazonReportRawSchema>
export type AmazonSpApiGetReportDocumentInput = z.infer<typeof amazonSpApiGetReportDocumentInputSchema>
export type AmazonSpApiGetReportDocumentOutput = z.infer<typeof amazonSpApiGetReportDocumentOutputSchema>
export type AmazonSpApiDownloadReportDocumentBytesInput = z.infer<
	typeof amazonSpApiDownloadReportDocumentBytesInputSchema
>
export type AmazonSpApiDownloadReportDocumentBytesOutput = z.infer<
	typeof amazonSpApiDownloadReportDocumentBytesOutputSchema
>
export type AmazonSpApiSearchCatalogItemsInput = z.infer<typeof amazonSpApiSearchCatalogItemsInputSchema>
export type AmazonSpApiSearchCatalogItemsOutput = z.infer<typeof amazonSpApiSearchCatalogItemsOutputSchema>
export type AmazonSpApiSearchOrdersInput = z.infer<typeof amazonSpApiSearchOrdersInputSchema>
export type AmazonSpApiSearchOrdersOutput = z.infer<typeof amazonSpApiSearchOrdersOutputSchema>
export type AmazonSpApiSearchOrder = z.infer<typeof amazonSpApiSearchOrderSchema>
export type AmazonSpApiGetSettlementSummaryInput = z.infer<typeof amazonSpApiGetSettlementSummaryInputSchema>
export type AmazonSpApiGetSettlementSummaryOutput = z.infer<typeof amazonSpApiGetSettlementSummaryOutputSchema>
export type AmazonSpApiSettlementSummary = z.infer<typeof amazonSpApiSettlementSummarySchema>
export type AmazonSpApiOrder = z.infer<typeof amazonSpApiOrderSchema>
export type AmazonSpApiOrderItem = z.infer<typeof amazonSpApiOrderItemSchema>
export type AmazonSpApiInventorySummary = z.infer<typeof amazonSpApiInventorySummarySchema>
export type AmazonSpApiReport = z.infer<typeof amazonSpApiReportSchema>
export type AmazonSpApiCatalogItem = z.infer<typeof amazonSpApiCatalogItemSchema>
