import { z } from 'zod'
import { artifactsAuthSchema } from '../../modules/artifacts/contracts'
import { artifactRefSchema } from '../../shared/artifact'

export const wayfairAuthSchema = z.object({
	client_id: z.string().min(1).describe('Wayfair Supplier OAuth client id'),
	client_secret: z.string().min(1).describe('Wayfair Supplier OAuth client secret'),
	supplier_id: z.coerce.number().int().positive().describe('Wayfair supplier id'),
	environment: z.enum(['production', 'sandbox']).optional().describe('Wayfair environment; defaults to production'),
	artifacts: artifactsAuthSchema.optional().describe('Optional host-bound artifact storage for document downloads')
})

export type WayfairAuth = z.infer<typeof wayfairAuthSchema>

const wayfairIdentifierSchema = z.union([z.string().min(1), z.number().int()])

export const wayfairCatalogSkuRawSchema = z.looseObject({
	sku: z.string().min(1),
	productName: z.string().nullable().optional(),
	className: z.string().nullable().optional(),
	classId: wayfairIdentifierSchema.nullable().optional(),
	status: z.string().nullable().optional(),
	isLive: z.boolean().nullable().optional(),
	collectionName: z.string().nullable().optional(),
	displaySku: z.string().nullable().optional(),
	minimumOrderQuantity: z.number().nullable().optional()
})

export const wayfairCatalogProductRawSchema = z.looseObject({
	productId: wayfairIdentifierSchema,
	upc: z.string().nullable().optional(),
	supplierPartNumber: z.string().min(1),
	status: z.string().nullable().optional(),
	skus: z.array(wayfairCatalogSkuRawSchema)
})

export const wayfairPurchaseOrderProductRawSchema = z.looseObject({
	partNumber: z.string().min(1),
	quantity: z.union([
		z.number(),
		z
			.string()
			.regex(/^\d+(?:\.\d+)?$/)
			.pipe(z.coerce.number())
	])
})

export const wayfairDropshipPurchaseOrderRawSchema = z.looseObject({
	id: wayfairIdentifierSchema,
	poNumber: z.string().min(1),
	poDate: z.string().min(1),
	orderId: wayfairIdentifierSchema.nullable().optional(),
	estimatedShipDate: z.string().nullable().optional(),
	salesChannelName: z.string().nullable().optional(),
	orderType: z.string().nullable().optional(),
	warehouse: z
		.looseObject({
			id: wayfairIdentifierSchema
		})
		.nullable()
		.optional(),
	products: z.array(wayfairPurchaseOrderProductRawSchema)
})

const wayfairGraphqlErrorSchema = z.looseObject({
	message: z.string().min(1)
})

export const wayfairCatalogResponseSchema = z.object({
	data: z
		.object({
			supplierCatalog: z.object({
				supplierId: wayfairIdentifierSchema,
				pageInfo: z.object({
					page: z.int().positive(),
					pageSize: z.int().positive(),
					hasNextPage: z.boolean(),
					totalPages: z.int().nonnegative()
				}),
				products: z.array(wayfairCatalogProductRawSchema)
			})
		})
		.nullable()
		.optional(),
	errors: z.array(wayfairGraphqlErrorSchema).optional()
})

export const wayfairDropshipPurchaseOrdersResponseSchema = z.object({
	data: z
		.object({
			getDropshipPurchaseOrders: z.array(wayfairDropshipPurchaseOrderRawSchema)
		})
		.nullable()
		.optional(),
	errors: z.array(wayfairGraphqlErrorSchema).optional()
})

export const wayfairListCatalogPageInputSchema = z.strictObject({
	page: z.int().positive().optional().describe('One-based catalog page; defaults to 1'),
	page_size: z
		.union([z.literal(10), z.literal(20), z.literal(25)])
		.optional()
		.describe('Wayfair catalog page size; defaults to 25')
})

export const wayfairListCatalogPageOutputSchema = z.object({
	items: z.array(wayfairCatalogProductRawSchema),
	page: z.int().positive(),
	page_size: z.int().positive(),
	total_pages: z.int().nonnegative(),
	has_next_page: z.boolean()
})

const wayfairOrderDateSchema = z.union([z.iso.date(), z.iso.datetime({ offset: true })])

export const wayfairListDropshipOrdersInputSchema = z.strictObject({
	limit: z.int().positive().optional().describe('Maximum purchase orders returned; defaults to 100'),
	from_date: wayfairOrderDateSchema.optional().describe('Purchase orders on or after this ISO 8601 date or date-time'),
	has_response: z.boolean().optional().describe('Filter by whether the purchase order has a supplier response'),
	po_numbers: z.array(z.string().min(1)).min(1).optional().describe('Exact Wayfair purchase order numbers'),
	sort_order: z.enum(['ASC', 'DESC']).optional().describe('Purchase order date sort order; defaults to ASC')
})

export const wayfairListDropshipOrdersOutputSchema = z.object({
	items: z.array(wayfairDropshipPurchaseOrderRawSchema),
	limit: z.int().positive(),
	limit_reached: z.boolean()
})

export type WayfairCatalogProductRaw = z.infer<typeof wayfairCatalogProductRawSchema>
export type WayfairDropshipPurchaseOrderRaw = z.infer<typeof wayfairDropshipPurchaseOrderRawSchema>
export type WayfairListCatalogPageInput = z.input<typeof wayfairListCatalogPageInputSchema>
export type WayfairListCatalogPageOutput = z.infer<typeof wayfairListCatalogPageOutputSchema>
export type WayfairListDropshipOrdersInput = z.input<typeof wayfairListDropshipOrdersInputSchema>
export type WayfairListDropshipOrdersOutput = z.infer<typeof wayfairListDropshipOrdersOutputSchema>

export const wayfairShipSpeedSchema = z.enum([
	'SECOND_DAY_AIR',
	'SECOND_DAY_AIR_FREE',
	'FIVE_DAY_DIRECT',
	'THREE_DAY',
	'CONTAINER',
	'EMAIL',
	'FEDEX_HOME',
	'GROUND',
	'PAKETVERSAND',
	'IMPERIAL_POOL_FREIGHT',
	'NEXT_DAY',
	'NEXT_DAY_OVERSEAS',
	'NEXT_MORNING',
	'NEXT_DAY_BEFORE_NINE',
	'WILL_CALL',
	'SATURDAY_DELIVERY',
	'TRUCK_FREIGHT_CASKETS_ONE_DAY',
	'TRUCK_FREIGHT_CASKETS_TWO_DAY',
	'CURBSIDE_WITH_UNLOAD',
	'TRUCK_LOAD',
	'CURBSIDE',
	'WHITE_GLOVE_BRONZE',
	'WHITE_GLOVE_GOLD',
	'WHITE_GLOVE_TWO_MAN',
	'WHITE_GLOVE_PLATINUM',
	'WHITE_GLOVE_SILVER',
	'TRUCK_FREIGHT_THRESHOLD',
	'STANDARD_VERSAND_SPERRGUT',
	'ALMO',
	'LARGE_PARCEL_COURIER',
	'EUROPEAN_LINE_HAUL',
	'ECONOMY',
	'WHITE_GLOVE_ROOM_OF_CHOICE',
	'TINY_PARCEL',
	'GROUND_OVERSEA',
	'LOW_COST_CARRIER',
	'WHITE_GLOVE_INNOVEL',
	'BACKYARD',
	'CURBSIDE_DELIVERY',
	'INSIDE_DELIVERY_PACKAGING_REMOVAL_REMOVAL_OF_OLD_APPLIANCE',
	'ONE_MAN_PREMIUM',
	'INSIDE_DELIVERY_PACKAGING_REMOVAL',
	'THRESHOLD_DELIVERY',
	'UK_1_MAN_48HRS',
	'ALLIED_ROAD_EXPRESS',
	'HUNTER_ROAD_EXPRESS',
	'WHITE_GLOVE_CAPITAL_CITIES',
	'SPEDITION_FREI_BORDSTEINKANTE',
	'UK_1_MAN_LONG_DELIVERY',
	'IN_HOME_MATTRESS_SET_UP_REMOVAL',
	'WHITE_GLOVE_DELIVERY_ROOM_OF_CHOICE_W_INSTALLATION',
	'WHITE_GLOVE_DELIVERY_ROOM_OF_CHOICE_W_INSTALLATION_HAUL_AWAY',
	'WHITE_GLOVE_DELIVERY_ROOM_OF_CHOICE_W_HAUL_AWAY',
	'ROOM_OF_CHOICE_DELIVERY_W_MOVE_TO_ANOTHER_ROOM',
	'ROOM_OF_CHOICE_DELIVERY_W_INSTALL_MOVE_TO_ANOTHER_ROOM',
	'GE_WG_DELIVERY',
	'SAMSUNG_WG_DELIVERY',
	'WAYFAIR_LARGE_APPLIANCES_DELIVERY',
	'WAYFAIR_OFF_THE_SHELF'
])

const wayfairAddressRawSchema = z.object({
	name: z.string().nullish(),
	address1: z.string().nullish(),
	address2: z.string().nullish(),
	address3: z.string().nullish(),
	city: z.string().nullish(),
	state: z.string().nullish(),
	country: z.string().nullish(),
	postalCode: z.string().nullish(),
	phoneNumber: z.string().nullish()
})

const wayfairAgentRawSchema = z.object({
	id: wayfairIdentifierSchema,
	name: z.string().nullish()
})

/** Explicit fulfillment details, separate from the PII-minimized list projection. */
export const wayfairDropshipOrderDetailsSchema = wayfairDropshipPurchaseOrderRawSchema.extend({
	storePrefix: z.string().nullish(),
	supplierId: wayfairIdentifierSchema.nullish(),
	scheduledDeliveryDate: z.string().nullish(),
	deliveryMethodCode: z.string().nullish(),
	customerName: z.string().nullish(),
	customerEmail: z.string().nullish(),
	shippingInfo: z
		.object({
			shipSpeed: wayfairShipSpeedSchema.nullish(),
			carrierCode: z.string().nullish(),
			poolPointAgent: wayfairAgentRawSchema.nullish(),
			crossDockAgent: wayfairAgentRawSchema.nullish(),
			deliveryAgent: wayfairAgentRawSchema.nullish()
		})
		.nullish(),
	warehouse: z
		.object({
			id: wayfairIdentifierSchema.nullish(),
			name: z.string().nullish(),
			address: wayfairAddressRawSchema.nullish()
		})
		.nullish(),
	products: z.array(
		wayfairPurchaseOrderProductRawSchema.extend({
			price: z.number().nullish(),
			pieceCount: z.int().nullish(),
			totalCost: z.number().nullish(),
			name: z.string().nullish(),
			weight: z.number().nullish(),
			totalWeight: z.number().nullish(),
			estShipDate: z.string().nullish(),
			fillDate: z.string().nullish(),
			sku: z.string().nullish(),
			isCancelled: z.boolean().nullish(),
			isTscaCompliant: z.boolean().nullish(),
			twoDayGuaranteeDeliveryDeadline: z.string().nullish(),
			customComment: z.string().nullish()
		})
	),
	shipTo: wayfairAddressRawSchema,
	billTo: wayfairAddressRawSchema,
	billingInfo: z.object({ vatNumber: z.string().nullish() }).nullish()
})

export const wayfairGetDropshipOrderInputSchema = z.strictObject({
	po_number: z.string().min(1).describe('Exact Wayfair purchase order number to retrieve with fulfillment details')
})

export const wayfairGetDropshipOrderResponseSchema = z.object({
	data: z.object({ getDropshipPurchaseOrders: z.array(wayfairDropshipOrderDetailsSchema) }).nullish(),
	errors: z.array(wayfairGraphqlErrorSchema).optional()
})

const wayfairPositiveIntSchema = z.int().min(1).max(2_147_483_647)

