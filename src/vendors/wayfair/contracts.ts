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
	quantity: z.number()
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
