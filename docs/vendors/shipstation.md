# ShipStation

| | |
| --- | --- |
| **Import** | `@5ss/ai-tools/shipstation` |
| **Kind** | **vendor** (`src/vendors/shipstation`) |
| **Module id** | `shipstation` |
| **Client** | `ShipstationClient` |
| **API** | `https://api.shipstation.com/v2` |

ShipStation V2 read surface for **labels** and **shipments**. Records use loose schemas so provider fields such as addresses, packages, items, costs, tracking, and custom data survive parsing.

## Auth

```ts
{ api_key: string }
```

The client sends the key in ShipStation's `API-Key` request header. Auth remains host-owned and never appears in tool input.

## Tools and client methods

| Tool id | Client method | HTTP |
| --- | --- | --- |
| `shipstation-list-labels` | `listLabelsPage` | `GET /labels` |
| `shipstation-list-shipments` | `listShipmentsPage` | `GET /shipments` |

Both methods perform exactly one provider request. Inputs accept `page` and `page_size` from 1 to 500 plus the endpoint's provider filters. Outputs return raw records and normalized pagination:

```ts
{
  items: unknown[]
  pagination: {
    total: number
    page: number
    pages: number
    page_size: number
    has_more: boolean
  }
}
```

Labels expose `created_at_start` and `created_at_end`. Shipments expose creation, modification, and payment timestamp windows. Hosts should use those timestamp windows to split shipment scans before ShipStation's 10,000-result offset ceiling, while `page` remains the continuation inside one bounded window.

ShipStation's default API plan allows 200 requests per minute. HTTP 429 responses become retryable `ToolError` values and preserve `Retry-After` as `details.retry_after_ms`; the host owns coordinated retry and pacing.

## Bind

```ts
import { ShipstationClient, shipstationModule } from '@5ss/ai-tools/shipstation'
import { withAuth } from '@5ss/ai-tools/core'

new ShipstationClient({ api_key: '…' })
withAuth(shipstationModule, { api_key: '…' })
```
