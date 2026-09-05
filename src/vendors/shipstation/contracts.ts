import { z } from 'zod'

export const shipstationAuthSchema = z.object({
	v2_api_key: z.string().min(1).describe('ShipStation V2 API key'),
	v1_api_key: z.string().min(1).describe('ShipStation V1 API key'),
	v1_api_secret: z.string().min(1).describe('ShipStation V1 API secret')
})

export type ShipstationAuth = z.infer<typeof shipstationAuthSchema>

const shipstationPageSchema = z.int().min(1).optional().describe('Provider page number, starting at 1')
const shipstationPageSizeSchema = z
	.int()
	.min(1)
	.max(500)
	.optional()
	.describe('Records per page, from 1 to 500; defaults to 25')

export const shipstationMoneySchema = z.looseObject({
	currency: z.string().min(1),
	amount: z.number().nonnegative()
})

export const shipstationRefundDetailsRawSchema = z.looseObject({
	refund_status: z.string().nullable().optional(),
	request_date: z.string().nullable().optional(),
	amount_paid: shipstationMoneySchema.nullable().optional(),
	amount_requested: shipstationMoneySchema.nullable().optional()
})

export const shipstationLabelRawSchema = z.looseObject({
	label_id: z.string().min(1),
	shipment_id: z.string().nullable().optional(),
	external_shipment_id: z.string().nullable().optional(),
	external_order_id: z.string().nullable().optional(),
	carrier_id: z.string().nullable().optional(),
	service_code: z.string().nullable().optional(),
	tracking_number: z.string().nullable().optional(),
	created_at: z.string().nullable().optional(),
	modified_at: z.string().nullable().optional(),
	ship_date: z.string().nullable().optional(),
	shipment_cost: shipstationMoneySchema.nullable().optional(),
	insurance_cost: shipstationMoneySchema.nullable().optional(),
	voided: z.boolean().nullable().optional(),
	voided_at: z.string().nullable().optional(),
	refund_details: shipstationRefundDetailsRawSchema.nullable().optional(),
	status: z.string().nullable().optional()
})

export const shipstationShipmentRawSchema = z.looseObject({
	shipment_id: z.string().min(1),
	external_order_id: z.string().nullable().optional(),
	shipment_number: z.string().nullable().optional(),
	carrier_id: z.string().nullable().optional(),
	service_code: z.string().nullable().optional(),
	store_id: z.string().nullable().optional(),
	created_at: z.string().nullable().optional(),
	modified_at: z.string().nullable().optional(),
	shipment_status: z.string().nullable().optional()
})

export const shipstationFulfillmentRawSchema = z.looseObject({
	fulfillment_id: z.string().min(1),
	shipment_id: z.string().nullable().optional(),
	shipment_number: z.string().nullable().optional(),
	tracking_number: z.string().nullable().optional(),
	carrier_code: z.string().nullable().optional(),
	fulfillment_provider_code: z.string().nullable().optional(),
	created_at: z.string().nullable().optional(),
	ship_date: z.string().nullable().optional()
})

export const shipstationCarrierServiceRawSchema = z.looseObject({
	service_code: z.string().min(1),
	name: z.string().nullable().optional(),
	carrier_id: z.string().nullable().optional(),
	carrier_code: z.string().nullable().optional(),
	domestic: z.boolean().nullable().optional(),
	international: z.boolean().nullable().optional()
})

export const shipstationCarrierPackageRawSchema = z.looseObject({
	package_code: z.string().min(1),
	name: z.string().nullable().optional(),
	carrier_id: z.string().nullable().optional(),
	carrier_code: z.string().nullable().optional()
})

export const shipstationCarrierOptionRawSchema = z.looseObject({
	name: z.string().min(1),
	description: z.string().nullable().optional(),
	default_value: z.union([z.string(), z.number(), z.boolean()]).nullable().optional()
})

