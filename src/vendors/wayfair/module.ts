import { defineModule, defineTool } from '../../core/define'
import { WayfairClient } from './client'
import {
	wayfairListCatalogItemsInputSchema,
	wayfairListBrandAssociationsInputSchema,
	wayfairGetMediaMetadataTagsInputSchema,
	wayfairListTaxonomyCategoriesInputSchema,
	wayfairGetTaxonomyAttributesInputSchema,
	wayfairGetCatalogUpdateStatusInputSchema,
	wayfairUpdateCatalogItemMediaInputSchema,
	wayfairUpdateCatalogItemsInputSchema,
	wayfairUpdateCatalogItemGroupsInputSchema,
	wayfairListCatalogItemsOutputSchema,
	wayfairListBrandAssociationsOutputSchema,
	wayfairGetMediaMetadataTagsOutputSchema,
	wayfairListTaxonomyCategoriesOutputSchema,
	wayfairGetTaxonomyAttributesOutputSchema,
	wayfairGetCatalogUpdateStatusOutputSchema,
	wayfairCatalogUpdateRequestSchema,
	wayfairCreateFulfillmentOrderInputSchema,
	wayfairCreateFulfillmentOrderOutputSchema,
	wayfairGetFulfillmentOrderInputSchema,
	wayfairFulfillmentOrderDetailsSchema,
	wayfairCancelFulfillmentOrderInputSchema,
	wayfairCancelFulfillmentOrderOutputSchema,
	wayfairListFulfillmentOrdersInputSchema,
	wayfairListFulfillmentOrdersOutputSchema,
	wayfairListFulfillmentShippingAdvicesInputSchema,
	wayfairListFulfillmentShippingAdvicesOutputSchema,
	wayfairListInboundOrdersInputSchema,
	wayfairListInboundOrdersOutputSchema,
	wayfairGenerateAdvertisingReportInputSchema,
	wayfairGenerateAdvertisingReportOutputSchema,
	wayfairGetAdvertisingReportInputSchema,
	wayfairAdvertisingReportStatusSchema,
	wayfairUpdateAdvertisingCampaignInputSchema,
	wayfairUpdateAdvertisingCampaignOutputSchema,
	wayfairAcceptDropshipOrderInputSchema,
	wayfairAuthSchema,
	wayfairSaveInventoryInputSchema,
	wayfairRegisterShipmentInputSchema,
	wayfairLabelGenerationEventSchema,
	wayfairListLabelGenerationEventsInputSchema,
	wayfairListLabelGenerationEventsOutputSchema,
	wayfairStoreDocumentInputSchema,
	wayfairDocumentOutputSchema,
	wayfairGetConsolidatedBolInputSchema,
	wayfairConsolidatedBolSchema,
	wayfairListCastleGateOrdersInputSchema,
	wayfairListCastleGateOrdersOutputSchema,
	wayfairListCastleGateShippingAdvicesInputSchema,
	wayfairListCastleGateShippingAdvicesOutputSchema,
	wayfairAcknowledgeCastleGateOrderInputSchema,
	wayfairAcknowledgeCastleGateShippingAdvicesInputSchema,
	wayfairConfirmCancellationRequestsInputSchema,
	wayfairDropshipOrderDetailsSchema,
	wayfairGetDropshipOrderInputSchema,
	wayfairListCatalogPageInputSchema,
	wayfairListCatalogPageOutputSchema,
	wayfairListDropshipOrdersInputSchema,
	wayfairListDropshipOrdersOutputSchema,
	wayfairListInventoryAdjustmentsInputSchema,
	wayfairListInventoryAdjustmentsOutputSchema,
	wayfairListInventorySummaryInputSchema,
	wayfairListInventorySummaryOutputSchema,
	wayfairListCancellationRequestsByOrdersInputSchema,
	wayfairListCancellationRequestsByWarehousesInputSchema,
	wayfairListCancellationRequestsOutputSchema,
	wayfairRejectCancellationRequestsInputSchema,
	wayfairRespondCancellationRequestsOutputSchema,
	wayfairSendShipmentNoticeInputSchema,
	wayfairTransactionStatusSchema
} from './contracts'