// IsoDateTime accepts both ISO T-separated timestamps and Wayfair's space-separated timestamps.
const isoTimestampSchema = z.iso.datetime({ offset: true, local: true })
const wayfairTimestampSchema = z
	.string()
	.min(1)
	.refine(
		(value) => isoTimestampSchema.safeParse(value.replace(' ', 'T').replace(/ (?=[+-]\d{2}:\d{2}$)/, '')).success,
		'Expected an ISO 8601 date-time, optionally with spaces between the date, time, and offset'
	)

export const wayfairAcceptedLineItemInputSchema = z.strictObject({
	part_number: z.string().min(1).describe('Supplier part number from the purchase order'),
	quantity: wayfairPositiveIntSchema.describe('Number of units being accepted'),
	unit_price: z.number().nonnegative().describe('Unit price from the purchase order'),
	estimated_ship_date: wayfairTimestampSchema.describe(
		'Estimated ship date-time in ISO 8601 or Wayfair date-time format'
	)
})

export const wayfairAcceptDropshipOrderInputSchema = z.strictObject({
	po_number: z.string().min(1).describe('Purchase order containing the items to accept'),
	ship_speed: wayfairShipSpeedSchema.describe(
		'Exact ship speed from the purchase order; do not substitute another service'
	),
	line_items: z
		.array(wayfairAcceptedLineItemInputSchema)
		.min(1)
		.describe('Purchase order line items and quantities to accept')
})

export const wayfairShipmentAddressInputSchema = z.strictObject({
	name: z.string().min(1).describe('Residence or recipient name'),
	street_address1: z.string().min(1).describe('Primary street address'),
	street_address2: z.string().optional().describe('Secondary street address'),
	city: z.string().min(1).describe('City'),
	state: z.string().optional().describe('State or province'),
	postal_code: z.string().optional().describe('Postal code'),
	country: z.string().min(2).max(3).describe('Two- or three-character country code')
})

export const wayfairShipmentPackageInputSchema = z.strictObject({
	code: z
		.strictObject({
			type: z.enum(['TRACKING_NUMBER', 'UCC_128']).describe('Type of package tracking code'),
			value: z.string().min(1).max(255).describe('Package tracking code, up to 255 characters')
		})
		.describe('Tracking information for this package'),
	weight: z.number().nonnegative().optional().describe('Package weight in pounds')
})

export const wayfairSmallParcelShipmentInputSchema = z.strictObject({
	package: wayfairShipmentPackageInputSchema.describe('Package and tracking information'),
	items: z
		.array(
			z.strictObject({
				part_number: z.string().min(1).describe('Supplier part number shipped in this package'),
				quantity: wayfairPositiveIntSchema.describe('Units of this part shipped in the package')
			})
		)
		.min(1)
		.describe('Contents of this small-parcel package')
})

export const wayfairLargeParcelShipmentInputSchema = z.strictObject({
	part_number: z.string().min(1).describe('Supplier part number being shipped as large parcel'),
	packages: z.array(wayfairShipmentPackageInputSchema).min(1).describe('Packages containing this large-parcel item')
})

export const wayfairSendShipmentNoticeInputSchema = z
	.strictObject({
		po_number: z.string().min(1).describe('Purchase order whose items have physically shipped'),
		supplier_id: wayfairIdentifierSchema.describe('Shipping supplier or warehouse ID from this purchase order'),
		package_count: wayfairPositiveIntSchema.describe('Total number of packages in this shipment notice'),
		weight: z.number().nonnegative().optional().describe('Total package weight in pounds'),
		volume: z.number().nonnegative().optional().describe('Total package volume in cubic feet'),
		carrier_code: z.string().min(1).describe('Wayfair-supported standard carrier alpha code (SCAC)'),
		ship_speed: wayfairShipSpeedSchema.describe('Exact ship speed from the purchase order'),
		tracking_number: z.string().min(1).max(1000).describe('Shipment tracking number, up to 1000 characters'),
		ship_date: wayfairTimestampSchema.describe(
			'Actual shipment date-time; Wayfair allows up to 10 days in the past or 1 day in the future'
		),
		source_address: wayfairShipmentAddressInputSchema.describe('Address the shipment departed from'),
		destination_address: wayfairShipmentAddressInputSchema.describe('Destination address matching the purchase order'),
		small_parcel_shipments: z
			.array(wayfairSmallParcelShipmentInputSchema)
			.optional()
			.describe('Small-parcel packages; provide these and/or large-parcel shipments'),
		large_parcel_shipments: z
			.array(wayfairLargeParcelShipmentInputSchema)
			.optional()
			.describe('Large-parcel shipments; provide these and/or small-parcel packages')
	})
	.refine(
		(input) => Boolean(input.small_parcel_shipments?.length || input.large_parcel_shipments?.length),
		'Provide at least one small-parcel or large-parcel shipment'
	)

const wayfairTransactionItemSchema = z.object({
	key: z.string().nullish(),
	message: z.string().nullish()
})

/** Raw transaction state is not a claim that the accepted work has completed. */
export const wayfairTransactionStatusSchema = z.object({
	id: z.string().nullish(),
	handle: z.string().nullish(),
	status: z.enum(['NEW', 'PROCESSING', 'ERROR', 'COMPLETE']).nullable(),
	submittedAt: z.string().min(1),
	completedAt: z.string().nullish(),
	itemCount: z.int().nonnegative().nullish(),
	errorCount: z.int().nonnegative().nullish(),
	errors: z.array(wayfairTransactionItemSchema.nullable()).nullish(),
	completedCount: z.int().nonnegative().nullish(),
	completed: z.array(wayfairTransactionItemSchema.nullable()).nullish(),
	processingCount: z.int().nonnegative().nullish(),
	processing: z.array(wayfairTransactionItemSchema.nullable()).nullish()
})

export const wayfairAcceptDropshipOrderResponseSchema = z.object({
	data: z
		.object({
			purchaseOrders: z.object({ accept: wayfairTransactionStatusSchema.nullish() }).nullish()
		})
		.nullish(),
	errors: z.array(wayfairGraphqlErrorSchema).optional()
})

export const wayfairSendShipmentNoticeResponseSchema = z.object({
	data: z
		.object({
			purchaseOrders: z.object({ shipment: wayfairTransactionStatusSchema.nullish() }).nullish()
		})
		.nullish(),
	errors: z.array(wayfairGraphqlErrorSchema).optional()
})

export type WayfairShipSpeed = z.infer<typeof wayfairShipSpeedSchema>
export type WayfairDropshipOrderDetails = z.infer<typeof wayfairDropshipOrderDetailsSchema>
export type WayfairGetDropshipOrderInput = z.infer<typeof wayfairGetDropshipOrderInputSchema>
export type WayfairAcceptedLineItemInput = z.infer<typeof wayfairAcceptedLineItemInputSchema>
export type WayfairAcceptDropshipOrderInput = z.infer<typeof wayfairAcceptDropshipOrderInputSchema>
export type WayfairShipmentAddressInput = z.infer<typeof wayfairShipmentAddressInputSchema>
export type WayfairShipmentPackageInput = z.infer<typeof wayfairShipmentPackageInputSchema>
export type WayfairSmallParcelShipmentInput = z.infer<typeof wayfairSmallParcelShipmentInputSchema>
export type WayfairLargeParcelShipmentInput = z.infer<typeof wayfairLargeParcelShipmentInputSchema>
export type WayfairSendShipmentNoticeInput = z.infer<typeof wayfairSendShipmentNoticeInputSchema>
export type WayfairTransactionStatus = z.infer<typeof wayfairTransactionStatusSchema>

export const wayfairCancellationFilterStatusSchema = z.enum(['CANCELLATION_PENDING_SUPPLIER_CONFIRMATION', 'CANCELLED'])

export const wayfairCancellationStatusSchema = z.enum([
	'CANCELLATION_PENDING_SUPPLIER_CONFIRMATION',
	'CANCELLED',
	'CANCELLATION_REJECTED'
])

const wayfairCancellationDateTimeSchema = z.iso.datetime({ offset: true })

export const wayfairCancellationRequestSchema = z.object({
	requestId: wayfairIdentifierSchema,
	status: wayfairCancellationStatusSchema,
	requestedAt: wayfairCancellationDateTimeSchema,
	cancellationReason: z.object({ reason: z.string() }).nullable(),
	purchaseOrder: z.object({
		poNumber: z.string().min(1),
		warehouse: z.object({ warehouseId: z.int32() })
	}),
	cancelledProduct: z.object({
		partNumber: z.string().min(1),
		cancellationQuantity: z
			.object({
				originalQuantity: z.int32(),
				cancelledQuantity: z.int32()
			})
			.nullable()
	})
})

export const wayfairListCancellationRequestsByOrdersInputSchema = z.strictObject({
	po_numbers: z
		.array(z.string().regex(/^[A-Za-z]{2}\d*$/))
		.min(1)
		.max(50)
		.describe('One to 50 purchase order numbers, each with two letters followed by digits')
})

export const wayfairListCancellationRequestsByWarehousesInputSchema = z
	.strictObject({
		warehouse_ids: z
			.array(z.int32())
			.min(1)
			.max(50)
			.describe('One to 50 warehouse IDs whose cancellation requests should be retrieved'),
		status: wayfairCancellationFilterStatusSchema.describe(
			'Required request status: pending supplier confirmation or cancelled'
		),
		from_datetime: wayfairCancellationDateTimeSchema
			.optional()
			.describe('Earliest request time as an RFC 3339 date-time with a timezone'),
		to_datetime: wayfairCancellationDateTimeSchema
			.optional()
			.describe('Latest request time as an RFC 3339 date-time with a timezone; must be later than from_datetime')
	})
	.refine(
		(input) =>
			input.from_datetime === undefined ||
			input.to_datetime === undefined ||
			Date.parse(input.from_datetime) < Date.parse(input.to_datetime),
		'from_datetime must be earlier than to_datetime'
	)

export const wayfairListCancellationRequestsOutputSchema = z.object({
	items: z.array(wayfairCancellationRequestSchema)
})

export const wayfairConfirmCancellationRequestsInputSchema = z.strictObject({
	request_ids: z
		.array(wayfairIdentifierSchema)
		.min(1)
		.max(100)
		.describe('One to 100 pending cancellation request IDs to confirm; these are not purchase order numbers')
})

export const wayfairCancellationRejectionInputSchema = z.strictObject({
	request_id: wayfairIdentifierSchema.describe('Pending cancellation request ID to reject'),
	reason: z
		.string()
		.min(1)
		.max(500)
		.refine((value) => value.trim().length > 0, 'Provide a nonblank rejection reason')
		.describe('Reason for rejecting this cancellation request, up to 500 characters')
})

export const wayfairRejectCancellationRequestsInputSchema = z.strictObject({
	requests: z
		.array(wayfairCancellationRejectionInputSchema)
		.min(1)
		.max(100)
		.describe('One to 100 pending cancellation requests, each with its own rejection reason')
})

export const wayfairCancellationResponseSchema = z.object({
	requestId: wayfairIdentifierSchema,
	status: z.enum(['SUCCESS', 'FAILURE']),
	errorCode: z.int32().nullable(),
	errorMessage: z.string().nullable()
})

export const wayfairRespondCancellationRequestsOutputSchema = z.object({
	items: z.array(wayfairCancellationResponseSchema)
})

export const wayfairCancellationRequestsByOrdersResponseSchema = z.object({
	data: z
		.object({
			lineItemCancellationRequestByPurchaseOrders: z.array(wayfairCancellationRequestSchema)
		})
		.nullish(),
	errors: z.array(wayfairGraphqlErrorSchema).optional()
})

