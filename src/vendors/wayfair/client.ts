/**
 * Wayfair Supplier production and sandbox client.
 * Host: `new WayfairClient(auth)`. Agent tools: `fromContext(ctx)`.
 */

import { isPlainObject } from 'es-toolkit'
import { z } from 'zod'
import type { output, ZodType } from 'zod'

import { ToolError } from '../../core/errors'
import { requireAuth } from '../../core/provider'
import type { FetchLike, ToolContext } from '../../core/types'
import { ArtifactsClient } from '../../modules/artifacts/client'
import { artifactsAuthSchema } from '../../modules/artifacts/contracts'
import type { ArtifactsAuth } from '../../modules/artifacts/contracts'
import { bytesToBase64 } from '../../shared/bytes'
import { HttpService } from '../../transport/http-service'
import type { HttpServiceOptions } from '../../transport/http-service'
import type {
	WayfairListCatalogItemsInput,
	WayfairListBrandAssociationsInput,
	WayfairGetMediaMetadataTagsInput,
	WayfairListTaxonomyCategoriesInput,
	WayfairGetTaxonomyAttributesInput,
	WayfairGetCatalogUpdateStatusInput,
	WayfairUpdateCatalogItemMediaInput,
	WayfairUpdateCatalogItemsInput,
	WayfairUpdateCatalogItemGroupsInput,
	WayfairListCatalogItemsOutput,
	WayfairListBrandAssociationsOutput,
	WayfairGetMediaMetadataTagsOutput,
	WayfairListTaxonomyCategoriesOutput,
	WayfairGetTaxonomyAttributesOutput,
	WayfairGetCatalogUpdateStatusOutput,
	WayfairCatalogUpdateRequest,
	WayfairCreateFulfillmentOrderInput,
	WayfairCreateFulfillmentOrderOutput,
	WayfairGetFulfillmentOrderInput,
	WayfairFulfillmentOrderDetails,
	WayfairCancelFulfillmentOrderInput,
	WayfairCancelFulfillmentOrderOutput,
	WayfairListFulfillmentOrdersInput,
	WayfairListFulfillmentOrdersOutput,
	WayfairListFulfillmentShippingAdvicesInput,
	WayfairListFulfillmentShippingAdvicesOutput,
	WayfairListInboundOrdersInput,
	WayfairListInboundOrdersOutput,
	WayfairGenerateAdvertisingReportInput,
	WayfairGenerateAdvertisingReportOutput,
	WayfairGetAdvertisingReportInput,
	WayfairAdvertisingReportStatus,
	WayfairUpdateAdvertisingCampaignInput,
	WayfairUpdateAdvertisingCampaignOutput,
	WayfairAcceptDropshipOrderInput,
	WayfairAuth,
	WayfairSaveInventoryInput,
	WayfairRegisterShipmentInput,
	WayfairListLabelGenerationEventsInput,
	WayfairListLabelGenerationEventsOutput,
	WayfairLabelGenerationEvent,
	WayfairDownloadDocumentInput,
	WayfairStoreDocumentInput,
	WayfairDocumentBytes,
	WayfairGetConsolidatedBolInput,
	WayfairConsolidatedBol,
	WayfairListCastleGateOrdersInput,
	WayfairListCastleGateOrdersOutput,
	WayfairListCastleGateShippingAdvicesInput,
	WayfairListCastleGateShippingAdvicesOutput,
	WayfairAcknowledgeCastleGateOrderInput,
	WayfairAcknowledgeCastleGateShippingAdvicesInput,
	WayfairConfirmCancellationRequestsInput,
	WayfairDropshipOrderDetails,
	WayfairGetDropshipOrderInput,
	WayfairListCatalogPageInput,
	WayfairListCatalogPageOutput,
	WayfairListDropshipOrdersInput,
	WayfairListDropshipOrdersOutput,
	WayfairListInventoryAdjustmentsInput,
	WayfairListInventoryAdjustmentsOutput,
	WayfairListInventorySummaryInput,
	WayfairListInventorySummaryOutput,
	WayfairListCancellationRequestsByOrdersInput,
	WayfairListCancellationRequestsByWarehousesInput,
	WayfairListCancellationRequestsOutput,
	WayfairRejectCancellationRequestsInput,
	WayfairRespondCancellationRequestsOutput,
	WayfairSendShipmentNoticeInput,
	WayfairTransactionStatus
} from './contracts'
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
	wayfairListCatalogItemsResponseSchema,
	wayfairListBrandAssociationsResponseSchema,
	wayfairGetMediaMetadataTagsResponseSchema,
	wayfairListTaxonomyCategoriesResponseSchema,
	wayfairGetTaxonomyAttributesResponseSchema,
	wayfairGetCatalogUpdateStatusResponseSchema,
	wayfairUpdateCatalogItemMediaResponseSchema,
	wayfairUpdateCatalogItemsResponseSchema,
	wayfairUpdateCatalogItemGroupsResponseSchema,
	wayfairListCatalogItemsOutputSchema,
	wayfairCreateFulfillmentOrderInputSchema,
	wayfairCreateFulfillmentOrderResponseSchema,
	wayfairGetFulfillmentOrderInputSchema,
	wayfairGetFulfillmentOrderResponseSchema,
	wayfairCancelFulfillmentOrderInputSchema,
	wayfairCancelFulfillmentOrderResponseSchema,
	wayfairListFulfillmentOrdersInputSchema,
	wayfairListFulfillmentOrdersResponseSchema,
	wayfairListFulfillmentShippingAdvicesInputSchema,
	wayfairListFulfillmentShippingAdvicesResponseSchema,
	wayfairListInboundOrdersInputSchema,
	wayfairListInboundOrdersResponseSchema,
	wayfairGenerateAdvertisingReportInputSchema,
	wayfairGenerateAdvertisingReportOutputSchema,
	wayfairGetAdvertisingReportInputSchema,
	wayfairAdvertisingReportStatusSchema,
	wayfairUpdateAdvertisingCampaignInputSchema,
	wayfairUpdateAdvertisingCampaignOutputSchema,
	wayfairAcceptDropshipOrderInputSchema,
	wayfairAcceptDropshipOrderResponseSchema,
	wayfairAuthSchema,
	wayfairSaveInventoryInputSchema,
	wayfairSaveInventoryResponseSchema,
	wayfairRegisterShipmentInputSchema,
	wayfairRegisterShipmentResponseSchema,
	wayfairListLabelGenerationEventsInputSchema,
	wayfairListLabelGenerationEventsResponseSchema,
	wayfairDownloadDocumentInputSchema,
	wayfairStoreDocumentInputSchema,
	wayfairGetConsolidatedBolInputSchema,
	wayfairConsolidatedBolResponseSchema,
	wayfairListCastleGateOrdersInputSchema,
	wayfairListCastleGateShippingAdvicesInputSchema,
	wayfairCastleGateOrdersResponseSchema,
	wayfairCastleGateShippingAdvicesResponseSchema,
	wayfairAcknowledgeCastleGateOrderInputSchema,
	wayfairAcknowledgeCastleGateShippingAdvicesInputSchema,
	wayfairAcknowledgeCastleGateOrderResponseSchema,
	wayfairAcknowledgeCastleGateShippingAdvicesResponseSchema,
	wayfairCatalogResponseSchema,
	wayfairCancellationRequestsByOrdersResponseSchema,
	wayfairCancellationRequestsByWarehousesResponseSchema,
	wayfairConfirmCancellationRequestsInputSchema,
	wayfairConfirmCancellationRequestsResponseSchema,
	wayfairDropshipPurchaseOrdersResponseSchema,
	wayfairGetDropshipOrderInputSchema,
	wayfairGetDropshipOrderResponseSchema,
	wayfairInventoryAdjustmentsResponseSchema,
	wayfairInventorySummaryResponseSchema,
	wayfairListCatalogPageInputSchema,
	wayfairListDropshipOrdersInputSchema,
	wayfairListInventoryAdjustmentsInputSchema,
	wayfairListInventorySummaryInputSchema,
	wayfairListCancellationRequestsByOrdersInputSchema,
	wayfairListCancellationRequestsByWarehousesInputSchema,
	wayfairRejectCancellationRequestsInputSchema,
	wayfairRejectCancellationRequestsResponseSchema,
	wayfairSendShipmentNoticeInputSchema,
	wayfairSendShipmentNoticeResponseSchema
} from './contracts'
import {
	catalogItemsVariables,
	catalogItemMediaVariables,
	catalogItemUpdateVariables,
	catalogItemGroupVariables,
	createFulfillmentOrderVariables,
	fulfillmentOrderListVariables,
	inboundOrderVariables,
	acceptOrderVariables,
	saveInventoryVariables,
	registerShipmentVariables,
	labelEventVariables,
	inventoryAdjustmentVariables,
	inventorySummaryVariables,
	shipmentNoticeVariables
} from './domain'

const WAYFAIR_TOKEN_BASE = 'https://sso.auth.wayfair.com'
const WAYFAIR_SUPPLIER_BASE = 'https://api.wayfair.io'
const WAYFAIR_ORDER_BASE = 'https://api.wayfair.com'
const WAYFAIR_AUDIENCE = 'https://api.wayfair.com/'
const DEFAULT_CATALOG_PAGE_SIZE = 25
const DEFAULT_ORDER_LIMIT = 100

const wayfairTokenResponseSchema = z.object({
	access_token: z.string().min(1),
	expires_in: z.coerce.number().int().positive()
})

const SUPPLIER_CATALOG_QUERY = `
query SupplierCatalog($supplierId: Int!, $paginationOptions: PaginationOptions) {
  supplierCatalog(supplierId: $supplierId, paginationOptions: $paginationOptions) {
    supplierId
    pageInfo {
      page
      pageSize
      hasNextPage
      totalPages
    }
    products {
      productId
      upc
      supplierPartNumber
      status
      skus {
        sku
        productName
        className
        classId
        status
        isLive
        collectionName
        displaySku
        minimumOrderQuantity
      }
    }
  }
}`

const DROPSHIP_ORDER_DETAILS_QUERY = `
query DropshipOrderDetails($poNumber: String!) {
  getDropshipPurchaseOrders(poNumbers: [$poNumber], limit: 2) {
    id
    storePrefix
    poNumber
    poDate
    orderId
    supplierId
    estimatedShipDate
    scheduledDeliveryDate
    deliveryMethodCode
    customerName
    customerEmail
    salesChannelName
    orderType
    shippingInfo {
      shipSpeed
      carrierCode
      poolPointAgent { id name }
      crossDockAgent { id name }
      deliveryAgent { id name }
    }
    warehouse {
      id
      name
      address { name address1 address2 address3 city state country postalCode phoneNumber }
    }
    products {
      partNumber quantity price pieceCount totalCost name weight totalWeight
      estShipDate fillDate sku isCancelled isTscaCompliant
      twoDayGuaranteeDeliveryDeadline customComment
    }
    shipTo { name address1 address2 address3 city state country postalCode phoneNumber }
    billTo { name address1 address2 address3 city state country postalCode phoneNumber }
    billingInfo { vatNumber }
  }
}`

