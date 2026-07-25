# Live integration tests — every vendor + every seam

## Local stack: Docker compose + Supabase CLI

### Ports (Supabase non-default)

| Service | Port | Notes |
| --- | --- | --- |
| Supabase API | **60121** | (default 54321) |
| Supabase DB | **60122** | (default 54322) |
| Supabase Studio | **60123** | (default 54323) |
| Inbucket | **60124** | |
| Analytics | **60127** | |
| Qdrant | 6333 | compose |
| MinIO S3 | 9000 / UI 9001 | compose |
| Gotenberg | 3000 | compose |

### One-shot e2e (recommended)

```bash
cd /Users/harryy/Desktop/hariom/ai-tools
# needs: Docker + bun on PATH (supabase via bunx)
bun run integration:e2e
```

`scripts/integration-e2e.ts` (Bun) runs in parallel where possible:

1. **parallel up:** `docker compose up -d --wait` + `bunx supabase start` (`Promise.all`)
2. `bunx supabase status -o env` → single-write API URL, DB URL, service_role into `.env` (no secrets printed)
3. **parallel tests:** `bun test --parallel --max-concurrency=<cpu>`
4. **parallel down:** compose + `bunx supabase stop` (always, even on failure)

Manual parallel helpers:

```bash
bun run integration:up      # compose + supabase in parallel
bun run integration:down    # both in parallel
```

### Manual start / stop

```bash
bun run integration:up
bunx supabase status   # if you need keys yourself
set -a && source .env && set +a
bun run test:integration
bun run integration:down
```

`.env` holds all `AI_TOOLS_*` vars (gitignored). Do not commit it. Agents must not read `.env`.

Migrations under `supabase/migrations/` create `ai_tools_vectors`, `match_vectors`, and storage bucket `ai-tools-it`.

### What is local vs cloud

**Local (compose + supabase):** qdrant, minio/s3, gotenberg, supabase storage/vector, mastra-vector (same Postgres).

**Cloud / external keys still needed:** Resend, CF email/browser, Telegram, Slack, Teams, iMessage proxy, Pinecone, Woo, Katana, Amazon, Transmute, Textract, embed models.

---

## Coverage policy

Live IT aims for **full client-method smoke** when env is set:

| Area | Policy |
| --- | --- |
| **WooCommerce, Katana, Amazon SP-API** | **Read-only only** — list/get/search. **No** create/update/delete/refunds/notes writes / `createReport` |
| All other vendors + seams | Exercise every public client method that can run without inbound webhooks/interactive callbacks |
| Missing env | `describe.skip` (not a failure) |
| Optional secondary resources | If list is empty, get-by-id branches no-op |

**Explicitly not live-covered** (need inbound/interactive state):

- Telegram/Slack/Teams `answerCallback` (needs interactive payload / `response_url`)
- Slack/Teams/iMessage `downloadFile` without a provider `file_id` from an **inbound** attachment (Telegram can round-trip: `sendMedia` → `file_id` → `downloadFile`)
- Amazon `createReport` (write)

### Slack bot scopes (full live IT — hard fail if missing)

After changing scopes, **reinstall the app** into the workspace and refresh the bot token if needed:

```json
"scopes": {
  "bot": [
    "chat:write",
    "channels:read",
    "groups:read",
    "im:history",
    "mpim:history",
    "reactions:write",
    "files:write",
    "files:read"
  ]
}
```

**Telegram webhook set/delete** is live-covered when:

```bash
AI_TOOLS_TELEGRAM_WEBHOOK_URL=https://…   # must be https
AI_TOOLS_TELEGRAM_WEBHOOK_SECRET=…        # optional; default ai-tools-it-webhook-secret
```

The test **always** `deleteWebhook` in `finally` (drops pending updates). Do not point a production bot’s IT env at this unless you accept a temporary webhook swap.

---

## Commands

```bash
bun test                    # unit only
bun run test:integration    # live (skips missing env)
bun test test/integration/vendors/resend.live.test.ts
```

---

## Vendors (live files under `test/integration/vendors/`)