export const shipstationCarrierRawSchema = z.looseObject({
	carrier_id: z.string().min(1),
	carrier_code: z.string().nullable().optional(),
	account_number: z.string().nullable().optional(),
	nickname: z.string().nullable().optional(),
	friendly_name: z.string().nullable().optional(),
	primary: z.boolean().nullable().optional(),
	connection_status: z.string().nullable().optional(),
	services: z.array(shipstationCarrierServiceRawSchema).optional(),
	packages: z.array(shipstationCarrierPackageRawSchema).optional(),
	options: z.array(shipstationCarrierOptionRawSchema).optional()
})

export const shipstationOrderRawSchema = z.looseObject({
	orderId: z.int(),
	orderNumber: z.string().nullable().optional(),
	orderKey: z.string().nullable().optional(),
	orderStatus: z.string().nullable().optional(),
	createDate: z.string().nullable().optional(),
	modifyDate: z.string().nullable().optional(),
	orderDate: z.string().nullable().optional(),
	paymentDate: z.string().nullable().optional(),
	shipByDate: z.string().nullable().optional(),
	storeId: z.int().nullable().optional()
})

export const shipstationStoreRawSchema = z.looseObject({
	storeId: z.int(),
	storeName: z.string().nullable().optional(),
	marketplaceId: z.int().nullable().optional(),
	marketplaceName: z.string().nullable().optional(),
	active: z.boolean().nullable().optional(),
	createDate: z.string().nullable().optional(),
	modifyDate: z.string().nullable().optional(),
	autoRefresh: z.boolean().nullable().optional()
})

export const shipstationPaginationSchema = z.object({
	total: z.int().nonnegative(),
	page: z.int().min(1),
	pages: z.int().nonnegative(),
	page_size: z.int().min(1).max(500),
	has_more: z.boolean()
})

export const shipstationListLabelsPageInputSchema = z.strictObject({
	page: shipstationPageSchema,
	page_size: shipstationPageSizeSchema,
	label_status: z.string().min(1).optional().describe('Label status filter'),
	service_code: z.string().min(1).optional().describe('Carrier service code filter'),
	carrier_id: z.string().min(1).optional().describe('ShipStation carrier id filter'),
	tracking_number: z.string().min(1).optional().describe('Exact tracking number filter'),
	batch_id: z.string().min(1).optional().describe('ShipStation batch id filter'),
	rate_id: z.string().min(1).optional().describe('ShipStation rate id filter'),
	shipment_id: z.string().min(1).optional().describe('ShipStation shipment id filter'),
	external_shipment_id: z.string().min(1).optional().describe('External shipment id filter'),
	warehouse_id: z.string().min(1).optional().describe('ShipStation warehouse id filter'),
	created_at_start: z.iso
		.datetime({ offset: true })
		.optional()
		.describe('Include labels created at or after this ISO 8601 timestamp'),
	created_at_end: z.iso
		.datetime({ offset: true })
		.optional()
		.describe('Include labels created at or before this ISO 8601 timestamp'),
	refund_status: z.string().min(1).optional().describe('Comma-separated label refund statuses'),
	sort_dir: z.enum(['asc', 'desc']).optional().describe('Provider slice direction; defaults to desc'),
	sort_by: z
		.enum(['modified_at', 'created_at', 'voided_at'])
		.optional()
		.describe('Label field used to sort the provider slice')
})

export const shipstationListLabelsPageOutputSchema = z.object({
	items: z.array(shipstationLabelRawSchema),
	pagination: shipstationPaginationSchema
})

