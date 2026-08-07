# Document Render

| | |
| --- | --- |
| **Import** | `@5ss/ai-tools/document-render` |
| **Kind** | multi-provider **seam** (`src/modules/document-render`) |
| **Module id** | `document-render` |
| **Auth** | Host union: `provider: 'gotenberg' \| 'cloudflare-browser'` + nested `storage` |
| **Tools** | `document-render-pdf`, `document-render-screenshot`, batches |

HTML or URL → PDF / PNG via a browser/print engine. **Not** office format conversion ([file-convert](./file-convert.md) / LibreOffice).

## Providers

| provider | Transport | Notes |
| --- | --- | --- |
| `gotenberg` | self-hosted Gotenberg | Preferred self-host |
| `cloudflare-browser` | CF Browser Run (optional auth `browser: 'kitesurf'`) | Managed |

Both write results to nested **S3-compatible** storage and return `ArtifactRef`.

## Bind

```ts
withAuth(documentRenderModule, {
  provider: 'gotenberg',
  gotenberg_base_url: 'http://localhost:3000',
  storage: {
    access_key_id: '…',
    secret_access_key: '…',
    region: 'auto',
    bucket: 'artifacts',
    endpoint: 'https://….r2.cloudflarestorage.com',
  },
})
```

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
- optional `output_key`, `filename`, screenshot `viewport`

Vendor packs: [gotenberg](../vendors/gotenberg.md), [cloudflare-browser](../vendors/cloudflare-browser.md).
