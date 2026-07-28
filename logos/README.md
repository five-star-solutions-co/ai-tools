# Pack logos

**One SVG file per unique mark.** Many packs share the same file.

```text
logos/
  amazon.svg              # used by s3, sqs, bedrock-*, eventbridge-scheduler, amazon-sp-api, …
  telegram.svg
  files.svg
  …
  pack-logos.json         # pack key → logo id (basename without .svg)
```

## How sharing works

`pack-logos.json`:

```json
{
  "s3": "amazon",
  "sqs": "amazon",
  "telegram": "telegram",
  "files": "files"
}
```

Resolves to `logos/{id}.svg`. Hosts should use the path from the manifest (or the map + id), **not** invent per-pack copies.

```ts
// generated/module-manifest.json
// { "key": "s3", "logo": "logos/amazon.svg" }
// { "key": "sqs", "logo": "logos/amazon.svg" }  // same file

import packLogos from '@harryy/ai-tools/logos/pack-logos.json'
// packLogos['s3'] === 'amazon' → logos/amazon.svg
```

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
