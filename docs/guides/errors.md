# Errors

## `ToolError`

All intentional tool failures should throw `ToolError` from `@5ss/ai-tools/core`.

```ts
import { ToolError, isToolError } from '@5ss/ai-tools/core'

throw new ToolError('Object not found', {
  code: 'not_found',
  retryable: false,
  details: { key: input.key },
})
```

| Field | Meaning |
| --- | --- |
| `message` | Safe human/model-readable text (no secrets). |
| `code` | Stable machine code (see below). |
| `retryable` | Hint for hosts/agents; defaults `false`. |
| `details` | Optional structured metadata (still no secrets). |
| `cause` | Optional underlying error (not serialized by default). |

`isToolError(error)` narrows unknown catches.

## Codes

| Code | Typical cause |
| --- | --- |
| `bad_input` | Schema/business validation failed |
| `bad_auth` | Missing/invalid credentials |
| `forbidden` | Authenticated but not allowed (HTTP 403) |
| `not_found` | Resource missing (HTTP 404) |
| `rate_limited` | HTTP 429 / provider throttle |
| `upstream` | Provider/API failure |
| `timeout` | Aborted or deadline exceeded |
| `too_large` | Payload/object over package or provider limit |
| `unsupported` | Capability not available for the bound provider or store (e.g. optional multipart path, host artifact store not resolved) |
| `unsupported_runtime` | Missing fetch / wrong runtime |
| `internal` | Unexpected local failure |

HTTP helpers map status codes to this set. Product modules may refine further (e.g. Cloudflare `success: false` body → `bad_auth`).

## Adapter behavior

Adapters should surface `ToolError` to the host framework rather than swallowing it. Hosts decide whether to expose `code` / `retryable` to models.

## Writing good error messages

- Say what failed and the constraint (e.g. “Object exceeds 5 MiB download limit”).
- Prefer codes over scraping free-text.
- Never include API tokens, signing strings, or full auth headers.
