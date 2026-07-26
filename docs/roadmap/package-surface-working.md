# Working doc: package surface delivery

Status: **living** (update as slices land)  
Package: `@harryy/ai-tools`  
Architecture source of truth: [package-surface-architecture.md](../specs/package-surface-architecture.md)  
Provider seam (Lane A): [provider-seam.md](../specs/provider-seam.md)  

This is **not** a second architecture lock. It tracks inventory, migration, open questions, and slice checklists. When a decision changes, update the architecture spec first, then this doc.

**Authority order** (when docs disagree): `AGENTS.md` → shipped code/gold files → `docs/specs/provider-seam.md` / http-aws ref → pack docs → `package-surface-architecture.md` + **this working doc**. Full gap backlog: [repo-review-standards-and-gaps.md](../handoffs/repo-review-standards-and-gaps.md).

---

## Doc split

| Doc | Holds | Does not hold |
| --- | --- | --- |
| **Architecture spec** | Locked lanes, ownership, patterns, non-goals | Task board, API map progress |
| **This working doc** | Inventory, adapters, backlog, questions, status | Competing architecture |

---

## Inventory: what exists where (as of 2026-07-26)

### A. `@harryy/ai-tools` (this package)

| Surface | Status | Notes |
| --- | --- | --- |
| Kernel + adapters | Done | core, HttpService/AwsService, Mastra/AI SDK/MCP/… |
| Provider seam | Done | Lane A modules |
| `email` (Lane A multi-provider) | **Done** | Thin seam over resend + cloudflare; send/batch only |
| `vendors/resend` | Done | full pack (send surface first; expand over time) |
| `vendors/cloudflare-email` | Done | full pack (send surface first; expand over time) |
| `storage` | **Removed** | No multi-provider storage seam — use `s3` vendor (or nested S3 on `files`) |
| `r2` / `supabase-storage` | **Removed** | Cloudflare R2 REST + Supabase Storage packs deleted; use S3-compatible `s3` (R2 endpoint) when needed |
| `document-extract` | Done | textract only |
| `file-convert` | Done | gotenberg LibreOffice `office-to-pdf` |
| `document` | Done | read (txt/md/json/csv/html/pdf/docx/pptx/xlsx/image) + build text/docx/pptx/xlsx + edit spreadsheet |
| `web-fetch` | Done | allowlisted HttpService |
| `mime` | **Removed** | Stub pack deleted; use `email-message` / `content-type` |
| `content-type` | Done | pure type ↔ extension |
| `email-message` | Done | pure parse/build MIME |
| `files` | Done | path root over nested S3: list/search/stat/get/put/delete/copy/move/mkdir + multipart |
| `document-render` | Done | gotenberg + cloudflare-browser |
| `vector-store` / `rag` | Done | qdrant+pinecone+supabase+mastra; chunk/embed/retrieve |
| `messaging` (thin multi-provider seam) | **Done** | Shared verbs; wraps telegram/slack/teams/imessage vendors |
| `speech` / `pdf` / `image` / `browser` / `queue` / `webhook` / `crypto` / `calendar` | Not started | |
| Codegen multi-lane | Done | discovers modules + vendors |
| `vendors/telegram` | Done | full pack + live message + webhook helpers |
| `vendors/slack` | Done | Web API + webhook helpers + messaging seam provider |
| `vendors/teams` | Done | Bot Framework pack + messaging seam provider |
| `vendors/imessage` | Done | photon-rest-proxy **outbound** pack + messaging seam provider; inbound webhooks = host (no pack webhook.ts) |

### B. Host apps (what stays outside this package)

| Concern | Owner | Notes |
| --- | --- | --- |
| Control plane (whoami, workflows, runs, agents, readiness) | **Host** | Not candidates for this package |
| SaaS OAuth / connector catalogs (Composio, Nango, …) | **Host** | Do not reimplement unless a first-party vendor pack is preferred |
| Webhook HTTP routes, secret storage, tenant→chat map | **Host** | Packs supply verify/parse helpers only |
| Durable outbox, authZ, audit, confirmation UX | **Host** | Optional pure helpers only in package |
| Thin adapters over pack tool ids | **Host** | Map legacy host names → package kebab ids |

---

## Channel pack checklist (every channel)

Use for Telegram first, then copy the row pattern.

**Locked:**