export const wayfairListCatalogTool = defineTool({
	id: 'wayfair-list-catalog',
	name: 'wayfairListCatalog',
	description: 'List one Wayfair Supplier catalog page with product, supplier part, and SKU details.',
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
		'List Wayfair Supplier dropship purchase orders by date, response state, or purchase order number without selecting customer PII.',
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
		'Get one exact Wayfair dropship purchase order with prices, shipping service, and customer shipping/billing details for fulfillment. Does not accept or acknowledge the order. Use the order list when customer details are unnecessary.',
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
		'Accept line items on a Wayfair dropship purchase order for fulfillment. Use the order’s exact prices and ship speed. Does not reject, backorder, or ship items. Returns transaction state and item results, not a completion guarantee; item arrays may contain only the first 10 entries.',
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
		'Send Wayfair an advance shipment notice for dropship items that have physically shipped. Include valid carrier tracking and small-parcel and/or large-parcel package details. This can trigger customer shipment notifications. Returns transaction state and item results, not a completion guarantee; item arrays may contain only the first 10 entries.',
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

export const wayfairListCancellationRequestsByOrdersTool = defineTool({
	id: 'wayfair-list-cancellation-requests-by-orders',
	name: 'wayfairListCancellationRequestsByOrders',
	description:
		'Read Wayfair line-item cancellation requests for one to 50 purchase order numbers. Returns request IDs, status, reason, warehouse, and quantities. Does not confirm or reject requests. No cursor is provided.',
	inputSchema: wayfairListCancellationRequestsByOrdersInputSchema,
	outputSchema: wayfairListCancellationRequestsOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	idempotent: true,
	network: true,
	supportsCancel: true,
	tags: ['orders', 'cancellations'],
	execute: async (input, ctx) => WayfairClient.fromContext(ctx).listCancellationRequestsByOrders(input)
})

export const wayfairListCancellationRequestsByWarehousesTool = defineTool({
	id: 'wayfair-list-cancellation-requests-by-warehouses',
	name: 'wayfairListCancellationRequestsByWarehouses',
	description:
		'Read Wayfair line-item cancellation requests for one to 50 warehouses, filtered by pending or cancelled status and optional date range. Does not confirm or reject requests. No cursor is provided.',
	inputSchema: wayfairListCancellationRequestsByWarehousesInputSchema,
	outputSchema: wayfairListCancellationRequestsOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	idempotent: true,
	network: true,
	supportsCancel: true,
	tags: ['orders', 'cancellations'],
	execute: async (input, ctx) => WayfairClient.fromContext(ctx).listCancellationRequestsByWarehouses(input)
})

export const wayfairConfirmCancellationRequestsTool = defineTool({
	id: 'wayfair-confirm-cancellation-requests',
	name: 'wayfairConfirmCancellationRequests',
	description:
		'Confirm one to 100 pending Wayfair line-item cancellation requests. This accepts the requested cancellations, not the purchase orders. Returns per-request SUCCESS or FAILURE; inspect each result. Already processed requests cannot be confirmed again.',
	inputSchema: wayfairConfirmCancellationRequestsInputSchema,
	outputSchema: wayfairRespondCancellationRequestsOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	idempotent: false,
	requiresConfirmation: true,
	network: true,
	supportsCancel: true,
	tags: ['orders', 'cancellations'],
	execute: async (input, ctx) => WayfairClient.fromContext(ctx).confirmCancellationRequests(input)
})

export const wayfairRejectCancellationRequestsTool = defineTool({
	id: 'wayfair-reject-cancellation-requests',
	name: 'wayfairRejectCancellationRequests',
	description:
		'Reject one to 100 pending Wayfair line-item cancellation requests, each with a reason up to 500 characters. This refuses the cancellation, not the original order. Returns per-request SUCCESS or FAILURE; inspect each result. Already processed requests cannot be rejected again.',
	inputSchema: wayfairRejectCancellationRequestsInputSchema,
	outputSchema: wayfairRespondCancellationRequestsOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	idempotent: false,
	requiresConfirmation: true,
	network: true,
	supportsCancel: true,
	tags: ['orders', 'cancellations'],
	execute: async (input, ctx) => WayfairClient.fromContext(ctx).rejectCancellationRequests(input)
})

export const wayfairListInventorySummaryTool = defineTool({
	id: 'wayfair-list-inventory-summary',
	name: 'wayfairListInventorySummary',
	description:
		'Read one page of Wayfair CastleGate and physical-retail inventory positions, including on-hand, allocated, fulfillable, and unavailable quantities by warehouse. Filter by up to 100 part numbers; page size is 1–100. Continue with end_cursor only when has_next_page is true. Does not update inventory.',
	inputSchema: wayfairListInventorySummaryInputSchema,
	outputSchema: wayfairListInventorySummaryOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	idempotent: true,
	network: true,
	supportsCancel: true,
	tags: ['inventory', 'warehouses'],
	execute: async (input, ctx) => WayfairClient.fromContext(ctx).listInventorySummary(input)
})

export const wayfairListInventoryAdjustmentsTool = defineTool({
	id: 'wayfair-list-inventory-adjustments',
	name: 'wayfairListInventoryAdjustments',
	description:
		'Read one zero-based page of Wayfair CastleGate inventory adjustment events with signed quantities, reasons, and warehouse details. Positive quantities are adjustments in; negative quantities are adjustments out. Supports part/date filters and event-date sorting, with 1–100 results per page. Data starts June 1, 2023. Does not create adjustments.',
	inputSchema: wayfairListInventoryAdjustmentsInputSchema,
	outputSchema: wayfairListInventoryAdjustmentsOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	idempotent: true,
	network: true,
	supportsCancel: true,
	tags: ['inventory', 'warehouses'],
	execute: async (input, ctx) => WayfairClient.fromContext(ctx).listInventoryAdjustments(input)
})

export const wayfairSaveInventoryTool = defineTool({
	id: 'wayfair-save-inventory',
	name: 'wayfairSaveInventory',
	description:
		'Submit a Wayfair dropship inventory feed or explicitly validate it with dry_run. Choose differential or complete true-up semantics. Returns transaction state and item errors, not a completion guarantee. Sandbox requires TRUE_UP and at most 500 lines.',
	inputSchema: wayfairSaveInventoryInputSchema,
	outputSchema: wayfairTransactionStatusSchema,
	sideEffect: 'write',
	runtime: 'both',
	idempotent: false,
	requiresConfirmation: true,
	network: true,
	supportsCancel: true,
	execute: async (input, ctx) => WayfairClient.fromContext(ctx).saveInventory(input)
})
export const wayfairRegisterShipmentTool = defineTool({
	id: 'wayfair-register-shipment',
	name: 'wayfairRegisterShipment',
	description:
		'Register a Wayfair purchase order for shipment and label generation. Optionally specify pickup date, warehouse, and packing details. Omitted packing details use catalog data. This is an explicit shipment registration, not an ASN or a read.',
	inputSchema: wayfairRegisterShipmentInputSchema,
	outputSchema: wayfairLabelGenerationEventSchema,
	sideEffect: 'write',
	runtime: 'both',
	idempotent: false,
	requiresConfirmation: true,
	network: true,
	supportsCancel: true,
	execute: async (input, ctx) => WayfairClient.fromContext(ctx).registerShipment(input)
})
export const wayfairListLabelGenerationEventsTool = defineTool({
	id: 'wayfair-list-label-generation-events',
	name: 'wayfairListLabelGenerationEvents',
	description:
		'Read previously registered Wayfair shipment events, label/tracking information, and document references. Supports filters and offset pagination. Does not register shipments. A full page may require another offset query.',
	inputSchema: wayfairListLabelGenerationEventsInputSchema,
	outputSchema: wayfairListLabelGenerationEventsOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	idempotent: true,
	network: true,
	supportsCancel: true,
	execute: async (input, ctx) => WayfairClient.fromContext(ctx).listLabelGenerationEvents(input)
})
export const wayfairDownloadBillOfLadingTool = defineTool({
	id: 'wayfair-download-bill-of-lading',
	name: 'wayfairDownloadBillOfLading',
	description:
		'Retrieve a registered Wayfair order’s bill of lading into an artifact. Intended for eligible North American large-parcel orders. Does not register or ship the order.',
	inputSchema: wayfairStoreDocumentInputSchema,
	outputSchema: wayfairDocumentOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	idempotent: false,
	network: true,
	supportsCancel: true,
	execute: async (input, ctx) => WayfairClient.fromContext(ctx).downloadBillOfLading(input)
})
export const wayfairDownloadPackingSlipTool = defineTool({
	id: 'wayfair-download-packing-slip',
	name: 'wayfairDownloadPackingSlip',
	description:
		'Retrieve a Wayfair purchase order’s packing slip into an artifact within the requested byte limit. Does not accept, register, or ship the order.',
	inputSchema: wayfairStoreDocumentInputSchema,
	outputSchema: wayfairDocumentOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	idempotent: false,
	network: true,
	supportsCancel: true,
	execute: async (input, ctx) => WayfairClient.fromContext(ctx).downloadPackingSlip(input)
})
export const wayfairDownloadShippingLabelTool = defineTool({
	id: 'wayfair-download-shipping-label',
	name: 'wayfairDownloadShippingLabel',
	description:
		'Retrieve all shipping labels for a registered Wayfair order into an artifact. Does not register an unregistered order or send a shipment notice.',
	inputSchema: wayfairStoreDocumentInputSchema,
	outputSchema: wayfairDocumentOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	idempotent: false,
	network: true,
	supportsCancel: true,
	execute: async (input, ctx) => WayfairClient.fromContext(ctx).downloadShippingLabel(input)
})
export const wayfairGetConsolidatedBolTool = defineTool({
	id: 'wayfair-get-consolidated-bol',
	name: 'wayfairGetConsolidatedBol',
	description:
		'Get availability, document reference, expiration, and shipment references for an eligible supplier’s consolidated bill of lading on a shipment date. NOT_FOUND means no available document. The returned link is temporary, not a durable artifact.',
	inputSchema: wayfairGetConsolidatedBolInputSchema,
	outputSchema: wayfairConsolidatedBolSchema,
	sideEffect: 'read',
	runtime: 'both',
	idempotent: true,
	network: true,
	supportsCancel: true,
	execute: async (input, ctx) => WayfairClient.fromContext(ctx).getConsolidatedBol(input)
})
export const wayfairListCastleGateOrdersTool = defineTool({
	id: 'wayfair-list-castlegate-orders',
	name: 'wayfairListCastleGateOrders',
	description:
		'Read CastleGate purchase orders with fulfillment addresses, quantities, and prices. Filter by acknowledgment, date, or PO number. Does not acknowledge receipt. A full bounded result may require a narrower date or PO filter.',
	inputSchema: wayfairListCastleGateOrdersInputSchema,
	outputSchema: wayfairListCastleGateOrdersOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	idempotent: true,
	network: true,
	supportsCancel: true,
	execute: async (input, ctx) => WayfairClient.fromContext(ctx).listCastleGateOrders(input)
})
export const wayfairListCastleGateShippingAdvicesTool = defineTool({
	id: 'wayfair-list-castlegate-shipping-advices',
	name: 'wayfairListCastleGateShippingAdvices',
	description:
		'Read CastleGate warehouse shipping advices with tracking, quantities, and addresses. Filter by acknowledgment, date, or advice IDs. Does not acknowledge receipt. No cursor is provided.',
	inputSchema: wayfairListCastleGateShippingAdvicesInputSchema,
	outputSchema: wayfairListCastleGateShippingAdvicesOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	idempotent: true,
	network: true,
	supportsCancel: true,
	execute: async (input, ctx) => WayfairClient.fromContext(ctx).listCastleGateShippingAdvices(input)
})
export const wayfairAcknowledgeCastleGateOrderTool = defineTool({
	id: 'wayfair-acknowledge-castlegate-order',
	name: 'wayfairAcknowledgeCastleGateOrder',
	description:
		'Explicitly acknowledge receipt of one CastleGate purchase order. This is not dropship acceptance or shipment confirmation. Returns transaction status and item results; inspect them before assuming completion.',
	inputSchema: wayfairAcknowledgeCastleGateOrderInputSchema,
	outputSchema: wayfairTransactionStatusSchema,
	sideEffect: 'write',
	runtime: 'both',
	idempotent: false,
	requiresConfirmation: true,
	network: true,
	supportsCancel: true,
	execute: async (input, ctx) => WayfairClient.fromContext(ctx).acknowledgeCastleGateOrder(input)
})
export const wayfairAcknowledgeCastleGateShippingAdvicesTool = defineTool({
	id: 'wayfair-acknowledge-castlegate-shipping-advices',
	name: 'wayfairAcknowledgeCastleGateShippingAdvices',
	description:
		'Explicitly acknowledge receipt of CastleGate warehouse shipping advices by their WSA IDs. Does not create shipments. Returns transaction status and per-item results, not an optimistic completion claim.',
	inputSchema: wayfairAcknowledgeCastleGateShippingAdvicesInputSchema,
	outputSchema: wayfairTransactionStatusSchema,
	sideEffect: 'write',
	runtime: 'both',
	idempotent: false,
	requiresConfirmation: true,
	network: true,
	supportsCancel: true,
	execute: async (input, ctx) => WayfairClient.fromContext(ctx).acknowledgeCastleGateShippingAdvices(input)
})

export const wayfairGetFulfillmentOrderTool = defineTool({
	id: 'wayfair-get-fulfillment-order',
	name: 'wayfairGetFulfillmentOrder',
	description:
		'Read one CastleGate multichannel fulfillment order by request ID, including status, item errors and delivery details. Does not create, cancel, or acknowledge the order.',
	inputSchema: wayfairGetFulfillmentOrderInputSchema,
	outputSchema: wayfairFulfillmentOrderDetailsSchema,
	sideEffect: 'read',
	runtime: 'both',
	idempotent: true,
	network: true,
	supportsCancel: true,
	execute: async (input, ctx) => WayfairClient.fromContext(ctx).getFulfillmentOrder(input)
})
export const wayfairListFulfillmentOrdersTool = defineTool({
	id: 'wayfair-list-fulfillment-orders',
	name: 'wayfairListFulfillmentOrders',
	description:
		'Read one page of CastleGate multichannel fulfillment orders, including item states, errors and shipping addresses. Supports date, retailer and status filters, with 1–100 results per page. Does not acknowledge receipt.',
	inputSchema: wayfairListFulfillmentOrdersInputSchema,
	outputSchema: wayfairListFulfillmentOrdersOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	idempotent: true,
	network: true,
	supportsCancel: true,
	execute: async (input, ctx) => WayfairClient.fromContext(ctx).listFulfillmentOrders(input)
})
export const wayfairListFulfillmentShippingAdvicesTool = defineTool({
	id: 'wayfair-list-fulfillment-shipping-advices',
	name: 'wayfairListFulfillmentShippingAdvices',
	description:
		'Read CastleGate multichannel shipping advices with shipment tracking and addresses. Supports item/date filters and one-based pages of 1–100 results. Does not acknowledge or create shipments.',
	inputSchema: wayfairListFulfillmentShippingAdvicesInputSchema,
	outputSchema: wayfairListFulfillmentShippingAdvicesOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	idempotent: true,
	network: true,
	supportsCancel: true,
	execute: async (input, ctx) => WayfairClient.fromContext(ctx).listFulfillmentShippingAdvices(input)
})
export const wayfairCreateFulfillmentOrderTool = defineTool({
	id: 'wayfair-create-fulfillment-order',
	name: 'wayfairCreateFulfillmentOrder',
	description:
		'Create a CastleGate multichannel fulfillment order that can allocate inventory and ship to a customer. Prefer a unique seller_fulfillment_order_id. ACCEPTED means queued for processing, not shipped; inspect request errors and subsequently read order status.',
	inputSchema: wayfairCreateFulfillmentOrderInputSchema,
	outputSchema: wayfairCreateFulfillmentOrderOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	idempotent: false,
	requiresConfirmation: true,
	network: true,
	supportsCancel: true,
	execute: async (input, ctx) => WayfairClient.fromContext(ctx).createFulfillmentOrder(input)
})
export const wayfairCancelFulfillmentOrderTool = defineTool({
	id: 'wayfair-cancel-fulfillment-order',
	name: 'wayfairCancelFulfillmentOrder',
	description:
		'Request cancellation of a CastleGate multichannel fulfillment order. Shipped or otherwise ineligible items may fail. Inspect each item’s SUCCESS or FAILURE and order errors; do not assume the entire order was cancelled.',
	inputSchema: wayfairCancelFulfillmentOrderInputSchema,
	outputSchema: wayfairCancelFulfillmentOrderOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	idempotent: false,
	requiresConfirmation: true,
	network: true,
	supportsCancel: true,
	execute: async (input, ctx) => WayfairClient.fromContext(ctx).cancelFulfillmentOrder(input)
})
export const wayfairListInboundOrdersTool = defineTool({
	id: 'wayfair-list-inbound-orders',
	name: 'wayfairListInboundOrders',
	description:
		'Read CastleGate Forwarding inbound orders and container milestone timelines by status, identifiers, service and date filters. Uses native limit/offset pagination without totals or a cursor. A full result may need another page; this does not book or modify freight.',
	inputSchema: wayfairListInboundOrdersInputSchema,
	outputSchema: wayfairListInboundOrdersOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	idempotent: true,
	network: true,
	supportsCancel: true,
	execute: async (input, ctx) => WayfairClient.fromContext(ctx).listInboundOrders(input)
})
export const wayfairGenerateAdvertisingReportTool = defineTool({
	id: 'wayfair-generate-advertising-report',
	name: 'wayfairGenerateAdvertisingReport',
	description:
		'Start a Wayfair campaign or listing performance report in CSV or Excel format. Returns a report ID, not a finished report. Read report status separately.',
	inputSchema: wayfairGenerateAdvertisingReportInputSchema,
	outputSchema: wayfairGenerateAdvertisingReportOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	idempotent: false,
	requiresConfirmation: true,
	network: true,
	supportsCancel: true,
	execute: async (input, ctx) => WayfairClient.fromContext(ctx).generateAdvertisingReport(input)
})
export const wayfairGetAdvertisingReportTool = defineTool({
	id: 'wayfair-get-advertising-report',
	name: 'wayfairGetAdvertisingReport',
	description:
		'Read a Wayfair advertising report’s processing status and temporary download reference when ready. Does not start a new report or download the file. The reference is not a durable artifact.',
	inputSchema: wayfairGetAdvertisingReportInputSchema,
	outputSchema: wayfairAdvertisingReportStatusSchema,
	sideEffect: 'read',
	runtime: 'both',
	idempotent: true,
	network: true,
	supportsCancel: true,
	execute: async (input, ctx) => WayfairClient.fromContext(ctx).getAdvertisingReport(input)
})
export const wayfairUpdateAdvertisingCampaignTool = defineTool({
	id: 'wayfair-update-advertising-campaign',
	name: 'wayfairUpdateAdvertisingCampaign',
	description:
		'Change Sponsored Product campaign listing bids or ADD/PAUSE/ACTIVATE/ARCHIVE state. This can change advertising spend. Manual/fixed bidding requires a bid for ADD or legacy updates; TARGET_ROAS rejects supplied bids. Inspect per-listing outcomes.',
	inputSchema: wayfairUpdateAdvertisingCampaignInputSchema,
	outputSchema: wayfairUpdateAdvertisingCampaignOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	idempotent: false,
	requiresConfirmation: true,
	network: true,
	supportsCancel: true,
	execute: async (input, ctx) => WayfairClient.fromContext(ctx).updateAdvertisingCampaign(input)
})

export const wayfairListCatalogItemsTool = defineTool({
	id: 'wayfair-list-catalog-items',
	name: 'wayfairListCatalogItems',
	description:
		'Read one Wayfair catalog item page with supplier, status, classification and listing IDs plus one sales-channel level. Page size is 1–30. Excludes rich attribute values and insights; does not change products.',
	inputSchema: wayfairListCatalogItemsInputSchema,
	outputSchema: wayfairListCatalogItemsOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	idempotent: true,
	network: true,
	supportsCancel: true,
	execute: async (input, ctx) => WayfairClient.fromContext(ctx).listCatalogItems(input)
})

export const wayfairListBrandAssociationsTool = defineTool({
	id: 'wayfair-list-brand-associations',
	name: 'wayfairListBrandAssociations',
	description:
		'Read supplier brand and manufacturer associations in a market. Supply a native page size and inspect pageInfo for more results; nullable brand entries are preserved.',
	inputSchema: wayfairListBrandAssociationsInputSchema,
	outputSchema: wayfairListBrandAssociationsOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	idempotent: true,
	network: true,
	supportsCancel: true,
	execute: async (input, ctx) => WayfairClient.fromContext(ctx).listBrandAssociations(input)
})

export const wayfairGetMediaMetadataTagsTool = defineTool({
	id: 'wayfair-get-media-metadata-tags',
	name: 'wayfairGetMediaMetadataTags',
	description:
		'Read Wayfair document, legal-document, language or region media metadata tags for a market. Returns available tag IDs and names without uploading media.',
	inputSchema: wayfairGetMediaMetadataTagsInputSchema,
	outputSchema: wayfairGetMediaMetadataTagsOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	idempotent: true,
	network: true,
	supportsCancel: true,
	execute: async (input, ctx) => WayfairClient.fromContext(ctx).getMediaMetadataTags(input)
})

export const wayfairListTaxonomyCategoriesTool = defineTool({
	id: 'wayfair-list-taxonomy-categories',
	name: 'wayfairListTaxonomyCategories',
	description:
		'Read one page of Wayfair taxonomy categories for a market. Optional page sizes are 10, 20, 25 or 50. Does not modify catalog items.',
	inputSchema: wayfairListTaxonomyCategoriesInputSchema,
	outputSchema: wayfairListTaxonomyCategoriesOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	idempotent: true,
	network: true,
	supportsCancel: true,
	execute: async (input, ctx) => WayfairClient.fromContext(ctx).listTaxonomyCategories(input)
})

export const wayfairGetTaxonomyAttributesTool = defineTool({
	id: 'wayfair-get-taxonomy-attributes',
	name: 'wayfairGetTaxonomyAttributes',
	description:
		'Read Wayfair Product Update taxonomy requirements, value formats, possible values, one child level, related attribute IDs and conditionality rules. Uses taxonomy_category_id, not the incompatible Product Addition class ID contract.',
	inputSchema: wayfairGetTaxonomyAttributesInputSchema,
	outputSchema: wayfairGetTaxonomyAttributesOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	idempotent: true,
	network: true,
	supportsCancel: true,
	execute: async (input, ctx) => WayfairClient.fromContext(ctx).getTaxonomyAttributes(input)
})

export const wayfairGetCatalogUpdateStatusTool = defineTool({
	id: 'wayfair-get-catalog-update-status',
	name: 'wayfairGetCatalogUpdateStatus',
	description:
		'Read processing status for a Wayfair catalog update request. COMPLETED can include partial failures: inspect problems and successfulUpdates. validationOnly means no changes were applied.',
	inputSchema: wayfairGetCatalogUpdateStatusInputSchema,
	outputSchema: wayfairGetCatalogUpdateStatusOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	idempotent: true,
	network: true,
	supportsCancel: true,
	execute: async (input, ctx) => WayfairClient.fromContext(ctx).getCatalogUpdateStatus(input)
})

export const wayfairUpdateCatalogItemMediaTool = defineTool({
	id: 'wayfair-update-catalog-item-media',
	name: 'wayfairUpdateCatalogItemMedia',
	description:
		'Upload or delete Wayfair catalog media associations. UPLOAD requires a public media URL; DELETE requires an asset ID. Explicit validate_only controls whether changes apply. Returns a request ID, not success; read catalog update status separately.',
	inputSchema: wayfairUpdateCatalogItemMediaInputSchema,
	outputSchema: wayfairCatalogUpdateRequestSchema,
	sideEffect: 'write',
	runtime: 'both',
	idempotent: false,
	requiresConfirmation: true,
	network: true,
	supportsCancel: true,
	execute: async (input, ctx) => WayfairClient.fromContext(ctx).updateCatalogItemMedia(input)
})

export const wayfairUpdateCatalogItemsTool = defineTool({
	id: 'wayfair-update-catalog-items',
	name: 'wayfairUpdateCatalogItems',
	description:
		'Update Wayfair market-specific item names or taxonomy attributes in the US or UK. Include existing values for every related attribute. Explicit validate_only controls applying changes. Returns a request ID; read update status and inspect partial failures.',
	inputSchema: wayfairUpdateCatalogItemsInputSchema,
	outputSchema: wayfairCatalogUpdateRequestSchema,
	sideEffect: 'write',
	runtime: 'both',
	idempotent: false,
	requiresConfirmation: true,
	network: true,
	supportsCancel: true,
	execute: async (input, ctx) => WayfairClient.fromContext(ctx).updateCatalogItems(input)
})

export const wayfairUpdateCatalogItemGroupsTool = defineTool({
	id: 'wayfair-update-catalog-item-groups',
	name: 'wayfairUpdateCatalogItemGroups',
	description:
		'Update Wayfair market-specific group names, marketing copy, feature bullets or option names in the US or UK. Does not update group media. Explicit validate_only controls applying changes; read returned request status separately.',
	inputSchema: wayfairUpdateCatalogItemGroupsInputSchema,
	outputSchema: wayfairCatalogUpdateRequestSchema,
	sideEffect: 'write',
	runtime: 'both',
	idempotent: false,
	requiresConfirmation: true,
	network: true,
	supportsCancel: true,
	execute: async (input, ctx) => WayfairClient.fromContext(ctx).updateCatalogItemGroups(input)
})

export const wayfairModule = defineModule({
	id: 'wayfair',
	title: 'Wayfair Supplier',
	description:
		'Wayfair Supplier catalog, dropship and CastleGate fulfillment, inventory, shipping documents, and advertising.',
	runtime: 'both',
	auth: { type: 'custom', schema: wayfairAuthSchema },
	categories: ['commerce', 'marketplace'],
	classification: 'pii',
	tags: ['catalog', 'orders', 'sales', 'inventory', 'wayfair'],
	tools: [
		wayfairListCatalogItemsTool,
		wayfairListBrandAssociationsTool,
		wayfairGetMediaMetadataTagsTool,
		wayfairListTaxonomyCategoriesTool,
		wayfairGetTaxonomyAttributesTool,
		wayfairGetCatalogUpdateStatusTool,
		wayfairUpdateCatalogItemMediaTool,
		wayfairUpdateCatalogItemsTool,
		wayfairUpdateCatalogItemGroupsTool,
		wayfairListCatalogTool,
		wayfairListDropshipOrdersTool,
		wayfairGetDropshipOrderTool,
		wayfairAcceptDropshipOrderTool,
		wayfairSendShipmentNoticeTool,
		wayfairListCancellationRequestsByOrdersTool,
		wayfairListCancellationRequestsByWarehousesTool,
		wayfairConfirmCancellationRequestsTool,
		wayfairRejectCancellationRequestsTool,
		wayfairListInventorySummaryTool,
		wayfairListInventoryAdjustmentsTool,
		wayfairSaveInventoryTool,
		wayfairRegisterShipmentTool,
		wayfairListLabelGenerationEventsTool,
		wayfairDownloadBillOfLadingTool,
		wayfairDownloadPackingSlipTool,
		wayfairDownloadShippingLabelTool,
		wayfairGetConsolidatedBolTool,
		wayfairListCastleGateOrdersTool,
		wayfairListCastleGateShippingAdvicesTool,
		wayfairAcknowledgeCastleGateOrderTool,
		wayfairAcknowledgeCastleGateShippingAdvicesTool,
		wayfairGetFulfillmentOrderTool,
		wayfairListFulfillmentOrdersTool,
		wayfairListFulfillmentShippingAdvicesTool,
		wayfairCreateFulfillmentOrderTool,
		wayfairCancelFulfillmentOrderTool,
		wayfairListInboundOrdersTool,
		wayfairGenerateAdvertisingReportTool,
		wayfairGetAdvertisingReportTool,
		wayfairUpdateAdvertisingCampaignTool
	]
})
