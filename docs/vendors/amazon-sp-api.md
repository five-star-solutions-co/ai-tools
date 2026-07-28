# Amazon SP-API

| | |
| --- | --- |
| **Import** | `@harryy/ai-tools/amazon-sp-api` |
| **Kind** | **vendor** (`src/vendors/amazon-sp-api`) |
| **Module id** | `amazon-sp-api` |
| **Client** | `AmazonSpApiClient` |

Deliberate surface: **orders** (v0 list/get/items + SearchOrders v2026 with FULFILLMENT), **FBA inventory summaries**, **reports** (create/get/list/document), **catalog search**.

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
| `amazon-sp-api-search-orders` | `searchOrders` | `GET /orders/2026-01-01/orders` (SearchOrders + FULFILLMENT) |
| `amazon-sp-api-search-catalog-items` | `searchCatalogItems` | `GET /catalog/2022-04-01/items` |

## Bind

```ts
import { AmazonSpApiClient, amazonSpApiModule } from '@harryy/ai-tools/amazon-sp-api'
import { withAuth } from '@harryy/ai-tools/core'

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