export const wayfairCancellationRequestsByWarehousesResponseSchema = z.object({
	data: z
		.object({
			lineItemCancellationRequestByWarehouses: z.array(wayfairCancellationRequestSchema)
		})
		.nullish(),
	errors: z.array(wayfairGraphqlErrorSchema).optional()
})

export const wayfairConfirmCancellationRequestsResponseSchema = z.object({
	data: z
		.object({
			confirmLineItemCancellationRequest: z.array(wayfairCancellationResponseSchema)
		})
		.nullish(),
	errors: z.array(wayfairGraphqlErrorSchema).optional()
})

export const wayfairRejectCancellationRequestsResponseSchema = z.object({
	data: z
		.object({
			rejectLineItemCancellationRequest: z.array(wayfairCancellationResponseSchema)
		})
		.nullish(),
	errors: z.array(wayfairGraphqlErrorSchema).optional()
})

export type WayfairCancellationFilterStatus = z.infer<typeof wayfairCancellationFilterStatusSchema>
export type WayfairCancellationStatus = z.infer<typeof wayfairCancellationStatusSchema>
export type WayfairCancellationRequest = z.infer<typeof wayfairCancellationRequestSchema>
export type WayfairCancellationResponse = z.infer<typeof wayfairCancellationResponseSchema>
export type WayfairCancellationRejectionInput = z.infer<typeof wayfairCancellationRejectionInputSchema>
export type WayfairListCancellationRequestsByOrdersInput = z.infer<
	typeof wayfairListCancellationRequestsByOrdersInputSchema
>
export type WayfairListCancellationRequestsByWarehousesInput = z.infer<
	typeof wayfairListCancellationRequestsByWarehousesInputSchema
>
export type WayfairListCancellationRequestsOutput = z.infer<typeof wayfairListCancellationRequestsOutputSchema>
export type WayfairConfirmCancellationRequestsInput = z.infer<typeof wayfairConfirmCancellationRequestsInputSchema>
export type WayfairRejectCancellationRequestsInput = z.infer<typeof wayfairRejectCancellationRequestsInputSchema>
export type WayfairRespondCancellationRequestsOutput = z.infer<typeof wayfairRespondCancellationRequestsOutputSchema>

export const wayfairListInventorySummaryInputSchema = z.strictObject({
	supplier_part_numbers: z
		.array(z.string().min(1))
		.min(1)
		.max(100)
		.optional()
		.describe('Filter to one to 100 supplier part numbers; omit to query all parts'),
	warehouse_id: z.int32().optional().describe('Filter to a physical warehouse or child supplier ID'),
	limit: z.int().min(1).max(100).optional().describe('Maximum inventory parts in this page (1–100); defaults to 50'),
	cursor: z.string().min(1).optional().describe('Opaque end_cursor from the previous page; omit for the first page')
})

// CastleGate and physical retail expose the same quantity breakdown.
const wayfairInventoryUnfulfillableSchema = z.object({
	expiredQty: z.int32(),
	heldQty: z.int32(),
	unpickableQty: z.int32(),
	onTransferQty: z.int32()
})

const wayfairInventoryOnHandSchema = z.object({
	allocatedQty: z.int32(),
	unreconciledQty: z.int32(),
	inStockQty: z.int32(),
	inStock: z
		.object({
			fulfillableQty: z.int32(),
			unfulfillableQty: z.int32(),
			unfulfillable: wayfairInventoryUnfulfillableSchema.nullable()
		})
		.nullable()
})

export const wayfairInventoryPositionSchema = z.object({
	onHandQty: z.int32(),
	onHand: wayfairInventoryOnHandSchema,
	warehouses: z
		.array(
			z.object({
				warehouseId: z.int32(),
				onHandQty: z.int32(),
				onHand: wayfairInventoryOnHandSchema.nullable()
			})
		)
		.nullable()
})

export const wayfairInventorySummarySchema = z.object({
	// Long values must not be rounded to fit JavaScript's numeric range.
	manufacturerPartId: z.union([z.int(), z.string().regex(/^-?\d+$/)]),
	supplierPartNumber: z.string().min(1),
	sku: z.string().nullable(),
	productName: z.string().nullable(),
	options: z.string().nullable(),
	inventoryPosition: z.object({
		castleGate: wayfairInventoryPositionSchema.nullable(),
		physicalRetail: wayfairInventoryPositionSchema.nullable()
	})
})

export const wayfairListInventorySummaryOutputSchema = z.object({
	items: z.array(wayfairInventorySummarySchema),
	has_next_page: z.boolean(),
	end_cursor: z.string().nullable()
})

export const wayfairInventorySummaryResponseSchema = z.object({
	data: z
		.object({
			inventorySummaryList: z.object({
				pageInfo: z.object({ hasNextPage: z.boolean(), endCursor: z.string().nullable() }),
				edges: z.array(z.object({ node: wayfairInventorySummarySchema }))
			})
		})
		.nullish(),
	errors: z.array(wayfairGraphqlErrorSchema).optional()
})

const wayfairInventoryDateTimeSchema = z.iso.datetime({ offset: true })
const wayfairInventoryAdjustmentStart = Date.parse('2023-06-01T00:00:00-05:00')

export const wayfairListInventoryAdjustmentsInputSchema = z
	.strictObject({
		supplier_part_number: z.string().min(1).optional().describe('Filter to one exact supplier part number'),
		from_datetime: wayfairInventoryDateTimeSchema
			.refine(
				(value) => Date.parse(value) >= wayfairInventoryAdjustmentStart,
				'Inventory adjustments are available from 2023-06-01T00:00:00-05:00'
			)
			.optional()
			.describe('Earliest event time with a timezone, no earlier than 2023-06-01T00:00:00-05:00'),
		to_datetime: wayfairInventoryDateTimeSchema
			.optional()
			.describe('Latest event time with a timezone; must be later than from_datetime when both are supplied'),
		page: z.int32().nonnegative().optional().describe('Zero-based adjustment page; defaults to 0'),
		page_size: z.int().min(1).max(100).optional().describe('Maximum adjustments per page (1–100); defaults to 50'),
		sort_by: z
			.literal('EVENT_DATE')
			.optional()
			.describe('Sort field; EVENT_DATE is the only supported value and the default'),
		sort_order: z.enum(['ASC', 'DESC']).optional().describe('Event-date sort order; defaults to DESC')
	})
	.refine(
		(input) =>
			input.from_datetime === undefined ||
			input.to_datetime === undefined ||
			Date.parse(input.from_datetime) < Date.parse(input.to_datetime),
		'from_datetime must be earlier than to_datetime'
	)

export const wayfairInventoryAdjustmentSchema = z.object({
	eventDate: wayfairInventoryDateTimeSchema,
	adjustmentType: z.string().nullable(),
	supplierPartNumber: z.string().min(1),
	quantity: z.int32(),
	description: z.string().nullable(),
	warehouse: z
		.object({
			warehouseId: z.int32().nullable(),
			name: z.string().nullable(),
			address: z
				.object({
					address1: z.string().nullable(),
					address2: z.string().nullable(),
					address3: z.string().nullable(),
					city: z.string().nullable(),
					stateShortName: z.string().nullable(),
					country: z.string().nullable(),
					postalCode: z.string().nullable()
				})
				.nullable()
		})
		.nullable()
})

const wayfairInventoryAdjustmentPageInfoSchema = z.object({
	pageNumber: z.int32().nonnegative().nullable(),
	pageSize: z.int32().positive(),
	totalPages: z.int32().nonnegative().nullable(),
	totalElements: z.int32().nonnegative().nullable()
})

export const wayfairListInventoryAdjustmentsOutputSchema = z.object({
	items: z.array(wayfairInventoryAdjustmentSchema),
	page: wayfairInventoryAdjustmentPageInfoSchema.shape.pageNumber,
	page_size: wayfairInventoryAdjustmentPageInfoSchema.shape.pageSize,
	total_pages: wayfairInventoryAdjustmentPageInfoSchema.shape.totalPages,
	total_elements: wayfairInventoryAdjustmentPageInfoSchema.shape.totalElements
})

export const wayfairInventoryAdjustmentsResponseSchema = z.object({
	data: z
		.object({
			inventoryAdjustmentList: z.object({
				pageInfo: wayfairInventoryAdjustmentPageInfoSchema,
				nodes: z.array(wayfairInventoryAdjustmentSchema)
			})
		})
		.nullish(),
	errors: z.array(wayfairGraphqlErrorSchema).optional()
})

export type WayfairInventoryPosition = z.infer<typeof wayfairInventoryPositionSchema>
export type WayfairInventorySummary = z.infer<typeof wayfairInventorySummarySchema>
export type WayfairInventoryAdjustment = z.infer<typeof wayfairInventoryAdjustmentSchema>
export type WayfairListInventorySummaryInput = z.infer<typeof wayfairListInventorySummaryInputSchema>
export type WayfairListInventorySummaryOutput = z.infer<typeof wayfairListInventorySummaryOutputSchema>
export type WayfairListInventoryAdjustmentsInput = z.infer<typeof wayfairListInventoryAdjustmentsInputSchema>
export type WayfairListInventoryAdjustmentsOutput = z.infer<typeof wayfairListInventoryAdjustmentsOutputSchema>

export const wayfairInventoryFeedItemSchema = z.strictObject({
	supplier_id: z.int32().positive().describe('Supplier or warehouse owning this inventory'),
	supplier_part_number: z.string().min(1).describe('Exact supplier part number'),
	quantity_on_hand: z
		.int32()
		.min(-1)
		.describe('Available units; -1 is reserved for eligible distributors with variable lead times'),
	quantity_backordered: z.int32().optional().describe('Backordered units'),
	quantity_on_order: z.int32().optional().describe('Units allocated to open orders'),
	item_next_availability_date: z
		.string()
		.min(1)
		.optional()
		.describe('Next availability, preferably MM-DD-YYYY HH:mm:ss in UTC; ISO 8601 is also documented'),
	product_name_and_options: z.string().optional().describe('Product name and options'),
	discontinued: z.boolean().optional().describe('Whether this product is discontinued; defaults to false upstream')
})
export const wayfairSaveInventoryInputSchema = z.strictObject({
	inventory: z
		.array(wayfairInventoryFeedItemSchema)
		.min(1)
		.describe('Inventory feed lines; sandbox accepts at most 500 lines'),
	feed_kind: z
		.enum(['DIFFERENTIAL', 'TRUE_UP'])
		.describe('Differential changes or a complete true-up feed; sandbox supports only TRUE_UP'),
	dry_run: z.boolean().describe('Validate without applying inventory changes when true; false submits the feed')
})
export const wayfairSaveInventoryResponseSchema = z.object({
	data: z.object({ inventory: z.object({ save: wayfairTransactionStatusSchema.nullish() }).nullish() }).nullish(),
	errors: z.array(wayfairGraphqlErrorSchema).optional()
})
export const wayfairWeightInputSchema = z.strictObject({
	value: z.number().positive().describe('Package weight'),
	unit: z.enum(['POUNDS', 'KILOGRAMS']).describe('Weight unit')
})
const wayfairMeasurementInputSchema = z.strictObject({
	value: z.number().positive().describe('Length measurement'),
	unit: z.enum(['INCHES', 'CENTIMETERS']).optional().describe('Length unit')
})
export const wayfairDimensionsInputSchema = z.strictObject({
	length: wayfairMeasurementInputSchema.describe('Package length'),
	width: wayfairMeasurementInputSchema.describe('Package width'),
	height: wayfairMeasurementInputSchema.describe('Package height')
})
const wayfairFreightClassSchema = z.enum([
	'CODE_500',
	'CODE_400',
	'CODE_300',
	'CODE_250',
	'CODE_200',
	'CODE_175',
	'CODE_150',
	'CODE_125',
	'CODE_110',
	'CODE_100',
	'CODE_92_5',
	'CODE_85',
	'CODE_77_5',
	'CODE_70',
	'CODE_65',
	'CODE_60',
	'CODE_55',
	'CODE_50'
])
export const wayfairRegistrationShippingUnitSchema = z.strictObject({
	part_number: z.string().min(1).describe('Ordered supplier part number'),
	unit_type: z.enum(['CARTON', 'BAG', 'ROLL', 'OTHER']).describe('Shipping unit type'),
	weight: wayfairWeightInputSchema.describe('Package weight'),
	dimensions: wayfairDimensionsInputSchema.describe('Package dimensions'),
	freight_class: wayfairFreightClassSchema.optional().describe('Shipping freight class'),
	pallet_info: z
		.strictObject({ weight: wayfairWeightInputSchema.describe('Additional pallet weight') })
		.optional()
		.describe('Provide only for palletized shipping units'),
	group_identifier: wayfairPositiveIntSchema.describe('Identifies one instance of the ordered part'),
	sequence_identifier: wayfairPositiveIntSchema.describe('Unique box number within this part instance')
})
export const wayfairRegistrationPackageUnitSchema = z.strictObject({
	unit_type: z.enum(['CARTON', 'BAG', 'ROLL', 'OTHER']).describe('Package type'),
	weight: wayfairWeightInputSchema.describe('Package weight'),
	dimensions: wayfairDimensionsInputSchema.describe('Package dimensions'),
	freight_class: wayfairFreightClassSchema.optional().describe('Shipping freight class'),
	contained_parts: z
		.array(
			z.strictObject({
				part_number: z.string().min(1).describe('Supplier part number in the package'),
				group_identifier: wayfairPositiveIntSchema.describe('Identifies one instance of this ordered part')
			})
		)
		.min(1)
		.describe('Ordered parts packed together')
})
export const wayfairRegisterShipmentInputSchema = z
	.strictObject({
		po_number: z.string().min(1).describe('Purchase order to register for shipment'),
		warehouse_id: wayfairIdentifierSchema.optional().describe('Pickup warehouse; defaults to the order warehouse'),
		request_for_pickup_date: wayfairTimestampSchema
			.optional()
			.describe('Ready-for-pickup date-time; defaults to registration time upstream'),
		shipping_units: z
			.array(wayfairRegistrationShippingUnitSchema)
			.min(1)
			.optional()
			.describe('Individual part shipping units; omit to use catalog data'),
		package_units: z
			.array(wayfairRegistrationPackageUnitSchema)
			.min(1)
			.optional()
			.describe('Alternative package-level packing details')
	})
	.refine((input) => !(input.shipping_units && input.package_units), 'Use shipping_units or package_units, not both')
