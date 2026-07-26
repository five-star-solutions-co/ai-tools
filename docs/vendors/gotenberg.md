# Gotenberg

| | |
| --- | --- |
| **Import** | `@harryy/ai-tools/gotenberg` |
| **Kind** | **vendor** (`src/vendors/gotenberg`) |
| **Module id** | `gotenberg` |
| **Client** | `GotenbergClient` |

Self-hosted [Gotenberg](https://gotenberg.dev/) — Chromium + LibreOffice. Results written to nested S3 as `ArtifactRef`.

## Auth

```ts
{
  gotenberg_base_url: string
  gotenberg_api_username?: string
  gotenberg_api_password?: string
  storage: { access_key_id, secret_access_key, region, bucket, endpoint?, session_token? }
}
```

## Tools / client methods

| Method | Tool id | Engine |
| --- | --- | --- |
| `renderPdf` | `gotenberg-render-pdf` | Chromium HTML/URL → PDF |
| `renderScreenshot` | `gotenberg-render-screenshot` | Chromium HTML/URL → PNG |
| `convert` | `gotenberg-convert` | LibreOffice `office-to-pdf` |
| `convertBatch` | `gotenberg-convert-batch` | same, batch |

## Docker

```bash
docker run --rm -p 127.0.0.1:3000:3000 gotenberg/gotenberg:8
# or: bun run integration:up:compose  (see docker/README.md)
```

## Seams

- [document-render](../modules/document-render.md) — `provider: 'gotenberg'` (Chromium)
- [file-convert](../modules/file-convert.md) — `provider: 'gotenberg'` (LibreOffice)
