# Spec: Package surface architecture (modules · vendors)

Status: **locked for implementation**  
Package: `@harryy/ai-tools`  
Date: 2026-07-22  

Related:

- [provider-seam.md](./provider-seam.md) — multi-provider capability modules only  
- [artifacts-extract-convert.md](./artifacts-extract-convert.md) — ArtifactRef pipelines  
- [http-and-aws-services.md](../reference/http-and-aws-services.md) — HTTP / SigV4 transport  
- [host-integration-kernel.md](./host-integration-kernel.md) — bind/context/hooks/catalog; **not** an agent brain  
- **Working delivery board:** [package-surface-working.md](../roadmap/package-surface-working.md) — inventory, migration, checklists, open questions  
- Host product context: connector seam (Composio + Nango where used), channel productionization  


### What this doc is vs is not

| This architecture spec | Working doc |
| --- | --- |
| Locked lanes, ownership, patterns, non-goals, build preference | Living inventory, slice status, open questions |
| Change only when a product decision changes | Update every delivered slice |

---

## Goals

1. One package, two **source roots** so platform seams and fat vendor APIs are not forced into one taxonomy.
2. Keep **Composio / Nango** as the OAuth SaaS catalog and PHI routing path; this package owns first-party HTTP/SigV4, self-hostable services, and channels the host operates.
3. Make **channel messaging** complete: not “webhook only” — inbound parse, outbound tools, media, edits, and host-owned durable delivery.
4. Prefer **self-hostable providers** for document render, convert, extract, speech, browser, and vectors, with managed clouds as optional providers.
5. Preserve kernel rules: auth host-bound, adapters generic, `HttpService` / `AwsService`, stable tool ids.
6. Remain a **reusable tool-pack library + host-integration kernel** — never an agent brain/runtime (see [host-integration-kernel.md](./host-integration-kernel.md)).

---

## Non-goals

- Becoming an **agent brain**, agent runtime, or product control plane (confirmation UX, model routing, chat delivery, durable product orchestration).
- Replacing Composio/Nango for broad SaaS OAuth catalogs or Composio-style connector “meta tools.”
- Encoding tenant RLS, org membership, agent allowlists, or PHI policy in this package (host owns those).
- Forcing huge APIs (Amazon SP-API, full Slack API) into a five-tool generic “commerce” or “chat” facade.
- Owning Mastra Memory / pgvector product schema (host owns stores; package exposes tools/clients).

---

## The three product kinds (two source roots)

```text
@harryy/ai-tools
├── modules/      Platform seams (storage, files, document-render, …)
└── vendors/      3rd-party packs (resend, telegram, cloudflare-email, …)
```

| Kind | Preferred source path | Module id style | When to use |
| --- | --- | --- | --- |
| **Platform capability** | `src/modules/<capability>/` | Capability name (`storage`, `files`) | Small stable contracts; **2+ swappable providers** with same verbs |
| **Vendor pack** | `src/vendors/<vendor>/` | Vendor name (`resend`, `telegram`, `cloudflare-email`, …) | Full first-party API; grow tools over time (includes chat platforms) |