| Vendor | Env (prefix `AI_TOOLS_`) | Smoke (high level) |
| --- | --- | --- |
| resend | `RESEND_API_KEY`, `FROM`, `TO` | send + sendBatch |
| cloudflare-email | `CF_EMAIL_*` | send + sendBatch |
| telegram | `TELEGRAM_BOT_TOKEN` (+ chat; optional `TELEGRAM_WEBHOOK_URL` / `SECRET`) | getBot, webhook info, set/delete webhook, send/edit/action/react/media/group, downloadFile |
| slack | `SLACK_BOT_TOKEN` (+ `SLACK_CHANNEL_ID`) | getBot, listConversations, send/edit/action/react/media — **reinstall after scopes** (below) |
| teams | `TEAMS_APP_ID`, `APP_PASSWORD` (+ `CHAT_ID`, `SERVICE_URL`) | getBot; optional send/edit/action/react/media |
| imessage | proxy URL + project + chat + **`IMESSAGE_INBOUND_MESSAGE_ID`** (user-sent msg for successful `/v1/read`) | send/edit/typing/react/media/unsend; outbound read expects **400**; inbound read must succeed |
| s3 | `S3_*` (MinIO defaults in `.env`) | list/put/get/head/copy/delete/bytes/signed URL/multipart |
| gotenberg | `GOTENBERG_BASE_URL` + S3 | renderPdf + renderScreenshot |
| cloudflare-browser | CF browser token + S3 | renderPdf + renderScreenshot |
| transmute | base URL + token + S3 | convert + convertBatch |
| textract | `TEXTRACT_*` only (no MinIO fallback) | extractText + extractTextBatch + getStatus |
| **woocommerce** | store + consumer key/secret | **read-only** list/get orders/products/customers/coupons/categories |
| **katana** | `KATANA_API_KEY` | **read-only** list/get all entity surfaces + inventory |
| **amazon-sp-api** | LWA + IAM + marketplace (+ optional `AMAZON_CATALOG_KEYWORDS`) | **read-only** orders/items/inventory/reports/catalog |
| qdrant | `QDRANT_URL` (+ collection) | upsert/query/delete (dim-safe collection helper) |
| pinecone | API key + base URL (+ `PINECONE_DIMENSION`, default 512) | upsert/query/delete |
| supabase-vector | Supabase URL + service role | upsert/query/delete |
| mastra-vector | `MASTRA_DB_URL` | upsert/query/delete |

## Seams (`test/integration/seams/`)

| Seam | Env | Smoke |
| --- | --- | --- |
| content-type, mime, email-message | none | pure |
| web-fetch | network | GET example.com |
| email | Resend and/or CF email | send + sendBatch per provider |
| storage | S3 and/or R2 and/or Supabase | full object surface per provider |
| files | S3 | list/search/stat/put/get/delete/copy/mkdir/move/multipart |
| messaging | TG / Slack / iMessage / Teams when env set | **full MessagingOps** per channel: send/edit/chatAction/stopTyping/setReaction/clearReaction/sendMedia/sendMediaBatch; Telegram also downloadFile round-trip; iMessage reaction clear + unsend + outbound read **400** + inbound read (requires `IMESSAGE_INBOUND_MESSAGE_ID`); TG/Slack/Teams `read`/`unsend` assert warn+no-op. Not covered: interactive `answerCallback` (except iMessage pure no-op); Slack/Teams/iMessage `downloadFile` (needs inbound attachment id) |
| document-render | Gotenberg and/or CF browser + S3 | renderPdf + renderScreenshot |
| file-convert | Transmute + S3 | convert |
| document-extract | Textract | extractText |
| vector-store | any vector backend | provider matrix |
| rag | embed + vector backend | ingest/retrieve/delete (qdrant uses `AI_TOOLS_QDRANT_RAG_COLLECTION` default `ai_tools_rag_it`) |

---

## After `bunx supabase start`

```bash
bunx supabase status -o env
# map:
# API_URL        → AI_TOOLS_SUPABASE_URL=http://127.0.0.1:60121
# DB_URL         → AI_TOOLS_MASTRA_DB_URL=...
# SERVICE_ROLE_KEY → AI_TOOLS_SUPABASE_API_KEY and AI_TOOLS_SUPABASE_SERVICE_ROLE_KEY
```

If DB password differs from `postgres`, update `AI_TOOLS_MASTRA_DB_URL` only (do not ask agents to open `.env`).
