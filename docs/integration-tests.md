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

### Recommended local workflow (reuse stack)

Stack is **left running** by default so iterative runs stay fast.

```bash
cd /Users/harryy/Desktop/hariom/ai-tools
# needs: Docker + bun on PATH (supabase via bunx)

# once per machine/session — skips start when already healthy
bun run integration:up

# full suite (reuses healthy stack; does not tear down)
bun run integration:e2e

# subset / single file (CLI)
bun run integration:e2e -- s3.live
bun run integration:e2e -- test/integration/vendors/resend.live.test.ts
bun run test:integration -- test/integration/vendors/s3.live.test.ts

# when finished
bun run integration:down
```

`scripts/integration-e2e.ts`:

1. **ensure up** (compose + supabase in parallel; **skip** when qdrant/minio healthy and `supabase status` ready)
2. `integration:env` → **in-place upsert** of API URL, DB URL, service_role into `.env`
3. **tests:** `bun test --parallel` (optional path / `-t` filters after `--`)
4. **leave stack up** unless `--down` (or `bun run integration:e2e:ci`)

Flags:

| Flag | Meaning |
| --- | --- |
| *(default)* | ensure stack if needed, run tests, **keep stack** |
| `--down` | tear down compose + supabase after tests |
| `--no-up` | tests only (stack already running) |
| `--up-only` | ensure stack + `.env` only |
| `--force` | force start even when healthy |

### WebStorm / IDE (list + run individual tests)

Do **not** wire WebStorm to `integration:e2e` — that is a shell orchestrator, so the IDE cannot expand a per-test tree from it.

Use the **Bun test** runner on real files under `test/integration/`:

1. Once: `bun run integration:up` (terminal; leaves Docker/Supabase up)
2. In WebStorm: open any `test/integration/**/*.live.test.ts`
3. Use gutter icons / right-click **Run** on `describe` / `test` / file
4. Or create a **Bun Test** run configuration:
   - Working directory: project root
   - Test file / directory: `test/integration` (or a single `*.live.test.ts`)
   - Bun loads `.env` automatically from the project root
5. Optional: second config for unit tests only (`test/*.test.ts`, `test/core`, …) matching the `test` script paths
6. When done: `bun run integration:down`

Missing secrets → suites use `describe.skip` (shown as skipped in the UI, not failed). Local-only suites (MinIO/Qdrant/pure helpers) need the compose/supabase stack when they hit those backends.

### Manual start / stop

```bash
bun run integration:up       # compose + supabase; skip if healthy; write .env
bun run integration:status   # healthy? + compose ps + supabase status
bun run test:integration     # all live files (stack must be up for local backends)
bun run integration:down
```

`.env` holds all `AI_TOOLS_*` vars (gitignored). Do not commit it. Agents must not read `.env`.

Migrations under `supabase/migrations/` create `ai_tools_vectors`, `match_vectors`, and storage bucket `ai-tools-it`.

### What is local vs cloud

**Local (compose + supabase):** qdrant, minio/s3, supabase storage/vector, mastra-vector (same Postgres).

**Cloud / external keys still needed:** Resend, CF email/browser, Telegram, Slack, Teams, iMessage proxy, Pinecone, Woo, Katana, Amazon SP-API (LWA), AWS IAM services, embed models.

### Credential families (secrets only)

Live IT **hardcodes** local compose defaults and fixed AWS resource names (`test/integration/env.ts` → `IT`).  
Env is only for **secrets** and **dynamic host values**.

| Family | Env (prefix `AI_TOOLS_`) | Notes |
| --- | --- | --- |
| **AWS IAM** | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, optional `AWS_REGION` (default `us-east-1`), optional `AWS_SESSION_TOKEN`, **`AWS_ACCOUNT_ID`** (from `bun scripts/aws-integration-setup.ts --write-env`) | Textract bucket/key, SQS URL, scheduler ARNs **derived** from account + region + fixed names |
| **Cloudflare** | `CF_ACCOUNT_ID`, `CF_API_TOKEN` + `CF_EMAIL_FROM` / `TO` | Email + browser |
| **Supabase** | `SUPABASE_URL`, `SUPABASE_API_KEY` | Table/schema/RPC hardcoded |
| **Mastra DB** | `MASTRA_DB_URL` | Schema hardcoded `public` |
| **Resend / chat / pinecone / embed / …** | product secrets as before | unchanged |