export const wayfairLabelEventFilterSchema = z.strictObject({
	field: z.enum(['id', 'eventDate', 'pickupDate', 'poNumber']).describe('Label event field to filter'),
	conjunction: z.enum(['AND', 'OR']).optional().describe('Conjunction with other filters; defaults to AND'),
	equals: z.string().optional().describe('Equal-to value'),
	greater_than: z.string().optional().describe('Exclusive lower bound'),
	greater_than_or_equal_to: z.string().optional().describe('Inclusive lower bound'),
	less_than: z.string().optional().describe('Exclusive upper bound'),
	less_than_or_equal_to: z.string().optional().describe('Inclusive upper bound'),
	not_equal_to: z.string().optional().describe('Excluded value'),
	in: z.array(z.string()).optional().describe('Allowed values'),
	not_in: z.array(z.string()).optional().describe('Excluded values'),
	is_null: z.boolean().optional().describe('Match null when true, non-null when false')
})
export const wayfairListLabelGenerationEventsInputSchema = z.strictObject({
	filters: z.array(wayfairLabelEventFilterSchema).optional().describe('Filters for previously registered shipments'),
	ordering: z
		.array(
			z.strictObject({
				asc: z.string().min(1).optional().describe('Field to order ascending'),
				desc: z.string().min(1).optional().describe('Field to order descending')
			})
		)
		.optional()
		.describe('Ordering priorities, highest first'),
	limit: wayfairPositiveIntSchema.optional().describe('Maximum events returned; defaults to 10'),
	offset: z.int32().nonnegative().optional().describe('Zero-based result offset; defaults to 0')
})
export const wayfairLabelGenerationEventSchema = z.object({
	id: wayfairIdentifierSchema,
	eventDate: z.string(),
	pickupDate: z.string(),
	poNumber: wayfairIdentifierSchema,
	billOfLading: z.object({ url: z.string() }),
	consolidatedShippingLabel: z.object({ url: z.string() }),
	customsDocument: z.object({ required: z.boolean(), url: z.string().nullable() }),
	generatedShippingLabels: z.array(
		z
			.object({
				poNumber: wayfairIdentifierSchema,
				fullPoNumber: z.string(),
				numberOfLabels: z.int32(),
				carrier: z.string(),
				carrierCode: z.string(),
				trackingNumber: z.string()
			})
			.nullable()
	),
	shippingLabelInfo: z.array(
		z.object({ carrier: z.string(), carrierCode: z.string(), trackingNumber: z.string() }).nullable()
	),
	shippingUnits: z.array(
		z.object({
			groupIdentifier: z.int32(),
			sequenceIdentifier: z.int32(),
			part: z.object({ supplierPartNumber: z.string(), upc: z.string().nullable() })
		})
	)
})
export const wayfairListLabelGenerationEventsOutputSchema = z.object({
	items: z.array(wayfairLabelGenerationEventSchema),
	limit: z.int().positive(),
	offset: z.int().nonnegative(),
	limit_reached: z.boolean()
})
export const wayfairListLabelGenerationEventsResponseSchema = z.object({
	data: z.object({ labelGenerationEvents: z.array(wayfairLabelGenerationEventSchema) }).nullish(),
	errors: z.array(wayfairGraphqlErrorSchema).optional()
})
export const wayfairRegisterShipmentResponseSchema = z.object({
	data: z
		.object({ purchaseOrders: z.object({ register: wayfairLabelGenerationEventSchema.nullish() }).nullish() })
		.nullish(),
	errors: z.array(wayfairGraphqlErrorSchema).optional()
})
export const wayfairDownloadDocumentInputSchema = z.strictObject({
	po_number: z
		.string()
		.min(1)
		.refine((value) => value !== '.' && value !== '..', 'Invalid purchase order')
		.describe('Registered purchase order number'),
	max_bytes: z.int().positive().describe('Maximum document bytes to retrieve')
})
export const wayfairStoreDocumentInputSchema = wayfairDownloadDocumentInputSchema.extend({
	output_key: z.string().min(1).describe('Destination artifact key for the document')
})
export const wayfairDocumentBytesSchema = z.object({
	bytes: z.custom<Uint8Array>((value) => value instanceof Uint8Array),
	media_type: z.string(),
	byte_length: z.int().nonnegative()
})
export const wayfairDocumentOutputSchema = z.object({ artifact: artifactRefSchema })
export const wayfairGetConsolidatedBolInputSchema = z.strictObject({
	date: z.iso.date().describe('Shipment date for the consolidated bill of lading')
})
export const wayfairConsolidatedBolSchema = z.object({
	availability: z.enum(['AVAILABLE', 'NOT_FOUND']),
	url: z.string().nullable(),
	bolNumber: z.string().nullable(),
	linkExpirationDatetime: z.string().nullable(),
	shipmentReferences: z.array(z.string().nullable()).nullable()
})
export const wayfairConsolidatedBolResponseSchema = z.object({
	data: z.object({ consolidatedBolDocument: wayfairConsolidatedBolSchema }).nullish(),
	errors: z.array(wayfairGraphqlErrorSchema).optional()
})
export const wayfairListCastleGateOrdersInputSchema = z.strictObject({
	limit: wayfairPositiveIntSchema.optional().describe('Maximum CastleGate orders; defaults to 10'),
	has_response: z.boolean().optional().describe('False for unacknowledged orders, true for acknowledged orders'),
	from_date: wayfairTimestampSchema.optional().describe('Starting purchase order date-time'),
	po_numbers: z.array(z.string().min(1)).min(1).optional().describe('Exact CastleGate purchase order numbers'),
	sort_order: z.enum(['ASC', 'DESC']).optional().describe('Purchase order date sort order; defaults to ASC')
})
export const wayfairListCastleGateShippingAdvicesInputSchema = z.strictObject({
	limit: wayfairPositiveIntSchema.optional().describe('Maximum shipping advices; defaults to 10'),
	has_response: z.boolean().optional().describe('Filter by whether receipt was acknowledged'),
	from_date: wayfairTimestampSchema.optional().describe('Starting shipping advice creation date-time'),
	wsa_ids: z.array(z.string().min(1)).min(1).optional().describe('Exact warehouse shipping advice IDs'),
	sort_order: z.enum(['ASC', 'DESC']).optional().describe('Creation-date sort order; defaults to ASC')
})
export const wayfairAcknowledgeCastleGateOrderInputSchema = z.strictObject({
	po_number: z.string().min(1).describe('CastleGate purchase order whose receipt is being acknowledged')
})
export const wayfairAcknowledgeCastleGateShippingAdvicesInputSchema = z.strictObject({
	wsa_ids: z
		.array(z.string().min(1))
		.min(1)
		.describe('Warehouse shipping advice IDs whose receipt is being acknowledged')
})
export const wayfairCastleGateOrderSchema = z.object({
	id: wayfairIdentifierSchema.nullish(),
	poNumber: z.string().nullish(),
	poDate: z.string().nullish(),
	orderId: wayfairIdentifierSchema.nullish(),
	supplierId: wayfairIdentifierSchema.nullish(),
	estimatedShipDate: z.string().nullish(),
	scheduledDeliveryDate: z.string().nullish(),
	shippingInfo: z.object({ shipSpeed: wayfairShipSpeedSchema.nullish(), carrierCode: z.string().nullish() }).nullish(),
	products: z
		.array(
			z
				.object({
					partNumber: z.string().nullish(),
					quantity: wayfairPurchaseOrderProductRawSchema.shape.quantity.nullish(),
					price: z.number().nullish(),
					name: z.string().nullish(),
					sku: z.string().nullish()
				})
				.nullable()
		)
		.nullish(),
	shipTo: wayfairAddressRawSchema,
	billTo: wayfairAddressRawSchema
})
const wayfairShippingAdviceAddressSchema = wayfairAddressRawSchema.extend({
	title: z.string().nullish(),
	company: z.string().nullish()
})
export const wayfairCastleGateShippingAdviceSchema = z.object({
	wsaId: z.string().nullish(),
	supplierId: z.int32().nullish(),
	poNumber: z.string().nullish(),
	fulfillmentCustomerOrderNumber: z.string().nullish(),
	fulfillmentCustomerId: z.int32().nullish(),
	retailerOrderNumber: z.string().nullish(),
	fulfillmentPurchaseOrderNumber: z.string().nullish(),
	creationDate: z.string().nullish(),
	shipDate: z.string().nullish(),
	shipSpeed: z.string().nullish(),
	carrierCode: z.string().nullish(),
	totalShipmentWeight: z.number().nullish(),
	totalQuantity: z.int32().nullish(),
	clientNumber: z.string().nullish(),
	warehouseId: z.int32().nullish(),
	actionDate: z.string().nullish(),
	transactionHandle: z.string().nullish(),
	packages: z
		.array(z.object({ packageWeight: z.number().nullish(), trackingNumber: z.string().nullish() }).nullable())
		.nullish(),
	shipFrom: wayfairShippingAdviceAddressSchema.nullish(),
	shipTo: wayfairShippingAdviceAddressSchema.nullish(),
	products: z
		.array(
			z
				.object({
					quantityOrdered: z.int32().nullish(),
					partNumber: z.string().nullish(),
					name: z.string().nullish(),
					quantityShipped: z.int32().nullish(),
					upc: z.string().nullish(),
					sku: z.string().nullish(),
					forceQuantityMultiplier: z.int32().nullish()
				})
				.nullable()
		)
		.nullish()
})
export const wayfairListCastleGateOrdersOutputSchema = z.object({
	items: z.array(wayfairCastleGateOrderSchema.nullable()).nullable(),
	limit: z.int().positive(),
	limit_reached: z.boolean()
})
export const wayfairListCastleGateShippingAdvicesOutputSchema = z.object({
	items: z.array(wayfairCastleGateShippingAdviceSchema.nullable()).nullable(),
	limit: z.int().positive(),
	limit_reached: z.boolean()
})
export const wayfairCastleGateOrdersResponseSchema = z.object({
	data: z
		.object({ getCastleGatePurchaseOrders: z.array(wayfairCastleGateOrderSchema.nullable()).nullable() })
		.nullish(),
	errors: z.array(wayfairGraphqlErrorSchema).optional()
})
export const wayfairCastleGateShippingAdvicesResponseSchema = z.object({
	data: z
		.object({
			getCastleGateWarehouseShippingAdvice: z.array(wayfairCastleGateShippingAdviceSchema.nullable()).nullable()
		})
		.nullish(),
	errors: z.array(wayfairGraphqlErrorSchema).optional()
})
export const wayfairAcknowledgeCastleGateOrderResponseSchema = z.object({
	data: z
		.object({ purchaseOrders: z.object({ acknowledgeCastleGate: wayfairTransactionStatusSchema.nullish() }).nullish() })
		.nullish(),
	errors: z.array(wayfairGraphqlErrorSchema).optional()
})
export const wayfairAcknowledgeCastleGateShippingAdvicesResponseSchema = z.object({
	data: z
		.object({
			purchaseOrders: z
				.object({ acknowledgeCastleGateWarehouseShippingAdvice: wayfairTransactionStatusSchema.nullish() })
				.nullish()
		})
		.nullish(),
	errors: z.array(wayfairGraphqlErrorSchema).optional()
})
export type WayfairSaveInventoryInput = z.infer<typeof wayfairSaveInventoryInputSchema>
export type WayfairRegisterShipmentInput = z.infer<typeof wayfairRegisterShipmentInputSchema>
export type WayfairListLabelGenerationEventsInput = z.infer<typeof wayfairListLabelGenerationEventsInputSchema>
export type WayfairListLabelGenerationEventsOutput = z.infer<typeof wayfairListLabelGenerationEventsOutputSchema>
export type WayfairLabelGenerationEvent = z.infer<typeof wayfairLabelGenerationEventSchema>
export type WayfairDownloadDocumentInput = z.infer<typeof wayfairDownloadDocumentInputSchema>
export type WayfairStoreDocumentInput = z.infer<typeof wayfairStoreDocumentInputSchema>
export type WayfairDocumentBytes = z.infer<typeof wayfairDocumentBytesSchema>
export type WayfairGetConsolidatedBolInput = z.infer<typeof wayfairGetConsolidatedBolInputSchema>
export type WayfairConsolidatedBol = z.infer<typeof wayfairConsolidatedBolSchema>
export type WayfairListCastleGateOrdersInput = z.infer<typeof wayfairListCastleGateOrdersInputSchema>
export type WayfairListCastleGateOrdersOutput = z.infer<typeof wayfairListCastleGateOrdersOutputSchema>
export type WayfairListCastleGateShippingAdvicesInput = z.infer<typeof wayfairListCastleGateShippingAdvicesInputSchema>
export type WayfairListCastleGateShippingAdvicesOutput = z.infer<
	typeof wayfairListCastleGateShippingAdvicesOutputSchema