// Item arrays default to ten entries upstream; counts describe the complete transaction.
const TRANSACTION_FIELDS = `
  id handle status submittedAt completedAt
  itemCount errorCount errors { key message }
  completedCount completed { key message }
  processingCount processing { key message }
`

const ACCEPT_DROPSHIP_ORDER_MUTATION = `
mutation AcceptDropshipOrder(
  $poNumber: String!,
  $shipSpeed: ShipSpeed!,
  $lineItems: [AcceptedLineItemInput!]!
) {
  purchaseOrders {
    accept(poNumber: $poNumber, shipSpeed: $shipSpeed, lineItems: $lineItems) {
      ${TRANSACTION_FIELDS}
    }
  }
}`

const SHIPMENT_NOTICE_MUTATION = `
mutation SendShipmentNotice($notice: ShipNoticeInput!) {
  purchaseOrders {
    shipment(notice: $notice) {
      ${TRANSACTION_FIELDS}
    }
  }
}`

const CANCELLATION_REQUEST_FIELDS = `
  requestId status requestedAt
  cancellationReason { reason }
  purchaseOrder { poNumber warehouse { warehouseId } }
  cancelledProduct { partNumber cancellationQuantity { originalQuantity cancelledQuantity } }
`

const CANCELLATION_REQUESTS_BY_ORDERS_QUERY = `
query CancellationRequestsByOrders($poInput: LineItemCancellationRequestByPurchaseOrdersInput!) {
  lineItemCancellationRequestByPurchaseOrders(poInput: $poInput) {
    ${CANCELLATION_REQUEST_FIELDS}
  }
}`

const CANCELLATION_REQUESTS_BY_WAREHOUSES_QUERY = `
query CancellationRequestsByWarehouses($warehouseInput: LineItemCancellationRequestByWarehousesInput!) {
  lineItemCancellationRequestByWarehouses(warehouseInput: $warehouseInput) {
    ${CANCELLATION_REQUEST_FIELDS}
  }
}`

const CONFIRM_CANCELLATION_REQUESTS_MUTATION = `
mutation ConfirmCancellationRequests($confirmationInputs: [ConfirmLineItemCancellationRequestInput!]!) {
  confirmLineItemCancellationRequest(confirmationInputs: $confirmationInputs) {
    requestId status errorCode errorMessage
  }
}`

const REJECT_CANCELLATION_REQUESTS_MUTATION = `
mutation RejectCancellationRequests($rejectionInputs: [RejectLineItemCancellationRequestInput!]!) {
  rejectLineItemCancellationRequest(rejectionInputs: $rejectionInputs) {
    requestId status errorCode errorMessage
  }
}`

const INVENTORY_ON_HAND_FIELDS = `
  allocatedQty unreconciledQty inStockQty
  inStock {
    fulfillableQty unfulfillableQty
    unfulfillable { expiredQty heldQty unpickableQty onTransferQty }
  }
`

const INVENTORY_POSITION_FIELDS = `
  onHandQty
  onHand { ${INVENTORY_ON_HAND_FIELDS} }
  warehouses { warehouseId onHandQty onHand { ${INVENTORY_ON_HAND_FIELDS} } }
`

const INVENTORY_SUMMARY_QUERY = `
query InventorySummary($supplierId: Int!, $filter: InventoryFilterInput, $page: InventoryPageInput) {
  inventorySummaryList(supplierId: $supplierId, filter: $filter, page: $page) {
    pageInfo { hasNextPage endCursor }
    edges {
      node {
        manufacturerPartId supplierPartNumber sku productName options
        inventoryPosition {
          castleGate { ${INVENTORY_POSITION_FIELDS} }
          physicalRetail { ${INVENTORY_POSITION_FIELDS} }
        }
      }
    }
  }
}`

const INVENTORY_ADJUSTMENTS_QUERY = `
query InventoryAdjustments(
  $supplierId: Int!, $filter: InventoryAdjustmentFilterInput,
  $page: InventoryAdjustmentPageInput, $sortOption: InventoryAdjustmentSortOptionsInput
) {
  inventoryAdjustmentList(supplierId: $supplierId, filter: $filter, page: $page, sortOption: $sortOption) {
    pageInfo { pageNumber pageSize totalPages totalElements }
    nodes {
      eventDate adjustmentType supplierPartNumber quantity description
      warehouse {
        warehouseId name
        address { address1 address2 address3 city stateShortName country postalCode }
      }
    }
  }
}`

const SAVE_INVENTORY_MUTATION = `
mutation SaveInventory($inventory: [inventoryInput!]!, $feedKind: inventoryFeedKind, $dryRun: Boolean) {
  inventory {
    save(inventory: $inventory, feedKind: $feedKind, dryRun: $dryRun) {
      handle status submittedAt completedAt itemCount errorCount
      errors { key message } completed { key message } processingCount processing { key message }
    }
  }
}`
const LABEL_EVENT_FIELDS = `
  id eventDate pickupDate poNumber
  billOfLading { url } consolidatedShippingLabel { url } customsDocument { required url }
  generatedShippingLabels { poNumber fullPoNumber numberOfLabels carrier carrierCode trackingNumber }
  shippingLabelInfo { carrier carrierCode trackingNumber }
  shippingUnits { groupIdentifier sequenceIdentifier part { supplierPartNumber upc } }
`
const REGISTER_SHIPMENT_MUTATION = `
mutation RegisterShipment($registrationInput: RegistrationInput!) {
  purchaseOrders { register(registrationInput: $registrationInput) { ${LABEL_EVENT_FIELDS} } }
}`
const LABEL_EVENTS_QUERY = `
query LabelGenerationEvents($filters: [LabelGenerationEventFilterInput], $ordering: [orderingInput], $limit: Int, $offset: Int) {
  labelGenerationEvents(filters: $filters, ordering: $ordering, limit: $limit, offset: $offset) { ${LABEL_EVENT_FIELDS} }
}`
const CONSOLIDATED_BOL_QUERY = `
query ConsolidatedBolDocument($supplierId: Int!, $date: Date!) {
  consolidatedBolDocument(supplierId: $supplierId, date: $date) {
    availability url bolNumber linkExpirationDatetime shipmentReferences
  }
}`
const CASTLEGATE_ORDERS_QUERY = `
query CastleGateOrders($limit: Int32, $hasResponse: Boolean, $fromDate: IsoDateTime, $poNumbers: [String], $sortOrder: SortOrder) {
  getCastleGatePurchaseOrders(limit: $limit, hasResponse: $hasResponse, fromDate: $fromDate, poNumbers: $poNumbers, sortOrder: $sortOrder) {
    id poNumber poDate orderId supplierId estimatedShipDate scheduledDeliveryDate
    shippingInfo { shipSpeed carrierCode }
    products { partNumber quantity price name sku }
    shipTo { name address1 address2 address3 city state country postalCode phoneNumber }
    billTo { name address1 address2 address3 city state country postalCode phoneNumber }
  }
}`
const CASTLEGATE_ADVICES_QUERY = `
query CastleGateShippingAdvices($limit: Int32, $hasResponse: Boolean, $fromDate: IsoDateTime, $wsaIds: [String], $sortOrder: SortOrder) {
  getCastleGateWarehouseShippingAdvice(limit: $limit, hasResponse: $hasResponse, fromDate: $fromDate, wsaIds: $wsaIds, sortOrder: $sortOrder) {
    wsaId supplierId poNumber fulfillmentCustomerOrderNumber fulfillmentCustomerId retailerOrderNumber
    fulfillmentPurchaseOrderNumber creationDate shipDate shipSpeed carrierCode totalShipmentWeight
    totalQuantity clientNumber warehouseId actionDate transactionHandle
    packages { packageWeight trackingNumber }
    shipFrom { name title company address1 address2 address3 city state country postalCode phoneNumber }
    shipTo { name title company address1 address2 address3 city state country postalCode phoneNumber }
    products { quantityOrdered partNumber name quantityShipped upc sku forceQuantityMultiplier }
  }
}`
const ACKNOWLEDGE_CASTLEGATE_ORDER_MUTATION = `
mutation AcknowledgeCastleGateOrder($poNumber: String!) {
  purchaseOrders { acknowledgeCastleGate(poNumber: $poNumber) { ${TRANSACTION_FIELDS} } }
}`
const ACKNOWLEDGE_CASTLEGATE_ADVICES_MUTATION = `
mutation AcknowledgeCastleGateShippingAdvices($wsaIds: [String]!) {
  purchaseOrders { acknowledgeCastleGateWarehouseShippingAdvice(wsaIds: $wsaIds) { ${TRANSACTION_FIELDS} } }
}`