**Hardcoded (no env needed):** MinIO (`aitools` / `ai-tools-it` / `:9000`), Qdrant (`:6333` / `ai_tools_it`), browser navigate `https://example.com`, Textract bucket `integration-test-ai-tools-{region}` + sample key, queue/role names under `integration-test-ai-tools*`.

---

## Coverage policy

Live IT aims for **full public client-method smoke** when env is set (pack-file matrix is 1:1 with every `src/modules/*` + `src/vendors/*` pack except vertical kits):

| Area | Policy |
| --- | --- |
| **WooCommerce, Katana, Amazon SP-API** | **Read-only only** — every pack list/get/search/report-read method. **No** create/update/delete/refunds/notes writes / `createReport` |
| All other vendors + seams | Full public methods that can run without a human-driven inbound interactive event |
| Missing env | `describe.skip` (not a failure) |
| Optional secondary resources | Seeded via optional env when self-seed is impossible |

**Self-seeded download round-trips:** Telegram + Slack (`sendMedia` → `file_id` → `downloadFile`).

**Optional inbound-only env** (still covered when set):

| Var | Method |
| --- | --- |
| `AI_TOOLS_IMESSAGE_FILE_ID` | iMessage `downloadFile` (attachment **guid** from inbound) |
| `AI_TOOLS_TEAMS_FILE_URL` | Teams `downloadFile` (absolute content URL from inbound) |
| `AI_TOOLS_SLACK_USER_ID` | Slack `postEphemeral` |

**Explicitly not live-covered** (cannot self-seed without a human press / production write):