export const shipstationListShipmentsPageInputSchema = z.strictObject({
	page: shipstationPageSchema,
	page_size: shipstationPageSizeSchema,
	shipment_status: z.string().min(1).optional().describe('Shipment status filter'),
	batch_id: z.string().min(1).optional().describe('ShipStation batch id filter'),
	pickup_id: z.string().min(1).optional().describe('ShipStation pickup id filter'),
	created_at_start: z.iso
		.datetime({ offset: true })
		.optional()
		.describe('Include shipments created at or after this ISO 8601 timestamp'),
	created_at_end: z.iso
		.datetime({ offset: true })
		.optional()
		.describe('Include shipments created at or before this ISO 8601 timestamp'),
	modified_at_start: z.iso
		.datetime({ offset: true })
		.optional()
		.describe('Include shipments modified at or after this ISO 8601 timestamp'),
	modified_at_end: z.iso
		.datetime({ offset: true })
		.optional()
		.describe('Include shipments modified at or before this ISO 8601 timestamp'),
	sales_order_id: z.string().min(1).optional().describe('Sales order id filter'),
	shipment_number: z.string().min(1).optional().describe('Shipment number filter'),
	ship_to_name: z.string().min(1).optional().describe('Recipient name filter'),
	item_keyword: z.string().min(1).optional().describe('Shipment item keyword filter'),
	payment_date_start: z.iso
		.datetime({ offset: true })
		.optional()
		.describe('Include shipments paid at or after this ISO 8601 timestamp'),
	payment_date_end: z.iso
		.datetime({ offset: true })
		.optional()
		.describe('Include shipments paid at or before this ISO 8601 timestamp'),
	store_id: z.string().min(1).optional().describe('ShipStation store id filter'),
	external_shipment_id: z.string().min(1).optional().describe('External shipment id filter'),
	sort_dir: z.enum(['asc', 'desc']).optional().describe('Provider slice direction; defaults to desc'),
	sort_by: z.enum(['modified_at', 'created_at']).optional().describe('Shipment field used to sort the provider slice')
})

export const shipstationListShipmentsPageOutputSchema = z.object({
	items: z.array(shipstationShipmentRawSchema),
	pagination: shipstationPaginationSchema
})

export const shipstationListFulfillmentsPageInputSchema = z.strictObject({
	page: shipstationPageSchema,
	page_size: shipstationPageSizeSchema,
	ship_to_name: z.string().min(1).optional().describe('Recipient name filter'),
	ship_to_country_code: z.string().length(2).optional().describe('Two-letter destination country code'),
	shipment_number: z.string().min(1).optional().describe('Shipment number filter'),
	shipment_id: z.string().min(1).optional().describe('Shipment id filter'),
	fulfillment_id: z.string().min(1).optional().describe('Fulfillment id filter'),
	batch_id: z.string().min(1).optional().describe('Batch id filter'),
	order_source_id: z.string().min(1).optional().describe('Order source id filter'),
	fulfillment_provider_code: z.string().min(1).optional().describe('Fulfillment provider code filter'),
	tracking_number: z.string().min(1).optional().describe('Tracking number filter'),
	ship_date_start: z.iso.datetime({ offset: true }).optional().describe('Earliest fulfillment ship time'),
	ship_date_end: z.iso.datetime({ offset: true }).optional().describe('Latest fulfillment ship time'),
	create_date_start: z.iso.datetime({ offset: true }).optional().describe('Earliest fulfillment creation time'),
	create_date_end: z.iso.datetime({ offset: true }).optional().describe('Latest fulfillment creation time'),
	sort_dir: z.enum(['asc', 'desc']).optional().describe('Provider slice direction'),
	sort_by: z.literal('created_at').optional().describe('Fulfillment field used to sort the provider slice')
})

export const shipstationListFulfillmentsPageOutputSchema = z.object({
	items: z.array(shipstationFulfillmentRawSchema),
	pagination: shipstationPaginationSchema
})

export const shipstationCarrierIdInputSchema = z.strictObject({
	carrier_id: z.string().min(1).describe('ShipStation V2 carrier id')
})

export const shipstationListCarriersInputSchema = z.strictObject({
	page: shipstationPageSchema,
	page_size: z.int().min(1).optional().describe('Records per page; defaults to 25'),
	include_extended_details: z
		.boolean()
		.optional()
		.describe('Include carrier packages and advanced options; defaults to true')
})

export const shipstationCarrierErrorSchema = z.looseObject({
	error_source: z.string().optional(),
	error_type: z.string().optional(),
	error_code: z.string(),
	message: z.string()
})

