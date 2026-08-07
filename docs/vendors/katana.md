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
| `katana-get-customer` | `getCustomer` | `GET /customers/{id}` |
| `katana-create-customer` | `createCustomer` | `POST /customers` |
| `katana-update-customer` | `updateCustomer` | `PATCH /customers/{id}` |
| `katana-list-suppliers` | `listSuppliers` | `GET /suppliers` |
| `katana-get-supplier` | `getSupplier` | `GET /suppliers/{id}` |
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

List responses normalize `{ data, pagination }` into `{ items, next_cursor?, truncated }`. Get/create/update unwrap optional `{ data }` envelopes. Updates use `PATCH`. Delete sales order returns `{ deleted, id }` after `204`.

### Composite query (`querySalesOrders`)

Multi-scope union for reporting/reconciliation:

1. For each scope × each status: `GET /sales_orders` with `created_at_min` (when `created_from` set), `customer_id`, `location_id`, sequential pages.
2. **Client-side** filter for `order_created_from` / `order_created_to` (list API has no `order_created_date` range params).
3. Dedupe by order id; enrich customer name via `GET /customers/{id}` (cached).
4. Line rows via `GET /sales_order_rows?sales_order_ids=…&extend=variant` in chunks of 50 order ids.
5. Output: normalized headers + rows with `tax_exclusive_total_cents` and `cogs_value_cents` (safe integer cents).

## Bind

```ts
import { KatanaClient, katanaModule } from '@5ss/ai-tools/katana'
import { withAuth } from '@5ss/ai-tools/core'

new KatanaClient({ api_key: '…' })
withAuth(katanaModule, { api_key: '…' })
```
