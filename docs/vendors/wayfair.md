# Wayfair Supplier

| | |
| --- | --- |
| **Import** | `@5ss/ai-tools/wayfair` |
| **Kind** | **vendor** (`src/vendors/wayfair`) |
| **Module id** | `wayfair` |
| **Client** | `WayfairClient` |
| **Environment** | Production |

Wayfair Supplier production access for the basic supplier catalog, dropship order lifecycle, and line-item cancellation requests. `listDropshipOrders` keeps its lightweight field selection, excluding customer names, email addresses, shipping addresses, and billing addresses. The separate `getDropshipOrder` method explicitly retrieves customer details needed for fulfillment.

## Auth

```ts
{
  client_id: string
  client_secret: string
  supplier_id: number
}
```

The client exchanges these credentials at `https://sso.auth.wayfair.com/oauth/token` for the fixed production audience `https://api.wayfair.com/`. Auth remains host-owned and never appears in tool input.

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

The three order-detail/fulfillment methods use `POST https://api.wayfair.com/v1/graphql`. The four cancellation methods use `POST https://api.wayfair.io/v1/supplier-order-api/graphql`. Each uses fixed queries/mutations and variables. No free-form GraphQL or HTTP tool is exposed.

This is not complete Wayfair API coverage. Inventory, registration/labels, CastleGate, catalog v2, and advertising operations are documented in the [public API inventory](../reference/wayfair-and-sps-commerce-apis.md), but are not yet implemented.

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

No mutation is automatically retried, including after an expired-token response or a network failure whose remote outcome is unknown. `requiresConfirmation` and `idempotent: false` are host hints, not an in-package confirmation gate. The host must verify the remote outcome before deciding whether to resubmit.

GraphQL errors on the new detail/mutation methods expose an error count, not raw messages that can echo submitted customer data. Structured transaction item messages remain part of the explicit business result, not logs.

Production ASN submission requires Wayfair's `verified:advance_ship_notice` entitlement. The current pack remains production-only; adding sandbox support is a separate, documented follow-up, not a change to existing defaults.

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
