# Katana

| | |
| --- | --- |
| **Import** | `@5ss/ai-tools/katana` |
| **Kind** | **vendor** (`src/vendors/katana`) |
| **Module id** | `katana` |
| **Client** | `KatanaClient` |
| **API** | `https://api.katanamrp.com/v1` |

Katana MRP surface: **sales orders**, **products**, **materials**, **customers**, **suppliers**, **purchase orders**, **manufacturing orders**, and **inventory**.

## Auth

```ts
{ api_key: string }  // Bearer token
```

## Tools

| id | Client method | HTTP |
| --- | --- | --- |
| `katana-list-sales-orders` | `listSalesOrders` | `GET /sales_orders` |
| `katana-get-sales-order` | `getSalesOrder` | `GET /sales_orders/{id}` |
| `katana-create-sales-order` | `createSalesOrder` | `POST /sales_orders` |
| `katana-update-sales-order` | `updateSalesOrder` | `PATCH /sales_orders/{id}` |
| `katana-delete-sales-order` | `deleteSalesOrder` | `DELETE /sales_orders/{id}` |
| `katana-query-sales-orders` | `querySalesOrders` | Composite: `GET /sales_orders` + `GET /sales_order_rows` (+ customer enrich) |
| `katana-list-products` | `listProducts` | `GET /products` |
| `katana-get-product` | `getProduct` | `GET /products/{id}` |
| `katana-create-product` | `createProduct` | `POST /products` |
| `katana-update-product` | `updateProduct` | `PATCH /products/{id}` |
| `katana-list-materials` | `listMaterials` | `GET /materials` |
| `katana-get-material` | `getMaterial` | `GET /materials/{id}` |
| `katana-list-customers` | `listCustomers` | `GET /customers` |
| `katana-get-customer` | `getCustomer` | `GET /customers?ids={id}` |
| `katana-create-customer` | `createCustomer` | `POST /customers` |
| `katana-update-customer` | `updateCustomer` | `PATCH /customers/{id}` |
| `katana-list-suppliers` | `listSuppliers` | `GET /suppliers` |
| `katana-get-supplier` | `getSupplier` | `GET /suppliers?ids={id}` |
| `katana-create-supplier` | `createSupplier` | `POST /suppliers` |
| `katana-list-purchase-orders` | `listPurchaseOrders` | `GET /purchase_orders` |
| `katana-get-purchase-order` | `getPurchaseOrder` | `GET /purchase_orders/{id}` |
| `katana-create-purchase-order` | `createPurchaseOrder` | `POST /purchase_orders` |
| `katana-update-purchase-order` | `updatePurchaseOrder` | `PATCH /purchase_orders/{id}` |
| `katana-list-manufacturing-orders` | `listManufacturingOrders` | `GET /manufacturing_orders` |
| `katana-get-manufacturing-order` | `getManufacturingOrder` | `GET /manufacturing_orders/{id}` |
| `katana-create-manufacturing-order` | `createManufacturingOrder` | `POST /manufacturing_orders` |
| `katana-update-manufacturing-order` | `updateManufacturingOrder` | `PATCH /manufacturing_orders/{id}` |
| `katana-list-inventory` | `listInventory` | `GET /inventory` |

Existing agent-facing list methods project raw pages into `{ items, next_cursor?, truncated }`. Get, create, and update methods unwrap optional `{ data }` envelopes. Updates use `PATCH`. Delete sales order returns `{ deleted, id }` after `204`.

## Host page APIs

The client exposes one-request host methods for connector-owned pagination and pacing:

```ts
listSalesOrdersPage(input)
listProductsPage(input)
listMaterialsPage(input)
listCustomersPage(input)
listSuppliersPage(input)
listPurchaseOrdersPage(input)
listManufacturingOrdersPage(input)
listInventoryPage(input)
```

Each method performs one `GET`, accepts provider `page` and `limit` values from 1 to 250, and returns:

```ts
{
  items: KatanaRawRecord[]
  pagination: {
    total_records: number
    total_pages: number
    offset: number
    page: number
    first_page: boolean
    last_page: boolean
  }
  rate_limit?: {
    limit: number
    remaining: number
    reset_at_ms: number
  }
}
```

Katana list payloads accept both the current `{ data: [...] }` envelope and a direct array. Pagination is parsed from the required JSON `X-Pagination` response header with Zod. Exact integer strings and `"true"` / `"false"` strings are normalized to canonical numbers and booleans because the live API string-encodes these values. Malformed or invalid pagination errors include the received header metadata in `ToolError.details.x_pagination`. A caller derives the next provider page as `page + 1` only when `last_page` is false. Item count is never used to guess continuation. Rate metadata comes from `X-Ratelimit-Limit`, `X-Ratelimit-Remaining`, and `X-Ratelimit-Reset`; the reset value is milliseconds since epoch.

Entity page inputs expose each endpoint's supported timestamp window fields, plus `include_deleted` where supported. Products and materials also expose `include_archived`. Inventory intentionally has no timestamp filters and accepts only its documented sync filters: `location_id`, `variant_id[]`, `include_archived`, and `extend`, where `extend` is limited to `variant` and `location`.

Raw entity schemas require only numeric `id` plus optional creation, update, and deletion timestamps. Raw inventory requires the `variant_id` and `location_id` composite identity. All raw schemas use `z.looseObject`, so variants, rows, addresses, custom fields, linked resources, archive state, inventory quantities, and provider-added fields survive parsing.

### Composite query (`querySalesOrders`)

Multi-scope union for reporting/reconciliation:

1. For each scope and status: `GET /sales_orders` with `created_at_min` (when `created_from` is set), `customer_id`, `location_id`, and sequential pages.
2. **Client-side** filter for `order_created_from` / `order_created_to` (list API has no `order_created_date` range params).
3. Dedupe by order id; enrich customer name via `GET /customers?ids={id}` (cached).
4. Line rows via `GET /sales_order_rows?sales_order_ids=…&extend=variant` in chunks of 50 order ids.
5. Output: normalized headers + rows with `tax_exclusive_total_cents` and `cogs_value_cents` (safe integer cents).

## Bind

```ts
import { KatanaClient, katanaModule } from '@5ss/ai-tools/katana'
import { withAuth } from '@5ss/ai-tools/core'

new KatanaClient({ api_key: '…' })
withAuth(katanaModule, { api_key: '…' })
```
