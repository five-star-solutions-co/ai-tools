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

Items expose both `next_cursor` and `next_offset`. Pass both values to the next call, retaining the same page size:

```ts
const first = await client.listItemsPage({ limit: 1000 })
if (first.truncated) {
  const next = await client.listItemsPage({ cursor: first.next_cursor, offset: first.next_offset, limit: 1000 })
}
```

With a continuation cursor, `offset` is the number of items already observed, used only to calculate progress and completion. It is not sent as Walmart's HTTP `offset` parameter, so cursor scans can continue past 10,000 items. Passing a cursor without its progress is rejected instead of silently resetting the count to zero.

Without a continuation cursor (or with the initial `*` sentinel), `offset` remains Walmart's zero-based query parameter and must be at most 10,000. The first request defaults to `nextCursor=*` and `offset=0`. First-page or offset-page filters are sent normally; cursor continuations do not repeat them. If the provider gives no cursor, use bounded offset pagination and repeat the original filters. An unfinished page that requires an offset above 10,000 without a usable cursor throws `upstream`; it never returns an unusable continuation or reports completion.

`truncated` is calculated from the caller's observed count, this page's length, and the provider's required `totalItems`. Empty pages before the advertised end, rows beyond that total or requested limit, and malformed pagination throw `upstream`. An empty catalog with `totalItems=0` completes normally. These checks do not guarantee stable membership across mutable pages; snapshot reconciliation remains host-owned.

Walmart documents reusable item cursors with a two-minute lifetime. An expired cursor's HTTP 400 is surfaced unchanged as a `ToolError`, without an SDK retry, offset fallback, or automatic scan restart. Durable hosts own recovery and must not treat a failed scan as a complete catalog. HTTP 429 retains retry metadata for the host's pacing policy.

Local regression coverage exercises a 12,001-item scan with the same provider cursor, the offset boundary, missing progress, malformed/empty responses, inactive raw fields, HTTP errors, and the agent tool. Live validation should confirm the provider advances cursor-only requests without an HTTP offset, returns accurate totals through the final page, and surfaces expiry without publishing an incomplete snapshot.

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
