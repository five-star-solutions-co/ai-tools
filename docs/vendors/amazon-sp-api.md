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
  endpoint: 'https://sellingpartnerapi-na.amazon.com'
    | 'https://sellingpartnerapi-eu.amazon.com'
    | 'https://sellingpartnerapi-fe.amazon.com'
  marketplace_ids?: string[]  // default marketplaces for tools
  user_agent: string           // application identity sent to SP-API
}
```

The client exchanges the refresh token through LWA, caches the complete token response according to `expires_in`, and refreshes slightly early. SP-API calls use `HttpService` with `x-amz-access-token` and `user-agent`. IAM credentials and SigV4 are not used.

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
| `amazon-sp-api-get-settlement-summary` | `getSettlementSummary` | Composite: list/get DONE `GET_V2_SETTLEMENT_REPORT_DATA_FLAT_FILE_V2` → download one document → eight summary fields (cents) |
| `amazon-sp-api-search-orders` | `searchOrders` | `GET /orders/2026-01-01/orders` (SearchOrders + FULFILLMENT) |
| `amazon-sp-api-search-catalog-items` | `searchCatalogItems` | `GET /catalog/2022-04-01/items` |

## Host page APIs

These methods are for connector-owned pagination and pacing. Each page method performs exactly one provider request and returns provider-shaped records plus response metadata.

### FBA inventory

```ts
await client.getInventorySummariesPage({
  mode: 'full',
  marketplace_id: 'ATVPDKIKX0DER',
  next_token,
})

await client.getInventorySummariesPage({
  mode: 'incremental',
  marketplace_id: 'ATVPDKIKX0DER',
  start_date_time: windowStart,
  next_token,
})
```

The request always uses marketplace granularity, one marketplace, and `details=true`. Full sync omits `startDateTime`. Incremental continuation requires both the original `start_date_time` and `next_token`. Amazon inventory tokens expire after 30 seconds, so they are not reliable long-lived warehouse checkpoints. On an expired token, restart the same fixed incremental window and rely on idempotent warehouse writes. The caller owns immediate sequential paging and pacing.

The result contains `items`, optional `next_token`, `rate_limit_per_second`, and `request_id`. Inventory items use additive `z.looseObject` schemas and preserve Amazon fields without renaming. In particular, `totalQuantity` and `inventoryDetails.fulfillableQuantity` remain distinct.

### Reports

```ts
await client.listReportsPage({
  report_types: ['GET_FLAT_FILE_OPEN_LISTINGS_DATA'],
  page_size: 100,
  created_since: windowStart,
})

await client.listReportsPage({ next_token })
```

An initial request requires 1 to 10 report types. A continuation sends only Amazon's `nextToken`; filters from the initial request are not resent. The result preserves raw report metadata and returns rate-limit and request metadata.

`getReportDocument` remains host-only because its presigned URL grants temporary access to the report body. It is deliberately excluded from `amazonSpApiModule`, so the URL cannot enter model output or agent logs. `downloadReportDocumentBytes` accepts only `report_document_id` and `max_bytes`, resolves the descriptor internally, then privately downloads Amazon's returned URL without SP-API auth headers. It enforces the byte limit on both downloaded and expanded content, supports Amazon's documented `GZIP` compression, and returns bytes, UTF-8 text, and response metadata. Callers cannot supply a download URL. Report metadata is not treated as a warehouse dataset.

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
  endpoint: 'https://sellingpartnerapi-na.amazon.com',
  marketplace_ids: ['ATVPDKIKX0DER'],
  user_agent: 'five-star-solutions/1.0',
})

withAuth(amazonSpApiModule, { /* same */ })
```
