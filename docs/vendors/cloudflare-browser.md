# Cloudflare Browser Run

| | |
| --- | --- |
| **Import** | `@5ss/ai-tools/cloudflare-browser` |
| **Kind** | **vendor** (`src/vendors/cloudflare-browser`) |
| **Module id** | `cloudflare-browser` |
| **Client** | `CloudflareBrowserClient` |

Cloudflare Browser Run sessions plus PDF and screenshot quick actions. Rendered files use nested S3 storage and return `ArtifactRef`; sessions do not require storage.

## Auth

```ts
{
  account_id: string
  api_token: string
  /** Optional default engine for all sessions + quick actions (default chromium) */
  browser?: 'chromium' | 'kitesurf'
  storage?: {
    access_key_id: string
    secret_access_key: string
    region: string
    bucket: string
    endpoint?: string
    session_token?: string
  }
}
```

### Kitesurf (`browser: 'kitesurf'`)

Cloudflare’s lightweight Workers browser ([docs](https://developers.cloudflare.com/browser-run/kitesurf/)). Lower CPU/memory than Chromium; good for agent screenshots, HTML extraction, and bursty one-shots. Not ideal for pixel-perfect print, WebGL/video, or bot-challenge TLS.

This pack sends `?browser=kitesurf` on Quick Actions and session create via `HttpService` `query` (same ofetch query bag as every other pack). Per-call `browser` on start-session / render tools overrides the auth default. CDP hosts can pass `browser: 'kitesurf'` to `mintCloudflareBrowserCdpConnection` so the WebSocket URL carries the param if upstream omitted it.

## Tools

| Tool | Purpose |
| --- | --- |
| `cloudflare-browser-start-session` | Start a Browser Run session |
| `cloudflare-browser-get-session` | Get session status and DevTools endpoints |
| `cloudflare-browser-stop-session` | Close a session |
| `cloudflare-browser-render-pdf` | Render HTML or URL to a stored PDF |
| `cloudflare-browser-render-screenshot` | Render HTML or URL to a stored PNG |

`storage` is required for the two render tools and optional for session lifecycle. Render and start-session tools accept optional `browser` to override the auth default.

## Bind

```ts
import { CloudflareBrowserClient, cloudflareBrowserModule } from '@5ss/ai-tools/cloudflare-browser'
import { withAuth } from '@5ss/ai-tools/core'

withAuth(cloudflareBrowserModule, {
  account_id: '…',
  api_token: '…',
  storage: {
    access_key_id: '…',
    secret_access_key: '…',
    region: 'auto',
    bucket: 'artifacts',
  },
})
```

Seams:

- [browser](../modules/browser.md) with `provider: 'cloudflare'` for sessions.
- [document-render](../modules/document-render.md) with `provider: 'cloudflare-browser'` for PDF and screenshot output.
