import { defineModule, defineTool } from '../../core/define'
import { WayfairClient } from './client'
import {
	wayfairAcceptDropshipOrderInputSchema,
	wayfairAuthSchema,
	wayfairDropshipOrderDetailsSchema,
	wayfairGetDropshipOrderInputSchema,
	wayfairListCatalogPageInputSchema,
	wayfairListCatalogPageOutputSchema,
	wayfairListDropshipOrdersInputSchema,
	wayfairListDropshipOrdersOutputSchema,
	wayfairSendShipmentNoticeInputSchema,
	wayfairTransactionStatusSchema
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

export const wayfairGetDropshipOrderTool = defineTool({
	id: 'wayfair-get-dropship-order',
	name: 'wayfairGetDropshipOrder',
	description:
		'Get one exact Wayfair production dropship purchase order with prices, shipping service, and customer shipping/billing details for fulfillment. Does not accept or acknowledge the order. Use the order list when customer details are unnecessary.',
	inputSchema: wayfairGetDropshipOrderInputSchema,
	outputSchema: wayfairDropshipOrderDetailsSchema,
	sideEffect: 'read',
	runtime: 'both',
	idempotent: true,
	network: true,
	supportsCancel: true,
	tags: ['orders', 'fulfillment'],
	execute: async (input, ctx) => WayfairClient.fromContext(ctx).getDropshipOrder(input)
})

export const wayfairAcceptDropshipOrderTool = defineTool({
	id: 'wayfair-accept-dropship-order',
	name: 'wayfairAcceptDropshipOrder',
	description:
		'Accept line items on a Wayfair production dropship purchase order for fulfillment. Use the order’s exact prices and ship speed. Does not reject, backorder, or ship items. Returns transaction state and item results, not a completion guarantee; item arrays may contain only the first 10 entries.',
	inputSchema: wayfairAcceptDropshipOrderInputSchema,
	outputSchema: wayfairTransactionStatusSchema,
	sideEffect: 'write',
	runtime: 'both',
	idempotent: false,
	requiresConfirmation: true,
	network: true,
	supportsCancel: true,
	tags: ['orders', 'fulfillment'],
	execute: async (input, ctx) => WayfairClient.fromContext(ctx).acceptDropshipOrder(input)
})

export const wayfairSendShipmentNoticeTool = defineTool({
	id: 'wayfair-send-shipment-notice',
	name: 'wayfairSendShipmentNotice',
	description:
		'Send Wayfair a production advance shipment notice for dropship items that have physically shipped. Include valid carrier tracking and small-parcel and/or large-parcel package details. This can trigger customer shipment notifications. Returns transaction state and item results, not a completion guarantee; item arrays may contain only the first 10 entries.',
	inputSchema: wayfairSendShipmentNoticeInputSchema,
	outputSchema: wayfairTransactionStatusSchema,
	sideEffect: 'send',
	runtime: 'both',
	idempotent: false,
	requiresConfirmation: true,
	network: true,
	supportsCancel: true,
	tags: ['orders', 'shipping', 'fulfillment'],
	execute: async (input, ctx) => WayfairClient.fromContext(ctx).sendShipmentNotice(input)
})

export const wayfairModule = defineModule({
	id: 'wayfair',
	title: 'Wayfair Supplier',
	description:
		'Wayfair Supplier production catalog and dropship orders, including order details, acceptance, and shipment notices.',
	runtime: 'both',
	auth: { type: 'custom', schema: wayfairAuthSchema },
	categories: ['commerce', 'marketplace'],
	classification: 'pii',
	tags: ['catalog', 'orders', 'sales', 'wayfair'],
	tools: [
		wayfairListCatalogTool,
		wayfairListDropshipOrdersTool,
		wayfairGetDropshipOrderTool,
		wayfairAcceptDropshipOrderTool,
		wayfairSendShipmentNoticeTool
	]
})