const FULFILLMENT_ADDRESS_FIELDS = `name address1 address2 city stateShortName postalCode countryShortName companyName`
const FULFILLMENT_ITEM_FIELDS = `
  fulfillmentOrderItemId productId partNumber supplierProductName supplierPartNumber srcCategory
  status statusLabel failureReasons quantityOrdered quantityShipped option forcedQuantityMultiplier unitPrice
  expectedShippingDate trackingNumbers errors { errorType errorSource errorCode errorMessage }
`
const FULFILLMENT_ORDER_FIELDS = `
  fulfillmentOrder {
    requestId status statusLabel billingType orderDate customerOrderNumber
    retailer { name retailerId orderNumber }
    shippingAddress { ${FULFILLMENT_ADDRESS_FIELDS} }
    fulfillmentOrderItems { ${FULFILLMENT_ITEM_FIELDS} }
  }
  fulfillmentOrderErrors { code message field value }
`
const GET_FULFILLMENT_ORDER_QUERY = `
query FulfillmentOrderDetails($orderDetailsInput: FulfillmentOrderDetailsInput!) {
  fulfillmentOrderDetails(orderDetailsInput: $orderDetailsInput) { ${FULFILLMENT_ORDER_FIELDS} }
}`
const LIST_FULFILLMENT_ORDERS_QUERY = `
query FulfillmentOrderDetailsList($orderDetailsListInput: FulfillmentOrderDetailsListInput!) {
  fulfillmentOrderDetailsList(orderDetailsListInput: $orderDetailsListInput) {
    pageInfo { hasNextPage hasPreviousPage totalPages totalItems }
    nodes { ${FULFILLMENT_ORDER_FIELDS} }
  }
}`
const FULFILLMENT_ADVICES_QUERY = `
query FulfillmentShippingAdvices($warehouseShippingAdviceInput: WarehouseShippingAdviceInput!) {
  warehouseShippingAdvices(warehouseShippingAdviceInput: $warehouseShippingAdviceInput) {
    pageInfo { hasNextPage hasPreviousPage totalPages totalItems }
    nodes {
      fulfillmentOrderItemId warehouseShippingAdviceDate fulfillmentOrderRequestId fulfillmentPurchaseOrderNumber supplierId
      retailer { name retailerId orderNumber }
      productDetails { ${FULFILLMENT_ITEM_FIELDS} }
      shippingDetails {
        shippingAddress { ${FULFILLMENT_ADDRESS_FIELDS} }
        shippingFromAddress { ${FULFILLMENT_ADDRESS_FIELDS} }
        warehouse { warehouseId name }
      }
      tracking { carrier carrierScac expectedShippingDate shippingDate shipSpeed shipSpeedCode trackingNumbers }
    }
  }
}`
const CREATE_FULFILLMENT_ORDER_MUTATION = `
mutation CreateFulfillmentOrder($fulfillmentOrderInput: CreateFulfillmentOrderInput!) {
  createFulfillmentOrder(fulfillmentOrderInput: $fulfillmentOrderInput) {
    fulfillmentOrderRequestId requestStatus errors { code message field value }
  }
}`
const CANCEL_FULFILLMENT_ORDER_MUTATION = `
mutation CancelFulfillmentOrder($cancelFulfillmentOrderInput: CancelFulfillmentOrderInput!) {
  cancelFulfillmentOrder(cancelFulfillmentOrderInput: $cancelFulfillmentOrderInput) {
    aggregatorOrderId errors { errorCode errorMessage errorField errorValue }
    results { fulfillmentOrderItemId supplierPartNumber requestStatus errors { errorCode errorMessage errorField errorValue } }
  }
}`
const INBOUND_COMPANY_FIELDS = `name type address { addressLine1 addressLine2 city province country postalCode }`
const INBOUND_ORDERS_QUERY = `
query InboundOrderList($supplierId: Int!, $status: InboundOrderStatus!, $paginate: InboundOrderPageInput!, $filters: InboundOrderFilterInput, $sorts: InboundOrderSortInput) {
  inboundOrderList(supplierId: $supplierId, status: $status, paginate: $paginate, filters: $filters, sorts: $sorts) {
    inboundOrders {
      orderId supplierOrderNumber orderStatus estimatedCargoReadyDate createdDate destinationName
      bookings {
        shippingOrderReceivedDate shippingOrderConfirmedDate
        shipments {
          shipmentId receivingIds masterBillOfLading houseBillOfLading containerNumber containerType originPortCode destinationPortCode trackingStatus
          legStops { locationName shipmentJourneyPortCode shipmentJourney { type timestamp } }
        }
      }
      shipper { ${INBOUND_COMPANY_FIELDS} }
      carrier { ${INBOUND_COMPANY_FIELDS} }
    }
  }
}`

// Supplier Catalog Read v2 uses a distinct production route and an explicit bounded union projection.
const CATALOG_ITEM_FIELDS = `
 supplierPartNumber marketContext { locale country brand channel segment location }
 catalogItemStatus class { classId className } listings { listingId }
`
const CATALOG_ITEMS_QUERY = `
query SupplierCatalogItems($input: SupplierCatalogItemsInput!, $marketContext: MarketContextInput) {
 supplierCatalogItems(input: $input) {
  __typename
  ... on SupplierCatalogItems {
   paginationInfo { page pageSize hasNextPage totalPages totalCount }
   supplier { supplierId supplierName }
   catalogItems {
    ${CATALOG_ITEM_FIELDS}
    salesChannels(marketContextInput: $marketContext) { ${CATALOG_ITEM_FIELDS} }
   }
  }
  ... on SupplierCatalogItemsError { httpError { code message } internalError { code message } }
 }
}`
const BRAND_ASSOCIATIONS_QUERY = `
query SupplierBrandAssociations($request: GetSupplierBrandsAssociationsRequest!) {
 supplierBrand { brandAssociations(request: $request) {
  brands { id manufacturer { id name } } pageInfo { hasNextPage hasPreviousPage totalPages }
 } }
}`
const MEDIA_METADATA_TAGS_QUERY = `
query MediaMetadataTags($input: MediaMetaDataTagInput!) {
 media { mediaMetaDataTags(mediaMetaDataTag: $input) { metaDataTagType metaDataTags { metaDataId name } } }
}`
const TAXONOMY_CATEGORIES_QUERY = `
query TaxonomyCategories($marketContext: MarketContextInput!, $paginationOptions: PaginationOptions) {
 taxonomyCategories(marketContext: $marketContext, paginationOptions: $paginationOptions) {
  pageInfo { page pageSize hasNextPage totalPages } taxonomyCategories { taxonomyCategoryId name }
 }
}`
const TAXONOMY_ATTRIBUTE_FIELDS = `
 taxonomyAttributeId title description market { locale country brand } requirement
 valueFormat {
  canValueBeCustomized canValueBeSetToUnavailable canValueBeSetToNotApplicable datatype
  measurement { measurementName measurementUnit { name symbol } }
 }
 possibleAttributeValues { value definition } parentAttributeId relatedAttributeIds taxonomyCategoryIds
`
// Deliberately uses the Product Update schema, not the incompatible Product Addition example.
const TAXONOMY_ATTRIBUTES_QUERY = `
query TaxonomyAttributes($input: AttributesFilterInput!) {
 attributesByFilter(input: $input) {
  taxonomyCategoryId
  attributes { ${TAXONOMY_ATTRIBUTE_FIELDS} childAttributes { ${TAXONOMY_ATTRIBUTE_FIELDS} } }
  conditionalityRules { taxonomyAttributeId rules {
   upstreamCondition { taxonomyAttributeId answers operation }
   downstreamConditions { taxonomyAttributeId validationType answers operation }
  } }
 }
}`
const CATALOG_UPDATE_STATUS_QUERY = `
query CatalogUpdateStatus($input: StatusOfUpdateRequestInput!) {
 statusOfUpdateRequest(input: $input) {
  requestId validationOnly status
  problems { code title detail catalogEntityIdentifier catalogEntityProperty catalogEntityPropertyId inputValue }
  successfulUpdates { entityIdentifier catalogEntityProperty }
 }
}`
const CATALOG_ITEM_MEDIA_MUTATION = `
mutation UpdateCatalogItemMedia($input: UpdateCatalogItemsMediaInput!) {
 updateCatalogEntitiesMutations { updateCatalogItemsMedia(input: $input) { requestId } }
}`
const CATALOG_ITEMS_MUTATION = `
mutation UpdateCatalogItems($input: UpdateMarketSpecificCatalogItemsInput!) {
 updateCatalogEntitiesMutations { updateMarketSpecificCatalogItems(input: $input) { requestId } }
}`
const CATALOG_ITEM_GROUPS_MUTATION = `
mutation UpdateCatalogItemGroups($input: UpdateMarketSpecificCatalogItemGroupsInput!) {
 updateCatalogEntitiesMutations { updateMarketSpecificCatalogItemGroups(input: $input) { requestId } }
}`

export type WayfairClientOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'> & {
	artifacts?: ArtifactsAuth | undefined
}

function parseInput<TSchema extends ZodType>(schema: TSchema, input: unknown, message: string): output<TSchema> {
	const parsed = schema.safeParse(input)
	if (!parsed.success) {
		throw new ToolError(message, {
			code: 'bad_input',
			details: { issues: parsed.error.issues.map((issue) => issue.message) }
		})
	}
	return parsed.data
}

function parseResponse<TSchema extends ZodType>(schema: TSchema, data: unknown, message: string): output<TSchema> {
	const parsed = schema.safeParse(data)
	if (!parsed.success) {
		throw new ToolError(message, {
			code: 'upstream',
			details: { issues: parsed.error.issues.map((issue) => issue.message) }
		})
	}
	return parsed.data
}

function graphqlError(message: string, issues: readonly string[]): never {
	throw new ToolError(message, { code: 'upstream', details: { issues } })
}

function assertOrderGraphqlResult(errors: readonly unknown[] | undefined, operation: string): void {
	if (errors?.length) {
		const extensions = errors.map((error) =>
			isPlainObject(error) && isPlainObject(error['extensions']) ? error['extensions'] : undefined
		)
		const invalidInput = extensions.some((extension) => {
			const classification = extension?.['classification']
			return (
				extension?.['category'] === 'BAD_REQUEST' ||
				extension?.['errorType'] === 'BAD_REQUEST' ||
				classification === 'ValidationError' ||
				(isPlainObject(classification) && classification['type'] === 'ExtendedValidationError')
			)
		})
		// Mutation errors may echo addresses or other submitted data. Do not expose those messages.
		throw new ToolError(`Wayfair Supplier ${operation} failed`, {
			code: extensions.some((extension) => extension?.['category'] === 'PERMISSION_DENIED')
				? 'forbidden'
				: invalidInput
					? 'bad_input'
					: 'upstream',
			details: { error_count: errors.length }
		})
	}
}

function assertCatalogGraphqlResult(data: unknown, operation: string): void {
	const envelope = parseResponse(
		z.object({ errors: z.array(z.unknown()).optional() }),
		data,
		'Invalid Wayfair catalog response'
	)
	assertOrderGraphqlResult(envelope.errors, operation)
}

function graphqlString(value: string): string {
	return JSON.stringify(value)
}

function dropshipPurchaseOrdersQuery(input: {
	limit: number
	from_date?: string
	has_response?: boolean
	po_numbers?: string[]
	sort_order: 'ASC' | 'DESC'
}): string {
	const argumentsList = [`limit: ${input.limit}`, `sortOrder: ${input.sort_order}`]
	if (input.from_date) argumentsList.push(`fromDate: ${graphqlString(input.from_date)}`)
	if (input.has_response !== undefined) argumentsList.push(`hasResponse: ${input.has_response}`)
	if (input.po_numbers) {
		argumentsList.push(`poNumbers: [${input.po_numbers.map(graphqlString).join(', ')}]`)
	}

	return `
query DropshipPurchaseOrders {
  getDropshipPurchaseOrders(${argumentsList.join(', ')}) {
    id
    poNumber
    poDate
    orderId
    estimatedShipDate
    salesChannelName
    orderType
    warehouse { id }
    products { partNumber quantity }
  }
}`
}

export class WayfairClient {
	readonly #auth: WayfairAuth
	readonly #tokenHttp: HttpService
	readonly #supplierHttp: HttpService
	readonly #orderHttp: HttpService
	readonly #artifacts: ArtifactsClient | undefined
	#accessToken: string | undefined
	#accessTokenExpiresAt = 0
	#accessTokenPromise: Promise<string> | undefined

