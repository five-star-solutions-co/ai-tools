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

**Cloud / external keys still needed:** Resend, CF email/browser, Telegram, Slack, Teams, iMessage proxy, Pinecone, Woo, Katana, Amazon SP-API (LWA), AWS IAM services, embed models.

### Shared AWS IAM (one key for all AWS cloud live IT)

Use **one** access key for Textract, Bedrock AgentCore, EventBridge Scheduler, and Amazon SP-API **SigV4**:

| Var | Role |
| --- | --- |
| `AI_TOOLS_AWS_ACCESS_KEY_ID` | required |
| `AI_TOOLS_AWS_SECRET_ACCESS_KEY` | required |
| `AI_TOOLS_AWS_REGION` | required default region |
| `AI_TOOLS_AWS_SESSION_TOKEN` | optional |

Optional per-service region overrides (still use the same key): `AI_TOOLS_TEXTRACT_REGION`, `AI_TOOLS_BEDROCK_AGENTCORE_REGION`, `AI_TOOLS_EVENTBRIDGE_SCHEDULER_REGION`, `AI_TOOLS_AMAZON_REGION`.

**Not** shared with MinIO: local object store stays on `AI_TOOLS_S3_*` only.

Service-specific non-credential env remains (buckets, ARNs, SP-API LWA client id/secret/refresh, marketplace ids, etc.).

---

## Coverage policy

Live IT aims for **full client-method smoke** when env is set:

| Area | Policy |
| --- | --- |
| **WooCommerce, Katana, Amazon SP-API** | **Read-only only** — list/get/search. **No** create/update/delete/refunds/notes writes / `createReport` |
| All other vendors + seams | Exercise public client methods that can run without inbound webhooks/interactive callbacks |
| Missing env | `describe.skip` (not a failure) |
| Optional secondary resources | If list is empty, get-by-id branches no-op |

**Explicitly not live-covered** (need inbound/interactive state):

- Telegram/Slack/Teams `answerCallback` (needs interactive payload / `response_url`)
- Slack/Teams/iMessage `downloadFile` without a provider `file_id` from an **inbound** attachment (Telegram can round-trip: `sendMedia` → `file_id` → `downloadFile`)
- Amazon `createReport` (write)
- Bedrock AgentCore interactive browser automation beyond session start/get/stop (host/Playwright on stream endpoints)

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
bun test                    # unit only (default CI gate)
bun run test:integration    # live under test/integration/vendors + seams
bun test test/integration/vendors/resend.live.test.ts
```

---

## Vendors (`test/integration/vendors/`)

| Vendor | Env (prefix `AI_TOOLS_`) | Smoke (high level) |
| --- | --- | --- |
| resend | `RESEND_API_KEY`, `FROM`, `TO` | send + sendBatch |
| cloudflare-email | `CF_EMAIL_*` | send + sendBatch |
| telegram | `TELEGRAM_BOT_TOKEN` (+ chat; optional webhook URL/secret) | getBot, webhook, send/edit/action/react/media/group, downloadFile |
| slack | `SLACK_BOT_TOKEN` (+ `SLACK_CHANNEL_ID`) | getBot, listConversations, send/edit/action/react/media |
| teams | `TEAMS_APP_ID`, `APP_PASSWORD` (+ chat, service URL) | getBot; optional send/edit/action/react/media |
| imessage | proxy URL + project + chat + **`IMESSAGE_INBOUND_MESSAGE_ID`** | send/edit/typing/react/media/unsend; inbound read |
| s3 | `S3_*` (MinIO defaults in `.env`) | list/put/get/head/copy/delete/bytes/getBytesRange/signed URL/multipart |
| gotenberg | `GOTENBERG_BASE_URL` + S3 | renderPdf + renderScreenshot |
| cloudflare-browser | CF browser token + S3 | renderPdf + renderScreenshot |
| textract | shared `AWS_*` + `TEXTRACT_BUCKET` + `TEXTRACT_SOURCE_KEY` | extractText + extractTextBatch + getStatus |
| **woocommerce** | store + consumer key/secret | **read-only** list/get orders/products/customers/coupons/categories |
| **katana** | `KATANA_API_KEY` | **read-only** list/get entity surfaces + inventory |
| **amazon-sp-api** | LWA (`AMAZON_CLIENT_*` / refresh) + shared `AWS_*` IAM + marketplace/endpoint | **read-only** orders/items/inventory/reports/catalog |
| qdrant | `QDRANT_URL` (+ collection) | upsert/query/delete |
| pinecone | API key + base URL (+ dimension) | upsert/query/delete |
| supabase-vector | Supabase URL + service role | upsert/query/delete |
| mastra-vector | `MASTRA_DB_URL` | upsert/query/delete |
| eventbridge-scheduler | shared `AWS_*` + `EVENTBRIDGE_SCHEDULER_TARGET_ARN` + `ROLE_ARN` | create/get/list/update/delete (DISABLED schedule) |
| bedrock-agentcore-browser | shared `AWS_*` (+ optional browser id) | start/get/stop; optional CDP navigate via automation stream (`AI_TOOLS_BEDROCK_BROWSER_NAVIGATE_URL`, default `https://example.com`; set `AI_TOOLS_BEDROCK_BROWSER_SKIP_NAVIGATE=1` to skip) |
| bedrock-agentcore-code-interpreter | shared `AWS_*` (+ optional interpreter id) | getSession, executeCode, executeCommand, write/list/read/remove files, startCommand/getTask/stopTask, stopSession |

Vertical kits (`_email`, `_messaging`, `_storage`, `_vector`) are not packs and have no live files.

---

## Seams (`test/integration/seams/`)

| Seam | Env | Smoke |
| --- | --- | --- |
| content-type | none | pure helpers + tool |
| email-message | none | pure parse/build |
| skills | none | bound catalog list/search/get |
| web-fetch | network | GET example.com |
| email | Resend and/or CF email | send + sendBatch per provider |
| files | S3 | list/search/stat/put/get/delete/copy/mkdir/move/multipart |
| artifacts | host callbacks (always) + S3 object provider | create/readRange/readLines |
| tasks | host callbacks (always) | create/get/list/update/delete |
| scheduler | shared `AWS_*` + EventBridge target/role ARNs | create/get/list/update/delete (DISABLED schedule) |
| document | S3 | buildText/read/editText + buildSpreadsheet/read |
| messaging | TG / Slack / iMessage / Teams when env set | send/edit/chatAction/stopTyping/reactions/media; Telegram downloadFile; iMessage unsend is **vendor-only** |
| document-render | Gotenberg and/or CF browser + S3 | renderPdf + renderScreenshot |
| file-convert | Gotenberg + S3 | office-to-pdf |
| document-extract | Textract | extractText |
| vector-store | any vector backend | provider matrix |
| rag | embed + vector backend | ingest/retrieve/delete (qdrant / pinecone / supabase / mastra) |

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
