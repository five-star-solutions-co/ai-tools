# Amazon SP-API

| | |
| --- | --- |
| **Import** | `@5ss/ai-tools/amazon-sp-api` |
| **Kind** | **vendor** (`src/vendors/amazon-sp-api`) |
| **Module id** | `amazon-sp-api` |
| **Client** | `AmazonSpApiClient` |

Deliberate surface: **orders** (v0 list/get/items + SearchOrders v2026 with FULFILLMENT), **FBA inventory summaries**, **reports** (create/get/list/document + settlement V2 summary composite), **catalog search**.

## Auth

```ts
{
  client_id: string
  client_secret: string
  refresh_token: string
  access_key_id: string
  secret_access_key: string
  region: string              // SigV4 region (e.g. us-east-1)
  endpoint: 'https://sellingpartnerapi-na.amazon.com'
    | 'https://sellingpartnerapi-eu.amazon.com'
    | 'https://sellingpartnerapi-fe.amazon.com'
  session_token?: string
  marketplace_ids?: string[]  // default marketplaces for tools
}
```

Flow: LWA refresh → `access_token`, then SP-API calls with **AwsService** (`execute-api` SigV4) + `x-amz-access-token`.

## Tools

| id | Client method | HTTP |
| --- | --- | --- |
| `amazon-sp-api-list-orders` | `listOrders` | `GET /orders/v0/orders` |
| `amazon-sp-api-get-order` | `getOrder` | `GET /orders/v0/orders/{orderId}` |
| `amazon-sp-api-get-order-items` | `getOrderItems` | `GET /orders/v0/orders/{orderId}/orderItems` |
| `amazon-sp-api-list-inventory-summaries` | `listInventorySummaries` | `GET /fba/inventory/v1/summaries` |
| `amazon-sp-api-create-report` | `createReport` | `POST /reports/2021-06-30/reports` |
| `amazon-sp-api-get-report` | `getReport` | `GET /reports/2021-06-30/reports/{reportId}` |
| `amazon-sp-api-list-reports` | `listReports` | `GET /reports/2021-06-30/reports` |
| `amazon-sp-api-get-report-document` | `getReportDocument` | `GET /reports/2021-06-30/documents/{reportDocumentId}` |
| `amazon-sp-api-get-settlement-summary` | `getSettlementSummary` | Composite: list/get DONE `GET_V2_SETTLEMENT_REPORT_DATA_FLAT_FILE_V2` → download one document → eight summary fields (cents) |
| `amazon-sp-api-search-orders` | `searchOrders` | `GET /orders/2026-01-01/orders` (SearchOrders + FULFILLMENT) |
| `amazon-sp-api-search-catalog-items` | `searchCatalogItems` | `GET /catalog/2022-04-01/items` |

### Settlement summary

`getSettlementSummary` does **not** create reports (Amazon auto-schedules settlement V2). It:

1. Lists DONE settlement reports in the last 90 days (or uses optional `report_id` / `created_since`)
2. Downloads **one** document (max ~16 MiB compressed / ~64 MiB decompressed, 250k rows)
3. Parses Flat File V2 TSV; verifies single settlement id / currency / period; `sum(amount) === total-amount`
4. Returns only: `settlement_id`, `settlement_start_date`, `settlement_end_date`, `deposit_date`, `currency`, `total_amount_cents`, `amount_sum_cents`, `row_count`

Never returns raw rows, order ids, SKUs, descriptions, or document URLs.

## Bind

```ts
import { AmazonSpApiClient, amazonSpApiModule } from '@5ss/ai-tools/amazon-sp-api'
import { withAuth } from '@5ss/ai-tools/core'

new AmazonSpApiClient({
  client_id: '…',
  client_secret: '…',
  refresh_token: '…',
  access_key_id: '…',
  secret_access_key: '…',
  region: 'us-east-1',
  endpoint: 'https://sellingpartnerapi-na.amazon.com',
  marketplace_ids: ['ATVPDKIKX0DER'],
})

withAuth(amazonSpApiModule, { /* same */ })
```