	constructor(auth: WayfairAuth, options: WayfairClientOptions = {}) {
		const parsed = wayfairAuthSchema.safeParse(auth)
		if (!parsed.success) {
			throw new ToolError('Invalid Wayfair Supplier auth credentials', {
				code: 'bad_auth',
				details: { issues: parsed.error.issues.map((issue) => issue.message) }
			})
		}
		this.#auth = parsed.data
		// Prevent redirects from replaying mutations or moving authenticated requests to another origin.
		const fetch = options.fetch ?? globalThis.fetch
		const noRedirects: FetchLike = (input, init) => fetch(input, { ...init, redirect: 'error' })
		const transport = { fetch: noRedirects, ...(options.signal && { signal: options.signal }) }
		this.#tokenHttp = new HttpService({ ...transport, baseURL: WAYFAIR_TOKEN_BASE, label: 'Wayfair Supplier' })
		this.#supplierHttp = new HttpService({
			...transport,
			baseURL: this.#auth.environment === 'sandbox' ? `${WAYFAIR_SUPPLIER_BASE}/sandbox` : WAYFAIR_SUPPLIER_BASE,
			label: 'Wayfair Supplier'
		})
		this.#orderHttp = new HttpService({
			...transport,
			baseURL: this.#auth.environment === 'sandbox' ? 'https://sandbox.api.wayfair.com' : WAYFAIR_ORDER_BASE,
			label: 'Wayfair Supplier'
		})
		this.#artifacts = options.artifacts ? ArtifactsClient.fromAuth(options.artifacts, options) : undefined
	}

	static fromContext(ctx: ToolContext): WayfairClient {
		const artifacts = ctx.extras?.['artifacts']
		const auth = requireAuth(ctx, wayfairAuthSchema)
		return new WayfairClient(auth, {
			...(ctx.fetch && { fetch: ctx.fetch }),
			...(ctx.signal && { signal: ctx.signal }),
			...(artifacts !== undefined && { artifacts: requireAuth({ auth: artifacts }, artifactsAuthSchema) })
		})
	}

	async #refreshAccessToken(): Promise<string> {
		const requestedAt = Date.now()
		const { data } = await this.#tokenHttp.post(
			'/oauth/token',
			{
				grant_type: 'client_credentials',
				client_id: this.#auth.client_id,
				client_secret: this.#auth.client_secret,
				audience: this.#auth.environment === 'sandbox' ? 'https://sandbox.api.wayfair.com/' : WAYFAIR_AUDIENCE
			},
			{ label: 'Wayfair Supplier token', headers: { 'Content-Type': 'application/json' } }
		)
		const token = parseResponse(wayfairTokenResponseSchema, data, 'Wayfair Supplier returned an invalid token response')
		this.#accessToken = token.access_token
		this.#accessTokenExpiresAt = requestedAt + Math.max(0, token.expires_in * 1000 - 60_000)
		return token.access_token
	}

	async #ensureAccessToken(): Promise<string> {
		if (this.#accessToken && Date.now() < this.#accessTokenExpiresAt) return this.#accessToken

		const pending = this.#accessTokenPromise ?? this.#refreshAccessToken()
		this.#accessTokenPromise = pending
		try {
			return await pending
		} finally {
			if (this.#accessTokenPromise === pending) this.#accessTokenPromise = undefined
		}
	}

	async #headers(): Promise<Record<string, string>> {
		return {
			Accept: 'application/json',
			Authorization: `Bearer ${await this.#ensureAccessToken()}`,
			'Content-Type': 'application/json'
		}
	}

	/** One supplier catalog page. Wayfair accepts page sizes 10, 20, or 25. */
	async listCatalogPage(input: WayfairListCatalogPageInput = {}): Promise<WayfairListCatalogPageOutput> {
		const parsedInput = parseInput(wayfairListCatalogPageInputSchema, input, 'Invalid Wayfair catalog page input')
		const page = parsedInput.page ?? 1
		const pageSize = parsedInput.page_size ?? DEFAULT_CATALOG_PAGE_SIZE
		const { data } = await this.#supplierHttp.post(
			'/v1/supplier-catalog-api/graphql',
			{
				query: SUPPLIER_CATALOG_QUERY,
				variables: {
					supplierId: this.#auth.supplier_id,
					paginationOptions: { page, pageSize }
				}
			},
			{
				label: 'Wayfair Supplier listCatalogPage',
				headers: {
					...(await this.#headers()),
					'X-SELECTED-SUPPLIER-ID': String(this.#auth.supplier_id)
				}
			}
		)
		const response = parseResponse(
			wayfairCatalogResponseSchema,
			data,
			'Wayfair Supplier returned an invalid catalog page'
		)
		if (response.errors?.length) {
			graphqlError(
				'Wayfair Supplier catalog query failed',
				response.errors.map((error) => error.message)
			)
		}
		if (!response.data) graphqlError('Wayfair Supplier returned no catalog data', [])
		const catalog = response.data.supplierCatalog
		return {
			items: catalog.products,
			page: catalog.pageInfo.page,
			page_size: catalog.pageInfo.pageSize,
			total_pages: catalog.pageInfo.totalPages,
			has_next_page: catalog.pageInfo.hasNextPage
		}
	}

	/** One bounded read of dropship purchase orders. Customer PII is not selected. */
	async listDropshipOrders(input: WayfairListDropshipOrdersInput = {}): Promise<WayfairListDropshipOrdersOutput> {
		const parsedInput = parseInput(
			wayfairListDropshipOrdersInputSchema,
			input,
			'Invalid Wayfair dropship purchase orders input'
		)
		const limit = parsedInput.limit ?? DEFAULT_ORDER_LIMIT
		const { data } = await this.#orderHttp.post(
			'/v1/graphql',
			{
				query: dropshipPurchaseOrdersQuery({
					limit,
					sort_order: parsedInput.sort_order ?? 'ASC',
					...(parsedInput.from_date && { from_date: parsedInput.from_date }),
					...(parsedInput.has_response !== undefined && { has_response: parsedInput.has_response }),
					...(parsedInput.po_numbers && { po_numbers: parsedInput.po_numbers })
				})
			},
			{ label: 'Wayfair Supplier listDropshipOrders', headers: await this.#headers() }
		)
		const response = parseResponse(
			wayfairDropshipPurchaseOrdersResponseSchema,
			data,
			'Wayfair Supplier returned invalid dropship purchase orders'
		)
		if (response.errors?.length) {
			graphqlError(
				'Wayfair Supplier dropship purchase orders query failed',
				response.errors.map((error) => error.message)
			)
		}
		if (!response.data) graphqlError('Wayfair Supplier returned no dropship purchase order data', [])
		const items = response.data.getDropshipPurchaseOrders
		return { items, limit, limit_reached: items.length === limit }
	}

	/** One exact PO read, including the customer details required for fulfillment. Never acknowledges it. */
	async getDropshipOrder(input: WayfairGetDropshipOrderInput): Promise<WayfairDropshipOrderDetails> {
		const parsedInput = parseInput(wayfairGetDropshipOrderInputSchema, input, 'Invalid Wayfair purchase order input')
		const { data } = await this.#orderHttp.post(
			'/v1/graphql',
			{
				query:
					this.#auth.environment === 'sandbox'
						? DROPSHIP_ORDER_DETAILS_QUERY.replace('isCancelled', '')
						: DROPSHIP_ORDER_DETAILS_QUERY,
				variables: { poNumber: parsedInput.po_number }
			},
			{ label: 'Wayfair Supplier getDropshipOrder', headers: await this.#headers() }
		)
		const response = parseResponse(
			wayfairGetDropshipOrderResponseSchema,
			data,
			'Wayfair Supplier returned invalid purchase order details'
		)
		assertOrderGraphqlResult(response.errors, 'getDropshipOrder')
		if (!response.data) throw new ToolError('Wayfair Supplier returned no order data', { code: 'upstream' })
		const items = response.data.getDropshipPurchaseOrders
		const order = items[0]
		if (!order) throw new ToolError('Wayfair purchase order was not found', { code: 'not_found' })
		if (items.length !== 1 || order.poNumber !== parsedInput.po_number) {
			throw new ToolError('Wayfair Supplier returned an unexpected purchase order', { code: 'upstream' })
		}
		return order
	}

	/** purchaseOrders.accept. Submission state and per-item errors are returned without optimistic success. */
	async acceptDropshipOrder(input: WayfairAcceptDropshipOrderInput): Promise<WayfairTransactionStatus> {
		const parsedInput = parseInput(
			wayfairAcceptDropshipOrderInputSchema,
			input,
			'Invalid Wayfair order acceptance input'
		)
		const { data } = await this.#orderHttp.post(
			'/v1/graphql',
			{
				query: ACCEPT_DROPSHIP_ORDER_MUTATION,
				variables: acceptOrderVariables(parsedInput)
			},
			{ label: 'Wayfair Supplier acceptDropshipOrder', headers: await this.#headers() }
		)
		const response = parseResponse(
			wayfairAcceptDropshipOrderResponseSchema,
			data,
			'Wayfair Supplier returned an invalid order acceptance'
		)
		assertOrderGraphqlResult(response.errors, 'acceptDropshipOrder')
		const transaction = response.data?.purchaseOrders?.accept
		if (!transaction) throw new ToolError('Wayfair Supplier returned no acceptance transaction', { code: 'upstream' })
		return transaction
	}

	/** purchaseOrders.shipment. Sends one ASN; never retries or treats submission as completed processing. */
	async sendShipmentNotice(input: WayfairSendShipmentNoticeInput): Promise<WayfairTransactionStatus> {
		const parsedInput = parseInput(wayfairSendShipmentNoticeInputSchema, input, 'Invalid Wayfair shipment notice input')
		const { data } = await this.#orderHttp.post(
			'/v1/graphql',
			{
				query: SHIPMENT_NOTICE_MUTATION,
				variables: shipmentNoticeVariables(parsedInput)
			},
			{ label: 'Wayfair Supplier sendShipmentNotice', headers: await this.#headers() }
		)
		const response = parseResponse(
			wayfairSendShipmentNoticeResponseSchema,
			data,
			'Wayfair Supplier returned an invalid shipment notice transaction'
		)
		assertOrderGraphqlResult(response.errors, 'sendShipmentNotice')
		const transaction = response.data?.purchaseOrders?.shipment
		if (!transaction) throw new ToolError('Wayfair Supplier returned no shipment transaction', { code: 'upstream' })
		return transaction
	}

	/** Retrieve requests for up to 50 POs without confirming or rejecting any request. */
	async listCancellationRequestsByOrders(
		input: WayfairListCancellationRequestsByOrdersInput
	): Promise<WayfairListCancellationRequestsOutput> {
		const parsedInput = parseInput(
			wayfairListCancellationRequestsByOrdersInputSchema,
			input,
			'Invalid Wayfair cancellation purchase order input'
		)
		const { data } = await this.#supplierHttp.post(
			'/v1/supplier-order-api/graphql',
			{
				query: CANCELLATION_REQUESTS_BY_ORDERS_QUERY,
				variables: { poInput: { poNumbers: parsedInput.po_numbers } }
			},
			{ label: 'Wayfair Supplier listCancellationRequestsByOrders', headers: await this.#headers() }
		)
		const response = parseResponse(
			wayfairCancellationRequestsByOrdersResponseSchema,
			data,
			'Wayfair Supplier returned invalid cancellation requests'
		)
		assertOrderGraphqlResult(response.errors, 'listCancellationRequestsByOrders')
		if (!response.data) throw new ToolError('Wayfair Supplier returned no cancellation data', { code: 'upstream' })
		return { items: response.data.lineItemCancellationRequestByPurchaseOrders }
	}

	/** One read for up to 50 warehouses, with an explicit status and optional date window. */
	async listCancellationRequestsByWarehouses(
		input: WayfairListCancellationRequestsByWarehousesInput
	): Promise<WayfairListCancellationRequestsOutput> {
		const parsedInput = parseInput(
			wayfairListCancellationRequestsByWarehousesInputSchema,
			input,
			'Invalid Wayfair cancellation warehouse input'
		)
		const { data } = await this.#supplierHttp.post(
			'/v1/supplier-order-api/graphql',
			{
				query: CANCELLATION_REQUESTS_BY_WAREHOUSES_QUERY,
				variables: {
					warehouseInput: {
						warehouseIds: parsedInput.warehouse_ids,
						status: parsedInput.status,
						...(parsedInput.from_datetime !== undefined && { fromDatetime: parsedInput.from_datetime }),
						...(parsedInput.to_datetime !== undefined && { toDatetime: parsedInput.to_datetime })
					}
				}
			},
			{ label: 'Wayfair Supplier listCancellationRequestsByWarehouses', headers: await this.#headers() }
		)
		const response = parseResponse(
			wayfairCancellationRequestsByWarehousesResponseSchema,
			data,
			'Wayfair Supplier returned invalid warehouse cancellation requests'
		)
		assertOrderGraphqlResult(response.errors, 'listCancellationRequestsByWarehouses')
		if (!response.data) throw new ToolError('Wayfair Supplier returned no cancellation data', { code: 'upstream' })
		return { items: response.data.lineItemCancellationRequestByWarehouses }
	}

	/** One native batch, preserving SUCCESS/FAILURE for each request. Never replays the mutation. */
	async confirmCancellationRequests(
		input: WayfairConfirmCancellationRequestsInput
	): Promise<WayfairRespondCancellationRequestsOutput> {
		const parsedInput = parseInput(
			wayfairConfirmCancellationRequestsInputSchema,
			input,
			'Invalid Wayfair cancellation confirmation input'
		)
		const { data } = await this.#supplierHttp.post(
			'/v1/supplier-order-api/graphql',
			{
				query: CONFIRM_CANCELLATION_REQUESTS_MUTATION,
				variables: { confirmationInputs: parsedInput.request_ids.map((requestId) => ({ requestId })) }
			},
			{ label: 'Wayfair Supplier confirmCancellationRequests', headers: await this.#headers() }
		)
		const response = parseResponse(
			wayfairConfirmCancellationRequestsResponseSchema,
			data,
			'Wayfair Supplier returned invalid cancellation confirmations'
		)
		assertOrderGraphqlResult(response.errors, 'confirmCancellationRequests')
		if (!response.data)
			throw new ToolError('Wayfair Supplier returned no cancellation response data', { code: 'upstream' })
		return { items: response.data.confirmLineItemCancellationRequest }
	}

	/** Reject up to 100 pending cancellation requests, each with an explicit reason. */
	async rejectCancellationRequests(
		input: WayfairRejectCancellationRequestsInput
	): Promise<WayfairRespondCancellationRequestsOutput> {
		const parsedInput = parseInput(
			wayfairRejectCancellationRequestsInputSchema,
			input,
			'Invalid Wayfair cancellation rejection input'
		)
		const { data } = await this.#supplierHttp.post(
			'/v1/supplier-order-api/graphql',
			{
				query: REJECT_CANCELLATION_REQUESTS_MUTATION,
				variables: {
					rejectionInputs: parsedInput.requests.map((request) => ({
						requestId: request.request_id,
						reason: request.reason
					}))
				}
			},
			{ label: 'Wayfair Supplier rejectCancellationRequests', headers: await this.#headers() }
		)
		const response = parseResponse(
			wayfairRejectCancellationRequestsResponseSchema,
			data,
			'Wayfair Supplier returned invalid cancellation rejections'
		)
		assertOrderGraphqlResult(response.errors, 'rejectCancellationRequests')
		if (!response.data)
			throw new ToolError('Wayfair Supplier returned no cancellation response data', { code: 'upstream' })
		return { items: response.data.rejectLineItemCancellationRequest }
	}

	/** One cursor page of CastleGate and physical-retail inventory; never submits an inventory feed. */
	async listInventorySummary(input: WayfairListInventorySummaryInput = {}): Promise<WayfairListInventorySummaryOutput> {
		const parsedInput = parseInput(
			wayfairListInventorySummaryInputSchema,
			input,
			'Invalid Wayfair inventory summary input'
		)
		const { data } = await this.#supplierHttp.post(
			'/v1/supplier-order-api/graphql',
			{
				query: INVENTORY_SUMMARY_QUERY,
				variables: { supplierId: this.#auth.supplier_id, ...inventorySummaryVariables(parsedInput) }
			},
			{ label: 'Wayfair Supplier listInventorySummary', headers: await this.#headers() }
		)
		const response = parseResponse(
			wayfairInventorySummaryResponseSchema,
			data,
			'Wayfair Supplier returned invalid inventory summary data'
		)
		assertOrderGraphqlResult(response.errors, 'listInventorySummary')
		if (!response.data) throw new ToolError('Wayfair Supplier returned no inventory summary data', { code: 'upstream' })
		const connection = response.data.inventorySummaryList
		const { hasNextPage, endCursor } = connection.pageInfo
		if (hasNextPage && (!endCursor || endCursor === parsedInput.cursor)) {
			throw new ToolError('Wayfair Supplier returned a missing or non-advancing inventory cursor', { code: 'upstream' })
		}
		return { items: connection.edges.map((edge) => edge.node), has_next_page: hasNextPage, end_cursor: endCursor }
	}

	/** One zero-based page of signed CastleGate inventory adjustments. No write operation is exposed. */
	async listInventoryAdjustments(
		input: WayfairListInventoryAdjustmentsInput = {}
	): Promise<WayfairListInventoryAdjustmentsOutput> {
		const parsedInput = parseInput(
			wayfairListInventoryAdjustmentsInputSchema,
			input,
			'Invalid Wayfair inventory adjustment input'
		)
		const { data } = await this.#supplierHttp.post(
			'/v1/supplier-order-api/graphql',
			{
				query: INVENTORY_ADJUSTMENTS_QUERY,
				variables: { supplierId: this.#auth.supplier_id, ...inventoryAdjustmentVariables(parsedInput) }
			},
			{ label: 'Wayfair Supplier listInventoryAdjustments', headers: await this.#headers() }
		)
		const response = parseResponse(
			wayfairInventoryAdjustmentsResponseSchema,
			data,
			'Wayfair Supplier returned invalid inventory adjustment data'
		)
		assertOrderGraphqlResult(response.errors, 'listInventoryAdjustments')
		if (!response.data)
			throw new ToolError('Wayfair Supplier returned no inventory adjustment data', { code: 'upstream' })
		const connection = response.data.inventoryAdjustmentList
		return {
			items: connection.nodes,
			page: connection.pageInfo.pageNumber,
			page_size: connection.pageInfo.pageSize,
			total_pages: connection.pageInfo.totalPages,
			total_elements: connection.pageInfo.totalElements
		}
	}

	async saveInventory(input: WayfairSaveInventoryInput): Promise<WayfairTransactionStatus> {
		const parsed = parseInput(wayfairSaveInventoryInputSchema, input, 'Invalid Wayfair inventory feed')
		if (this.#auth.environment === 'sandbox' && (parsed.feed_kind !== 'TRUE_UP' || parsed.inventory.length > 500)) {
			throw new ToolError('Wayfair sandbox requires TRUE_UP with at most 500 inventory lines', { code: 'bad_input' })
		}
		const { data } = await this.#orderHttp.post(
			'/v1/graphql',
			{
				query: SAVE_INVENTORY_MUTATION,
				variables: saveInventoryVariables(parsed)
			},
			{ label: 'Wayfair saveInventory', headers: await this.#headers() }
		)
		const result = parseResponse(wayfairSaveInventoryResponseSchema, data, 'Invalid Wayfair inventory transaction')
		assertOrderGraphqlResult(result.errors, 'saveInventory')
		const transaction = result.data?.inventory?.save
		if (!transaction) throw new ToolError('Wayfair returned no inventory transaction', { code: 'upstream' })
		return transaction
	}

	async registerShipment(input: WayfairRegisterShipmentInput): Promise<WayfairLabelGenerationEvent> {
		const parsed = parseInput(wayfairRegisterShipmentInputSchema, input, 'Invalid Wayfair shipment registration')
		const { data } = await this.#orderHttp.post(
			'/v1/graphql',
			{
				query: REGISTER_SHIPMENT_MUTATION,
				variables: registerShipmentVariables(parsed)
			},
			{ label: 'Wayfair registerShipment', headers: await this.#headers() }
		)
		const result = parseResponse(wayfairRegisterShipmentResponseSchema, data, 'Invalid Wayfair registration response')
		assertOrderGraphqlResult(result.errors, 'registerShipment')
		const event = result.data?.purchaseOrders?.register
		if (!event) throw new ToolError('Wayfair returned no registration event', { code: 'upstream' })
		return event
	}

	async listLabelGenerationEvents(
		input: WayfairListLabelGenerationEventsInput = {}
	): Promise<WayfairListLabelGenerationEventsOutput> {
		const parsed = parseInput(wayfairListLabelGenerationEventsInputSchema, input, 'Invalid Wayfair label event filters')
		const variables = labelEventVariables(parsed)
		const { data } = await this.#orderHttp.post(
			'/v1/graphql',
			{
				query: LABEL_EVENTS_QUERY,
				variables
			},
			{ label: 'Wayfair listLabelGenerationEvents', headers: await this.#headers() }
		)
		const result = parseResponse(wayfairListLabelGenerationEventsResponseSchema, data, 'Invalid Wayfair label events')
		assertOrderGraphqlResult(result.errors, 'listLabelGenerationEvents')
		if (!result.data) throw new ToolError('Wayfair returned no label event data', { code: 'upstream' })
		return {
			items: result.data.labelGenerationEvents,
			limit: variables.limit,
			offset: variables.offset,
			limit_reached: result.data.labelGenerationEvents.length === variables.limit
		}
	}

	async getConsolidatedBol(input: WayfairGetConsolidatedBolInput): Promise<WayfairConsolidatedBol> {
		const parsed = parseInput(wayfairGetConsolidatedBolInputSchema, input, 'Invalid Wayfair consolidated BOL date')
		const { data } = await this.#supplierHttp.post(
			'/v1/supplier-order-api/graphql',
			{
				query: CONSOLIDATED_BOL_QUERY,
				variables: { supplierId: this.#auth.supplier_id, date: parsed.date }
			},
			{ label: 'Wayfair getConsolidatedBol', headers: await this.#headers() }
		)
		const result = parseResponse(
			wayfairConsolidatedBolResponseSchema,
			data,
			'Invalid Wayfair consolidated BOL response'
		)
		assertOrderGraphqlResult(result.errors, 'getConsolidatedBol')
		if (!result.data) throw new ToolError('Wayfair returned no consolidated BOL data', { code: 'upstream' })
		return result.data.consolidatedBolDocument
	}

	async downloadBillOfLadingBytes(input: WayfairDownloadDocumentInput): Promise<WayfairDocumentBytes> {
		const parsed = parseInput(wayfairDownloadDocumentInputSchema, input, 'Invalid Wayfair BOL download')
		const result = await this.#orderHttp.bytes('GET', `/v1/bill_of_lading/${encodeURIComponent(parsed.po_number)}`, {
			label: 'Wayfair bill of lading',
			headers: { ...(await this.#headers()), Accept: 'application/octet-stream' },
			maxBytes: parsed.max_bytes
		})
		return this.#documentBytes(result.bytes, result.headers)
	}

	async downloadPackingSlipBytes(input: WayfairDownloadDocumentInput): Promise<WayfairDocumentBytes> {
		const parsed = parseInput(wayfairDownloadDocumentInputSchema, input, 'Invalid Wayfair packing slip download')
		const result = await this.#orderHttp.bytes('GET', `/v1/packing_slip/${encodeURIComponent(parsed.po_number)}`, {
			label: 'Wayfair packing slip',
			headers: { ...(await this.#headers()), Accept: 'application/octet-stream' },
			maxBytes: parsed.max_bytes
		})
		return this.#documentBytes(result.bytes, result.headers)
	}

	async downloadShippingLabelBytes(input: WayfairDownloadDocumentInput): Promise<WayfairDocumentBytes> {
		const parsed = parseInput(wayfairDownloadDocumentInputSchema, input, 'Invalid Wayfair shipping label download')
		const result = await this.#orderHttp.bytes('GET', `/v1/shipping_label/${encodeURIComponent(parsed.po_number)}`, {
			label: 'Wayfair shipping label',
			headers: { ...(await this.#headers()), Accept: 'application/octet-stream' },
			maxBytes: parsed.max_bytes
		})
		return this.#documentBytes(result.bytes, result.headers)
	}

	#documentBytes(bytes: Uint8Array, headers: Headers): WayfairDocumentBytes {
		const mediaType = headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() || 'application/octet-stream'
		if (
			bytes.byteLength === 0 ||
			mediaType === 'text/html' ||
			mediaType === 'application/xhtml+xml' ||
			mediaType === 'application/json' ||
			mediaType.endsWith('+json')
		) {
			throw new ToolError('Wayfair returned an error document instead of shipping bytes', { code: 'upstream' })
		}
		return { bytes, media_type: mediaType, byte_length: bytes.byteLength }
	}

	#artifactStore(): ArtifactsClient {
		if (!this.#artifacts) throw new ToolError('Document downloads require bound artifact storage', { code: 'bad_auth' })
		return this.#artifacts
	}

	async downloadBillOfLading(input: WayfairStoreDocumentInput) {
		const parsed = parseInput(wayfairStoreDocumentInputSchema, input, 'Invalid Wayfair document destination')
		const store = this.#artifactStore()
		const result = await this.downloadBillOfLadingBytes({ po_number: parsed.po_number, max_bytes: parsed.max_bytes })
		return store.create({
			key: parsed.output_key,
			body: bytesToBase64(result.bytes),
			encoding: 'base64',
			media_type: result.media_type
		})
	}

	async downloadPackingSlip(input: WayfairStoreDocumentInput) {
		const parsed = parseInput(wayfairStoreDocumentInputSchema, input, 'Invalid Wayfair document destination')
		const store = this.#artifactStore()
		const result = await this.downloadPackingSlipBytes({ po_number: parsed.po_number, max_bytes: parsed.max_bytes })
		return store.create({
			key: parsed.output_key,
			body: bytesToBase64(result.bytes),
			encoding: 'base64',
			media_type: result.media_type
		})
	}

	async downloadShippingLabel(input: WayfairStoreDocumentInput) {
		const parsed = parseInput(wayfairStoreDocumentInputSchema, input, 'Invalid Wayfair document destination')
		const store = this.#artifactStore()
		const result = await this.downloadShippingLabelBytes({ po_number: parsed.po_number, max_bytes: parsed.max_bytes })
		return store.create({
			key: parsed.output_key,
			body: bytesToBase64(result.bytes),
			encoding: 'base64',
			media_type: result.media_type
		})
	}

	async listCastleGateOrders(input: WayfairListCastleGateOrdersInput = {}): Promise<WayfairListCastleGateOrdersOutput> {
		const parsed = parseInput(wayfairListCastleGateOrdersInputSchema, input, 'Invalid CastleGate order filters')
		const limit = parsed.limit ?? 10
		const { data } = await this.#orderHttp.post(
			'/v1/graphql',
			{
				query: CASTLEGATE_ORDERS_QUERY,
				variables: {
					limit,
					sortOrder: parsed.sort_order ?? 'ASC',
					...(parsed.has_response !== undefined && { hasResponse: parsed.has_response }),
					...(parsed.from_date && { fromDate: parsed.from_date }),
					...(parsed.po_numbers && { poNumbers: parsed.po_numbers })
				}
			},
			{ label: 'Wayfair listCastleGateOrders', headers: await this.#headers() }
		)
		const result = parseResponse(wayfairCastleGateOrdersResponseSchema, data, 'Invalid CastleGate orders')
		assertOrderGraphqlResult(result.errors, 'listCastleGateOrders')
		if (!result.data) throw new ToolError('Wayfair returned no CastleGate order data', { code: 'upstream' })
		const items = result.data.getCastleGatePurchaseOrders
		return { items, limit, limit_reached: items?.length === limit }
	}

	async listCastleGateShippingAdvices(
		input: WayfairListCastleGateShippingAdvicesInput = {}
	): Promise<WayfairListCastleGateShippingAdvicesOutput> {
		const parsed = parseInput(
			wayfairListCastleGateShippingAdvicesInputSchema,
			input,
			'Invalid CastleGate shipping advice filters'
		)
		const limit = parsed.limit ?? 10
		const { data } = await this.#orderHttp.post(
			'/v1/graphql',
			{
				query: CASTLEGATE_ADVICES_QUERY,
				variables: {
					limit,
					sortOrder: parsed.sort_order ?? 'ASC',
					...(parsed.has_response !== undefined && { hasResponse: parsed.has_response }),
					...(parsed.from_date && { fromDate: parsed.from_date }),
					...(parsed.wsa_ids && { wsaIds: parsed.wsa_ids })
				}
			},
			{ label: 'Wayfair listCastleGateShippingAdvices', headers: await this.#headers() }
		)
		const result = parseResponse(
			wayfairCastleGateShippingAdvicesResponseSchema,
			data,
			'Invalid CastleGate shipping advices'
		)
		assertOrderGraphqlResult(result.errors, 'listCastleGateShippingAdvices')
		if (!result.data) throw new ToolError('Wayfair returned no CastleGate shipping advice data', { code: 'upstream' })
		const items = result.data.getCastleGateWarehouseShippingAdvice
		return { items, limit, limit_reached: items?.length === limit }
	}

	async acknowledgeCastleGateOrder(input: WayfairAcknowledgeCastleGateOrderInput): Promise<WayfairTransactionStatus> {
		const parsed = parseInput(
			wayfairAcknowledgeCastleGateOrderInputSchema,
			input,
			'Invalid CastleGate order acknowledgment'
		)
		const { data } = await this.#orderHttp.post(
			'/v1/graphql',
			{
				query: ACKNOWLEDGE_CASTLEGATE_ORDER_MUTATION,
				variables: { poNumber: parsed.po_number }
			},
			{ label: 'Wayfair acknowledgeCastleGateOrder', headers: await this.#headers() }
		)
		const result = parseResponse(
			wayfairAcknowledgeCastleGateOrderResponseSchema,
			data,
			'Invalid CastleGate acknowledgment response'
		)
		assertOrderGraphqlResult(result.errors, 'acknowledgeCastleGateOrder')
		const transaction = result.data?.purchaseOrders?.acknowledgeCastleGate
		if (!transaction)
			throw new ToolError('Wayfair returned no CastleGate acknowledgment transaction', { code: 'upstream' })
		return transaction
	}

	async acknowledgeCastleGateShippingAdvices(
		input: WayfairAcknowledgeCastleGateShippingAdvicesInput
	): Promise<WayfairTransactionStatus> {
		const parsed = parseInput(
			wayfairAcknowledgeCastleGateShippingAdvicesInputSchema,
			input,
			'Invalid CastleGate shipping advice acknowledgment'
		)
		const { data } = await this.#orderHttp.post(
			'/v1/graphql',
			{
				query: ACKNOWLEDGE_CASTLEGATE_ADVICES_MUTATION,
				variables: { wsaIds: parsed.wsa_ids }
			},
			{ label: 'Wayfair acknowledgeCastleGateShippingAdvices', headers: await this.#headers() }
		)
		const result = parseResponse(
			wayfairAcknowledgeCastleGateShippingAdvicesResponseSchema,
			data,
			'Invalid CastleGate shipping advice acknowledgment response'
		)
		assertOrderGraphqlResult(result.errors, 'acknowledgeCastleGateShippingAdvices')
		const transaction = result.data?.purchaseOrders?.acknowledgeCastleGateWarehouseShippingAdvice
		if (!transaction)
			throw new ToolError('Wayfair returned no CastleGate shipping advice acknowledgment transaction', {
				code: 'upstream'
			})
		return transaction
	}

	async getFulfillmentOrder(input: WayfairGetFulfillmentOrderInput): Promise<WayfairFulfillmentOrderDetails> {
		const parsed = parseInput(
			wayfairGetFulfillmentOrderInputSchema,
			input,
			'Invalid Wayfair fulfillment order reference'
		)
		const { data } = await this.#supplierHttp.post(
			'/v1/supplier-order-api/graphql',
			{
				query: GET_FULFILLMENT_ORDER_QUERY,
				variables: {
					orderDetailsInput: {
						supplierId: this.#auth.supplier_id,
						fulfillmentOrderRequestId: parsed.request_id,
						...(parsed.locale !== undefined && { locale: parsed.locale })
					}
				}
			},
			{ label: 'Wayfair getFulfillmentOrder', headers: await this.#headers() }
		)
		const result = parseResponse(
			wayfairGetFulfillmentOrderResponseSchema,
			data,
			'Invalid Wayfair fulfillment order details'
		)
		assertOrderGraphqlResult(result.errors, 'getFulfillmentOrder')
		if (!result.data) throw new ToolError('Wayfair returned no fulfillment data', { code: 'upstream' })
		const details = result.data.fulfillmentOrderDetails
		if (!details) throw new ToolError('Wayfair fulfillment order was not found', { code: 'not_found' })
		if (details.fulfillmentOrder.requestId !== parsed.request_id)
			throw new ToolError('Wayfair returned a different fulfillment order', { code: 'upstream' })
		return details
	}

	async listFulfillmentOrders(
		input: WayfairListFulfillmentOrdersInput = {}
	): Promise<WayfairListFulfillmentOrdersOutput> {
		const parsed = parseInput(
			wayfairListFulfillmentOrdersInputSchema,
			input,
			'Invalid Wayfair fulfillment order filters'
		)
		const { data } = await this.#supplierHttp.post(
			'/v1/supplier-order-api/graphql',
			{
				query: LIST_FULFILLMENT_ORDERS_QUERY,
				variables: fulfillmentOrderListVariables(parsed, this.#auth.supplier_id)
			},
			{ label: 'Wayfair listFulfillmentOrders', headers: await this.#headers() }
		)
		const result = parseResponse(
			wayfairListFulfillmentOrdersResponseSchema,
			data,
			'Invalid Wayfair fulfillment order page'
		)
		assertOrderGraphqlResult(result.errors, 'listFulfillmentOrders')
		if (!result.data) throw new ToolError('Wayfair returned no fulfillment order page', { code: 'upstream' })
		return result.data.fulfillmentOrderDetailsList
	}

	async listFulfillmentShippingAdvices(
		input: WayfairListFulfillmentShippingAdvicesInput = {}
	): Promise<WayfairListFulfillmentShippingAdvicesOutput> {
		const parsed = parseInput(
			wayfairListFulfillmentShippingAdvicesInputSchema,
			input,
			'Invalid Wayfair fulfillment shipping advice filters'
		)
		const { data } = await this.#supplierHttp.post(
			'/v1/supplier-order-api/graphql',
			{
				query: FULFILLMENT_ADVICES_QUERY,
				variables: {
					warehouseShippingAdviceInput: {
						supplierId: this.#auth.supplier_id,
						page: parsed.page ?? 1,
						pageSize: parsed.page_size ?? 50,
						sortOption: { sortBy: 'WAREHOUSE_SHIPPING_ADVICE_DATE', sortOrder: parsed.sort_order ?? 'DESC' },
						...(parsed.fulfillment_order_item_ids !== undefined && {
							fulfillmentOrderItemIds: parsed.fulfillment_order_item_ids
						}),
						...(parsed.date_interval && { warehouseShippingAdviceDateInterval: parsed.date_interval })
					}
				}
			},
			{ label: 'Wayfair listFulfillmentShippingAdvices', headers: await this.#headers() }
		)
		const result = parseResponse(
			wayfairListFulfillmentShippingAdvicesResponseSchema,
			data,
			'Invalid Wayfair fulfillment shipping advice page'
		)
		assertOrderGraphqlResult(result.errors, 'listFulfillmentShippingAdvices')
		if (!result.data) throw new ToolError('Wayfair returned no fulfillment shipping advice page', { code: 'upstream' })
		return result.data.warehouseShippingAdvices
	}

	async createFulfillmentOrder(
		input: WayfairCreateFulfillmentOrderInput
	): Promise<WayfairCreateFulfillmentOrderOutput> {
		const parsed = parseInput(wayfairCreateFulfillmentOrderInputSchema, input, 'Invalid Wayfair fulfillment order')
		const { data } = await this.#supplierHttp.post(
			'/v1/supplier-order-api/graphql',
			{
				query: CREATE_FULFILLMENT_ORDER_MUTATION,
				variables: createFulfillmentOrderVariables(parsed, this.#auth.supplier_id)
			},
			{ label: 'Wayfair createFulfillmentOrder', headers: await this.#headers() }
		)
		const result = parseResponse(
			wayfairCreateFulfillmentOrderResponseSchema,
			data,
			'Invalid Wayfair fulfillment creation response'
		)
		assertOrderGraphqlResult(result.errors, 'createFulfillmentOrder')
		if (!result.data) throw new ToolError('Wayfair returned no fulfillment creation response', { code: 'upstream' })
		return result.data.createFulfillmentOrder
	}

	async cancelFulfillmentOrder(
		input: WayfairCancelFulfillmentOrderInput
	): Promise<WayfairCancelFulfillmentOrderOutput> {
		const parsed = parseInput(
			wayfairCancelFulfillmentOrderInputSchema,
			input,
			'Invalid Wayfair fulfillment cancellation'
		)
		const { data } = await this.#supplierHttp.post(
			'/v1/supplier-order-api/graphql',
			{
				query: CANCEL_FULFILLMENT_ORDER_MUTATION,
				variables: {
					cancelFulfillmentOrderInput: {
						aggregatorOrderId: parsed.request_id,
						supplierId: String(this.#auth.supplier_id)
					}
				}
			},
			{ label: 'Wayfair cancelFulfillmentOrder', headers: await this.#headers() }
		)
		const result = parseResponse(
			wayfairCancelFulfillmentOrderResponseSchema,
			data,
			'Invalid Wayfair fulfillment cancellation response'
		)
		assertOrderGraphqlResult(result.errors, 'cancelFulfillmentOrder')
		if (!result.data) throw new ToolError('Wayfair returned no fulfillment cancellation response', { code: 'upstream' })
		return result.data.cancelFulfillmentOrder
	}

	async listInboundOrders(input: WayfairListInboundOrdersInput): Promise<WayfairListInboundOrdersOutput> {
		const parsed = parseInput(wayfairListInboundOrdersInputSchema, input, 'Invalid Wayfair inbound order filters')
		const variables = inboundOrderVariables(parsed, this.#auth.supplier_id)
		const { data } = await this.#supplierHttp.post(
			'/v1/supplier-order-api/graphql',
			{
				query: INBOUND_ORDERS_QUERY,
				variables
			},
			{ label: 'Wayfair listInboundOrders', headers: await this.#headers() }
		)
		const result = parseResponse(wayfairListInboundOrdersResponseSchema, data, 'Invalid Wayfair inbound order page')
		assertOrderGraphqlResult(result.errors, 'listInboundOrders')
		if (!result.data?.inboundOrderList)
			throw new ToolError('Wayfair returned no inbound order page', { code: 'upstream' })
		const items = result.data.inboundOrderList.inboundOrders
		return {
			items,
			limit: variables.paginate.limit,
			offset: variables.paginate.offset,
			limit_reached: items?.length === variables.paginate.limit
		}
	}

	async generateAdvertisingReport(
		input: WayfairGenerateAdvertisingReportInput
	): Promise<WayfairGenerateAdvertisingReportOutput> {
		const parsed = parseInput(wayfairGenerateAdvertisingReportInputSchema, input, 'Invalid Wayfair advertising report')
		const { data } = await this.#supplierHttp.post(
			'/advertising/v1/reports',
			{
				name: parsed.name,
				reportType: parsed.report_type,
				fileType: parsed.file_type,
				attributionWindow: parsed.attribution_window ?? 14,
				groupBy: parsed.group_by,
				program: parsed.program,
				supplierId: this.#auth.supplier_id,
				filters: {
					...(parsed.filters.start_date !== undefined && { startDate: parsed.filters.start_date }),
					...(parsed.filters.end_date !== undefined && { endDate: parsed.filters.end_date })
				}
			},
			{ label: 'Wayfair generateAdvertisingReport', headers: await this.#headers() }
		)
		return parseResponse(
			wayfairGenerateAdvertisingReportOutputSchema,
			data,
			'Invalid Wayfair advertising report generation response'
		)
	}

	async getAdvertisingReport(input: WayfairGetAdvertisingReportInput): Promise<WayfairAdvertisingReportStatus> {
		const parsed = parseInput(wayfairGetAdvertisingReportInputSchema, input, 'Invalid Wayfair advertising report ID')
		const { data } = await this.#supplierHttp.get('/advertising/v1/reports', {
			query: { reportId: parsed.report_id, supplierId: this.#auth.supplier_id },
			label: 'Wayfair getAdvertisingReport',
			headers: await this.#headers()
		})
		return parseResponse(wayfairAdvertisingReportStatusSchema, data, 'Invalid Wayfair advertising report status')
	}

	async updateAdvertisingCampaign(
		input: WayfairUpdateAdvertisingCampaignInput
	): Promise<WayfairUpdateAdvertisingCampaignOutput> {
		const parsed = parseInput(
			wayfairUpdateAdvertisingCampaignInputSchema,
			input,
			'Invalid Wayfair advertising campaign update'
		)
		const { data } = await this.#supplierHttp.post(
			`/advertising/v1/campaign/${parsed.campaign_id}`,
			{
				campaignProductData: {
					listings: Object.fromEntries(
						Object.entries(parsed.listings).map(([id, listing]) => [
							id,
							{
								...(listing.status !== undefined && { status: listing.status }),
								...(listing.bid !== undefined && { bid: listing.bid }),
								...(listing.is_active !== undefined && { isActive: listing.is_active })
							}
						])
					)
				}
			},
			{ label: 'Wayfair updateAdvertisingCampaign', headers: await this.#headers() }
		)
		return parseResponse(wayfairUpdateAdvertisingCampaignOutputSchema, data, 'Invalid Wayfair campaign update response')
	}

	/** Supplier Catalog Read v2: bounded fields and one sales-channel level, not a full attribute export. */
	async listCatalogItems(input: WayfairListCatalogItemsInput): Promise<WayfairListCatalogItemsOutput> {
		const parsed = parseInput(wayfairListCatalogItemsInputSchema, input, 'Invalid Wayfair catalog item filters')
		const path =
			this.#auth.environment === 'sandbox' ? '/v1/product-catalog-api/graphql' : '/product-catalog-api/graphql'
		const { data } = await this.#supplierHttp.post(
			path,
			{
				query: CATALOG_ITEMS_QUERY,
				variables: catalogItemsVariables(parsed)
			},
			{
				label: 'Wayfair listCatalogItems',
				headers: { ...(await this.#headers()), 'X-SELECTED-SUPPLIER-ID': String(this.#auth.supplier_id) }
			}
		)
		assertCatalogGraphqlResult(data, 'listCatalogItems')
		const result = parseResponse(wayfairListCatalogItemsResponseSchema, data, 'Invalid Wayfair catalog items response')
		const catalog = result.data?.supplierCatalogItems
		if (!catalog) throw new ToolError('Wayfair returned no catalog items data', { code: 'upstream' })
		if (catalog.__typename === 'SupplierCatalogItemsError') {
			// Error messages and unknown codes can contain submitted data; do not echo them.
			const code = catalog.httpError?.code
			throw new ToolError('Wayfair catalog items query failed', {
				code:
					code === 'UNAUTHORIZED'
						? 'bad_auth'
						: code === 'FORBIDDEN'
							? 'forbidden'
							: code === 'BAD_REQUEST'
								? 'bad_input'
								: 'upstream'
			})
		}
		if (catalog.supplier.supplierId !== String(this.#auth.supplier_id)) {
			throw new ToolError('Wayfair returned a different supplier catalog', { code: 'upstream' })
		}
		return wayfairListCatalogItemsOutputSchema.parse(catalog)
	}

	async listBrandAssociations(input: WayfairListBrandAssociationsInput): Promise<WayfairListBrandAssociationsOutput> {
		const parsed = parseInput(
			wayfairListBrandAssociationsInputSchema,
			input,
			'Invalid Wayfair brand association filters'
		)
		const { data } = await this.#supplierHttp.post(
			'/v1/product-catalog-api/graphql',
			{
				query: BRAND_ASSOCIATIONS_QUERY,
				variables: {
					request: {
						supplierId: this.#auth.supplier_id,
						marketContext: parsed.market_context,
						pageSize: parsed.page_size,
						...(parsed.page !== undefined && { page: parsed.page })
					}
				}
			},
			{ label: 'Wayfair listBrandAssociations', headers: await this.#headers() }
		)
		assertCatalogGraphqlResult(data, 'listBrandAssociations')
		const result = parseResponse(wayfairListBrandAssociationsResponseSchema, data, 'Invalid Wayfair brand associations')
		const associations = result.data?.supplierBrand?.brandAssociations
		if (!associations) throw new ToolError('Wayfair returned no brand associations', { code: 'upstream' })
		return associations
	}

	async getMediaMetadataTags(input: WayfairGetMediaMetadataTagsInput): Promise<WayfairGetMediaMetadataTagsOutput> {
		const parsed = parseInput(wayfairGetMediaMetadataTagsInputSchema, input, 'Invalid Wayfair media metadata filters')
		const { data } = await this.#supplierHttp.post(
			'/v1/product-catalog-api/graphql',
			{
				query: MEDIA_METADATA_TAGS_QUERY,
				variables: { input: { metaDataTagTypes: parsed.meta_data_tag_types, marketContext: parsed.market_context } }
			},
			{ label: 'Wayfair getMediaMetadataTags', headers: await this.#headers() }
		)
		assertCatalogGraphqlResult(data, 'getMediaMetadataTags')
		const result = parseResponse(wayfairGetMediaMetadataTagsResponseSchema, data, 'Invalid Wayfair media metadata tags')
		const tags = result.data?.media?.mediaMetaDataTags
		if (!tags) throw new ToolError('Wayfair returned no media metadata tags', { code: 'upstream' })
		return tags
	}

	async listTaxonomyCategories(
		input: WayfairListTaxonomyCategoriesInput
	): Promise<WayfairListTaxonomyCategoriesOutput> {
		const parsed = parseInput(
			wayfairListTaxonomyCategoriesInputSchema,
			input,
			'Invalid Wayfair taxonomy category filters'
		)
		const pagination = parsed.pagination_options
		const { data } = await this.#supplierHttp.post(
			'/v1/product-catalog-api/graphql',
			{
				query: TAXONOMY_CATEGORIES_QUERY,
				variables: {
					marketContext: parsed.market_context,
					...(pagination && {
						paginationOptions: {
							...(pagination.page !== undefined && { page: pagination.page }),
							...(pagination.page_size !== undefined && { pageSize: pagination.page_size })
						}
					})
				}
			},
			{ label: 'Wayfair listTaxonomyCategories', headers: await this.#headers() }
		)
		assertCatalogGraphqlResult(data, 'listTaxonomyCategories')
		const result = parseResponse(
			wayfairListTaxonomyCategoriesResponseSchema,
			data,
			'Invalid Wayfair taxonomy categories'
		)
		const categories = result.data?.taxonomyCategories
		if (!categories) throw new ToolError('Wayfair returned no taxonomy categories', { code: 'upstream' })
		return categories
	}

	/** Product Update taxonomyCategoryId contract; not interchangeable with Addition classId. */
	async getTaxonomyAttributes(input: WayfairGetTaxonomyAttributesInput): Promise<WayfairGetTaxonomyAttributesOutput> {
		const parsed = parseInput(
			wayfairGetTaxonomyAttributesInputSchema,
			input,
			'Invalid Wayfair taxonomy attribute filters'
		)
		const { data } = await this.#supplierHttp.post(
			'/v1/product-catalog-api/graphql',
			{
				query: TAXONOMY_ATTRIBUTES_QUERY,
				variables: { input: { taxonomyCategoryId: parsed.taxonomy_category_id, marketContext: parsed.market_context } }
			},
			{ label: 'Wayfair getTaxonomyAttributes', headers: await this.#headers() }
		)
		assertCatalogGraphqlResult(data, 'getTaxonomyAttributes')
		const result = parseResponse(
			wayfairGetTaxonomyAttributesResponseSchema,
			data,
			'Invalid Wayfair taxonomy attributes'
		)
		const attributes = result.data?.attributesByFilter
		if (!attributes) throw new ToolError('Wayfair returned no taxonomy attributes', { code: 'upstream' })
		return attributes
	}

	/** COMPLETED can include partial failures; validationOnly never indicates applied changes. */
	async getCatalogUpdateStatus(
		input: WayfairGetCatalogUpdateStatusInput
	): Promise<WayfairGetCatalogUpdateStatusOutput> {
		const parsed = parseInput(
			wayfairGetCatalogUpdateStatusInputSchema,
			input,
			'Invalid Wayfair catalog update request ID'
		)
		const { data } = await this.#supplierHttp.post(
			'/v1/product-catalog-api/graphql',
			{
				query: CATALOG_UPDATE_STATUS_QUERY,
				variables: { input: { requestId: parsed.request_id, supplierId: String(this.#auth.supplier_id) } }
			},
			{ label: 'Wayfair getCatalogUpdateStatus', headers: await this.#headers() }
		)
		assertCatalogGraphqlResult(data, 'getCatalogUpdateStatus')
		const result = parseResponse(
			wayfairGetCatalogUpdateStatusResponseSchema,
			data,
			'Invalid Wayfair catalog update status'
		)
		const status = result.data?.statusOfUpdateRequest
		if (!status) throw new ToolError('Wayfair returned no catalog update status', { code: 'upstream' })
		if (status.requestId !== parsed.request_id)
			throw new ToolError('Wayfair returned a different catalog update request', { code: 'upstream' })
		return status
	}

	/** Submit exactly once; the returned request ID is not a processing status. */
	async updateCatalogItemMedia(input: WayfairUpdateCatalogItemMediaInput): Promise<WayfairCatalogUpdateRequest> {
		const parsed = parseInput(
			wayfairUpdateCatalogItemMediaInputSchema,
			input,
			'Invalid Wayfair updateCatalogItemMedia input'
		)
		const { data } = await this.#supplierHttp.post(
			'/v1/product-catalog-api/graphql',
			{
				query: CATALOG_ITEM_MEDIA_MUTATION,
				variables: catalogItemMediaVariables(parsed, this.#auth.supplier_id)
			},
			{ label: 'Wayfair updateCatalogItemMedia', headers: await this.#headers() }
		)
		assertCatalogGraphqlResult(data, 'updateCatalogItemMedia')
		const result = parseResponse(
			wayfairUpdateCatalogItemMediaResponseSchema,
			data,
			'Invalid Wayfair updateCatalogItemMedia response'
		)
		const request = result.data?.updateCatalogEntitiesMutations?.updateCatalogItemsMedia
		if (!request) throw new ToolError('Wayfair returned no catalog update request', { code: 'upstream' })
		return request
	}

	/** Submit exactly once; the returned request ID is not a processing status. */
	async updateCatalogItems(input: WayfairUpdateCatalogItemsInput): Promise<WayfairCatalogUpdateRequest> {
		const parsed = parseInput(wayfairUpdateCatalogItemsInputSchema, input, 'Invalid Wayfair updateCatalogItems input')
		const { data } = await this.#supplierHttp.post(
			'/v1/product-catalog-api/graphql',
			{
				query: CATALOG_ITEMS_MUTATION,
				variables: catalogItemUpdateVariables(parsed, this.#auth.supplier_id)
			},
			{ label: 'Wayfair updateCatalogItems', headers: await this.#headers() }
		)
		assertCatalogGraphqlResult(data, 'updateCatalogItems')
		const result = parseResponse(
			wayfairUpdateCatalogItemsResponseSchema,
			data,
			'Invalid Wayfair updateCatalogItems response'
		)
		const request = result.data?.updateCatalogEntitiesMutations?.updateMarketSpecificCatalogItems
		if (!request) throw new ToolError('Wayfair returned no catalog update request', { code: 'upstream' })
		return request
	}

	/** Submit exactly once; the returned request ID is not a processing status. */
	async updateCatalogItemGroups(input: WayfairUpdateCatalogItemGroupsInput): Promise<WayfairCatalogUpdateRequest> {
		const parsed = parseInput(
			wayfairUpdateCatalogItemGroupsInputSchema,
			input,
			'Invalid Wayfair updateCatalogItemGroups input'
		)
		const { data } = await this.#supplierHttp.post(
			'/v1/product-catalog-api/graphql',
			{
				query: CATALOG_ITEM_GROUPS_MUTATION,
				variables: catalogItemGroupVariables(parsed, this.#auth.supplier_id)
			},
			{ label: 'Wayfair updateCatalogItemGroups', headers: await this.#headers() }
		)
		assertCatalogGraphqlResult(data, 'updateCatalogItemGroups')
		const result = parseResponse(
			wayfairUpdateCatalogItemGroupsResponseSchema,
			data,
			'Invalid Wayfair updateCatalogItemGroups response'
		)
		const request = result.data?.updateCatalogEntitiesMutations?.updateMarketSpecificCatalogItemGroups
		if (!request) throw new ToolError('Wayfair returned no catalog update request', { code: 'upstream' })
		return request
	}
}
