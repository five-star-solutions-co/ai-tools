# Document Render

| | |
| --- | --- |
| **Import** | `@5ss/ai-tools/document-render` |
| **Kind** | multi-provider **seam** (`src/modules/document-render`) |
| **Module id** | `document-render` |
| **Auth** | Host: `provider: 'cloudflare-browser'` + nested `storage` |
| **Tools** | `document-render-pdf`, `document-render-screenshot`, batches |

HTML or URL → PDF / PNG via a browser print engine.

## Providers

| provider | Transport | Notes |
| --- | --- | --- |
| `cloudflare-browser` | CF Browser Run (optional auth `browser: 'kitesurf'`) | Managed |

Writes results to nested **S3-compatible** storage and returns `ArtifactRef`.

## Bind

```ts
withAuth(documentRenderModule, {
  provider: 'cloudflare-browser',
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

Nested `storage` is S3 auth fields only (no nested `provider`).

## Input

- `source.html` **or** `source.url`
- optional `output_key`, `filename`, screenshot `viewport`, per-call `browser` engine override

Vendor pack: [cloudflare-browser](../vendors/cloudflare-browser.md).
