import { defineModule, defineTool } from '../../core/define'
import { ShipstationClient } from './client'
import {
	shipstationAuthSchema,
	shipstationListLabelsPageInputSchema,
	shipstationListLabelsPageOutputSchema,
	shipstationListShipmentsPageInputSchema,
	shipstationListShipmentsPageOutputSchema
} from './contracts'

export const shipstationListLabelsTool = defineTool({
	id: 'shipstation-list-labels',
	name: 'shipstationListLabels',
	description:
		'List one page of ShipStation labels. Filter by creation time, status, carrier, service, tracking number, shipment, warehouse, batch, rate, or refund status.',
	inputSchema: shipstationListLabelsPageInputSchema,
	outputSchema: shipstationListLabelsPageOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	idempotent: true,
	network: true,
	supportsCancel: true,
	tags: ['labels', 'shipping', 'tracking', 'fulfillment'],
	execute: async (input, ctx) => ShipstationClient.fromContext(ctx).listLabelsPage(input)
})

export const shipstationListShipmentsTool = defineTool({
	id: 'shipstation-list-shipments',
	name: 'shipstationListShipments',
	description:
		'List one page of ShipStation shipments. Filter by creation, modification, or payment time plus status, order, store, recipient, item, batch, pickup, or shipment identifiers.',
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

export const shipstationModule = defineModule({
	id: 'shipstation',
	title: 'ShipStation',
	description: 'ShipStation V2 vendor pack for paginated label and shipment reads.',
	runtime: 'both',
	auth: { type: 'custom', schema: shipstationAuthSchema },
	categories: ['commerce', 'shipping'],
	classification: 'pii',
	tags: ['labels', 'shipments', 'tracking', 'fulfillment'],
	tools: [shipstationListLabelsTool, shipstationListShipmentsTool]
})
