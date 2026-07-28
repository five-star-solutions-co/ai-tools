import { defineModule, defineTool } from '../../core/define'
import { AmazonSpApiClient } from './client'
import {
	amazonSpApiAuthSchema,
	amazonSpApiCreateReportInputSchema,
	amazonSpApiCreateReportOutputSchema,
	amazonSpApiGetOrderInputSchema,
	amazonSpApiGetOrderItemsInputSchema,
	amazonSpApiGetOrderItemsOutputSchema,
	amazonSpApiGetOrderOutputSchema,
	amazonSpApiGetReportDocumentInputSchema,
	amazonSpApiGetReportDocumentOutputSchema,
	amazonSpApiGetReportInputSchema,
	amazonSpApiGetReportOutputSchema,
	amazonSpApiListInventorySummariesInputSchema,
	amazonSpApiListInventorySummariesOutputSchema,
	amazonSpApiListOrdersInputSchema,
	amazonSpApiListOrdersOutputSchema,
	amazonSpApiListReportsInputSchema,
	amazonSpApiListReportsOutputSchema,
	amazonSpApiSearchCatalogItemsInputSchema,
	amazonSpApiSearchCatalogItemsOutputSchema,
	amazonSpApiSearchOrdersInputSchema,
	amazonSpApiSearchOrdersOutputSchema,
	amazonSpApiGetSettlementSummaryInputSchema,
	amazonSpApiGetSettlementSummaryOutputSchema
} from './contracts'

export const amazonSpApiListOrdersTool = defineTool({
	id: 'amazon-sp-api-list-orders',
	name: 'amazonSpApiListOrders',
	description:
		'List Amazon SP-API orders for one or more marketplaces. Optional date and status filters. Paginate with next_cursor (NextToken).',
	inputSchema: amazonSpApiListOrdersInputSchema,
	outputSchema: amazonSpApiListOrdersOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => AmazonSpApiClient.fromContext(ctx).listOrders(input)
})

export const amazonSpApiGetOrderTool = defineTool({
	id: 'amazon-sp-api-get-order',
	name: 'amazonSpApiGetOrder',
	description: 'Get one Amazon SP-API order by AmazonOrderId.',
	inputSchema: amazonSpApiGetOrderInputSchema,
	outputSchema: amazonSpApiGetOrderOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => AmazonSpApiClient.fromContext(ctx).getOrder(input)
})

export const amazonSpApiGetOrderItemsTool = defineTool({
	id: 'amazon-sp-api-get-order-items',
	name: 'amazonSpApiGetOrderItems',
	description: 'List line items for one Amazon SP-API order. Paginate with next_cursor (NextToken).',
	inputSchema: amazonSpApiGetOrderItemsInputSchema,
	outputSchema: amazonSpApiGetOrderItemsOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => AmazonSpApiClient.fromContext(ctx).getOrderItems(input)
})

export const amazonSpApiSearchOrdersTool = defineTool({
	id: 'amazon-sp-api-search-orders',
	name: 'amazonSpApiSearchOrders',
	description:
		'Search Amazon orders via Orders API v2026-01-01 (searchOrders). Filter by created_after (required) and optional created_before. Always includes FULFILLMENT data for fulfillment_status. Optional max_pages drains pages sequentially (max 50). Paginate with next_cursor when truncated.',
	inputSchema: amazonSpApiSearchOrdersInputSchema,
	outputSchema: amazonSpApiSearchOrdersOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => AmazonSpApiClient.fromContext(ctx).searchOrders(input)
})

export const amazonSpApiListInventorySummariesTool = defineTool({
	id: 'amazon-sp-api-list-inventory-summaries',
	name: 'amazonSpApiListInventorySummaries',
	description:
		'List FBA inventory summaries for a marketplace. Optional seller SKUs and start_date_time. Paginate with next_cursor.',
	inputSchema: amazonSpApiListInventorySummariesInputSchema,
	outputSchema: amazonSpApiListInventorySummariesOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => AmazonSpApiClient.fromContext(ctx).listInventorySummaries(input)
})

