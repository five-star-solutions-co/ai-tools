# Wayfair Supplier

| | |
| --- | --- |
| **Import** | `@5ss/ai-tools/wayfair` |
| **Kind** | **vendor** (`src/vendors/wayfair`) |
| **Module id** | `wayfair` |
| **Client** | `WayfairClient` |
| **Environment** | Production (default) or sandbox |

Wayfair Supplier access for catalog, dropship and CastleGate fulfillment, cancellations, inventory, shipping documents, inbound milestones, and advertising. `listDropshipOrders` retains its lightweight selection without customer details. Explicit detail and fulfillment reads include the addresses needed for fulfillment.

## Auth

```ts
{
  client_id: string
  client_secret: string
  supplier_id: number
  environment?: 'production' | 'sandbox'
}
```

The client exchanges these credentials at `https://sso.auth.wayfair.com/oauth/token`. The audience is `https://api.wayfair.com/` in production or `https://sandbox.api.wayfair.com/` in sandbox. Tokens are cached per client, refreshed before expiry, and concurrent refreshes are deduplicated. Auth remains host-owned and never appears in tool input. Reuse a client for host workflows that should share its token cache.

Production defaults and tool inputs are unchanged. Sandbox uses `https://sandbox.api.wayfair.com` for orders/documents and `https://api.wayfair.io/sandbox` for supplier APIs. The sandbox dropship detail query omits the production-only `isCancelled` field. Entitlements and account enablement still apply.

The credential schema contains only JSON data and supports plain `wayfairModule.auth.schema.toJSONSchema()` after narrowing `auth.type` to `custom`. No schema overrides are needed.

### Document storage binding

Storage is runtime configuration, not Wayfair authentication. Pass the existing [artifact binding](../modules/artifacts.md) (`ArtifactsAuth`, object or host provider) through client options or `ToolContext.extras.artifacts`:

```ts
const client = new WayfairClient(auth, { artifacts })

const bound = bindModule(wayfairModule, {
  resolveAuth: async () => auth,
  resolveContext: async () => ({ extras: { artifacts } }),
})
```

`withAuth(wayfairModule, auth)` also works when the execution context supplies `extras.artifacts`. Storage is required only for methods returning stored documents; bounded host byte methods do not require it.

**Binding API change:** move the previous `auth.artifacts` value to `options.artifacts` for direct clients or `extras.artifacts` for tools. Callbacks must not be stored with credentials or passed as tool inputs. Consuming apps must adopt a released SDK containing this change before regenerating their credential catalogs; a local SDK fix alone does not update an installed package.

## Tools and client methods

