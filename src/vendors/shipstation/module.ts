import { z } from 'zod'

import { defineModule, defineTool } from '../../core/define'
import { ShipstationClient } from './client'
import {
	shipstationAuthSchema,
	shipstationCarrierIdInputSchema,
	shipstationGetCarrierOutputSchema,
	shipstationListCarrierOptionsOutputSchema,
	shipstationListCarrierPackagesOutputSchema,
	shipstationListCarriersOutputSchema,
	shipstationListCarrierServicesOutputSchema,
	shipstationListFulfillmentsPageInputSchema,
	shipstationListFulfillmentsPageOutputSchema,
	shipstationListLabelsPageInputSchema,
	shipstationListLabelsPageOutputSchema,
	shipstationListOrdersPageInputSchema,
	shipstationListOrdersPageOutputSchema,
	shipstationListShipmentsPageInputSchema,
	shipstationListShipmentsPageOutputSchema,
	shipstationListStoresInputSchema,
	shipstationListStoresOutputSchema
} from './contracts'

const emptyInputSchema = z.strictObject({}).describe('No input fields')

export const shipstationListLabelsTool = defineTool({
	id: 'shipstation-list-labels',
	name: 'shipstationListLabels',
	description:
		'List one V2 page of ShipStation labels, including shipping and insurance cost, carrier, service, tracking, void, and refund data.',
	inputSchema: shipstationListLabelsPageInputSchema,
	outputSchema: shipstationListLabelsPageOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	idempotent: true,
	network: true,
	supportsCancel: true,
	tags: ['labels', 'shipping', 'tracking', 'costs', 'fulfillment'],
	execute: async (input, ctx) => ShipstationClient.fromContext(ctx).listLabelsPage(input)
})

export const shipstationListShipmentsTool = defineTool({
	id: 'shipstation-list-shipments',
	name: 'shipstationListShipments',
	description:
		'List one V2 page of ShipStation shipments. Filter by time, status, order, store, recipient, item, batch, pickup, or shipment identifiers.',
	inputSchema: shipstationListShipmentsPageInputSchema,
	outputSchema: shipstationListShipmentsPageOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	idempotent: true,
	network: true,
	supportsCancel: true,
	tags: ['shipments', 'shipping', 'orders', 'fulfillment'],
	execute: async (input, ctx) => ShipstationClient.fromContext(ctx).listShipmentsPage(input)
})

export const shipstationListFulfillmentsTool = defineTool({
	id: 'shipstation-list-fulfillments',
	name: 'shipstationListFulfillments',
	description:
		'List one V2 page of completed ShipStation fulfillments with shipment, provider, tracking, creation, and ship-date filters.',
	inputSchema: shipstationListFulfillmentsPageInputSchema,
	outputSchema: shipstationListFulfillmentsPageOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	idempotent: true,
	network: true,
	supportsCancel: true,
	tags: ['fulfillments', 'shipments', 'tracking'],
	execute: async (input, ctx) => ShipstationClient.fromContext(ctx).listFulfillmentsPage(input)
})

export const shipstationListCarriersTool = defineTool({
	id: 'shipstation-list-carriers',
	name: 'shipstationListCarriers',
	description: 'List connected V2 ShipStation carrier accounts and their available shipping capabilities.',
	inputSchema: emptyInputSchema,
	outputSchema: shipstationListCarriersOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	idempotent: true,
	network: true,
	supportsCancel: true,
	tags: ['carriers', 'shipping'],
	execute: async (_input, ctx) => ShipstationClient.fromContext(ctx).listCarriers()
})

export const shipstationGetCarrierTool = defineTool({
	id: 'shipstation-get-carrier',
	name: 'shipstationGetCarrier',
	description: 'Get one connected V2 ShipStation carrier account and its capabilities.',
	inputSchema: shipstationCarrierIdInputSchema,
	outputSchema: shipstationGetCarrierOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	idempotent: true,
	network: true,
	supportsCancel: true,
	tags: ['carriers', 'shipping'],
	execute: async (input, ctx) => ShipstationClient.fromContext(ctx).getCarrier(input)
})