>
export type WayfairAcknowledgeCastleGateOrderInput = z.infer<typeof wayfairAcknowledgeCastleGateOrderInputSchema>
export type WayfairAcknowledgeCastleGateShippingAdvicesInput = z.infer<
	typeof wayfairAcknowledgeCastleGateShippingAdvicesInputSchema
>

export const wayfairDateIntervalInputSchema = z
	.strictObject({
		from: z.iso.datetime({ offset: true }).optional().describe('Inclusive starting RFC 3339 date-time with timezone'),
		to: z.iso.datetime({ offset: true }).optional().describe('Ending RFC 3339 date-time with timezone')
	})
	.refine(
		(value) => !value.from || !value.to || Date.parse(value.from) <= Date.parse(value.to),
		'from must not be after to'
	)

export const wayfairFulfillmentAddressInputSchema = z
	.strictObject({
		name: z.string().min(1).max(30).describe('Recipient name, at most 30 characters'),
		address1: z.string().min(1).max(35).describe('First address line, at most 35 characters'),
		address2: z.string().max(35).optional().describe('Second address line, at most 35 characters'),
		city: z.string().min(1).describe('City'),
		state_short_name: z.string().min(1).optional().describe('State or region code; required for US addresses'),
		postal_code: z.string().min(1).describe('Postal code'),
		country_short_name: z.string().min(1).describe('Country code, such as US'),
		phone_number: z.string().min(1).optional().describe('Recipient phone number valid for the country'),
		company_name: z.string().optional().describe('Recipient company')
	})
	.refine(
		(value) => value.country_short_name !== 'US' || Boolean(value.state_short_name),
		'US addresses require state_short_name'
	)
export const wayfairFulfillmentBillingAddressInputSchema = z
	.strictObject({
		name: z.string().min(1).describe('Billing name'),
		address1: z.string().min(1).describe('First billing address line'),
		address2: z.string().optional().describe('Second billing address line'),
		city: z.string().min(1).describe('Billing city'),
		state_short_name: z.string().min(1).optional().describe('State or region; required for US addresses'),
		postal_code: z.string().min(1).describe('Billing postal code'),
		country_short_name: z.string().min(1).describe('Billing country code')
	})
	.refine(
		(value) => value.country_short_name !== 'US' || Boolean(value.state_short_name),
		'US addresses require state_short_name'
	)