| Tool id | Client method | API |
| --- | --- | --- |
| `wayfair-list-catalog` | `listCatalogPage` | `POST https://api.wayfair.io/v1/supplier-catalog-api/graphql` |
| `wayfair-list-dropship-orders` | `listDropshipOrders` | `POST https://api.wayfair.com/v1/graphql` |
| `wayfair-get-dropship-order` | `getDropshipOrder` | `getDropshipPurchaseOrders` filtered by exact PO number |
| `wayfair-accept-dropship-order` | `acceptDropshipOrder` | `purchaseOrders.accept` mutation |
| `wayfair-send-shipment-notice` | `sendShipmentNotice` | `purchaseOrders.shipment` mutation |
| `wayfair-list-cancellation-requests-by-orders` | `listCancellationRequestsByOrders` | `lineItemCancellationRequestByPurchaseOrders` query |
| `wayfair-list-cancellation-requests-by-warehouses` | `listCancellationRequestsByWarehouses` | `lineItemCancellationRequestByWarehouses` query |
| `wayfair-confirm-cancellation-requests` | `confirmCancellationRequests` | `confirmLineItemCancellationRequest` mutation |
| `wayfair-reject-cancellation-requests` | `rejectCancellationRequests` | `rejectLineItemCancellationRequest` mutation |
| `wayfair-list-inventory-summary` | `listInventorySummary` | `inventorySummaryList` query |
| `wayfair-list-inventory-adjustments` | `listInventoryAdjustments` | `inventoryAdjustmentList` query |
| `wayfair-save-inventory` | `saveInventory` | `inventory.save` |
| `wayfair-register-shipment` | `registerShipment` | `purchaseOrders.register` |
| `wayfair-list-label-generation-events` | `listLabelGenerationEvents` | `labelGenerationEvents` |
| `wayfair-download-bill-of-lading` | `downloadBillOfLading` | GET `/v1/bill_of_lading/{po}` |
| `wayfair-download-packing-slip` | `downloadPackingSlip` | GET `/v1/packing_slip/{po}` |
| `wayfair-download-shipping-label` | `downloadShippingLabel` | GET `/v1/shipping_label/{po}` |
| `wayfair-get-consolidated-bol` | `getConsolidatedBol` | `consolidatedBolDocument` |
| `wayfair-list-castlegate-orders` | `listCastleGateOrders` | `getCastleGatePurchaseOrders` |
| `wayfair-list-castlegate-shipping-advices` | `listCastleGateShippingAdvices` | `getCastleGateWarehouseShippingAdvice` |
| `wayfair-acknowledge-castlegate-order` | `acknowledgeCastleGateOrder` | `purchaseOrders.acknowledgeCastleGate` |
| `wayfair-acknowledge-castlegate-shipping-advices` | `acknowledgeCastleGateShippingAdvices` | `purchaseOrders.acknowledgeCastleGateWarehouseShippingAdvice` |
| `wayfair-get-fulfillment-order` | `getFulfillmentOrder` | `fulfillmentOrderDetails` |
| `wayfair-list-fulfillment-orders` | `listFulfillmentOrders` | `fulfillmentOrderDetailsList` |
| `wayfair-list-fulfillment-shipping-advices` | `listFulfillmentShippingAdvices` | `warehouseShippingAdvices` |
| `wayfair-create-fulfillment-order` | `createFulfillmentOrder` | `createFulfillmentOrder` |
| `wayfair-cancel-fulfillment-order` | `cancelFulfillmentOrder` | `cancelFulfillmentOrder` |
| `wayfair-list-inbound-orders` | `listInboundOrders` | `inboundOrderList` |
| `wayfair-generate-advertising-report` | `generateAdvertisingReport` | POST `/advertising/v1/reports` |
| `wayfair-get-advertising-report` | `getAdvertisingReport` | GET `/advertising/v1/reports` |
| `wayfair-update-advertising-campaign` | `updateAdvertisingCampaign` | POST `/advertising/v1/campaign/{id}` |
| `wayfair-list-catalog-items` | `listCatalogItems` | `supplierCatalogItems` |
| `wayfair-list-brand-associations` | `listBrandAssociations` | `supplierBrand.brandAssociations` |
| `wayfair-get-media-metadata-tags` | `getMediaMetadataTags` | `media.mediaMetaDataTags` |
| `wayfair-list-taxonomy-categories` | `listTaxonomyCategories` | `taxonomyCategories` |
| `wayfair-get-taxonomy-attributes` | `getTaxonomyAttributes` | `attributesByFilter` (update schema) |
| `wayfair-get-catalog-update-status` | `getCatalogUpdateStatus` | `statusOfUpdateRequest` |
| `wayfair-update-catalog-item-media` | `updateCatalogItemMedia` | `updateCatalogEntitiesMutations.updateCatalogItemsMedia` |
| `wayfair-update-catalog-items` | `updateCatalogItems` | `updateCatalogEntitiesMutations.updateMarketSpecificCatalogItems` |
| `wayfair-update-catalog-item-groups` | `updateCatalogItemGroups` | `updateCatalogEntitiesMutations.updateMarketSpecificCatalogItemGroups` |

Dropship, inventory feeds, registration, label events, and CastleGate single-channel methods use the orders GraphQL endpoint. Cancellations, inventory visibility, multichannel fulfillment, consolidated BOL and inbound milestones use the supplier GraphQL endpoint. Each uses fixed operations and variables. No free-form GraphQL or HTTP tool is exposed.

The [public API inventory](../reference/wayfair-and-sps-commerce-apis.md) records exact coverage and unresolved contracts. Placeholder operations and contradictory contracts are not silently guessed. Mocked tests do not establish live account access or vendor certification.

