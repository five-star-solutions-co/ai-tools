# Walmart Marketplace

| | |
| --- | --- |
| **Import** | `@5ss/ai-tools/walmart` |
| **Kind** | **vendor** (`src/vendors/walmart`) |
| **Module id** | `walmart` |
| **Client** | `WalmartClient` |
| **API** | `https://marketplace.walmartapis.com` |

Walmart Marketplace US read surface for orders, catalog items, returns, and V1 reconciliation reports. Raw provider records use loose schemas so Walmart fields survive parsing while the stable identifiers required by warehouse callers remain validated.

Official references: [Orders](https://developer.walmart.com/us-marketplace/reference/getallorders), [Items](https://developer.walmart.com/us-marketplace/reference/getallitems), [Returns](https://developer.walmart.com/us-marketplace/reference/getreturns), [available recon dates](https://developer.walmart.com/us-marketplace/docs/available-recon-report-dates), and [recon report download](https://developer.walmart.com/us-marketplace/reference/getreconreportv1-1).

## Auth

```ts
{
  client_id: string
  client_secret: string
}
```

The client exchanges these credentials at `POST /v3/token`, caches the access token until its safety-adjusted expiry, and sends a new correlation id on every provider request. Auth remains host-owned and never appears in tool input.

## Tools and client methods

| Tool id | Client method | HTTP |
| --- | --- | --- |
| `walmart-list-orders` | `listOrdersPage` | `GET /v3/orders` |
| `walmart-list-items` | `listItemsPage` | `GET /v3/items` |
| `walmart-list-returns` | `listReturnsPage` | `GET /v3/returns` |
| `walmart-list-recon-report-dates` | `listReconReportDates` | `GET /v3/report/reconreport/availableReconFiles` |

`downloadReconReportBytes` is a host-facing client method for `GET /v3/report/reconreport/reconFile`. It returns raw bytes and is intentionally not an agent tool, preventing report files from being serialized into model context. The caller may provide `max_bytes`; the pack imposes no arbitrary file-size cap.

## Pagination

Orders and returns expose Walmart's opaque `nextCursor` as `next_cursor`. It is a complete query fragment beginning with `?`; pass it back unchanged as `cursor`. First-page filters are not repeated on cursor pages.

Items expose both `next_cursor` and `next_offset`. Pass both values to the next call. The first request uses Walmart's `*` cursor. Item cursors are short-lived, so durable hosts should finish the active scan rather than persist them between scheduled runs.

The Orders API documents a 180-day availability window and a 10,000-order maximum per query. Hosts that may reach that cap must partition collection by time window.

HTTP 429 responses become retryable `ToolError` values and preserve `Retry-After` as `details.retry_after_ms`; the host owns coordinated retry and pacing.

## Bind

```ts
import { WalmartClient, walmartModule } from '@5ss/ai-tools/walmart'
import { withAuth } from '@5ss/ai-tools/core'

const auth = {
  client_id: '…',
  client_secret: '…'
}

new WalmartClient(auth)
withAuth(walmartModule, auth)
```