- Telegram `answerCallback` (needs a live `callback_query_id` from a button press). Slack/Teams **no-op** path (non-URL id) **is** covered; real `response_url` / invoke reply needs inbound.
- Amazon SP-API / Katana / WooCommerce **writes** (policy)
- Full interactive browser automation product surface beyond session lifecycle + CDP navigate (pack API is start/get/stop only)

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
bun run integration:up      # ensure local stack + .env (skip if healthy)
bun run test:integration    # live under test/integration/vendors + seams
bun test test/integration/vendors/resend.live.test.ts
bun run integration:e2e     # ensure + full live suite; leave stack up
bun run integration:e2e:ci  # same but --down after (CI / clean teardown)
bun run integration:down
```

---

## Vendors (`test/integration/vendors/`)

| Vendor | Env (prefix `AI_TOOLS_`) | Smoke (high level) |
| --- | --- | --- |
| resend | `RESEND_API_KEY`, `FROM`, `TO` | send + sendBatch |
| cloudflare-email | shared `CF_ACCOUNT_ID` + `CF_API_TOKEN` + `CF_EMAIL_FROM` / `TO` | send + sendBatch |
| telegram | `TELEGRAM_BOT_TOKEN` (+ chat; optional webhook URL/secret) | getBot, webhook, send/edit/action/react/media/group, downloadFile |
| slack | `SLACK_BOT_TOKEN` (+ `SLACK_CHANNEL_ID`; optional `SLACK_USER_ID`) | getBot, listConversations, send/edit, **thread** typing/stopTyping, react, media, **downloadFile round-trip**, answerCallback no-op, optional postEphemeral |
| teams | `TEAMS_APP_ID`, `APP_PASSWORD` (+ chat, service URL; optional `TEAMS_FILE_URL`) | getBot; send/edit/action/react/media; answerCallback no-op; optional downloadFile |
| imessage | `IMESSAGE_BASE_URL` (or `PROXY_URL`) + `PROJECT_ID`/`PROJECT_SECRET` + `CHAT_ID` (+ optional `PHONE`, `FILE_ID`) | photon-rest-proxy; send/edit/typing/react/media/unsend/markRead; optional downloadFile |
| s3 | `S3_*` (MinIO defaults in `.env`) | list/put/get/head/copy/delete/bytes/getBytesRange/signed URL/multipart |
| cloudflare-browser | shared `CF_*` + S3 for render | start/get/stop + optional CDP navigate + renderPdf + renderScreenshot |
| textract | shared `AWS_*` + `TEXTRACT_BUCKET` + `TEXTRACT_SOURCE_KEY` | extractText + extractTextBatch + getStatus |
| **woocommerce** | store + consumer key/secret | **read-only** list/get orders/products/customers/coupons/categories |
| **katana** | `KATANA_API_KEY` | **read-only** list/get all entity surfaces + inventory + `querySalesOrders` + host `list*Page` |
| **amazon-sp-api** | LWA (`AMAZON_CLIENT_*` / refresh) + marketplace/endpoint | **read-only** orders v0 + searchOrders v2026, inventory (+ page), reports (+ page/document/download), settlement summary (soft if none), optional catalog keywords |
| qdrant | `QDRANT_URL` (+ `QDRANT_COLLECTION`) | upsert/query/delete |
| pinecone | `PINECONE_API_KEY` + `BASE_URL` (+ dimension) | upsert/query/delete |
| supabase-vector | shared `SUPABASE_*` | upsert/query/delete |
| mastra-vector | `MASTRA_DB_URL` (+ schema from `SUPABASE_SCHEMA`) | upsert/query/delete (+ disconnect cleanup) |
| eventbridge-scheduler | shared `AWS_*` + `SCHEDULER_TARGET_ARN` + `SCHEDULER_ROLE_ARN` | create/get/list/update/delete (DISABLED schedule) |
| sqs | shared `AWS_*` + `SQS_QUEUE_URL` | enqueue/receive/extend visibility/acknowledge |
| bedrock-agentcore-browser | shared `AWS_*` (+ optional `AWS_BROWSER_ID`); `BROWSER_NAVIGATE_URL` | start/get/stop; optional CDP navigate |
| bedrock-agentcore-code-interpreter | shared `AWS_*` (+ optional `AWS_CODE_INTERPRETER_ID`) | full session surface |
| cloudflare-sandbox | `CF_SANDBOX_BASE_URL` + `CF_SANDBOX_API_KEY` (bridge) | create/exec/executeCode/write/read/destroy |

Vertical kits (`_email`, `_messaging`, `_storage`, `_vector`) are not packs and have no live files.

---

## Seams (`test/integration/seams/`)

| Seam | Env | Smoke |
| --- | --- | --- |
| content-type | none | helpers + all 3 tools (get / extension / extensions) |
| email-message | none | pure parse/build |
| skills | none | bound catalog list/search/get |
| web-fetch | network | get + request (POST when reachable) |
| email | Resend and/or CF email | send + sendBatch per provider |
| files | S3 | list/search/stat/put/get/delete/copy/mkdir/move/multipart (start/part/complete/abort) |
| artifacts | host callbacks (always) + S3 object provider | create/readRange/readLines |
| tasks | host callbacks (always) | create/get/list/update/delete |
| scheduler | shared `AWS_*` + `SCHEDULER_TARGET_ARN` / `ROLE_ARN` | create/get/list/update/delete (DISABLED schedule) |
| queue | shared `AWS_*` + `SQS_QUEUE_URL` | enqueue/receive/extend visibility/acknowledge |
| browser | shared `AWS_*` and/or shared `CF_*` | start/get/stop per provider; optional CDP navigate (`BROWSER_NAVIGATE_URL`) |
| code-sandbox | CF sandbox bridge and/or shared `AWS_*` | start/execute/stop per provider |
| image | S3 | metadata/resize/crop/thumbnail/convert artifacts |
| crypto | none | tools: hash, hmac sign/verify, random bytes |
| calendar | none | tools: build-ics + parse-ics round trip |
| messaging | TG / Slack / iMessage / Teams when env set | full surface incl. Telegram+Slack downloadFile; optional Teams/iMessage download; Slack/Teams answerCallback no-op; iMessage unsend is **vendor-only** |
| document-render | CF browser + S3 | renderPdf + renderScreenshot + batch tools |
| document-extract | Textract | extractText + extractTextBatch + getStatus |
| vector-store | any vector backend | upsert/query/delete per provider |
| rag | embed + vector backend | ingest/retrieve/delete (qdrant / pinecone / supabase / mastra) |

---

## After `bunx supabase start`

```bash
bun run integration:env   # preferred: in-place upsert after integration:up
# or: bunx supabase status -o env
# API_URL          → AI_TOOLS_SUPABASE_URL
# SERVICE_ROLE_KEY → AI_TOOLS_SUPABASE_API_KEY
# DB_URL           → AI_TOOLS_MASTRA_DB_URL
```

If DB password differs from `postgres`, update `AI_TOOLS_MASTRA_DB_URL` only (do not ask agents to open `.env`).
