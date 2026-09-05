# ShipStation

| | |
| --- | --- |
| **Import** | `@5ss/ai-tools/shipstation` |
| **Kind** | **vendor** (`src/vendors/shipstation`) |
| **Module id** | `shipstation` |
| **Client** | `ShipstationClient` |
| **V2 API** | `https://api.shipstation.com/v2` |
| **V1 API** | `https://ssapi.shipstation.com` |

Hybrid ShipStation read surface. V2 owns shipping operations. Legacy V1 supplies sales orders and installed stores because V2 does not expose equivalent collections.

Records use loose schemas so provider fields such as addresses, packages, items, costs, tracking, and custom data survive parsing.

## Auth

```ts
{
  v2_api_key: string
  v1_api_key: string
  v1_api_secret: string
}
```

ShipStation issues separate credentials for V2 and V1. The client sends `v2_api_key` in the V2 `API-Key` header. It sends `v1_api_key:v1_api_secret` as HTTP Basic auth only to the V1 host. Auth remains host-owned and never appears in tool input.

## Tools and client methods

| Tool id | Client method | API | HTTP |
| --- | --- | --- | --- |
| `shipstation-list-labels` | `listLabelsPage` | V2 | `GET /labels` |
| `shipstation-list-shipments` | `listShipmentsPage` | V2 | `GET /shipments` |
| `shipstation-list-fulfillments` | `listFulfillmentsPage` | V2 | `GET /fulfillments` |
| `shipstation-list-carriers` | `listCarriers` | V2 | `GET /carriers` |
| `shipstation-get-carrier` | `getCarrier` | V2 | `GET /carriers/{carrier_id}` |
| `shipstation-list-carrier-services` | `listCarrierServices` | V2 | `GET /carriers/{carrier_id}/services` |
| `shipstation-list-carrier-packages` | `listCarrierPackages` | V2 | `GET /carriers/{carrier_id}/packages` |
| `shipstation-list-carrier-options` | `listCarrierOptions` | V2 | `GET /carriers/{carrier_id}/options` |
| `shipstation-list-orders` | `listOrdersPage` | V1 | `GET /orders` |
| `shipstation-list-stores` | `listStores` | V1 | `GET /stores` |

Each client method performs exactly one provider request. Paginated methods return raw records and normalized pagination:

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

Labels explicitly expose `shipment_cost`, `insurance_cost`, `carrier_id`, `service_code`, `tracking_number`, `voided`, and `refund_details` while preserving all other provider fields.

`listCarriers({ page, page_size, include_extended_details })` also returns normalized pagination, the provider's
`errors`, optional `request_id`, and `partial`. HTTP 207 or a nonempty errors array sets `partial: true`, including
when a 207 response omits errors. Callers must not treat a partial page as a complete inventory. Missing or malformed
pagination/error metadata is rejected, except omitted errors on a successful response normalize to an empty array.
The client and `shipstation-list-carriers` tool expose the same contract. Each call remains one request; callers
own traversal, retry, and deciding whether a complete scan is authoritative.

Reference: [ShipStation V2 carriers API](https://docs.shipstation.com/apis/openapi/carriers).

V2 inputs retain ShipStation's snake-case query names. V1 order and store inputs use the pack's snake-case convention and map to ShipStation's camel-case query names at the client boundary.

ShipStation's default V2 API plan allows 200 requests per minute. HTTP 429 responses become retryable `ToolError` values and preserve `Retry-After` as `details.retry_after_ms`; the host owns coordinated retry and pacing.

## Bind

```ts
import { ShipstationClient, shipstationModule } from '@5ss/ai-tools/shipstation'
import { withAuth } from '@5ss/ai-tools/core'

const auth = {
  v2_api_key: '…',
  v1_api_key: '…',
  v1_api_secret: '…'
}

new ShipstationClient(auth)
withAuth(shipstationModule, auth)
```