**3rd party → vendors; seams → modules.** Chat platforms (Telegram, Slack, …) and email ESPs (Resend, Cloudflare Email) are **vendor packs** with full product APIs. Platform **seams** (storage, files, document-render, email, messaging, …) stay under **modules/**.

**Thin seams are allowed** when 2+ backends share the same verbs: they wrap vendor clients and must **not** shrink or replace full packs. Native-only APIs stay on the vendor. Do **not** invent a fat multi-provider facade that erases vendor surface.

Public imports stay **flat** regardless of source lane:

```ts
import { storageModule } from '@harryy/ai-tools/storage'
import { emailModule } from '@harryy/ai-tools/email'
import { messagingModule } from '@harryy/ai-tools/messaging'
import { resendModule, ResendClient } from '@harryy/ai-tools/resend'
import { telegramModule } from '@harryy/ai-tools/telegram'
```

Codegen discovers `modules/*` and `vendors/*` only.

### Email and messaging (locked)

| Product need | Kind | Pack path |
| --- | --- | --- |
| Full Resend API | Vendor | `vendors/resend` |
| Full Cloudflare Email API | Vendor | `vendors/cloudflare-email` |
| Shared send verbs (bind one provider) | Seam | `modules/email` — thin wrap; providers `resend`, `cloudflare` |
| Full Telegram / Slack / Teams / iMessage API | Vendor (chat) | `vendors/telegram`, `slack`, `teams`, `imessage` |
| Shared channel verbs (bind one provider) | Seam | `modules/messaging` — thin wrap; providers `telegram`, `slack`, `teams`, `imessage` |

**Dual surface (locked):** full vendor packs **and** optional thin seams. Hosts that need the full product API import the vendor. Hosts that bind one channel/ESP at a time and want stable capability tool ids use the seam. Seams never replace packs.

### How this relates to Composio / Nango

| Concern | Owner |
| --- | --- |
| Logical tool catalog for SaaS OAuth apps | Host + Composio/Nango seam |
| PHI fail-closed routing (Nango only) | Host |
| Self-hosted render/convert/extract | **This package** (platform modules) |
| Resend / Cloudflare Email / Amazon / Woo first-party | **This package** (vendor packs) **or** Composio when OAuth catalog wins |
| Telegram / Slack / iMessage | **This package** (messaging packs) + host durable turn / authZ |

Rule of thumb:

- **OAuth + huge multi-app catalog** → Composio/Nango  
- **You own credentials, self-host, or need strict contracts** → platform or vendor lane  
- **Chat transport is product messaging** → messaging lane + host outbox/authZ/audit  

---

## Lane A — Platform modules (`src/modules`)

### Pattern

Same as [provider-seam.md](./provider-seam.md):

```text
src/modules/<capability>/
  contracts.ts
  module.ts
  providers/<provider>.ts   # ops type class
  index.ts
```

- Tool ids are **capability-named** (`email-send`, `storage-get-object`).  
- Auth is `{ provider: '…', … }` union.  
- Never name a **platform** module after a single cloud vendor (`cloudflare-email` is forbidden).  
- `HttpService` for HTTP; `AwsService` for SigV4 (S3, Textract, SP-API, …).

### Current platform modules

| Module | Providers (today) | Notes |
| --- | --- | --- |
| `storage` | s3, r2 (CF REST), supabase | Object CRUD; multipart + signed URL when provider supports (S3) |
| `files` | nested storage + `root_prefix` | Path-rooted manage over storage |
| `email` | resend, cloudflare | Thin send/batch seam over email vendors |
| `messaging` | telegram, slack, teams, imessage | Thin shared channel verbs over chat vendors |
| `document-extract` | textract | ArtifactRef text extract |
| `document-render` | gotenberg, cloudflare-browser | HTML/URL → PDF / screenshot |
| `file-convert` | transmute | Format conversion (not browser print) |
| `web-fetch` | host allowlist | Free-form allowlisted HTTP |
| `email-message` | none | Email message parse/build |
| `content-type` | none | MIME type ↔ extension |
| `vector-store` | qdrant, pinecone, supabase, mastra | Upsert / query / delete vectors |
| `rag` | nested vector_store + embed | Chunk + OpenAI-compatible embed + store/retrieve |

### Planned platform modules

| Module | Job | Provider examples (self-host preferred first) |
| --- | --- | --- |
| `speech` | STT / TTS | whisper-selfhost, elevenlabs, deepgram |
| `vector-store` (more providers) | Upsert / query / delete vectors | weaviate, chroma, … |
| `rag` (extensions) | Ingest + retrieve | additional embed adapters |
| `pdf` | Merge, split, page count | gotenberg, stirling-pdf, pdf-lib |
| `image` | Resize, thumb, light transforms | imgproxy, sharp (node), cloudinary |
| `browser` | Scrape / structured page ops | browserless, playwright-server |
| `queue` | Enqueue durable work | sqs (AwsService), redis, nats |
| `webhook` | Signed outbound HTTP dispatch | pure + HttpService |
| `crypto` | HMAC, JWT verify | pure helpers (`auth: none` or host secrets) |
| `calendar` | ICS build / thin CalDAV | ical pure; CalDAV HttpService |

#### `files` (path-scoped; replaces “org files are only product”)

- Host maps tenant → storage credentials + `root_prefix` (e.g. `orgs/{id}/files/`).  
- Tools: list / search / stat / get / put / delete / copy / mkdir — all under root only.  
- Keys exposed to the model are **relative to root**.  
- Host keeps RLS and org membership; package enforces prefix isolation at the tool boundary.

#### `document-render` vs `file-convert`

| | `file-convert` (Transmute, …) | `document-render` |
| --- | --- | --- |
| Input | Documents / images / formats | HTML string, URL, template |
| Output | Converted file | Print PDF, screenshot PNG |
| Engine | Format converters | Browser / print pipeline |

They share **ArtifactRef + storage**. They are **not** the same module. HTML→PDF via Gotenberg may appear as a render provider or later as a convert provider; screenshots always belong to render.

#### Knowledge / memory (`vector-store`, `rag`)

- `vector-store` — storage ops only; host owns the database.  
- `rag` — chunk/embed/store and retrieve; embed credentials host-bound.  
- Optional thin `mastra-memory` tools only if product needs explicit Mastra memory APIs as agent tools; Mastra Memory ownership stays with the host.  
- Do not reimplement product org-RAG classification policy in this package.

---

## Lane B — Vendor packs (`src/vendors`)

### Why this lane exists

Amazon SP-API, Katana, WooCommerce, etc. are **large, domain-specific APIs**. Forcing them into tiny generic “commerce-orders / commerce-products” modules loses coverage and creates fake abstractions.

Vendor packs are the first-party analogue of a Composio toolkit:

- One pack per vendor.  
- Tool surface grows as APIs are mapped.  
- Auth schema is vendor-specific (still host-bound via `withAuth`).  
- ofetch (or aws4fetch when SigV4 is required) **service clients** own endpoints; tools stay thin.

### Layout

```text
src/vendors/<vendor-key>/
  auth.ts                 # Zod auth (no model fields)
  client.ts               # service client (ofetch / aws4fetch)
  tools/                  # one file per action or domain group
  module.ts               # defineModule({ id: vendor-key, tools: […] })
  index.ts
  README.md               # API map progress, auth setup (host-facing)
```

### Initial vendor targets

| Vendor key | Domains to map (incremental) | Notes |
| --- | --- | --- |
| `woocommerce` | orders, products | REST + consumer key/secret |
| `katana` | sales orders, related reads | Expand by product demand |
| `amazon-sp-api` | orders, inventory, reports, documents, … | Large surface; ship action groups deliberately |

Tool ids **may** be vendor-prefixed (`woocommerce-list-orders`, `amazon-sp-api-create-report`). That is intentional for this lane.

### Optional host-level “logical commerce”

Grouping Amazon + Woo under one UI “Orders” catalog is a **host connector/catalog** concern (same idea as Composio logical tools). It is **not** required inside this package. If added later, it is a thin projection over vendor tools, not a replacement for vendor packs.

---

## Messaging (vendor packs + optional thin seam)

### Product reality

Product messaging is multi-channel (Telegram, Slack, Teams, Photon-backed iMessage; later WhatsApp). Each transport is a **full vendor pack** under `src/vendors/<channel>/`. Hosts may also bind the thin **`modules/messaging`** seam (`{ provider, … }`) for shared verbs. Native-only APIs stay on the vendor pack. Host keeps durable turns, authZ, and audit.

### Messaging pack owns more than webhooks

**Locked:** a messaging pack is a **full transport + presentation surface**, not a thin “send message” wrapper.  
If the product already does typing, reactions, progressive edit/stream, final/complete, media groups, callbacks, file download, webhook lifecycle, etc., the pack must expose those primitives (client + tools/helpers). Host owns orchestration (when to type, when to react, FIFO cohorts, durable claim) but must not reimplement Bot API / Spectrum / Photon calls.

| Piece | Package (messaging module) | Host product |
| --- | --- | --- |
| API client (Bot API, Slack Web API, Photon, …) | Yes — **full used surface** | — |
| Outbound tools (send text/media, edit, react, typing, stream write/final, …) | Yes | Allowlist which tools agents get |
| Presentation helpers (e.g. live message, typing pulse) | Yes (pure/composition over client) | Schedules when to call them |
| Inbound webhook **verification + parse** helpers | Yes | HTTP route registration, raw body |
| Webhook **route**, signature secret storage | Helpers only | Host HTTP + secrets |
| Durable outbox / retries / idempotency / FIFO cohorts | Optional pure helpers | **Host owns** production durability |
| Tenant mapping (chat id → org/agent) | — | **Host** |
| Access level / confirmation / audit / reaction policy | — | **Host** |

So: **every feature the product channel uses for transport/presentation lives in the pack.** Host still owns product orchestration, tenancy, and durability.

### Naming and API design (locked)

Product hosts are **capability inventories only**. They are **not** the naming authority.

| Rule | Detail |
| --- | --- |
| **No host name inheritance** | Do not copy host symbols, tool ids, helper names, or awkward legacy terms (`sendTelegramMessage`, `createEditedTextStream`, eyes/thinking enums, etc.). |
| **Package-owned names** | Stable, capability-shaped, snake/kebab tool ids (`telegram-send-text`, `telegram-set-reaction`), clean client methods, plain contracts. |
| **Capability ≥ host, often more** | Match every host transport behavior, then open constraints the host hardcoded without product reason (e.g. reactions = **any emoji** + clear, not a four-emoji enum). |
| **Provider limits only** | Cap behavior by the real API (Telegram Bot API, Slack, Photon), not by host policy. Host policy stays in the host. |
| **Thin host adapters later** | Host maps its old names onto this package; the package never mirrors the host. |

### Layout

```text
src/vendors/<channel-key>/
  contracts.ts
  client.ts               # class client + private ofetch service
  webhook.ts              # verify + parse → normalized inbound event (pure)
  module.ts               # tools → client
  index.ts
```

### Normalized inbound event (shared shape, channel-specific parser)

Host-facing (and optional tool output), content-minimized:

```ts
{
  channel: 'telegram' | 'slack' | 'imessage' | 'teams' | 'whatsapp'
  event_id: string
  chat_id: string
  user_id?: string
  message_id?: string
  text?: string
  media?: Array<{ kind: string; ref?: string; media_type?: string }>
  reply_to?: string
  raw_type: string          // channel-native type name
  received_at: string       // ISO
}
```

PHI/PII: never log full payloads in package errors; host applies classification.

### Channel targets

| Channel key | Priority | API notes |
| --- | --- | --- |
| `telegram` | P0 (product first) | Bot API |
| `slack` | P1 | Events API + Web API |
| `imessage` | P1 (product specced) | Photon Spectrum |
| `teams` | P2 | Bot Framework / Graph as chosen by host |
| `whatsapp` | P2 | Meta Cloud API or BSP |

### Aligned method names across messaging packs + thin seam

Messaging packs implement shared method names (`sendText`, `editText`, `sendChatAction`, `setReaction`, …) on their **class clients** so host code, pure helpers (`createLiveMessage`), and the **`messaging` seam** compose easily. The seam is wiring over vendor clients — it does **not** shrink pack APIs.

```ts
createLiveMessage({ sendText, editText }) → { start, update, finalize }
// or host binds:
withAuth(messagingModule, { provider: 'telegram', bot_token: '…' })
```

Channel-specific methods stay on the pack only (`sendMediaGroup`, Slack blocks, …).

---

## HTTP and transport standards

Applies to all three lanes:

1. **`HttpService`** (ofetch) for JSON/HTTP.  
2. **`AwsService`** (HttpService + aws4fetch SigV4) when signing is required.  
3. Prefer **vendor REST** over Workers-only bindings (e.g. R2 REST or S3 API, not `env.R2` as the primary provider).  
4. Auth only via `withAuth` / `ctx.auth`.  
5. Batch + cursor pagination + `rate_limited` / `retryable` where the domain allows.

See [http-and-aws-services.md](../reference/http-and-aws-services.md).

---

## Self-hosted provider matrix (preferred defaults)

| Capability | Self-hosted / first-party | Managed optional |
| --- | --- | --- |
| document-render | **Gotenberg**, Browserless, Playwright server | Cloudflare Browser Rendering |
| file-convert | **Transmute**, LibreOffice headless stacks | Cloud convert APIs |
| document-extract | ocrmypdf / tesseract / docling services | **Textract** |
| speech | Whisper / faster-whisper, Piper | ElevenLabs, Deepgram |
| browser | Browserless, Playwright | Firecrawl cloud |
| vector-store | **pgvector**, Qdrant, Weaviate, Chroma | Pinecone, managed Supabase |
| pdf utils | Stirling-PDF, qpdf, pdf-lib | — |
| image | imgproxy, sharp | Cloudinary |
| queue | Redis, NATS | SQS, Cloudflare Queues |

Document each provider’s host setup in module docs (host-facing only; not model-facing tool copy).

---

## Artifact pipeline (cross-cutting)

- Durable bytes use `ArtifactRef` (`store: 'object' | 'host'`).  
- Convert / extract / render / rag-ingest accept ArtifactRef where large payloads must not enter the LLM.  
- `files` and `storage` share the same object plane; `files` only adds root prefix + metadata UX.

---

## Host vs package responsibility (summary)

| Responsibility | Package | Host |
| --- | --- | --- |
| Tool schemas, execute, errors | Yes | — |
| Provider HTTP clients | Yes | — |
| Secret storage / vaults | — | Yes |
| Org tenancy / RLS | — | Yes |
| Agent tool allowlists | — | Yes |
| Channel durable turns / outbox | Helpers optional | Yes |
| Composio/Nango catalog + PHI route | — | Yes |
| Framework projection (Mastra, AI SDK, MCP) | Adapters | Composition |

---

## Build order (locked preference)

1. **Layout** — discover `modules` / `vendors`; docs + AGENTS locks (this spec).  
2. **`document-render`** — providers: gotenberg + cloudflare-browser.  
3. **`files`** — path root over storage.  
4. **`vendors/telegram`** — full Bot API pack (product P0).  
5. **Email vendor packs** — `resend`, `cloudflare-email` (expand APIs over time).  
6. **Vendor lifts** — `woocommerce`, `katana`, `amazon-sp-api`.  
7. **`vector-store` + `rag`**.  
8. **More messaging** — slack, imessage, whatsapp, teams.  
9. **Remaining platform** — speech, browser, pdf, image, queue, webhook, crypto as needed.

---

## Acceptance criteria

- Spec distinguishes **modules / vendors** with explicit layout and import paths.  
- Platform modules keep generic tool ids + provider auth unions.  
- Vendor packs may use vendor-prefixed tool ids and full API surfaces.  
- Channel packs include **tools + webhook verify/parse**, not webhook-only stubs.  
- Document-render is separate from file-convert; self-host providers are first-class.  
- Composio/Nango remain the SaaS OAuth catalog; this package does not absorb them.  
- Host tenancy/authZ/durable turns remain outside package tools.

---

## Implementation notes (non-normative)

- Lane A: storage, files, email, messaging, extract, convert, render, web-fetch, email-message, content-type, vector-store, rag.  
- Lane B: `resend`, `cloudflare-email`, chat vendors, storage vendors, commerce vendors, etc.  
- Chat: full packs under `vendors/*` + thin `modules/messaging` seam.  
- Email: full packs under `vendors/*` + thin `modules/email` seam.  
- Codegen discovers `modules` + `vendors`.  
- Host apps can thin-adapt existing custom tools over platform/vendor packs without a big-bang rewrite.
