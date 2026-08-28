import { z } from 'zod'

export const shipstationAuthSchema = z.object({
	api_key: z.string().min(1).describe('ShipStation V2 API key')
})

export type ShipstationAuth = z.infer<typeof shipstationAuthSchema>

const shipstationPageSchema = z.int().min(1).optional().describe('Provider page number, starting at 1')
const shipstationPageSizeSchema = z
	.int()
	.min(1)
	.max(500)
	.optional()
	.describe('Records per page, from 1 to 500; defaults to 25')

export const shipstationLabelRawSchema = z.looseObject({
	label_id: z.string().min(1),
	shipment_id: z.string().nullable().optional(),
	external_order_id: z.string().nullable().optional(),
	tracking_number: z.string().nullable().optional(),
	created_at: z.string().nullable().optional(),
	modified_at: z.string().nullable().optional(),
	ship_date: z.string().nullable().optional(),
	voided_at: z.string().nullable().optional(),
	status: z.string().nullable().optional()
})

export const shipstationShipmentRawSchema = z.looseObject({
	shipment_id: z.string().min(1),
	external_order_id: z.string().nullable().optional(),
	shipment_number: z.string().nullable().optional(),
	created_at: z.string().nullable().optional(),
	modified_at: z.string().nullable().optional(),
	shipment_status: z.string().nullable().optional()
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
	refund_status: z.string().min(1).optional().describe('Label refund status filter'),
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

export type ShipstationLabelRaw = z.infer<typeof shipstationLabelRawSchema>
export type ShipstationShipmentRaw = z.infer<typeof shipstationShipmentRawSchema>
export type ShipstationPagination = z.infer<typeof shipstationPaginationSchema>
export type ShipstationListLabelsPageInput = z.infer<typeof shipstationListLabelsPageInputSchema>
export type ShipstationListLabelsPageOutput = z.infer<typeof shipstationListLabelsPageOutputSchema>
export type ShipstationListShipmentsPageInput = z.infer<typeof shipstationListShipmentsPageInputSchema>
export type ShipstationListShipmentsPageOutput = z.infer<typeof shipstationListShipmentsPageOutputSchema>