1. Full transport + presentation surface (not thin send).  
2. Host code is a **capability inventory only** — **do not reuse host naming** (it is legacy/messy). Package owns clean names.  
3. Capability **≥ host**, often **strictly more** (provider limits only). Example: reactions accept **any emoji** (and clear); host policy may still pick 👀/🤔/👍/👎.

| Work item | Package | Host |
| --- | --- | --- |
| Auth schema (bot token / app creds) | Yes | Vault bind |
| Service client covering **all** used API methods | Yes (package method names) | — |
| Send text / media / media group | Yes | Agent allowlist / delivery claim |
| Edit message text (+ markup when used) | Yes | Allowlist / stream cadence |
| Typing / chat action + refresh helper | Yes | When to start/stop/renew |
| Reactions set/clear (**any emoji**, not host enum) | Yes | Which emoji for which lifecycle phase |
| Progressive live message: start / update / finalize | Yes | Model delta wiring + final claim |
| Callback answer, file download, webhook get/set/delete | Yes | Route + vault + lifecycle |
| Webhook signature verify | Yes (pure helper) | Call from route |
| Webhook body → normalized inbound event (+ album hints) | Yes | Persist / route / album settlement |
| HTTP route registration | — | Yes |
| Outbox / retries / idempotency / FIFO cohorts | optional helpers | **Yes (production)** |
| Tenant + agent resolution / authZ / audit | — | Yes |

### Telegram capability map (inventory from host; **names are package-owned**)

Host files are reference only for *what* exists, never for *what to call things*.

| Capability (package-facing) | Host does this today | Package shape (proposed) |
| --- | --- | --- |
| Bot identity | `getMe` | client `getBot` · tool `telegram-get-bot` |
| Webhook lifecycle | get/set/delete webhook | client only (or admin tools); host UI |
| Send text | send + reply + markup | `telegram-send-text` |
| Edit text | edit (+ markup) | `telegram-edit-text` |
| Send photo / document / media group | yes | `telegram-send-photo`, `telegram-send-document`, `telegram-send-media-group` |
| Download file bytes | getFile + download | client `downloadFile` · tool `telegram-download-file` |
| Answer callback | yes | `telegram-answer-callback` |
| Chat action / typing | typing only | `telegram-send-chat-action` (full Bot API actions, not typing-only) + `createTypingPulse` helper |
| Message reaction | fixed `👀\|🤔\|👍\|👎\|null` | `telegram-set-reaction` with **any emoji string** or clear |
| Progressive outbound text | `createEditedTextStream` start/write/finish | `createLiveMessage` (`start` / `update` / `finalize`) over send+edit |
| Lifecycle presentation | host picks eyes→thinking→like/dislike | host policy; pack only sets emoji it is given |
| Typing renew | host loop | host schedules; pack supplies action + optional pulse helper |
| Album by media group | durable host | parse/normalize in pack; settlement host |
| Webhook verify + Update parse | host route | pure verify/parse in pack |
| Tenant / grants / FIFO / send claim | host | **host only** |

**Naming anti-patterns (do not ship):** `sendTelegramMessage`, `setTelegramMessageReaction`, `createEditedTextStream`, host-only emoji unions, host RPC/lifecycle type names.

Slice 3 done when: this capability map is implemented under `src/channels/telegram` with **package names**, tests, docs; host can thin-adapt without reimplementing Bot API.

---

## Vendor pack checklist (every vendor)

| Work item | Notes |
| --- | --- |
| Auth schema + host docs | No model-facing secrets |
| Service client | ofetch or SigV4 as needed |
| API map doc in vendor README | What is mapped / not mapped |
| Ship first action group | e.g. Woo: list/get order + list/get product |
| Expand by demand | Amazon reports, etc. |
| Host thin adapter | Host maps old names onto pack tools when ready |

### Initial vendor API map stubs

**woocommerce**

- [x] orders CRUD + notes + refunds  
- [x] products CRUD + variations  
- [x] customers, coupons, product categories  
- [ ] webhooks admin, shipping zones, reports (later)  

**katana**

- [x] sales orders CRUD  
- [x] products, materials  
- [x] customers, suppliers  
- [x] purchase + manufacturing orders  
- [x] inventory list  
- [ ] stock transfers / stocktakes / recipes (later)  

**amazon-sp-api**

- [x] orders list/get + order items  
- [x] FBA inventory summaries  
- [x] reports create/list/get + document  
- [x] catalog item search  
- [ ] listings / finances / shipments (later)  
- [ ] Do **not** block on full SP-API coverage  

---

## Platform module slice checklist

### Spine (default build order)