export const shipstationListCarriersOutputSchema = z.object({
	items: z.array(shipstationCarrierRawSchema),
	pagination: shipstationPaginationSchema.extend({ page_size: z.int().min(1) }),
	errors: z.array(shipstationCarrierErrorSchema),
	partial: z.boolean(),
	request_id: z.string().optional()
})
export const shipstationGetCarrierOutputSchema = shipstationCarrierRawSchema
export const shipstationListCarrierServicesOutputSchema = z.object({
	items: z.array(shipstationCarrierServiceRawSchema)
})
export const shipstationListCarrierPackagesOutputSchema = z.object({
	items: z.array(shipstationCarrierPackageRawSchema)
})
export const shipstationListCarrierOptionsOutputSchema = z.object({
	items: z.array(shipstationCarrierOptionRawSchema)
})

export const shipstationListOrdersPageInputSchema = z.strictObject({
	page: shipstationPageSchema,
	page_size: shipstationPageSizeSchema,
	customer_name: z.string().min(1).optional().describe('Customer name filter'),
	item_keyword: z.string().min(1).optional().describe('Order item SKU, description, or option filter'),
	create_date_start: z.iso.datetime({ offset: true }).optional().describe('Earliest ShipStation creation time'),
	create_date_end: z.iso.datetime({ offset: true }).optional().describe('Latest ShipStation creation time'),
	modify_date_start: z.iso.datetime({ offset: true }).optional().describe('Earliest modification time'),
	modify_date_end: z.iso.datetime({ offset: true }).optional().describe('Latest modification time'),
	order_date_start: z.iso.datetime({ offset: true }).optional().describe('Earliest order time'),
	order_date_end: z.iso.datetime({ offset: true }).optional().describe('Latest order time'),
	order_number: z.string().min(1).optional().describe('Order number prefix filter'),
	order_status: z
		.enum([
			'awaiting_payment',
			'awaiting_shipment',
			'pending_fulfillment',
			'shipped',
			'on_hold',
			'cancelled',
			'rejected_fulfillment'
		])
		.optional()
		.describe('Order status filter'),
	payment_date_start: z.iso.datetime({ offset: true }).optional().describe('Earliest payment time'),
	payment_date_end: z.iso.datetime({ offset: true }).optional().describe('Latest payment time'),
	store_id: z.int().optional().describe('V1 store id filter'),
	sort_by: z.enum(['OrderDate', 'ModifyDate', 'CreateDate']).optional().describe('Order sort field'),
	sort_dir: z.enum(['ASC', 'DESC']).optional().describe('Order sort direction')
})

export const shipstationListOrdersPageOutputSchema = z.object({
	items: z.array(shipstationOrderRawSchema),
	pagination: shipstationPaginationSchema
})

export const shipstationListStoresInputSchema = z.strictObject({
	show_inactive: z.boolean().optional().describe('Include inactive stores'),
	marketplace_id: z.int().optional().describe('Marketplace type id filter')
})

export const shipstationListStoresOutputSchema = z.object({ items: z.array(shipstationStoreRawSchema) })

export const shipstationListLabelsResponseSchema = z.looseObject({
	labels: z.array(shipstationLabelRawSchema),
	total: z.int().nonnegative(),
	page: z.int().min(1),
	pages: z.int().nonnegative()
})

export const shipstationListShipmentsResponseSchema = z.looseObject({
	shipments: z.array(shipstationShipmentRawSchema),
	total: z.int().nonnegative(),
	page: z.int().min(1),
	pages: z.int().nonnegative()
})

export const shipstationListFulfillmentsResponseSchema = z.looseObject({
	fulfillments: z.array(shipstationFulfillmentRawSchema),
	total: z.int().nonnegative(),
	page: z.int().min(1),
	pages: z.int().nonnegative()
})

