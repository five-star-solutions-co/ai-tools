import { z } from 'zod'

import { defineModule, defineTool } from '../../core/define'
import { WalmartClient } from './client'
import {
	walmartAuthSchema,
	walmartListItemsPageInputSchema,
	walmartListItemsPageOutputSchema,
	walmartListOrdersPageInputSchema,
	walmartListOrdersPageOutputSchema,
	walmartListReconReportDatesOutputSchema,
	walmartListReturnsPageInputSchema,
	walmartListReturnsPageOutputSchema
} from './contracts'

const emptyInputSchema = z.strictObject({}).describe('No input fields')

export const walmartListOrdersTool = defineTool({
	id: 'walmart-list-orders',
	name: 'walmartListOrders',
	description:
		'List one Walmart Marketplace US orders page with order-id, status, fulfillment, and creation or modification date filters.',
	inputSchema: walmartListOrdersPageInputSchema,
	outputSchema: walmartListOrdersPageOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	idempotent: true,
	network: true,
	supportsCancel: true,
	tags: ['orders', 'sales', 'fulfillment'],
	execute: async (input, ctx) => WalmartClient.fromContext(ctx).listOrdersPage(input)
})

export const walmartListItemsTool = defineTool({
	id: 'walmart-list-items',
	name: 'walmartListItems',
	description:
		'List one Walmart Marketplace US catalog page with SKU, GTIN, lifecycle, publication, availability, variant, duplicate, and virtual-pack filters.',
	inputSchema: walmartListItemsPageInputSchema,
	outputSchema: walmartListItemsPageOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	idempotent: true,
	network: true,
	supportsCancel: true,
	tags: ['items', 'catalog', 'inventory'],
	execute: async (input, ctx) => WalmartClient.fromContext(ctx).listItemsPage(input)
})

export const walmartListReturnsTool = defineTool({
	id: 'walmart-list-returns',
	name: 'walmartListReturns',
	description:
		'List one Walmart Marketplace US returns page with RMA, order, status, type, WFS, and creation or modification date filters.',
	inputSchema: walmartListReturnsPageInputSchema,
	outputSchema: walmartListReturnsPageOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	idempotent: true,
	network: true,
	supportsCancel: true,
	tags: ['returns', 'refunds', 'orders'],
	execute: async (input, ctx) => WalmartClient.fromContext(ctx).listReturnsPage(input)
})

export const walmartListReconReportDatesTool = defineTool({
	id: 'walmart-list-recon-report-dates',
	name: 'walmartListReconReportDates',
	description:
		'List the Walmart Marketplace US legacy V1 reconciliation report dates currently available for download.',
	inputSchema: emptyInputSchema,
	outputSchema: walmartListReconReportDatesOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	idempotent: true,
	network: true,
	supportsCancel: true,
	tags: ['reports', 'reconciliation', 'payments'],
	execute: async (_input, ctx) => WalmartClient.fromContext(ctx).listReconReportDates()
})

export const walmartModule = defineModule({
	id: 'walmart',
	title: 'Walmart Marketplace',
	description: 'Walmart Marketplace US read pack for orders, catalog items, returns, and reconciliation reports.',
	runtime: 'both',
	auth: { type: 'custom', schema: walmartAuthSchema },
	categories: ['commerce', 'marketplace'],
	classification: 'pii',
	tags: ['orders', 'items', 'returns', 'reconciliation', 'walmart'],
	tools: [walmartListOrdersTool, walmartListItemsTool, walmartListReturnsTool, walmartListReconReportDatesTool]
})
