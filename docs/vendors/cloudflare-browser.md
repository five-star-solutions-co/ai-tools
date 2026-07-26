# Cloudflare Browser Run

| | |
| --- | --- |
| **Import** | `@harryy/ai-tools/cloudflare-browser` |
| **Kind** | **vendor** (`src/vendors/cloudflare-browser`) |
| **Module id** | `cloudflare-browser` |
| **Client** | `CloudflareBrowserClient` |

Cloudflare Browser Run sessions plus PDF and screenshot quick actions. Rendered files use nested S3 storage and return `ArtifactRef`; sessions do not require storage.

## Auth

```ts
{
  account_id: string
  api_token: string
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

## Tools

| Tool | Purpose |
| --- | --- |
| `cloudflare-browser-start-session` | Start a Browser Run session |
| `cloudflare-browser-get-session` | Get session status and DevTools endpoints |
| `cloudflare-browser-stop-session` | Close a session |
| `cloudflare-browser-render-pdf` | Render HTML or URL to a stored PDF |
| `cloudflare-browser-render-screenshot` | Render HTML or URL to a stored PNG |

`storage` is required for the two render tools and optional for session lifecycle.

## Bind

```ts
import { CloudflareBrowserClient, cloudflareBrowserModule } from '@harryy/ai-tools/cloudflare-browser'
import { withAuth } from '@harryy/ai-tools/core'

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
