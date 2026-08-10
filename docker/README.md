# Docker images for local / self-host backends

Integration compose: `docker-compose.integration.yml` at repo root.

## Compose services

| Service | Port | Used by |
| --- | --- | --- |
| MinIO | 9000 | S3 / files / artifact IO |
| Qdrant | 6333 | vector-store / qdrant |
| Supabase | 60xxx | see `supabase/config.toml` (started separately) |

```bash
bun run integration:up:compose
```

HTML/URL → PDF or PNG uses managed **Cloudflare Browser Rendering** (`document-render` with `provider: 'cloudflare-browser'`). No local print engine is required for integration compose.
