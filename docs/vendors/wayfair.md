# Wayfair Supplier

| | |
| --- | --- |
| **Import** | `@5ss/ai-tools/wayfair` |
| **Kind** | **vendor** (`src/vendors/wayfair`) |
| **Module id** | `wayfair` |
| **Client** | `WayfairClient` |
| **Environment** | Production, read-only |

Read-only Wayfair Supplier production access for the basic supplier catalog and dropship purchase orders. The fixed order query intentionally excludes customer names, email addresses, shipping addresses, and billing addresses.

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

The pack exposes fixed GraphQL reads only. It does not expose free-form GraphQL, HTTP, mutations, inventory writes, cancellations, or purchase-order responses.

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
