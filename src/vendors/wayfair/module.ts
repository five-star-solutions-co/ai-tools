import { defineModule, defineTool } from '../../core/define'
import { WayfairClient } from './client'
import {
	wayfairAuthSchema,
	wayfairListCatalogPageInputSchema,
	wayfairListCatalogPageOutputSchema,
	wayfairListDropshipOrdersInputSchema,
	wayfairListDropshipOrdersOutputSchema
} from './contracts'

export const wayfairListCatalogTool = defineTool({
	id: 'wayfair-list-catalog',
	name: 'wayfairListCatalog',
	description: 'List one Wayfair Supplier production catalog page with product, supplier part, and SKU details.',
	inputSchema: wayfairListCatalogPageInputSchema,
	outputSchema: wayfairListCatalogPageOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	idempotent: true,
	network: true,
	supportsCancel: true,
	tags: ['catalog', 'products', 'skus'],
	execute: async (input, ctx) => WayfairClient.fromContext(ctx).listCatalogPage(input)
})

export const wayfairListDropshipOrdersTool = defineTool({
	id: 'wayfair-list-dropship-orders',
	name: 'wayfairListDropshipOrders',
	description:
		'List Wayfair Supplier production dropship purchase orders by date, response state, or purchase order number without selecting customer PII.',
	inputSchema: wayfairListDropshipOrdersInputSchema,
	outputSchema: wayfairListDropshipOrdersOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	idempotent: true,
	network: true,
	supportsCancel: true,
	tags: ['orders', 'sales', 'fulfillment'],
	execute: async (input, ctx) => WayfairClient.fromContext(ctx).listDropshipOrders(input)
})

export const wayfairModule = defineModule({
	id: 'wayfair',
	title: 'Wayfair Supplier',
	description: 'Read-only Wayfair Supplier production pack for catalog products and dropship purchase orders.',
	runtime: 'both',
	auth: { type: 'custom', schema: wayfairAuthSchema },
	categories: ['commerce', 'marketplace'],
	classification: 'pii',
	tags: ['catalog', 'orders', 'sales', 'wayfair'],
	tools: [wayfairListCatalogTool, wayfairListDropshipOrdersTool]
})