export const shipstationListCarriersResponseSchema = z.looseObject({
	carriers: z.array(shipstationCarrierRawSchema),
	total: z.int().nonnegative(),
	page: z.int().min(1),
	pages: z.int().nonnegative(),
	errors: z.array(shipstationCarrierErrorSchema).default([]),
	request_id: z.string().optional()
})
export const shipstationListCarrierServicesResponseSchema = z.looseObject({
	services: z.array(shipstationCarrierServiceRawSchema)
})
export const shipstationListCarrierPackagesResponseSchema = z.looseObject({
	packages: z.array(shipstationCarrierPackageRawSchema)
})
export const shipstationListCarrierOptionsResponseSchema = z.looseObject({
	options: z.array(shipstationCarrierOptionRawSchema)
})
export const shipstationListOrdersResponseSchema = z.looseObject({
	orders: z.array(shipstationOrderRawSchema),
	total: z.int().nonnegative(),
	page: z.int().min(1),
	pages: z.int().nonnegative()
})
export const shipstationListStoresResponseSchema = z.array(shipstationStoreRawSchema)

export type ShipstationLabelRaw = z.infer<typeof shipstationLabelRawSchema>
export type ShipstationShipmentRaw = z.infer<typeof shipstationShipmentRawSchema>
export type ShipstationFulfillmentRaw = z.infer<typeof shipstationFulfillmentRawSchema>
export type ShipstationCarrierRaw = z.infer<typeof shipstationCarrierRawSchema>
export type ShipstationCarrierServiceRaw = z.infer<typeof shipstationCarrierServiceRawSchema>
export type ShipstationCarrierPackageRaw = z.infer<typeof shipstationCarrierPackageRawSchema>
export type ShipstationCarrierOptionRaw = z.infer<typeof shipstationCarrierOptionRawSchema>
export type ShipstationOrderRaw = z.infer<typeof shipstationOrderRawSchema>
export type ShipstationStoreRaw = z.infer<typeof shipstationStoreRawSchema>
export type ShipstationPagination = z.infer<typeof shipstationPaginationSchema>
export type ShipstationListLabelsPageInput = z.infer<typeof shipstationListLabelsPageInputSchema>
export type ShipstationListLabelsPageOutput = z.infer<typeof shipstationListLabelsPageOutputSchema>
export type ShipstationListShipmentsPageInput = z.infer<typeof shipstationListShipmentsPageInputSchema>
export type ShipstationListShipmentsPageOutput = z.infer<typeof shipstationListShipmentsPageOutputSchema>
export type ShipstationListFulfillmentsPageInput = z.infer<typeof shipstationListFulfillmentsPageInputSchema>
export type ShipstationListFulfillmentsPageOutput = z.infer<typeof shipstationListFulfillmentsPageOutputSchema>
export type ShipstationCarrierIdInput = z.infer<typeof shipstationCarrierIdInputSchema>
export type ShipstationListCarriersOutput = z.infer<typeof shipstationListCarriersOutputSchema>
export type ShipstationListCarriersInput = z.infer<typeof shipstationListCarriersInputSchema>
export type ShipstationCarrierError = z.infer<typeof shipstationCarrierErrorSchema>
export type ShipstationGetCarrierOutput = z.infer<typeof shipstationGetCarrierOutputSchema>
export type ShipstationListCarrierServicesOutput = z.infer<typeof shipstationListCarrierServicesOutputSchema>
export type ShipstationListCarrierPackagesOutput = z.infer<typeof shipstationListCarrierPackagesOutputSchema>
export type ShipstationListCarrierOptionsOutput = z.infer<typeof shipstationListCarrierOptionsOutputSchema>
export type ShipstationListOrdersPageInput = z.infer<typeof shipstationListOrdersPageInputSchema>
export type ShipstationListOrdersPageOutput = z.infer<typeof shipstationListOrdersPageOutputSchema>
export type ShipstationListStoresInput = z.infer<typeof shipstationListStoresInputSchema>
export type ShipstationListStoresOutput = z.infer<typeof shipstationListStoresOutputSchema>