export const amazonSpApiCreateReportTool = defineTool({
	id: 'amazon-sp-api-create-report',
	name: 'amazonSpApiCreateReport',
	description:
		'Request an Amazon SP-API report for given marketplace(s) and optional date range. Returns report_id for later getReport polling.',
	inputSchema: amazonSpApiCreateReportInputSchema,
	outputSchema: amazonSpApiCreateReportOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => AmazonSpApiClient.fromContext(ctx).createReport(input)
})

export const amazonSpApiGetReportTool = defineTool({
	id: 'amazon-sp-api-get-report',
	name: 'amazonSpApiGetReport',
	description:
		'Get one Amazon SP-API report by report_id, including processing_status and report_document_id when DONE.',
	inputSchema: amazonSpApiGetReportInputSchema,
	outputSchema: amazonSpApiGetReportOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => AmazonSpApiClient.fromContext(ctx).getReport(input)
})

export const amazonSpApiListReportsTool = defineTool({
	id: 'amazon-sp-api-list-reports',
	name: 'amazonSpApiListReports',
	description:
		'List Amazon SP-API reports with optional type, status, marketplace, and created-time filters. Paginate with next_cursor.',
	inputSchema: amazonSpApiListReportsInputSchema,
	outputSchema: amazonSpApiListReportsOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => AmazonSpApiClient.fromContext(ctx).listReports(input)
})

export const amazonSpApiGetReportDocumentTool = defineTool({
	id: 'amazon-sp-api-get-report-document',
	name: 'amazonSpApiGetReportDocument',
	description:
		'Get a downloadable Amazon SP-API report document (document_id, url, optional compression_algorithm). Does not download the file body.',
	inputSchema: amazonSpApiGetReportDocumentInputSchema,
	outputSchema: amazonSpApiGetReportDocumentOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => AmazonSpApiClient.fromContext(ctx).getReportDocument(input)
})

export const amazonSpApiSearchCatalogItemsTool = defineTool({
	id: 'amazon-sp-api-search-catalog-items',
	name: 'amazonSpApiSearchCatalogItems',
	description:
		'Search Amazon catalog items by keywords for marketplace(s). Optional included_data and page_size. Paginate with next_cursor (pageToken).',
	inputSchema: amazonSpApiSearchCatalogItemsInputSchema,
	outputSchema: amazonSpApiSearchCatalogItemsOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => AmazonSpApiClient.fromContext(ctx).searchCatalogItems(input)
})

export const amazonSpApiGetSettlementSummaryTool = defineTool({
	id: 'amazon-sp-api-get-settlement-summary',
	name: 'amazonSpApiGetSettlementSummary',
	description:
		'Summarize the newest completed Amazon Flat File V2 settlement report (or a specific report_id): downloads one document, validates the TSV, and returns eight summary fields in integer cents (settlement id, period, deposit date, currency, total and amount sum, row count). Does not return line-level order or SKU data. Optional created_since (default last 90 days when listing).',
	inputSchema: amazonSpApiGetSettlementSummaryInputSchema,
	outputSchema: amazonSpApiGetSettlementSummaryOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => AmazonSpApiClient.fromContext(ctx).getSettlementSummary(input)
})

export const amazonSpApiModule = defineModule({
	id: 'amazon-sp-api',
	title: 'Amazon SP-API',
	description:
		'Amazon Selling Partner API vendor pack: orders v0 and SearchOrders v2026, order items, FBA inventory summaries, reports (create/get/list/document), settlement V2 summary, and catalog item search.',
	runtime: 'both',
	auth: { type: 'custom', schema: amazonSpApiAuthSchema },
	tools: [
		amazonSpApiListOrdersTool,
		amazonSpApiGetOrderTool,
		amazonSpApiGetOrderItemsTool,
		amazonSpApiSearchOrdersTool,
		amazonSpApiListInventorySummariesTool,
		amazonSpApiCreateReportTool,
		amazonSpApiGetReportTool,
		amazonSpApiListReportsTool,
		amazonSpApiGetReportDocumentTool,
		amazonSpApiGetSettlementSummaryTool,
		amazonSpApiSearchCatalogItemsTool
	]
})