## Dropship fulfillment

```ts
const client = new WayfairClient(auth)
const order = await client.getDropshipOrder({ po_number: 'CS12345678' })

// Explicit write: use the actual order's ship speed, prices, and accepted quantities.
const transaction = await client.acceptDropshipOrder({
  po_number: order.poNumber,
  ship_speed: 'GROUND',
  line_items: [{
    part_number: 'SKU-1',
    quantity: 2,
    unit_price: 24.50,
    estimated_ship_date: '2026-09-10T12:00:00-04:00',
  }],
})
```

- Reading an order never accepts or acknowledges it. A missing exact PO returns `not_found`.
- `acceptDropshipOrder` accepts line items, not backorders or rejections. Wayfair directs those actions to Partner Home.
- `sendShipmentNotice` sends an ASN for goods that have physically shipped. Include the shipping supplier/warehouse ID from the PO, carrier, service, tracking, addresses, and at least one small- or large-parcel shipment.
- ASN `supplier_id` identifies the shipping warehouse/supplier on the order; it is not an additional credential.
- Package tracking codes support `TRACKING_NUMBER` and `UCC_128`. Limits are 255 characters per package and 1000 for the shipment tracking number. Weight is in pounds and volume in cubic feet.
- Both ISO timestamps and Wayfair's space-separated timestamp with fractional seconds/offset are accepted for write date-times. Wayfair validates actual shipment time against its 10-day past / 1-day future window.
- Purchase-order quantities returned as numeric strings are normalized to numbers, including on the existing list method.

### Transaction results and retry safety

Mutations return the vendor's `handle`, `status`, timestamps, counts, and item result arrays. `NEW` or `PROCESSING` means submitted work, not completed fulfillment. `ERROR`, per-item errors, null status, and null fields are preserved; there is no optimistic `success: true`.

Wayfair defaults each transaction item array (`errors`, `completed`, `processing`) to ten entries. Counts can exceed the returned array lengths. The captured orders reference does not document a standalone transaction-status query; this pack does not invent one.

Mutation examples contain an inconsistent top-level `data.accept` response. The actual documented mutation and error paths nest the response under `data.purchaseOrders.accept`; the client follows that nesting.

No mutation is automatically retried, including after an expired-token response or a network failure whose remote outcome is unknown. Redirects are disabled on vendor requests to prevent redirected mutation replay and credential forwarding. `requiresConfirmation` and `idempotent: false` are host hints, not an in-package confirmation gate. The host must verify the remote outcome before deciding whether to resubmit.

GraphQL errors on the new detail/mutation methods expose an error count, not raw messages that can echo submitted customer data. Structured transaction item messages remain part of the explicit business result, not logs.

Production ASN submission requires Wayfair's `verified:advance_ship_notice` entitlement. Sandbox support does not change the default environment or establish production certification.

