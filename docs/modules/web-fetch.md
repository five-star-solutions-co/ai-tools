# Web Fetch

| | |
| --- | --- |
| **Import** | `@5ss/ai-tools/web-fetch` |
| **Module id** | `web-fetch` |
| **Client** | [ofetch](https://github.com/unjs/ofetch) (Node / Bun / edge) |

Thin policy wrapper around ofetch. ofetch owns HTTP; we enforce allowlisting and credential hygiene.

## Tools and side effects

| Tool id | Name | Methods | `sideEffect` |
| --- | --- | --- |
| `web-fetch-get` | `httpGet` | `GET`, `HEAD` | **`read`** |
| `web-fetch-request` | `httpRequest` | `POST`, `PUT`, `PATCH`, `DELETE` | **`write`** |

GET/HEAD never take a body. Mutating tool defaults to `POST` when `method` is omitted.

## ofetch owns

- Single `body` on the mutate tool: object/array → JSON + `Content-Type`; string → raw text
- Query string, timeouts, redirects, default response parse (JSON when `Content-Type` is JSON)

## We own

| Rule | Why |
| --- | --- |
| `allowed_origins` | SSRF / open-proxy prevention |
| Final URL origin check | Redirect must still land on allowlist |
| Block model credential headers | Secrets stay host-side |
| `default_headers` | Host injects `Authorization` etc. |
| No URL userinfo | `user:pass@host` rejected |

## Host binding

```ts
import { withAuth } from '@5ss/ai-tools/core'
import { webFetchModule } from '@5ss/ai-tools/web-fetch'

const bound = withAuth(webFetchModule, {
  allowed_origins: ['https://api.example.com'],
  default_headers: { Authorization: `Bearer ${token}` },
  require_https: true,
})
```

## Tool output

`url`, `status`, `ok`, `headers`, `content_type?`, `body` (ofetch-parsed).

Non-2xx still returns a body (`ignoreResponseError`).
