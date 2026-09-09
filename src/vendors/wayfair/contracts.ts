import { z } from 'zod'

export const wayfairAuthSchema = z.object({
	client_id: z.string().min(1).describe('Wayfair Supplier production OAuth client id'),
	client_secret: z.string().min(1).describe('Wayfair Supplier production OAuth client secret'),
	supplier_id: z.coerce.number().int().positive().describe('Wayfair supplier id')
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
