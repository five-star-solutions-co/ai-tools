# Docker images for local / self-host backends

Integration compose: `docker-compose.integration.yml` at repo root.

## Gotenberg (document render + office convert)

**Image:** `gotenberg/gotenberg:8` (official; we do not build a custom image).

| Route | Use |
| --- | --- |
| Chromium HTML/URL → PDF / PNG | `document-render` / `gotenberg` render tools |
| LibreOffice office → PDF | `file-convert` path `office-to-pdf` / `gotenberg-convert` |

```bash
# with full integration stack
bun run integration:up:compose

# or Gotenberg alone
docker run --rm -p 127.0.0.1:3000:3000 gotenberg/gotenberg:8
```

Env for tests: `AI_TOOLS_GOTENBERG_BASE_URL=http://127.0.0.1:3000`

**Not in this image:** kitchen-sink format soup (Transmute removed). HTML layout print can also use managed Cloudflare Browser. Builders (pptx/docx/xlsx create/edit) are in-process libs, not Docker.

## Other compose services

| Service | Port | Used by |
| --- | --- | --- |
| MinIO | 9000 | S3 / files / artifact IO |
| Qdrant | 6333 | vector-store / qdrant |
| Supabase | 60xxx | see `supabase/config.toml` (started separately) |