export const wayfairCreateFulfillmentOrderInputSchema = z.strictObject({
	seller_fulfillment_order_id: z
		.string()
		.min(1)
		.optional()
		.describe('Unique seller order ID to prevent accidental duplicate orders'),
	billing_address: wayfairFulfillmentBillingAddressInputSchema.optional().describe('Billing address when required'),
	customer: z
		.strictObject({ order_number: z.string().min(1).describe('End-customer order number') })
		.describe('Customer order reference'),
	items: z
		.array(
			z.strictObject({
				supplier_product_name: z.string().optional().describe('Supplier product name'),
				supplier_part_number: z.string().min(1).describe('Supplier part number'),
				quantity: z.int32().positive().describe('Units to fulfill'),
				fulfillment_warehouse_id: z.int32().optional().describe('Optional eligible CastleGate warehouse ID')
			})
		)
		.min(1)
		.describe('Items to fulfill from CastleGate inventory'),
	retailer: z
		.strictObject({
			retailer_id: z.int32().describe('Retailer identifier'),
			order_number: z.string().min(1).describe('Retailer order number')
		})
		.describe('Retailer reference'),
	shipping_address: wayfairFulfillmentAddressInputSchema.describe('Delivery address'),
	shipping_details: z
		.strictObject({
			shipping_account_number: z.string().optional().describe('Shipping account number for this order'),
			carrier_scac: z.string().optional().describe('Carrier Standard Carrier Alpha Code'),
			ship_speed_code: z.string().optional().describe('Shipping service code')
		})
		.describe('Shipping preferences'),
	delivery_signature_required: z.boolean().optional().describe('Require a delivery signature when true')
})
export const wayfairGetFulfillmentOrderInputSchema = z.strictObject({
	request_id: z.string().min(1).describe('fulfillmentOrderRequestId returned by order creation'),
	locale: z.string().min(1).optional().describe('Locale for translated order statuses')
})
export const wayfairCancelFulfillmentOrderInputSchema = z.strictObject({
	request_id: z.string().min(1).describe('Fulfillment request ID, also called aggregatorOrderId')
})
export const wayfairListFulfillmentOrdersInputSchema = z.strictObject({
	locale: z.string().min(1).optional().describe('Locale for translated statuses'),
	status: z
		.array(
			z.enum([
				'PENDING',
				'INITIATED',
				'NEW',
				'ALLOCATED',
				'PARTIALLY_SHIPPED',
				'SHIPPED',
				'REJECTED',
				'ON_HOLD',
				'CANCELLED'
			])
		)
		.optional()
		.describe('Fulfillment statuses to include'),
	retailer_ids: z.array(z.string().min(1)).optional().describe('Retailer IDs to include'),
	retailer_order_numbers: z.array(z.string().min(1)).optional().describe('Retailer order numbers to include'),
	order_creation_date_interval: wayfairDateIntervalInputSchema.optional().describe('Order creation date window'),
	shipping_date_interval: wayfairDateIntervalInputSchema.optional().describe('Actual shipping date window'),
	expected_shipping_date_interval: wayfairDateIntervalInputSchema.optional().describe('Expected shipping date window'),
	sort_by: z
		.enum(['ORDER_CREATION_DATE', 'SHIPPING_DATE', 'EXPECTED_SHIPPING_DATE'])
		.optional()
		.describe('Sort field; defaults to ORDER_CREATION_DATE'),
	sort_order: z.enum(['ASC', 'DESC']).optional().describe('Sort direction; defaults to DESC'),
	page: z.int32().positive().optional().describe('One-based page; defaults to 1'),
	page_size: z.int32().min(1).max(100).optional().describe('Results per page, 1–100; defaults to 10')
})
export const wayfairListFulfillmentShippingAdvicesInputSchema = z.strictObject({
	fulfillment_order_item_ids: z.array(z.string().min(1)).optional().describe('Fulfillment order item IDs to include'),
	date_interval: wayfairDateIntervalInputSchema.optional().describe('Shipping advice date window'),
	sort_order: z.enum(['ASC', 'DESC']).optional().describe('Shipping advice date direction; defaults to DESC'),
	page: z.int32().positive().optional().describe('One-based page; defaults to 1'),
	page_size: z.int32().min(1).max(100).optional().describe('Results per page, 1–100; defaults to 50')
})
const wayfairFulfillmentErrorSchema = z.object({
	code: z.string().nullish(),
	message: z.string().nullish(),
	field: z.string().nullish(),
	value: z.string().nullish()
})
const wayfairFulfillmentItemSchema = z.object({
	fulfillmentOrderItemId: z.string().nullish(),
	productId: z.string().nullish(),
	partNumber: z.string().nullish(),
	supplierProductName: z.string().nullish(),
	supplierPartNumber: z.string().nullish(),
	srcCategory: z.string().nullish(),
	status: z.string().nullish(),
	statusLabel: z.string().nullish(),
	failureReasons: z.array(z.string().nullable()).nullish(),
	quantityOrdered: z.int32().nullish(),
	quantityShipped: z.int32().nullish(),
	option: z.string().nullish(),
	forcedQuantityMultiplier: z.number().nullish(),
	unitPrice: z.number().nullish(),
	expectedShippingDate: z.string().nullish(),
	trackingNumbers: z.array(z.string()).nullish(),
	errors: z
		.array(
			z
				.object({
					errorType: z.string(),
					errorSource: z.string(),
					errorCode: z.string().nullish(),
					errorMessage: z.string().nullish()
				})
				.nullable()
		)
		.nullish()
})
const wayfairFulfillmentAddressSchema = z.object({
	name: z.string().nullish(),
	address1: z.string().nullish(),
	address2: z.string().nullish(),
	city: z.string().nullish(),
	stateShortName: z.string().nullish(),
	postalCode: z.string().nullish(),
	countryShortName: z.string().nullish(),
	companyName: z.string().nullish()
})
const wayfairFulfillmentRetailerSchema = z.object({
	name: z.string().nullish(),
	retailerId: z.string().nullish(),
	orderNumber: z.string().nullish()
})
export const wayfairFulfillmentOrderDetailsSchema = z.object({
	fulfillmentOrder: z.object({
		requestId: z.string(),
		status: z.string(),
		statusLabel: z.string(),
		billingType: z.enum(['PICK_ONLY', 'PICK_AND_SHIP']).nullish(),
		orderDate: z.string().nullish(),
		customerOrderNumber: z.string().nullish(),
		retailer: wayfairFulfillmentRetailerSchema.nullish(),
		shippingAddress: wayfairFulfillmentAddressSchema.nullish(),
		fulfillmentOrderItems: z.array(wayfairFulfillmentItemSchema).nullish()
	}),
	fulfillmentOrderErrors: z.array(wayfairFulfillmentErrorSchema).nullish()
})
const wayfairFulfillmentPageInfoSchema = z.object({
	hasNextPage: z.boolean(),
	hasPreviousPage: z.boolean(),
	totalPages: z.int32(),
	totalItems: z.int32()
})
export const wayfairListFulfillmentOrdersOutputSchema = z.object({
	nodes: z.array(wayfairFulfillmentOrderDetailsSchema),
	pageInfo: wayfairFulfillmentPageInfoSchema.nullish()
})
export const wayfairFulfillmentShippingAdviceSchema = z.object({
	fulfillmentOrderItemId: z.string(),
	warehouseShippingAdviceDate: z.string().nullish(),
	fulfillmentOrderRequestId: z.string().nullish(),
	fulfillmentPurchaseOrderNumber: z.string().nullish(),
	supplierId: z.int32().nullish(),
	retailer: wayfairFulfillmentRetailerSchema,
	productDetails: wayfairFulfillmentItemSchema.nullish(),
	shippingDetails: z
		.object({
			shippingAddress: wayfairFulfillmentAddressSchema.nullish(),
			shippingFromAddress: wayfairFulfillmentAddressSchema.nullish(),
			warehouse: z.object({ warehouseId: z.int32().nullish(), name: z.string().nullish() }).nullish()
		})
		.nullish(),
	tracking: z
		.object({
			carrier: z.string().nullish(),
			carrierScac: z.string().nullish(),
			expectedShippingDate: z.string().nullish(),
			shippingDate: z.string().nullish(),
			shipSpeed: z.string().nullish(),
			shipSpeedCode: z.string().nullish(),
			trackingNumbers: z.array(z.string()).nullish()
		})
		.nullish()
})
export const wayfairListFulfillmentShippingAdvicesOutputSchema = z.object({
	nodes: z.array(wayfairFulfillmentShippingAdviceSchema),
	pageInfo: wayfairFulfillmentPageInfoSchema.nullish()
})
export const wayfairCreateFulfillmentOrderOutputSchema = z.object({
	fulfillmentOrderRequestId: z.string().nullish(),
	requestStatus: z.enum(['ACCEPTED', 'FAILURE']),
	errors: z.array(wayfairFulfillmentErrorSchema).nullish()
})
const wayfairFulfillmentCancellationErrorSchema = z.object({
	errorCode: z.string().nullish(),
	errorMessage: z.string().nullish(),
	errorField: z.string().nullish(),
	errorValue: z.string().nullish()
})
export const wayfairCancelFulfillmentOrderOutputSchema = z.object({
	aggregatorOrderId: z.string(),
	errors: z.array(wayfairFulfillmentCancellationErrorSchema).nullish(),
	results: z
		.array(
			z.object({
				fulfillmentOrderItemId: z.string(),
				supplierPartNumber: z.string().nullish(),
				requestStatus: z.enum(['SUCCESS', 'FAILURE']),
				errors: z.array(wayfairFulfillmentCancellationErrorSchema).nullish()
			})
		)
		.nullish()
})
export const wayfairGetFulfillmentOrderResponseSchema = z.object({
	data: z.object({ fulfillmentOrderDetails: wayfairFulfillmentOrderDetailsSchema.nullable() }).nullish(),
	errors: z.array(wayfairGraphqlErrorSchema).optional()
})
export const wayfairListFulfillmentOrdersResponseSchema = z.object({
	data: z.object({ fulfillmentOrderDetailsList: wayfairListFulfillmentOrdersOutputSchema }).nullish(),
	errors: z.array(wayfairGraphqlErrorSchema).optional()
})
export const wayfairListFulfillmentShippingAdvicesResponseSchema = z.object({
	data: z.object({ warehouseShippingAdvices: wayfairListFulfillmentShippingAdvicesOutputSchema }).nullish(),
	errors: z.array(wayfairGraphqlErrorSchema).optional()
})
export const wayfairCreateFulfillmentOrderResponseSchema = z.object({
	data: z.object({ createFulfillmentOrder: wayfairCreateFulfillmentOrderOutputSchema }).nullish(),
	errors: z.array(wayfairGraphqlErrorSchema).optional()
})
export const wayfairCancelFulfillmentOrderResponseSchema = z.object({
	data: z.object({ cancelFulfillmentOrder: wayfairCancelFulfillmentOrderOutputSchema }).nullish(),
	errors: z.array(wayfairGraphqlErrorSchema).optional()
})
export const wayfairListInboundOrdersInputSchema = z.strictObject({
	status: z.enum(['OPEN', 'COMPLETED', 'CANCELLED']).describe('Inbound order state to retrieve'),
	limit: z.int32().positive().optional().describe('Maximum results; defaults to 10'),
	offset: z.int32().nonnegative().optional().describe('Native pagination offset; defaults to 0'),
	sort_order: z
		.enum(['ASCENDING', 'DESCENDING'])
		.optional()
		.describe('Creation date sort direction; defaults to ASCENDING'),
	filters: z
		.strictObject({
			inbound_order_id: z.string().optional().describe('Inbound order ID'),
			legacy_order_id: z.string().optional().describe('Legacy order ID'),
			supplier_purchase_order_id: z.string().optional().describe('Supplier purchase order ID'),
			estimated_cargo_ready_date: wayfairDateIntervalInputSchema.optional().describe('Estimated cargo-ready window'),
			created_date: wayfairDateIntervalInputSchema.optional().describe('Creation date window'),
			services: z
				.enum([
					'OCEAN',
					'ORIGIN_TRUCKING',
					'DESTINATION_DRAY',
					'CONSOLIDATION',
					'DESTINATION_X_DOCK',
					'ORIGIN_DRAY',
					'DESTINATION_TRUCKING',
					'CG_INDUCTION',
					'UNKNOWN'
				])
				.optional()
				.describe('Logistics service'),
			receiving_reference_id: z.string().optional().describe('Receiving reference ID'),
			supplier_part_number: z.string().optional().describe('Supplier part number'),
			inbound_shipment_id: z.string().optional().describe('Inbound shipment ID'),
			bill_of_lading: z.string().optional().describe('Bill of lading identifier')
		})
		.optional()
		.describe('Optional inbound order filters')
})
const wayfairInboundCompanySchema = z.object({
	name: z.string(),
	type: z.string(),
	address: z
		.object({
			addressLine1: z.string().nullish(),
			addressLine2: z.string().nullish(),
			city: z.string().nullish(),
			province: z.string().nullish(),
			country: z.string().nullish(),
			postalCode: z.string().nullish()
		})
		.nullish()
})
export const wayfairInboundOrderSchema = z.object({
	orderId: z.string(),
	supplierOrderNumber: z.string().nullish(),
	orderStatus: z.enum(['OPEN', 'COMPLETED', 'CANCELLED']),
	estimatedCargoReadyDate: z.string().nullish(),
	createdDate: z.string().nullish(),
	destinationName: z.string().nullish(),
	bookings: z.array(
		z.object({
			shippingOrderReceivedDate: z.string().nullish(),
			shippingOrderConfirmedDate: z.string().nullish(),
			shipments: z.array(
				z.object({
					shipmentId: z.string(),
					receivingIds: z.array(z.string().nullable()).nullish(),
					masterBillOfLading: z.string().nullish(),
					houseBillOfLading: z.string().nullish(),
					containerNumber: z.string().nullish(),
					containerType: z.string(),
					originPortCode: z.string().nullish(),
					destinationPortCode: z.string().nullish(),
					trackingStatus: z.string(),
					legStops: z.array(
						z.object({
							locationName: z.string(),
							shipmentJourneyPortCode: z.string().nullish(),
							shipmentJourney: z.array(z.object({ type: z.string(), timestamp: z.string() }))
						})
					)
				})
			)
		})
	),
	shipper: wayfairInboundCompanySchema.nullish(),
	carrier: wayfairInboundCompanySchema.nullish()
})
export const wayfairListInboundOrdersOutputSchema = z.object({
	items: z.array(wayfairInboundOrderSchema.nullable()).nullable(),
	limit: z.int32().positive(),
	offset: z.int32().nonnegative(),
	limit_reached: z.boolean()
})
export const wayfairListInboundOrdersResponseSchema = z.object({
	data: z
		.object({
			inboundOrderList: z.object({ inboundOrders: z.array(wayfairInboundOrderSchema.nullable()).nullable() }).nullable()
		})
		.nullish(),
	errors: z.array(wayfairGraphqlErrorSchema).optional()
})
const wayfairAdvertisingDateSchema = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2}:\d{2})?$/)
	.refine(
		(value) =>
			z.iso.datetime().safeParse(`${value.replace(' ', 'T')}${value.length === 10 ? 'T00:00:00' : ''}Z`).success,
		'Invalid advertising date'
	)
export const wayfairGenerateAdvertisingReportInputSchema = z.strictObject({
	name: z.string().min(1).max(250).describe('Report filename, at most 250 characters'),
	report_type: z
		.enum(['CAMPAIGN_REPORT', 'LISTING_REPORT'])
		.describe('Campaign aggregates or listing-level performance'),
	file_type: z.enum(['CSV', 'EXCEL']).describe('Report format'),
	filters: z
		.strictObject({
			start_date: wayfairAdvertisingDateSchema.optional().describe('Start date, yyyy-MM-dd or yyyy-MM-dd HH:mm:ss'),
			end_date: wayfairAdvertisingDateSchema.optional().describe('End date, yyyy-MM-dd or yyyy-MM-dd HH:mm:ss')
		})
		.refine(
			(value) =>
				!value.start_date ||
				!value.end_date ||
				value.start_date.padEnd(19, ' 00:00:00') <= value.end_date.padEnd(19, ' 00:00:00'),
			'start_date must not be after end_date'
		)
		.describe('Report date filters'),
	attribution_window: z
		.union([z.literal(14), z.literal(28), z.literal(56)])
		.optional()
		.describe('Attribution window in days; defaults to 14'),
	group_by: z.enum(['DAY', 'WEEK', 'MONTH', 'NONE']).describe('Report grouping'),
	program: z.enum(['WSP', 'WSS']).describe('Advertising program')
})
export const wayfairGenerateAdvertisingReportOutputSchema = z.object({ id: z.string().min(1) })
export const wayfairGetAdvertisingReportInputSchema = z.strictObject({
	report_id: z.string().min(1).describe('Report ID returned by generation')
})
export const wayfairAdvertisingReportStatusSchema = z.object({
	status: z.string().min(1),
	url: z.string().nullish()
})
export const wayfairCampaignListingInputSchema = z
	.strictObject({
		status: z
			.enum(['ADD', 'PAUSE', 'ACTIVATE', 'ARCHIVE'])
			.optional()
			.describe('Listing change intent; preferred over is_active'),
		bid: z
			.string()
			.regex(/^\d+(?:\.\d+)?$/)
			.refine((value) => Number(value) >= 0.05 && Number(value) <= 10000, 'Bid must be 0.05–10000')
			.optional()
			.describe('Bid as a decimal string; allowed only for manual/fixed bid updates or ADD, never TARGET_ROAS'),
		is_active: z
			.boolean()
			.optional()
			.describe('Legacy active state; required without status and must agree with status when provided')
	})
	.superRefine((value, ctx) => {
		if (!value.status && value.is_active === undefined)
			ctx.addIssue({ code: 'custom', message: 'Legacy updates require is_active' })
		if (value.status && value.status !== 'ADD' && value.bid !== undefined)
			ctx.addIssue({ code: 'custom', message: 'Only ADD permits a bid on a status mutation' })
		if (
			value.status &&
			value.is_active !== undefined &&
			value.is_active !== (value.status === 'ADD' || value.status === 'ACTIVATE')
		) {
			ctx.addIssue({ code: 'custom', message: 'is_active conflicts with status' })
		}
	})