Source: [Wayfair Dropship Orders API v1](https://developer.wayfair.io/posts/docs/orders-api/reference/GraphQL/v1.0.0), inspected September 9, 2026.

## Cancellation requests

```ts
const pending = await client.listCancellationRequestsByWarehouses({
  warehouse_ids: [2683],
  status: 'CANCELLATION_PENDING_SUPPLIER_CONFIRMATION',
  from_datetime: '2026-09-01T00:00:00Z',
  to_datetime: '2026-09-09T23:59:59Z',
})

// Separate explicit write, after reviewing the requested cancellation.
const request = pending.items[0]
if (request) {
  const result = await client.confirmCancellationRequests({
    request_ids: [request.requestId],
  })
  // Inspect each item's status, errorCode and errorMessage.
}

// Alternative: reject a specific pending cancellation with a reason.
// await client.rejectCancellationRequests({
//   requests: [{ request_id: '4', reason: 'The item has already shipped' }],
// })
```

- Reads never confirm or reject requests. Query by 1–50 PO numbers or 1–50 warehouse IDs. Warehouse queries require `CANCELLATION_PENDING_SUPPLIER_CONFIRMATION` or `CANCELLED`; returned requests can additionally be `CANCELLATION_REJECTED`.
- Optional warehouse time bounds use RFC 3339 timestamps with a timezone. When both are present, `from_datetime` must precede `to_datetime`, accounting for offsets. Neither bound nor a default time window is invented.
- PO input follows the reference's validation pattern, `^[A-Za-z]{2}\d*$`. The prose says two letters followed by digits, but the published pattern also permits a two-letter-only value. Wayfair still validates existence and access.
- Read results are `{ items }`, preserving request IDs, status, request time, PO/warehouse, part number, reason, and original/cancelled quantities. Nullable reasons and quantity adjustments stay null. No cursor or total count is documented; the pack does not invent pagination.
- Confirm/reject accept 1–100 request IDs per native batch, not PO numbers. IDs can be strings or integers. Rejection requires a nonblank reason of at most 500 characters for each request.
- Only pending requests can be acted on. Confirming accepts the cancellation, not the original order. Rejecting refuses the cancellation, not the original order.
- Mutation results are `{ items }` with native `SUCCESS`/`FAILURE`, `requestId`, `errorCode`, and `errorMessage`. Preserve and inspect every result, including mixed successes/failures and nullable errors. An empty result array is not proof that submitted requests succeeded.
- Mutations are never automatically replayed. Top-level GraphQL errors throw even when partial data is present; verify remote state before any resubmission. `PERMISSION_DENIED` maps to `forbidden`, `BAD_REQUEST` to `bad_input`, and other categories to `upstream`, without exposing raw error messages. Per-request business messages remain in explicit results.
- The public header example names an inbound-order scope, so it does not establish cancellation entitlements. Confirm the required access with Wayfair. The rejection error example incorrectly uses the confirmation response key; the client follows the declared `rejectLineItemCancellationRequest` mutation and response instead.

Source: [Wayfair Order Cancellation API v1](https://developer.wayfair.io/posts/docs/order-cancellation-api/reference/GraphQL/v1.0.0), inspected September 9, 2026. Verification uses mocked HTTP, not live order mutations or entitlement certification.

## Inventory visibility

Both inventory methods use the parent `supplier_id` from bound auth, not tool input. Summary access requires `read:inventory_visibility`; adjustment access requires `read:inventory_transactions`. These are reads, not dropship inventory feeds or adjustment writes.

```ts
const inventory = await client.listInventorySummary({
  supplier_part_numbers: ['PART-001'],
  warehouse_id: 123,
  limit: 50,
})

// Each call reads one page. Keep the same filters when continuing.
if (inventory.has_next_page && inventory.end_cursor) {
  const nextPage = await client.listInventorySummary({
    supplier_part_numbers: ['PART-001'],
    warehouse_id: 123,
    limit: 50,
    cursor: inventory.end_cursor,
  })
}

const adjustments = await client.listInventoryAdjustments({
  supplier_part_number: 'PART-001',
  from_datetime: '2026-09-01T00:00:00Z',
  to_datetime: '2026-09-10T00:00:00Z',
  page: 0,
  page_size: 50,
  sort_order: 'DESC',
})
```

### Inventory summary

- `supplier_part_numbers` accepts 1–100 entries when supplied. Omit it to query all parts. `warehouse_id` is an optional physical warehouse/child supplier filter, distinct from the bound parent supplier ID.
- `limit` is 1–100, default 50. The result is `{ items, has_next_page, end_cursor }`. Cursors are opaque strings; do not decode them or substitute numeric offsets. A terminal cursor can be non-null, so use `has_next_page` to decide whether to continue.
- A response claiming another page must provide a nonempty cursor different from the submitted cursor; otherwise the client throws `upstream`. It does not auto-fetch subsequent pages.
- Items include part identity and CastleGate/physical-retail quantities, with warehouse breakdowns for on-hand, allocated, unreconciled, in-stock, fulfillable, unfulfillable, expired, held, unpickable, and transfer inventory. These positions are not a dropship quantity-on-hand feed.
- Nullable positions, breakdowns, warehouse lists, and product fields remain null, not fabricated zeroes or empty lists. Manufacturer `Long` IDs preserve numeric or integer-string representation; unsafe JavaScript numeric IDs are rejected rather than silently rounded.

### Inventory adjustments

- `page` is **zero-based**, default 0. `page_size` is 1–100, default 50. `sort_by` supports only `EVENT_DATE`, with `sort_order` defaulting to `DESC`.
- Optional `from_datetime` and `to_datetime` require timezone-bearing RFC 3339 timestamps. The earliest supported start is exactly `2023-06-01T00:00:00-05:00`. When both bounds are supplied, the end must be strictly later than the start. No default date window is added.
- Results are `{ items, page, page_size, total_pages, total_elements }`, preserving returned page metadata. Nullable page numbers/totals stay null, so they must not be treated as zero or as a completion guarantee. The client does not recompute totals from the vendor's inconsistent example counts.
- Events preserve timestamps, native adjustment types, signed quantities, descriptions, and warehouse/address details. Positive quantities indicate adjustments in; negative quantities indicate adjustments out.
- GraphQL `ValidationError` and `ExtendedValidationError` classifications map to `bad_input`, without exposing submitted part numbers, cursors, or raw upstream messages. Transport errors retain normal HTTP status/retry metadata. No automatic retries run.
- The documented `adjustmentMutationNotAvailable` is a placeholder and is deliberately not exposed. Dropship `inventory.save` is a separate operation, described below.

Sources: [Inventory Visibility API v1](https://developer.wayfair.io/posts/docs/inventory-visibility-onhand-api/reference/GraphQL/v1.0.0) and [Inventory Adjustment API v1](https://developer.wayfair.io/posts/docs/inventory-visibility-adjustment-api/reference/GraphQL/v1.0.0), captured September 9, 2026 and reviewed September 10. Tests use mocked HTTP; no live account entitlement or vendor certification is claimed.

## Inventory feeds

`saveInventory` requires explicit `feed_kind` (`DIFFERENTIAL` or `TRUE_UP`) and `dry_run`. Each line identifies its inventory warehouse/supplier and part number. `quantity_on_hand` permits `-1` for eligible distributors; normal availability is nonnegative. Optional backorder, on-order, next-availability, name, and discontinued fields preserve `0`, `false`, and omitted values.

Sandbox rejects differential feeds and more than 500 lines before requesting a token. This prevents the documented silent truncation. Production does not inherit the sandbox count limit.

The client follows the documented nested request and successful response, `inventory.save`, and the declared `[inventoryInput!]!` variable type. The public reference also shows root `save` and conflicting nullable-item examples. Only declared transaction fields are selected; disputed `id` and `completedCount` fields are omitted. No endpoint fallback, chunking, retry, or optimistic completion is attempted. Confirm this chosen contract against your enabled account before production use.

## Registration and shipping documents

- `registerShipment` registers one PO for label generation. Omitted packing details use catalog data. Supply either `shipping_units` (individual part instances) or `package_units` (parts packed together), not both. Inputs include weight/dimensions, unit type, freight class and part grouping, plus optional pickup time and warehouse.
- Registration is neither acceptance nor an ASN. `listLabelGenerationEvents` only reads previously registered shipments. Its fixed projection includes labels/tracking, document references and part grouping, not the nested customer purchase order.
- Label-event pagination uses `limit` (default 10) and zero-based result `offset`. Field comparators, conjunctions and ordering are passed as variables. `limit_reached` does not prove another page exists.
- The three document tools require `po_number`, `max_bytes`, and `output_key`; they return `{ artifact }`, never model-facing bytes. Storage must be bound before a download starts. Writing the same artifact key follows the selected store's overwrite behavior.
- Document tools are marked as writes because they create or replace artifacts; they do not mutate Wayfair orders. Host byte methods only retrieve the document.
- Hosts may instead use `downloadBillOfLadingBytes`, `downloadPackingSlipBytes`, or `downloadShippingLabelBytes`, each returning bounded `{ bytes, media_type, byte_length }`. Byte limits apply while streaming, including responses without `Content-Length`. HTML/JSON error documents are rejected.
- Document methods use fixed Wayfair paths and encoded PO identifiers, not URLs returned by label events. They do not register an order, fetch arbitrary document origins, or pass Wayfair authorization to artifact storage.
- `getConsolidatedBol({ date })` returns native `AVAILABLE`/`NOT_FOUND`, BOL number, nullable expiration and shipment references. Its URL is temporary, not a durable artifact or a reason to assume `NOT_FOUND` succeeded.

## CastleGate fulfillment

Single-channel `listCastleGateOrders` and `listCastleGateShippingAdvices` use bounded lists (default 10, ascending) with acknowledgment, date, PO/WSA filters. Native nullable lists and elements remain nullable. A full result requires a narrower date or identifier scan; these APIs expose no cursor. Receipt acknowledgments are separate explicit mutations and preserve transaction/item status.

Multichannel methods use a different supplier API:

- `createFulfillmentOrder` accepts customer/retailer references, ordered parts, shipping address/preferences, optional billing address and delivery signature. A unique `seller_fulfillment_order_id` helps prevent accidental duplicates. `ACCEPTED` means queued, not allocated or shipped; read the resulting `fulfillmentOrderRequestId` separately.
- `getFulfillmentOrder({ request_id })` requires an exact match and preserves item errors and native states. No read acknowledges receipt.
- `listFulfillmentOrders` uses one-based `page`, default 1, and `page_size`, default 10, max 100. Status, retailer and three date intervals are supported. The client follows the declared flat `page`/`pageSize` and filter fields rather than stale examples using nested `pagination`/`filters`.
- `listFulfillmentShippingAdvices` defaults to 50 results per one-based page, max 100, with optional item IDs/date window. It returns shipping/warehouse information and tracking.
- Both multichannel list methods return native `{ nodes, pageInfo }`. Nullable page metadata stays null. Neither automatically follows pages.
- `cancelFulfillmentOrder` uses the fulfillment request ID as `aggregatorOrderId`, with the bound supplier ID serialized as a string as required by this operation. Results can mix `SUCCESS` and `FAILURE`; shipped items cannot be assumed cancelled.

## Inbound milestones

`listInboundOrders` reads CastleGate Forwarding orders in an explicit `OPEN`, `COMPLETED`, or `CANCELLED` state. Filters include order/legacy/PO IDs, cargo-ready and creation windows, logistics service, receiving reference, part, shipment and BOL. Output preserves orders, bookings, container/tracking details, shipment-journey milestones and shipper/carrier information.

The native `paginate` input has `limit` and `offset`, defaulting to 10 and 0. Its prose inconsistently calls these cursor fields and describes offset as a page number. The client passes the supplied offset unchanged and does not invent an increment algorithm or cursor. Results expose `limit_reached`, not fabricated totals or completion.

## Advertising

- `generateAdvertisingReport` starts `CAMPAIGN_REPORT` or `LISTING_REPORT` generation in CSV/Excel with WSP/WSS program, grouping, date filters and a 14/28/56-day attribution window (default 14). It returns only the report ID.
- `getAdvertisingReport` returns status and an optional temporary URL; it does not poll, download the report, or start another job.
- `updateAdvertisingCampaign` changes a nonempty listing map for one campaign. Prefer `status: ADD|PAUSE|ACTIVATE|ARCHIVE`. Legacy updates require `is_active`. Conflicting status/active state is rejected locally.
- Bid strings must be in `0.05`–`10000`; PAUSE/ACTIVATE/ARCHIVE cannot include a bid. Manual/fixed campaigns require bids for ADD and legacy updates; TARGET_ROAS prohibits supplied bids. The client does not guess the campaign's strategy, so account-dependent requirements remain upstream validation.
- Listing outcomes remain per-listing; a 200 response does not imply every change succeeded. Campaign writes can change spend. Required permissions distinguish bid-only updates (`modify-bids`) from status/campaign changes (`modify-campaigns`).

## Catalog v2 and updates

`listCatalogPage` remains the existing catalog-v1 method. `listCatalogItems` is separate:

```ts
const page = await client.listCatalogItems({
  pagination_options: { page: 1, page_size: 30 },
  filter: { catalog_item_statuses: ['LIVE'] },
  market_context: { locale: 'en-US', country: 'UNITED_STATES', brand: 'WAYFAIR' },
})
```

Its production path is `/product-catalog-api/graphql`, without `/v1`. Sandbox uses `/sandbox/v1/product-catalog-api/graphql`. `X-SELECTED-SUPPLIER-ID` comes from the bound supplier. The required pagination object permits `{}`, defaulting to page 1 and size 30; the maximum size is 30.

The bounded output contains native `paginationInfo`, supplier identity and `catalogItems` with part, market, state, class and listing IDs. Optional market context selects one additional `salesChannels` level. Undeclared rich insight/attribute-value leaf types are excluded rather than guessed. The in-data `SupplierCatalogItemsError` union, including partial-read failures, throws a sanitized error instead of returning an empty successful page.

`marketContext.location` may be omitted, null, or a string in both the default item and its sales channels. User-run production diagnostics on September 12, 2026 confirmed that Wayfair omits this selected field. The client preserves absence rather than inventing a location or replacing it with null; numeric, boolean, array, and object values remain invalid. Other market-context fields retain their existing required/nullability contracts. Consuming apps need a released SDK containing this correction; changing this checkout does not update installed packages or switch legacy catalog callers to v2.

Reference and update operations use the declared `/v1/product-catalog-api/graphql` route (with `/sandbox` in sandbox):

- `listBrandAssociations` requires `market_context` and native `page_size`, with optional `page`. No undocumented default or upper bound is borrowed from other catalog operations. Nullable brand entries stay null.
- `getMediaMetadataTags` discovers `DOCUMENT`, `LEGAL_DOCUMENT`, `LANGUAGE`, and `REGION` tags for a market.
- `listTaxonomyCategories` supports optional one-based pagination with page sizes 10, 20, 25 or 50, without local defaults.
- `getTaxonomyAttributes` explicitly follows the **Product Update** schema's `taxonomyCategoryId`, not the incompatible addition example's `classId`. It includes formats, allowed values, related attributes, one child level, and conditionality rules.
- `updateCatalogItemMedia` requires explicit `validate_only`. UPLOAD (the upstream default action) requires a public media URL; DELETE requires `asset_id` or `legacy_asset_id`, with `asset_id` taking precedence. Image/video/document types and lead-image overrides remain explicit. This input has no market-context field.
- `updateCatalogItems` changes names and/or taxonomy attribute values. Include all existing related-attribute values required by the taxonomy; the client does not silently fetch or fill them.
- `updateCatalogItemGroups` changes group names, marketing copy, feature bullets and option content. The contradictory `mediaContent` input is excluded.
- Item/group updates require market country and locale, and reject German/Canadian updates because the public update reference says they are no longer supported. Reference queries still accept those markets.
- All update mutations return a `requestId`, not completion. `getCatalogUpdateStatus` preserves `IN_PROGRESS`, `COMPLETED` or `BLOCKED`, `validationOnly`, problems and successful updates. **COMPLETED can include failed items.**

Product-addition `submitV2` and `submissionsV2` remain excluded because the public docs contradict their route, response cardinality and status-request identifier. See the [specific contract gaps](../reference/wayfair-and-sps-commerce-apis.md#catalog-exclusions-requiring-clarification). No fallback write, invented attribute schema or private introspection is used.

## Pagination

Catalog calls expose Wayfair's page metadata. Continue with `page + 1` while `has_next_page` is true. Wayfair accepts page sizes 10, 20, and 25.

The legacy `getDropshipPurchaseOrders` query is bounded by `limit` and filtered by `from_date`; it does not return a provider cursor. `limit_reached` tells a host that it must continue its time-partitioned scan rather than assuming the result is complete.

HTTP 429 responses become retryable `ToolError` values and preserve `Retry-After` as `details.retry_after_ms`; the host owns coordinated retry and pacing.

## Bind

```ts
import { WayfairClient, wayfairModule } from '@5ss/ai-tools/wayfair'
import { withAuth } from '@5ss/ai-tools/core'

const auth = {
  client_id: '…',
  client_secret: '…',
  supplier_id: 1234
}

new WayfairClient(auth)
withAuth(wayfairModule, auth)
```