export const shipstationListCarrierServicesTool = defineTool({
	id: 'shipstation-list-carrier-services',
	name: 'shipstationListCarrierServices',
	description: 'List shipping services available through one V2 ShipStation carrier account.',
	inputSchema: shipstationCarrierIdInputSchema,
	outputSchema: shipstationListCarrierServicesOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	idempotent: true,
	network: true,
	supportsCancel: true,
	tags: ['carriers', 'services', 'shipping'],
	execute: async (input, ctx) => ShipstationClient.fromContext(ctx).listCarrierServices(input)
})

export const shipstationListCarrierPackagesTool = defineTool({
	id: 'shipstation-list-carrier-packages',
	name: 'shipstationListCarrierPackages',
	description: 'List package types available through one V2 ShipStation carrier account.',
	inputSchema: shipstationCarrierIdInputSchema,
	outputSchema: shipstationListCarrierPackagesOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	idempotent: true,
	network: true,
	supportsCancel: true,
	tags: ['carriers', 'packages', 'shipping'],
	execute: async (input, ctx) => ShipstationClient.fromContext(ctx).listCarrierPackages(input)
})

export const shipstationListCarrierOptionsTool = defineTool({
	id: 'shipstation-list-carrier-options',
	name: 'shipstationListCarrierOptions',
	description: 'List advanced options available through one V2 ShipStation carrier account.',
	inputSchema: shipstationCarrierIdInputSchema,
	outputSchema: shipstationListCarrierOptionsOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	idempotent: true,
	network: true,
	supportsCancel: true,
	tags: ['carriers', 'options', 'shipping'],
	execute: async (input, ctx) => ShipstationClient.fromContext(ctx).listCarrierOptions(input)
})

export const shipstationListOrdersTool = defineTool({
	id: 'shipstation-list-orders',
	name: 'shipstationListOrders',
	description:
		'List one legacy V1 page of ShipStation sales orders. Filter by creation, modification, order, or payment time plus customer, item, number, status, or store.',
	inputSchema: shipstationListOrdersPageInputSchema,
	outputSchema: shipstationListOrdersPageOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	idempotent: true,
	network: true,
	supportsCancel: true,
	tags: ['orders', 'sales', 'stores'],
	execute: async (input, ctx) => ShipstationClient.fromContext(ctx).listOrdersPage(input)
})

export const shipstationListStoresTool = defineTool({
	id: 'shipstation-list-stores',
	name: 'shipstationListStores',
	description: 'List installed legacy V1 ShipStation stores, optionally including inactive stores or one marketplace.',
	inputSchema: shipstationListStoresInputSchema,
	outputSchema: shipstationListStoresOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	idempotent: true,
	network: true,
	supportsCancel: true,
	tags: ['stores', 'orders', 'marketplaces'],
	execute: async (input, ctx) => ShipstationClient.fromContext(ctx).listStores(input)
})

export const shipstationModule = defineModule({
	id: 'shipstation',
	title: 'ShipStation',
	description: 'Hybrid ShipStation pack: V2 shipping operations plus legacy V1 sales orders and stores.',
	runtime: 'both',
	auth: { type: 'custom', schema: shipstationAuthSchema },
	categories: ['commerce', 'shipping'],
	classification: 'pii',
	tags: ['labels', 'shipments', 'fulfillments', 'carriers', 'orders', 'stores', 'tracking'],
	tools: [
		shipstationListLabelsTool,
		shipstationListShipmentsTool,
		shipstationListFulfillmentsTool,
		shipstationListCarriersTool,
		shipstationGetCarrierTool,
		shipstationListCarrierServicesTool,
		shipstationListCarrierPackagesTool,
		shipstationListCarrierOptionsTool,
		shipstationListOrdersTool,
		shipstationListStoresTool
	]
})