export const wayfairUpdateAdvertisingCampaignInputSchema = z.strictObject({
	campaign_id: z.int32().positive().describe('Sponsored Product campaign ID'),
	listings: z
		.record(
			z.string().refine((value) => Boolean(value.trim()), 'Listing ID must not be blank'),
			wayfairCampaignListingInputSchema
		)
		.refine((value) => Object.keys(value).length > 0, 'Include at least one listing')
		.describe('Updates keyed by listing ID; bid requirements depend on the campaign bidding strategy')
})
export const wayfairUpdateAdvertisingCampaignOutputSchema = z.object({
	campaignId: z.string().optional(),
	listingChanges: z
		.array(
			z.object({
				listing: z.string().optional(),
				bid: z.string().optional(),
				isActive: z.boolean().optional(),
				status: z.string().optional()
			})
		)
		.optional()
})
export type WayfairCreateFulfillmentOrderInput = z.infer<typeof wayfairCreateFulfillmentOrderInputSchema>
export type WayfairGetFulfillmentOrderInput = z.infer<typeof wayfairGetFulfillmentOrderInputSchema>
export type WayfairCancelFulfillmentOrderInput = z.infer<typeof wayfairCancelFulfillmentOrderInputSchema>
export type WayfairListFulfillmentOrdersInput = z.infer<typeof wayfairListFulfillmentOrdersInputSchema>
export type WayfairListFulfillmentShippingAdvicesInput = z.infer<
	typeof wayfairListFulfillmentShippingAdvicesInputSchema
>
export type WayfairFulfillmentOrderDetails = z.infer<typeof wayfairFulfillmentOrderDetailsSchema>
export type WayfairCreateFulfillmentOrderOutput = z.infer<typeof wayfairCreateFulfillmentOrderOutputSchema>
export type WayfairCancelFulfillmentOrderOutput = z.infer<typeof wayfairCancelFulfillmentOrderOutputSchema>
export type WayfairListFulfillmentOrdersOutput = z.infer<typeof wayfairListFulfillmentOrdersOutputSchema>
export type WayfairListFulfillmentShippingAdvicesOutput = z.infer<
	typeof wayfairListFulfillmentShippingAdvicesOutputSchema
>
export type WayfairListInboundOrdersInput = z.infer<typeof wayfairListInboundOrdersInputSchema>
export type WayfairListInboundOrdersOutput = z.infer<typeof wayfairListInboundOrdersOutputSchema>
export type WayfairGenerateAdvertisingReportInput = z.infer<typeof wayfairGenerateAdvertisingReportInputSchema>
export type WayfairGenerateAdvertisingReportOutput = z.infer<typeof wayfairGenerateAdvertisingReportOutputSchema>
export type WayfairGetAdvertisingReportInput = z.infer<typeof wayfairGetAdvertisingReportInputSchema>
export type WayfairAdvertisingReportStatus = z.infer<typeof wayfairAdvertisingReportStatusSchema>
export type WayfairUpdateAdvertisingCampaignInput = z.infer<typeof wayfairUpdateAdvertisingCampaignInputSchema>
export type WayfairUpdateAdvertisingCampaignOutput = z.infer<typeof wayfairUpdateAdvertisingCampaignOutputSchema>

/** Shared read context. Output market codes are strings, not these input enums. */
export const wayfairMarketContextInputSchema = z.strictObject({
	locale: z
		.string()
		.regex(/^[a-z]{2}-[A-Z]{2}$/)
		.optional()
		.describe('Language and country locale in ll-CC form, such as en-US'),
	country: z
		.enum(['UNITED_STATES', 'GERMANY', 'UNITED_KINGDOM', 'CANADA'])
		.optional()
		.describe('Catalog market country'),
	brand: z
		.enum(['WAYFAIR', 'JOSS_AND_MAIN', 'PERIGOLD', 'ALLMODERN', 'BIRCHLANE'])
		.optional()
		.describe('Catalog retail brand')
})
export const wayfairCatalogUpdateMarketInputSchema = wayfairMarketContextInputSchema.extend({
	locale: z
		.string()
		.regex(/^[a-z]{2}-[A-Z]{2}$/)
		.describe('Required market locale in ll-CC form, such as en-US'),
	country: z
		.enum(['UNITED_STATES', 'UNITED_KINGDOM'])
		.describe('Market to update; German and Canadian catalog updates are no longer supported')
})
const wayfairMarketContextSchema = z.object({
	locale: z.string().nullable(),
	country: z.string().nullable(),
	brand: z.string().nullable()
})
const wayfairCatalogItemBaseSchema = z.object({
	supplierPartNumber: z.string(),
	marketContext: wayfairMarketContextSchema.extend({
		channel: z.string().nullable(),
		segment: z.string().nullable(),
		location: z.string().nullable()
	}),
	catalogItemStatus: z.enum(['LIVE', 'NOT_LIVE', 'LAUNCHING']).nullable(),
	class: z.object({ classId: z.string(), className: z.string().nullable() }).nullable(),
	listings: z.array(z.object({ listingId: z.string() }))
})
export const wayfairCatalogItemSchema = wayfairCatalogItemBaseSchema.extend({
	salesChannels: z.array(wayfairCatalogItemBaseSchema)
})
export const wayfairListCatalogItemsInputSchema = z.strictObject({
	pagination_options: z
		.strictObject({
			page: z.int32().positive().optional().describe('One-based page; defaults to 1'),
			page_size: z.int32().min(1).max(30).optional().describe('Items per page, 1–30; defaults to 30')
		})
		.describe('Required pagination object; empty uses page 1 and page size 30'),
	filter: z
		.strictObject({
			supplier_part_numbers: z.array(z.string()).optional().describe('Exact supplier part numbers to include'),
			listing_ids: z.array(z.string()).optional().describe('Exact listing IDs to include'),
			catalog_item_statuses: z
				.array(z.enum(['LIVE', 'NOT_LIVE', 'LAUNCHING']))
				.optional()
				.describe('Catalog item states to include')
		})
		.optional()
		.describe('Optional catalog item filters'),
	market_context: wayfairMarketContextInputSchema
		.optional()
		.describe('Additional market context for one level of sales channels; omitted returns no additional channels')
})
export const wayfairListCatalogItemsOutputSchema = z.object({
	paginationInfo: z.object({
		page: z.int32().positive(),
		pageSize: z.int32().positive(),
		hasNextPage: z.boolean(),
		totalPages: z.int32().nonnegative(),
		totalCount: z.int32().nonnegative()
	}),
	supplier: z.object({ supplierId: z.string(), supplierName: z.string().nullable() }),
	catalogItems: z.array(wayfairCatalogItemSchema)
})
const wayfairCatalogResponseErrorSchema = z.object({ code: z.string().nullish(), message: z.string().nullish() })
export const wayfairListCatalogItemsResponseSchema = z.object({
	data: z
		.object({
			supplierCatalogItems: z
				.discriminatedUnion('__typename', [
					wayfairListCatalogItemsOutputSchema.extend({ __typename: z.literal('SupplierCatalogItems') }),
					z.object({
						__typename: z.literal('SupplierCatalogItemsError'),
						httpError: wayfairCatalogResponseErrorSchema.nullish(),
						internalError: wayfairCatalogResponseErrorSchema.nullish()
					})
				])
				.nullable()
		})
		.nullish(),
	errors: z.array(wayfairGraphqlErrorSchema).optional()
})
export const wayfairListBrandAssociationsInputSchema = z.strictObject({
	market_context: wayfairMarketContextInputSchema.describe('Market context for brand associations'),
	page: z.int32().optional().describe('Native brand-association page number; omit to use the upstream default'),
	page_size: z.int32().describe('Required native brand-association page size; no published maximum or default')
})
export const wayfairListBrandAssociationsOutputSchema = z.object({
	brands: z
		.array(
			z.object({ id: z.string(), manufacturer: z.object({ id: z.string(), name: z.string().nullable() }) }).nullable()
		)
		.nullable(),
	pageInfo: z.object({ hasNextPage: z.boolean(), hasPreviousPage: z.boolean(), totalPages: z.int32() })
})
export const wayfairListBrandAssociationsResponseSchema = z.object({
	data: z
		.object({
			supplierBrand: z.object({ brandAssociations: wayfairListBrandAssociationsOutputSchema.nullable() }).nullable()
		})
		.nullish(),
	errors: z.array(wayfairGraphqlErrorSchema).optional()
})
export const wayfairGetMediaMetadataTagsInputSchema = z.strictObject({
	meta_data_tag_types: z
		.array(z.enum(['DOCUMENT', 'LEGAL_DOCUMENT', 'LANGUAGE', 'REGION']))
		.describe('Media metadata tag types to retrieve'),
	market_context: wayfairMarketContextInputSchema.describe('Market context for media metadata')
})
export const wayfairGetMediaMetadataTagsOutputSchema = z.array(
	z.object({
		metaDataTagType: z.string(),
		metaDataTags: z.array(z.object({ metaDataId: z.string(), name: z.string() }))
	})
)
export const wayfairGetMediaMetadataTagsResponseSchema = z.object({
	data: z
		.object({ media: z.object({ mediaMetaDataTags: wayfairGetMediaMetadataTagsOutputSchema.nullable() }).nullable() })
		.nullish(),
	errors: z.array(wayfairGraphqlErrorSchema).optional()
})
export const wayfairListTaxonomyCategoriesInputSchema = z.strictObject({
	market_context: wayfairMarketContextInputSchema.describe('Market context for taxonomy categories'),
	pagination_options: z
		.strictObject({
			page: z.int32().positive().optional().describe('One-based category page'),
			page_size: z
				.union([z.literal(10), z.literal(20), z.literal(25), z.literal(50)])
				.optional()
				.describe('Category page size: 10, 20, 25, or 50')
		})
		.optional()
		.describe('Optional native pagination; no local defaults are applied')
})
export const wayfairListTaxonomyCategoriesOutputSchema = z.object({
	pageInfo: z
		.object({ page: z.int32(), pageSize: z.int32(), hasNextPage: z.boolean(), totalPages: z.int32() })
		.nullable(),
	taxonomyCategories: z.array(z.object({ taxonomyCategoryId: z.string(), name: z.string().nullable() }))
})
export const wayfairListTaxonomyCategoriesResponseSchema = z.object({
	data: z.object({ taxonomyCategories: wayfairListTaxonomyCategoriesOutputSchema.nullable() }).nullish(),
	errors: z.array(wayfairGraphqlErrorSchema).optional()
})
/** Product Update schema: taxonomyCategoryId, not the Product Addition classId contract. */
export const wayfairGetTaxonomyAttributesInputSchema = z.strictObject({
	taxonomy_category_id: wayfairIdentifierSchema.describe(
		'Taxonomy category ID from the update taxonomy; not a product-addition class ID'
	),
	market_context: wayfairMarketContextInputSchema.describe('Market context for taxonomy attribute requirements')
})
const wayfairTaxonomyAttributeBaseSchema = z.object({
	taxonomyAttributeId: z.string(),
	title: z.string(),
	description: z.string().nullable(),
	market: wayfairMarketContextSchema.nullable(),
	requirement: z.enum(['OPTIONAL', 'REQUIRED', 'RECOMMENDED']),
	valueFormat: z.object({
		canValueBeCustomized: z.boolean().nullable(),
		canValueBeSetToUnavailable: z.boolean().nullable(),
		canValueBeSetToNotApplicable: z.boolean().nullable(),
		datatype: z.enum(['BOOLEAN', 'STRING', 'INTEGER', 'DECIMAL', 'SINGLE_CHOICE', 'MULTI_CHOICE']).nullable(),
		measurement: z
			.object({
				measurementName: z.string().nullable(),
				measurementUnit: z.object({ name: z.string().nullable(), symbol: z.string().nullable() }).nullable()
			})
			.nullable()
	}),
	possibleAttributeValues: z
		.array(z.object({ value: z.string(), definition: z.string().nullable() }).nullable())
		.nullable(),
	parentAttributeId: z.string().nullable(),
	relatedAttributeIds: z.array(z.string()).nullable(),
	taxonomyCategoryIds: z.array(z.string())
})
export const wayfairTaxonomyAttributeSchema = wayfairTaxonomyAttributeBaseSchema.extend({
	childAttributes: z.array(wayfairTaxonomyAttributeBaseSchema.nullable()).nullable()
})
export const wayfairGetTaxonomyAttributesOutputSchema = z.array(
	z.object({
		taxonomyCategoryId: z.string(),
		attributes: z.array(wayfairTaxonomyAttributeSchema.nullable()).nullable(),
		conditionalityRules: z
			.array(
				z.object({
					taxonomyAttributeId: z.string(),
					rules: z.array(
						z.object({
							upstreamCondition: z.object({
								taxonomyAttributeId: z.string(),
								answers: z.array(z.string().nullable()),
								operation: z.string()
							}),
							downstreamConditions: z.array(
								z.object({
									taxonomyAttributeId: z.string(),
									validationType: z.enum(['ERROR', 'WARNING']).nullable(),
									answers: z.array(z.string().nullable()),
									operation: z.enum(['ASSIGN', 'EXCLUDE'])
								})
							)
						})
					)
				})
			)
			.nullable()
	})
)
export const wayfairGetTaxonomyAttributesResponseSchema = z.object({
	data: z.object({ attributesByFilter: wayfairGetTaxonomyAttributesOutputSchema.nullable() }).nullish(),
	errors: z.array(wayfairGraphqlErrorSchema).optional()
})
export const wayfairGetCatalogUpdateStatusInputSchema = z.strictObject({
	request_id: z.string().min(1).describe('Request ID returned by a catalog item, media, or group update')
})
export const wayfairGetCatalogUpdateStatusOutputSchema = z.object({
	requestId: z.string(),
	validationOnly: z.boolean(),
	status: z.enum(['IN_PROGRESS', 'COMPLETED', 'BLOCKED']),
	problems: z.array(
		z.object({
			code: z.string().nullable(),
			title: z.string().nullable(),
			detail: z.string().nullable(),
			catalogEntityIdentifier: z.string().nullable(),
			catalogEntityProperty: z.string().nullable(),
			catalogEntityPropertyId: z.string().nullable(),
			inputValue: z.string().nullable()
		})
	),
	successfulUpdates: z
		.array(z.object({ entityIdentifier: z.string(), catalogEntityProperty: z.string() }).nullable())
		.nullable()
})
export const wayfairGetCatalogUpdateStatusResponseSchema = z.object({
	data: z.object({ statusOfUpdateRequest: wayfairGetCatalogUpdateStatusOutputSchema.nullable() }).nullish(),
	errors: z.array(wayfairGraphqlErrorSchema).optional()
})
const wayfairCatalogMediaUrlSchema = z.url({ protocol: /^https?$/ }).refine((value) => {
	const url = new URL(value)
	return !url.username && !url.password
}, 'Provide a public HTTP(S) URL without embedded credentials')
export const wayfairCatalogItemMediaInputSchema = z
	.strictObject({
		supplier_part_number: z.string().min(1).describe('Supplier part number whose media association changes'),
		media_url: wayfairCatalogMediaUrlSchema
			.optional()
			.describe('Publicly accessible HTTP(S) media URL; required for UPLOAD'),
		media_type: z.enum(['IMAGE', 'VIDEO', 'DOCUMENT']).describe('Type of media asset'),
		action: z.enum(['UPLOAD', 'DELETE']).optional().describe('Media action; omitted means UPLOAD'),
		asset_id: z
			.string()
			.min(1)
			.optional()
			.describe('Existing asset ID for deletion; takes precedence over legacy_asset_id'),
		legacy_asset_id: z
			.int32()
			.optional()
			.describe('Legacy numeric asset ID; required for DELETE when asset_id is omitted'),
		lead_image_override: z
			.boolean()
			.optional()
			.describe('Override lead selection for an existing eligible image; false removes a previous override')
	})
	.refine(
		(value) =>
			value.action === 'DELETE'
				? value.asset_id !== undefined || value.legacy_asset_id !== undefined
				: value.media_url !== undefined,
		'UPLOAD requires media_url; DELETE requires asset_id or legacy_asset_id'
	)