| # | Slice | Status | Done when |
| --- | --- | --- | --- |
| 0 | Multi-lane codegen (`modules` + `vendors` + `channels`) | Done | `bun run codegen` registers all three |
| 1 | `document-render` + gotenberg + cloudflare-browser | Done | PDF + screenshot; ArtifactRef out; tests |
| 2 | `files` (root_prefix + storage auth) | Done | list/search/stat relative keys; tests |
| 3 | `vendors/telegram` | Done | Full pack; tools + live message + webhook helpers |
| 3b | `vendors/resend` + `vendors/cloudflare-email` + `modules/email` | Done | Lane B email ESPs + thin multi-provider email seam |
| 4 | `vendors/woocommerce` (first action group) | Done | orders + products list/get |
| 5 | `vendors/katana` | Done | sales order list/get |
| 6 | `vendors/amazon-sp-api` (first action group) | Done | orders + FBA inventory summaries |
| 7 | `vector-store` + `rag` | Done | qdrant+pinecone+supabase; ingest/retrieve via host embed |
| 8 | `vendors/slack` + messaging seam | Done | Web API pack + multi-provider messaging |
| 8b | `vendors/teams` | Done | Bot Framework pack in messaging seam |
| 9 | `vendors/imessage` (photon-rest-proxy) | Done | HTTP pack; gRPC only in hosted proxy |
| 10 | Remaining platform (speech, browser, pdf, image, queue, webhook, crypto, calendar) | Backlog | product-driven |

---

## Knowledge / Mastra memory (detail)

| Piece | Package | Host |
| --- | --- | --- |
| `vector-store` tools | Yes | DB connection, collection names |
| `rag-ingest` / `rag-retrieve` | Yes | Embed model route, classification |
| Mastra Memory schemas / PG tables | — | Yes (`@mastra/memory`, operator) |
| Optional `mastra-memory` tool wrapper | Only if product needs tool-facing memory APIs | Binds existing store |
| Org RAG purpose / PHI gates | — | Yes |

---

## Open questions

Record answers here; promote locked answers into the architecture spec.

1. **Codegen:** one manifest for all lanes, or separate manifests? (Default: one discovery root list.)  
2. ~~**messaging vs channels only**~~ → **Locked:** both. Full packs (A) + thin shared seam (B). Shared client method names (`sendText`, `editText`, `sendChatAction`, `setReaction`, `clearReaction`, `sendMedia`, `downloadFile`, `answerCallback`) so seam is wiring. Ship Telegram pack first with those names; `messaging` module can follow once 2+ packs exist.
3. **Amazon auth model:** host always supplies LWA tokens, or package documents refresh helpers?  
4. **document-render ArtifactRef:** always write PDF/PNG to storage, or allow base64 for tiny screenshots? (Default: storage for agent-facing outputs.)  
5. **iMessage:** Photon as only provider under `channels/imessage`?  
6. **SMS:** under `messaging` providers (Twilio) vs separate `sms` module? (Default: `messaging` providers.)  

---

## Decision log (short)

| Date | Decision |
| --- | --- |
| 2026-07-22 | Two roots: modules / vendors (+ underscore vertical kits) |
| 2026-07-22 | Fat APIs are vendor packs, not forced commerce facades |
| 2026-07-22 | Channels include tools + webhook tooling; host owns durability |
| 2026-07-22 | Channel packs = full transport/presentation surface (typing, reactions, stream edit/final, media groups, …), not thin send |
| 2026-07-22 | Channel naming is package-owned; host is capability inventory only; reactions any emoji (not host enum); capability ≥ host |
| 2026-07-22 | Dual access: full vendor packs + thin shared seams (`messaging`, `email`); aligned client method names for seam wiring |
| 2026-07-26 | Architecture + inventory docs reconciled: email + messaging seams are **shipped** thin wrappers (not removed / not “not planned”) |
| 2026-07-26 | S3 vendor client uses `AwsService` (no raw `AwsClient` soup in product clients) |
| 2026-07-22 | document-render ≠ file-convert; self-host first (Gotenberg) |
| 2026-07-22 | org files → path-scoped `files` over storage |
| 2026-07-22 | Composio/Nango remain SaaS OAuth + PHI catalog |

---

## How to update this doc

- After each delivered slice: flip checklist status, note commit/version if released.  
- New product inventory: add rows under Inventory, not new architecture.  
- Architecture change: edit [package-surface-architecture.md](../specs/package-surface-architecture.md) first, then Decision log here.
