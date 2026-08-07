# Pack logos

**One SVG file per unique mark** under `logos/`. Shared via `pack-logos.json`.

## Host usage (preferred)

Logos are **inlined on the module** by `defineModule` (codegen → `src/generated/pack-logos.ts` → build).

```ts
import { telegramModule } from '@5ss/ai-tools/telegram'

// Inline SVG markup — no separate asset path required
telegramModule.logo
// also on catalog: toModuleCatalogEntry(telegramModule).logo
```

Hosts that only import packs do not need to know about `logos/` or static files.

## Source layout (maintainers)

```text
logos/
  amazon.svg              # once — referenced by many pack keys
  telegram.svg
  pack-logos.json         # pack key → logo id
```

`bun run codegen` embeds these into `src/generated/pack-logos.ts` for the JS build.
Optional package export `@5ss/ai-tools/logos/*` remains for raw file access.

## Pattern

| Rule | Detail |
| --- | --- |
| Size | Root `width="24"` `height="24"` |
| Safe | No scripts, external refs, embedded raster |
| Vendors | Real brand marks (CDN / brand kits) |
| Modules | **Lucide** icons (`lucide-static@0.469.0`, ISC) — not hand-drawn |
| Dedup | Shared brands listed once; map reuses them |

## Shared brands today

| Logo id | Pack keys |
| --- | --- |
| `amazon` | `amazon-sp-api`, `s3`, `sqs`, `eventbridge-scheduler`, `bedrock-agentcore-browser`, `bedrock-agentcore-code-interpreter` |
| `cloudflare` | `cloudflare-sandbox` |
| `cloudflare-browser` | `cloudflare-browser` |
| `cloudflare-email` | `cloudflare-email` |
| `supabase` | `supabase-vector` |
| `mastra` | `mastra-vector` |

Everything else is 1:1 pack key → same-named logo id.

## Module icons (Lucide pack)

Downloaded from [Lucide](https://lucide.dev) / `lucide-static@0.469.0` (ISC). See `LUCIDE-ATTRIBUTION.txt`.

| Logo id | Lucide icon |
| --- | --- |
| `artifacts` | `package` |
| `browser` | `app-window` |
| `calendar` | `calendar-days` |
| `code-sandbox` | `box` |
| `content-type` | `file-type` |
| `crypto` | `key-round` |
| `document` | `file-text` |
| `document-extract` | `scan-text` |
| `document-render` | `printer` |
| `email` | `mail` |
| `email-message` | `mails` |
| `file-convert` | `refresh-cw` |
| `files` | `folder-open` |
| `image` | `image` |
| `messaging` | `messages-square` |
| `pdf` | `file-type-2` |
| `presentation` | `presentation` |
| `queue` | `list-ordered` |
| `rag` | `brain-circuit` |
| `scheduler` | `clock` |
| `skills` | `sparkles` |
| `tasks` | `list-todo` |
| `vector-store` | `layers` |
| `web-fetch` | `globe` |

## Vendor sources

| Logo | Source |
| --- | --- |
| `teams` | Wikimedia Commons [Microsoft Office Teams (2025–present)](https://upload.wikimedia.org/wikipedia/commons/0/07/Microsoft_Office_Teams_%282025%E2%80%93present%29.svg) |