export const wayfairUpdateCatalogItemMediaInputSchema = z.strictObject({
	catalog_items_to_update: z
		.array(wayfairCatalogItemMediaInputSchema)
		.describe('Catalog item media changes; no published batch maximum'),
	validate_only: z
		.boolean()
		.describe('Required: true validates without applying changes; false validates and applies successful changes')
})
export const wayfairCatalogAttributeUpdatesInputSchema = z.strictObject({
	updates: z
		.array(
			z.strictObject({
				attribute_id: z.string().min(1).describe('Taxonomy attribute ID to update'),
				value: z
					.array(z.string())
					.describe('New attribute values as strings; include existing values for all related attributes')
			})
		)
		.describe('Attribute updates including all related attribute IDs required by conditionality rules'),
	ignore_warnings: z
		.boolean()
		.optional()
		.describe('Apply despite validation warnings when true; errors still block updates'),
	enable_autofill: z
		.boolean()
		.optional()
		.describe('Autofill eligible blank values before validating and saving when true'),
	taxonomy_category_id: z.string().min(1).describe('Taxonomy category for the updated attributes')
})
export const wayfairUpdateCatalogItemsInputSchema = z.strictObject({
	market_context: wayfairCatalogUpdateMarketInputSchema.describe(
		'Required country and locale for market-specific updates'
	),
	catalog_items_to_update: z
		.array(
			z.strictObject({
				supplier_part_number: z.string().min(1).describe('Supplier part number to update'),
				item_name: z.string().optional().describe('New catalog item name'),
				attributes: wayfairCatalogAttributeUpdatesInputSchema
					.optional()
					.describe('Taxonomy attribute updates; include all related attribute values')
			})
		)
		.describe('Market-specific item changes; no published batch maximum'),
	validate_only: z.boolean().describe('Required: true validates only; false applies changes that pass validation')
})
export const wayfairUpdateCatalogItemGroupsInputSchema = z.strictObject({
	market_context: wayfairCatalogUpdateMarketInputSchema.describe(
		'Required country and locale for market-specific group updates'
	),
	catalog_item_groups_to_update: z
		.array(
			z.strictObject({
				item_group_id: z.string().min(1).describe('Catalog item group ID to update'),
				item_group_name: z.string().optional().describe('New catalog item group name'),
				marketing_copy: z.string().optional().describe('New marketing copy'),
				feature_bullets: z.array(z.string()).optional().describe('Replacement feature bullets'),
				option_content: z
					.array(
						z.strictObject({
							option_id: z.int32().describe('Option ID to rename'),
							option_name: z.string().describe('New option name')
						})
					)
					.optional()
					.describe('Replacement option names')
			})
		)
		.describe('Market-specific group changes; media content is not supported by this operation'),
	validate_only: z.boolean().describe('Required: true validates only; false applies changes that pass validation')
})
export const wayfairCatalogUpdateRequestSchema = z.object({ requestId: z.string().min(1) })
export const wayfairUpdateCatalogItemMediaResponseSchema = z.object({
	data: z
		.object({
			updateCatalogEntitiesMutations: z
				.object({ updateCatalogItemsMedia: wayfairCatalogUpdateRequestSchema.nullable() })
				.nullable()
		})
		.nullish(),
	errors: z.array(wayfairGraphqlErrorSchema).optional()
})
export const wayfairUpdateCatalogItemsResponseSchema = z.object({
	data: z
		.object({
			updateCatalogEntitiesMutations: z
				.object({ updateMarketSpecificCatalogItems: wayfairCatalogUpdateRequestSchema.nullable() })
				.nullable()
		})
		.nullish(),
	errors: z.array(wayfairGraphqlErrorSchema).optional()
})
export const wayfairUpdateCatalogItemGroupsResponseSchema = z.object({
	data: z
		.object({
			updateCatalogEntitiesMutations: z
				.object({ updateMarketSpecificCatalogItemGroups: wayfairCatalogUpdateRequestSchema.nullable() })
				.nullable()
		})
		.nullish(),
	errors: z.array(wayfairGraphqlErrorSchema).optional()
})
export type WayfairMarketContextInput = z.infer<typeof wayfairMarketContextInputSchema>
export type WayfairCatalogUpdateMarketInput = z.infer<typeof wayfairCatalogUpdateMarketInputSchema>
export type WayfairCatalogItem = z.infer<typeof wayfairCatalogItemSchema>
export type WayfairListCatalogItemsInput = z.infer<typeof wayfairListCatalogItemsInputSchema>
export type WayfairListCatalogItemsOutput = z.infer<typeof wayfairListCatalogItemsOutputSchema>
export type WayfairListBrandAssociationsInput = z.infer<typeof wayfairListBrandAssociationsInputSchema>
export type WayfairListBrandAssociationsOutput = z.infer<typeof wayfairListBrandAssociationsOutputSchema>
export type WayfairGetMediaMetadataTagsInput = z.infer<typeof wayfairGetMediaMetadataTagsInputSchema>
export type WayfairGetMediaMetadataTagsOutput = z.infer<typeof wayfairGetMediaMetadataTagsOutputSchema>
export type WayfairListTaxonomyCategoriesInput = z.infer<typeof wayfairListTaxonomyCategoriesInputSchema>
export type WayfairListTaxonomyCategoriesOutput = z.infer<typeof wayfairListTaxonomyCategoriesOutputSchema>
export type WayfairGetTaxonomyAttributesInput = z.infer<typeof wayfairGetTaxonomyAttributesInputSchema>
export type WayfairGetTaxonomyAttributesOutput = z.infer<typeof wayfairGetTaxonomyAttributesOutputSchema>
export type WayfairTaxonomyAttribute = z.infer<typeof wayfairTaxonomyAttributeSchema>
export type WayfairGetCatalogUpdateStatusInput = z.infer<typeof wayfairGetCatalogUpdateStatusInputSchema>
export type WayfairGetCatalogUpdateStatusOutput = z.infer<typeof wayfairGetCatalogUpdateStatusOutputSchema>
export type WayfairCatalogItemMediaInput = z.infer<typeof wayfairCatalogItemMediaInputSchema>
export type WayfairCatalogAttributeUpdatesInput = z.infer<typeof wayfairCatalogAttributeUpdatesInputSchema>
export type WayfairUpdateCatalogItemMediaInput = z.infer<typeof wayfairUpdateCatalogItemMediaInputSchema>
export type WayfairUpdateCatalogItemsInput = z.infer<typeof wayfairUpdateCatalogItemsInputSchema>
export type WayfairUpdateCatalogItemGroupsInput = z.infer<typeof wayfairUpdateCatalogItemGroupsInputSchema>
export type WayfairCatalogUpdateRequest = z.infer<typeof wayfairCatalogUpdateRequestSchema>
