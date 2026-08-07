# File Convert

| | |
| --- | --- |
| **Import** | `@5ss/ai-tools/file-convert` |
| **Kind** | multi-provider **seam** (`src/modules/file-convert`) |
| **Module id** | `file-convert` |
| **Auth** | Host union: `provider: 'gotenberg'` + nested `storage` |
| **Tools** | `file-convert`, `file-convert-batch` |

Office documents → PDF via self-hosted **Gotenberg LibreOffice**.  
**Not** HTML/URL print — use [document-render](./document-render.md) (Chromium / Cloudflare Browser).

## Paths

| `path` | Behavior |
| --- | --- |
| `office-to-pdf` | docx, pptx, xlsx, odt, rtf, … → PDF |

## Bind

```ts
withAuth(fileConvertModule, {
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

Nested `storage` is S3 auth only (no nested `provider`).

## Docker

Use official Gotenberg image (compose already includes it). See [docker/README.md](../../docker/README.md).

Vendor pack: [gotenberg](../vendors/gotenberg.md).
