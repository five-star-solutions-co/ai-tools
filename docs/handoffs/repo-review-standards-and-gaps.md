# Repo review: standards, non-negotiables, and gap tasks

**Package:** `@harryy/ai-tools`  
**Repo:** `/Users/harryy/Desktop/hariom/ai-tools`  
**Captured:** 2026-07-26  
**Status:** knowledge + backlog only — **do not implement or commit** unless the user explicitly asks.

This document is the full dump from an end-to-end read of the package: architecture, locked standards, inventory, and **serious gaps** turned into actionable tasks with enough context to execute without re-deriving the review.

**Authority order when docs disagree:**

1. `AGENTS.md` (hard rules)
2. Shipped code + gold files
3. `docs/specs/provider-seam.md`, `docs/reference/http-and-aws-services.md`
4. README / pack docs under `docs/modules|vendors/`
5. `docs/specs/package-surface-architecture.md` + `docs/roadmap/package-surface-working.md` (reconciled 2026-07-26 for email/messaging dual surface — G-02)
6. `docs/specs/host-integration-kernel.md` — bind/context/hooks/catalog; **not** an agent brain

---

## Table of contents

1. [Mental model](#1-mental-model)
2. [Inventory (shipped)](#2-inventory-shipped)
3. [Standards that must stay the same](#3-standards-that-must-stay-the-same)
4. [Never invent / never skip](#4-never-invent--never-skip)
5. [Gold files to clone](#5-gold-files-to-clone)
6. [What is solid](#6-what-is-solid)
7. [Gap tasks (backlog)](#7-gap-tasks-backlog)
8. [Host-integration epic (later)](#8-host-integration-epic-later)
9. [Suggested execution order](#9-suggested-execution-order)
10. [Verification rules for any fix](#10-verification-rules-for-any-fix)

---

## 1. Mental model

### 1.1 One package, layered surface

| Layer | Path | Role |
| --- | --- | --- |
| **Kernel** | `src/core/` | Only place tools are *authored*: `defineTool` / `defineModule`, `withAuth`, `runTool`, `ToolError`, contracts, catalog |
| **Transport** | `src/transport/` | Only HTTP stack: `HttpService` (ofetch) + `AwsService` (SigV4) → public `@harryy/ai-tools/http` |
| **Adapters** | `src/adapters/*` | Projectors only (Mastra, AI SDK, TanStack, Cloudflare, MCP). No business logic |
| **Modules (seams)** | `src/modules/*` | Capability contracts *we* own; multi-provider when 2+ backends share verbs |
| **Vendors** | `src/vendors/*` | Full first-party API of one 3rd-party product; grow over time |
| **Vertical kits** | `src/vendors/_email`, `_storage`, `_messaging`, `_vector` | Shared schemas/helpers; **codegen-skipped**, not published |
| **Shared** | `src/shared/` | Cross-cutting pure helpers: artifact, batch, bytes, content-type, pagination |

### 1.2 Three consumption paths (locked)

```text
defineTool / defineModule  (kernel — only real tool definitions)
        │
        ├─► Host:   Class client  (new ResendClient(auth).send(...))
        ├─► Agent:  withAuth(module) → tools → adapters
        └─► Direct: runTool(tool, input, ctx)
```

- Auth is **host-bound only** (`constructor` / `withAuth` / `ctx.auth`). **Never** on tool inputs.
- Public imports are **flat**: `@harryy/ai-tools/resend`, not `@harryy/ai-tools/vendors/resend`.
- Codegen owns `package.json` exports, `tsdown.config.ts`, `generated/module-manifest.json`, `src/generated/module-keys.ts`.

### 1.3 modules vs vendors

| Root | Holds | When |
| --- | --- | --- |
| `src/modules/<key>/` | **Our seams** | Stable capability contract; backends swappable when real (`files`, multi-provider email/messaging, etc.) |
| `src/vendors/<key>/` | **3rd-party packs** | Full API of one product (`resend`, `telegram`, `woocommerce`, …) |
| `src/vendors/_*/` | Vertical kits | Shared by packs in that category only; underscore = skipped by codegen |

**Seam provider rule:**

```text
modules/<seam>/providers/foo.ts   →  thin wrap of vendors/foo Client
vendors/foo/client.ts             →  owns HttpService / AwsService + vendor API
```

**Forbidden:** fat HTTP / ofetch / REST mapping living only under `modules/*/providers/*.ts`.

### 1.4 Pack file layout (same both roots)

```text
src/modules|vendors/<kebab-key>/
  contracts.ts    # Zod I/O + auth schema + domain types
  domain.ts       # optional shared preflight (no HTTP)
  client.ts       # public class client (owns HttpService / AwsService)
  providers/      # modules only: multi-provider ops (real seams)
  webhook.ts      # chat vendors only: verify + parse
  module.ts       # defineModule + defineTool adapters over client
  index.ts        # public re-exports (codegen entry)
```

### 1.5 Kernel responsibilities

| API | Role |
| --- | --- |
| `defineTool` | id, name, description, schemas, execute; input parsed in execute |
| `defineModule` | id, title, description, auth, tools; unique tool ids |
| `withAuth` | Bind credentials into every tool execute (closes auth) |
| `runTool` | safeParse input → execute → safeParse output |
| `requireAuth` / `resolveProvider` | Parse `ctx.auth`; pick provider by `auth.provider` |
| `defineProvider` | Optional unused helper — gold seams use switch + Ops (G-08 done) |
| `ToolError` | Stable codes + retryable + details (no secrets) |
| `validateTool` / `validateModule` | Model-copy, kebab id, field `.describe()` contracts |

### 1.6 Transport

| Class | Role |
| --- | --- |
| `HttpService` | ofetch; `query` / `bytes` / get/post/put/patch/delete/head; throws `ToolError` on non-2xx by default |
| `AwsService` | extends HttpService; signs every request with aws4fetch; `sign()` for presigned URLs |

Auth on HTTP is just **headers** (or SigV4 credentials on `AwsService`). Product clients **own** the transport instance in the constructor. Tools never call transport.

### 1.7 Artifacts

Durable bytes use `ArtifactRef` (`src/shared/artifact.ts`):

```ts
{ store: 'object' | 'host', key: string, media_type?, filename?, byte_length? }
```

Extract / convert / render accept ArtifactRef so large payloads do not enter the LLM. (Messaging still uses base64 — see G-04.)

### 1.8 Host vs package

| Package owns | Host owns |
| --- | --- |
| Tool schemas, execute, errors | Secret vaults |
| Provider HTTP clients | Org tenancy / RLS |
| Webhook verify + parse helpers | HTTP routes + secret storage |
| Optional pure presentation helpers | Durable outbox / retries / FIFO / claim |
| — | Agent allowlists / confirmation UX |
| — | Composio/Nango OAuth catalog + PHI routing |

---

## 2. Inventory (shipped)

### 2.1 Brain exports

`core`, `http`, `mastra`, `ai-sdk`, `tanstack`, `cloudflare`, `mcp`

### 2.2 Seams (`src/modules/`)

| Key | Kind | Notes |
| --- | --- | --- |
| `files` | nested S3 + `root_prefix` | Path isolation over S3Client |
| `email` | multi-provider | resend, cloudflare — send/batch only |
| `messaging` | multi-provider | telegram, slack, teams, imessage — shared verbs |
| `document-extract` | multi-provider | textract only |
| `document-render` | multi-provider | gotenberg, cloudflare-browser |
| `file-convert` | multi-provider | gotenberg LibreOffice `office-to-pdf` (+ nested S3 storage) |
| `web-fetch` | host policy | allowlisted HTTP |
| `vector-store` | multi-provider | qdrant, pinecone, supabase, mastra |
| `rag` | nested | chunk + OpenAI-compatible embed + nested vector-store |
| `email-message` | pure (no auth) | parse/build MIME |
| `content-type` | pure (no auth) | media type ↔ extension |


### 2.3 Vendors (`src/vendors/`)

resend, cloudflare-email, telegram, slack, teams, imessage, s3, qdrant, pinecone, supabase-vector, mastra-vector, textract, gotenberg, cloudflare-browser, woocommerce, katana, amazon-sp-api

### 2.4 Vertical kits (not packs)

| Kit | Role |
| --- | --- |
| `_email` | address, limits, schemas |
| `_storage` | shared storage I/O schemas |
| `_messaging` | live message / typing pulse helpers |
| `_vector` | shared vector I/O schemas + private domain parse |

### 2.5 Scale (approx at capture)

~33 packs, ~22k LOC under `src/`, unit tests under `test/`, live tests under `test/integration/`.

---

## 3. Standards that must stay the same

These override convenience, host inventory code, and “I’ll clean it up later.”

### 3.1 Hard rules from `AGENTS.md`

| ID | Rule |
| --- | --- |
| **R-commit** | Never commit unless the **current** user message explicitly asks |
| **R0** | Read AGENTS → http/aws ref if network → package-surface / provider-seam if multi-provider → **clone a gold file** before code |
| **R1** | Same problem → same shape. Host repos are capability inventory only |
| **R-no-spread-undefined** | Never `...(x === undefined ? {} : { key: x })` for optionals; use `if` assign or typed `| undefined` |
| **R2** | modules = seams; vendors = 3rd-party; kits underscored |
| **R3** | Flat public imports; codegen owns export surface |
| **R4** | Client class + tools + adapters (not “everything is a class” or tools-only when host needs client) |
| **R5** | File layout locked (contracts / domain / client / providers / webhook / module / index) |
| **R6** | All product HTTP via `HttpService` / `AwsService` |
| **R7** | Auth host-bound; snake_case auth/domain; kebab tool ids; model copy has no secrets/env/vault |
| **R8** | Name gold file + module vs vendor + endpoints before writing; stop and ask if no same-shape file |
| **R9** | Format only session-touched paths; done = `bun run check` green. Green ≠ commit |

### 3.2 Naming

| Surface | Convention |
| --- | --- |
| Tool ids | kebab-case; seams capability-prefixed (`storage-get-object`); vendors vendor-prefixed (`telegram-send-text`) |
| Auth / domain fields | snake_case (`api_key`, `access_key_id`, `bot_token`) unless already shipped camelCase for that surface |
| Model-facing copy | what / when / bounds only — no API keys, env names, vault, install, host wiring |
| Package names | Package-owned; host is inventory only — never copy host symbols |

### 3.3 Type safety (`src/`)

- No `as T` / `as any` / non-null `!` / `@ts-ignore` / `@ts-expect-error` except unchained `as const`
- Untrusted boundaries: `unknown` + runtime checks (Zod, guards)
- Prefer `es-toolkit` / `es-toolkit/compat` over hand-rolled typeof/array helpers

### 3.4 Errors

Stable `ToolError` codes: `bad_input`, `bad_auth`, `forbidden`, `not_found`, `rate_limited`, `upstream`, `timeout`, `too_large`, `unsupported`, `unsupported_runtime`, `internal`.

Never leak secrets in messages or details.

### 3.5 Batch / pagination

- Batch: `runBatchItems` in `src/shared/batch` (`p-map` + optional `p-retry`)
- Not inside transport
- Partial failure OK for batches unless product says otherwise

### 3.6 Dependencies & tooling

- Package manager **Bun**; versions **exact**
- No add/remove/upgrade deps or package scripts without explicit approval
- Formatter **oxfmt**; linter **oxlint** type-aware; codegen **oxc-parser**; build **tsdown**; hooks **lefthook**
- Do not introduce Prettier, ESLint, or Husky

### 3.7 Gate

```bash
# while editing
oxfmt --write <session-touched-paths>

# claim done
bun run check   # format:check + lint + codegen:check + unit tests
```

If public surface / build emit changed: also `bun run build` and `bun run typecheck`.

---

## 4. Never invent / never skip

### Never invent

- A second HTTP stack (raw `fetch` loops, custom retry frameworks, dual `json`/`form`/`methodJson` helpers, dynamic `/${method}` routers)
- Fat multi-provider facades that shrink real vendor APIs into five toy tools (seams stay **thin wrappers** of full packs)
- Fat single-vendor HTTP only under `modules/` as a fake seam
- Secrets / vault language on model-facing tool inputs
- Nested public imports (`@harryy/ai-tools/vendors/resend`)
- Hand-edited codegen surface
- New layout/naming schemes when a gold file exists
- Public kit dumpster of parse helpers on `_storage` / `_vector` barrels (schemas/types only on barrel)
- Host-name inheritance (`sendTelegramMessage`, host emoji enums, host-only RPC names)

### Never skip

- Reading AGENTS + gold file before writing
- Auth via constructor / `withAuth` / `ctx.auth` only
- `HttpService` / `AwsService` for product HTTP
- Thin seam providers wrapping vendor clients
- Codegen after adding `src/modules|vendors/<key>/index.ts`
- Model-facing contract quality (description + field `.describe()`)
- `ToolError` with stable codes
- Unit tests with mocked network (live not required for main gate)
- `bun run check` green before claiming done
- Explicit user request before any commit

---

## 5. Gold files to clone

| Kind | Path |
| --- | --- |
| Vendor pack | `src/vendors/resend/` (`client.ts`, `contracts.ts`, `module.ts`, `index.ts`) |
| Vendor domain parse | `src/vendors/s3/domain.ts` + client uses es-toolkit |
| Multi-provider seam | `src/modules/email/` |
| Thin seam provider | `src/modules/email/providers/resend.ts` |
| SigV4 via AwsService | `src/vendors/s3/client.ts`, `src/vendors/textract/client.ts`, `src/vendors/amazon-sp-api/client.ts` |
| Kit barrel | `src/vendors/_storage/index.ts` — schemas only |
| Chat webhook | `src/vendors/telegram/webhook.ts` |
| Pure pack | `src/modules/content-type/` |

**Vendor client shape:**

1. Parse auth with Zod → `ToolError` `bad_auth` on failure  
2. Construct one `HttpService` / `AwsService` with fixed baseURL (+ headers or SigV4)  
3. Methods: domain preflight → transport → domain parse  
4. `static fromContext(ctx)` via `requireAuth`  
5. Tools: `Client.fromContext(ctx).method(input)`  

---

## 6. What is solid (protect these)

- Kernel auth binding (`withAuth`; never secrets on tools)
- Contract validation + `validateModule` in almost every pack test
- Thin seam providers wrapping vendors (email, messaging, vector-store, extract, …)
- Adapters are pure projectors using `runTool`
- Transport status → `ToolError` mapping (retryable, Retry-After)
- `files` path isolation (`..` rejection, root prefix)
- Web-fetch allowlist + blocked credential headers
- No `as any` / `@ts-expect-error` sprawl in `src/`
- Integration harness (Docker + local Supabase) under `test/integration/`
- Messaging rejection helpers (`isMessagingDefiniteRejection` / outcome-unknown)

---

## 7. Gap tasks (backlog)

Each task is self-contained: problem, why it matters, evidence, fix direction, acceptance, related paths.

Priority: **P0** = standards integrity / agent falsehood; **P1** = product honesty / public surface; **P2** = consistency / docs; **P3** = backlog polish.

---

### G-01 — Migrate S3 client onto `AwsService` (P0)

**Status:** done (2026-07-26)  
**Severity:** standards violation on the largest SigV4 surface  

**Problem**  
`src/vendors/s3/client.ts` uses raw `AwsClient` from `aws4fetch` plus raw `#fetch` / `#signedFetch` for every operation. AGENTS **R6** forbids “raw `AwsClient` soup” and requires `AwsService`. Textract and Amazon SP-API already use `AwsService` correctly. S3 is the gold people will copy for storage/SigV4.

**Evidence**

- `src/vendors/s3/client.ts` — `import { AwsClient } from 'aws4fetch'`, `#aws: AwsClient`, `#signedFetch` → `this.#fetch(signed)`
- `src/vendors/textract/client.ts` — `new AwsService({ … service: 'textract' })`
- `src/vendors/amazon-sp-api/client.ts` — `AwsService` for execute-api
- `src/transport/aws-service.ts` — official SigV4 stack + `sign()` for presigns
- AGENTS R6; `docs/reference/http-and-aws-services.md`

**Fix direction**

1. Rewrite `S3Client` to own `AwsService` (or sign via `AwsService.sign` for presigned URLs and use signed fetch consistently).
2. Map list/get/put/delete/head/copy/multipart/signed URL through the same error path as other transport clients (`throwHttpStatus` / `mapTransportNetworkError` where applicable).
3. Preserve public API: auth schema, method names, tool ids, output shapes.
4. Keep injectable `fetch` / `signal` via constructor options / `fromContext`.
5. Do **not** change R2 (REST) or Supabase (REST) unless needed for parity tests.

**Acceptance**

- [x] No direct `AwsClient` import outside `src/transport/aws-service.ts`
- [x] S3 unit tests green (mocked AwsService-signed fetch); integration path unchanged
- [x] `bun run check` green
- [x] Public API / error messages for 404 get preserved (`Object not found`)

**Related paths**

- `src/vendors/s3/client.ts`, `domain.ts`, `contracts.ts`, `module.ts`
- `test/vendors/s3.test.ts`, `test/integration/vendors/s3.live.test.ts`
- `src/transport/aws-service.ts`

**Do not** invent a third SigV4 helper; clone textract’s use of `AwsService`.

---

### G-02 — Reconcile architecture / working docs with shipped email + messaging seams (P0)

**Status:** done (2026-07-26)  
**Severity:** agents and humans will delete or refuse shipped code if they only read locked architecture  

**Problem**  
Shipped product has multi-provider `email` and `messaging` seams (thin wrappers over full vendor packs). Locked architecture still says those seams do not exist / must not be invented. Working roadmap still marks email multi-provider as **Removed** and thin messaging as **Not planned**, while later rows say messaging seam is Done.

**Evidence**

- Code: `src/modules/email/`, `src/modules/messaging/`
- Correct docs: `docs/specs/provider-seam.md`, `docs/modules/messaging.md`, README tables
- Stale: `docs/specs/package-surface-architecture.md` (lines claiming no email/messaging multi-provider module; messaging layout section still “prefer modules under channels”)
- Stale: `docs/roadmap/package-surface-working.md` inventory table (`email` Removed; thin messaging Not planned) vs later “Locked: both packs + seam”

**Locked product truth to write into docs**

1. Full vendor packs for every channel/ESP (full transport/API surface grows over time).
2. Optional thin **seams** (`email`, `messaging`) with shared verbs for hosts that bind one provider at a time.
3. Seams **must not** shrink or replace full packs; native-only APIs stay on vendors.
4. Host owns durability, tenancy, allowlists.

**Acceptance**

- [x] `package-surface-architecture.md` updated: email + messaging seams allowed as thin multi-provider wrappers; remove contradictory “there is no …” language
- [x] Working inventory table matches code (email Done, messaging Done)
- [x] AGENTS / authoring guide unchanged in spirit (still: do not invent fat fake seams)
- [x] Docs-only for G-02 (S3 code is G-01)

**Related paths**

- `docs/specs/package-surface-architecture.md`
- `docs/roadmap/package-surface-working.md`
- Cross-check: `docs/specs/provider-seam.md`, `docs/README.md`, root `README.md`

---

### G-03 — Remove or replace published `mime` stub pack (P1)

**Status:** done (2026-07-26) — **removed** pack, docs, tests; real MIME is `email-message` / `content-type`.

---

### G-04 — Messaging media: ArtifactRef path (reduce base64-through-model) (P1)

**Status:** done (2026-07-26) — seam send accepts `source` ArtifactRef (optional auth `storage`); download accepts `destination_key` → `artifact` (no body_base64). Base64 kept for small/host paths.  
**Severity:** contradicts artifact doctrine for large bytes  

**Problem**  
Extract/convert/render use `ArtifactRef` so bytes stay out of the LLM. Chat packs and the messaging seam take `body_base64` for send/download media. Large files blow context and fail limits.

**Evidence**

- `src/shared/artifact.ts` — `store: 'object' | 'host'`
- `src/vendors/telegram/contracts.ts` — `body_base64` on send media / download
- Messaging seam mirrors base64 media (`src/modules/messaging/contracts.ts`)
- `docs/specs/artifacts-extract-convert.md` — “bytes never pass through the LLM”

**Fix direction**

1. Add optional ArtifactRef (or storage key + bound storage auth) input for send media on seam + major channel clients.
2. Keep base64 for small host-only client methods or documented tiny limits.
3. Prefer host: put object → tool takes key; download returns ArtifactRef or streams to storage rather than base64 in tool output when large.
4. Align limits with existing media max constants.

**Acceptance**

- [ ] Model-facing path exists that does not require multi-MiB base64 in tool args for send
- [ ] Download path can land in object store / ArtifactRef when large
- [ ] Back-compat for existing base64 (or explicit BREAKING with migration note)
- [ ] Tests for new path; docs updated on messaging + channel vendor pages

**Related paths**

- `src/modules/messaging/contracts.ts`, providers, client, module
- `src/vendors/telegram|slack|teams|imessage` contracts/client
- `src/shared/artifact.ts`
- `docs/modules/messaging.md`, vendor messaging docs

---

### G-05 — Messaging unsupported ops: stop silent success no-ops (P1)

**Status:** done (2026-07-26) — product policy:  
- **`unsend` removed from seam** (use `imessage` vendor).  
- Intentional successful no-ops kept: `read` (TG/Slack/Teams), Teams reactions (presentation), typing lifecycle (TG stop; Slack assistant status when thread_ts set).  
- Seam must not throw `unsupported` for lifecycle/presentation no-ops.

---

### G-06 — Align optional-spread rule with gold code (P1)

**Status:** done (2026-07-26) — AGENTS **R-optional-spread**: prefer `...(x && { y: x })`; use `...(x !== undefined && …)` when falsy-valid (`0`, `false`, `''`); ban ternary empty-object soup only.

---

### G-07 — Vendor surface honesty: email ESPs still send-only (P2)

**Status:** done (2026-07-26) — mapped vs not-mapped tables on resend/cloudflare-email docs; module copy send-only.  
**Severity:** product messaging oversells “full pack”  

**Problem**  
Resend and Cloudflare Email packs (and email seam) only implement send + batch. Module descriptions say “expand over time.” Architecture sells full first-party APIs. Hosts may assume domains, webhooks, audiences, templates, receiving, etc.

**Fix direction**

1. Docs: explicit “mapped API” vs “not mapped” tables (authoring guide already wants this for vendors).
2. Optional: next incremental slices (e.g. Resend emails get / list / cancel; domains) only when product asks — do not invent scope.
3. Keep seam thin (send verbs only is correct for a seam).

**Acceptance**

- [ ] Each email vendor doc lists mapped vs not mapped honestly
- [ ] Module description does not imply full Resend/CF API if only send exists
- [ ] No fake endpoints

**Related paths**

- `src/vendors/resend/**`, `src/vendors/cloudflare-email/**`
- `docs/vendors/resend.md`, `docs/vendors/cloudflare-email.md`
- `src/modules/email/**`, `docs/modules/email.md`

---

### G-08 — `defineProvider` dead API: adopt or demote (P2)

**Status:** done (2026-07-26) — **demoted**: gold = auth union + provider Ops classes + switch; defineProvider optional unused helpers.  
**Severity:** docs teach a registry pattern modules do not use  

**Problem**  
Kernel exports `defineProvider` / `resolveProvider`. No module registers providers with it. Real pattern: Zod discriminated union + `switch` / provider class + `requireAuth`.

**Options**

| Option | Action |
| --- | --- |
| A — Adopt | Refactor email (or messaging) to `defineProvider` array + `resolveProvider` as gold |
| B — Demote | Keep helpers exported but document real gold as switch + Ops class; remove “use defineProvider” as required authoring step |

**Acceptance**

- [ ] One clear gold story in authoring docs
- [ ] No half-documented dual patterns

**Related paths**

- `src/core/provider.ts`
- `docs/specs/provider-seam.md`
- `docs/guides/authoring-modules.md`
- Example seam: `src/modules/email/`

---

### G-09 — Storage seam tool surface vs partial provider capabilities (P2)

**Status:** cancelled (2026-07-26) — **storage multi-provider seam removed**; `r2` + `supabase-storage` vendors removed. Object store is `@harryy/ai-tools/s3` only; `files` nests S3 auth.

---

### G-10 — iMessage inbound webhook surface missing (P2)

**Status:** done (2026-07-26) — **documented out of pack**: Photon inbound webhooks = host; pack is outbound REST only.  
**Severity:** channel checklist incomplete for iMessage  

**Problem**  
Telegram, Slack, Teams export `webhook.ts` (verify + parse → normalized inbound). iMessage pack has no webhook helpers in public index. Channel checklist requires verify + normalize inbound for every channel.

**Evidence**

- `src/vendors/telegram|slack|teams/webhook.ts` + re-exports in `index.ts`
- `src/vendors/imessage/index.ts` — no webhook exports
- Working doc channel checklist (verify + parse)

**Fix direction**

1. Add `webhook.ts` for photon/Spectrum inbound shape the host actually receives (or document that inbound is host-only HTTP and pack owns only REST outbound).
2. Normalize to shared inbound event shape used by other channels where possible.
3. Export from index; document host route responsibilities.

**Acceptance**

- [ ] Either webhook helpers exist with tests, or docs explicitly state inbound is out of pack scope with rationale
- [ ] Channel checklist row for iMessage honest

**Related paths**

- `src/vendors/imessage/**`
- `docs/vendors/imessage.md`
- Compare: `src/vendors/telegram/webhook.ts`

---

### G-11 — Schema / contract consistency cleanup (P2)

**Status:** done (2026-07-26)  
**Subtasks:** G-11a artifact `object` in spec; G-11b parse attachment `mime_type`; G-11c `unsupported` in errors guide; G-11d runTool validates output (docs); G-11e CHANGELOG Unreleased/historical note (empty 1.x sections left to semantic-release).

**Related paths**

- `src/shared/artifact.ts`
- `docs/specs/artifacts-extract-convert.md`
- `src/modules/email-message/module.ts`
- `docs/guides/errors.md`
- `src/core/define.ts`, `src/core/with-auth.ts`
- `CHANGELOG.md`

---

### G-12 — Self-host extract / platform backlog (P3)

**Status:** open  
**Severity:** architecture preference not reflected; not a bug  

**Problem**  
Architecture prefers self-hosted extract (tesseract/docling/…) and lists speech / pdf / image / browser / queue / webhook / crypto / calendar as planned. Shipped extract is Textract-only. Other platform modules not started.

**Fix direction**

- Do not invent providers without product request.
- When product asks: add provider under `document-extract/providers/` + vendor pack if needed; keep ArtifactRef.
- Keep working roadmap rows accurate (G-02).

**Acceptance**

- [ ] Backlog remains explicit in roadmap; no fake stubs published (contrast G-03)

**Related paths**

- `docs/specs/package-surface-architecture.md` planned modules
- `docs/roadmap/package-surface-working.md`
- `src/modules/document-extract/`

---

### G-13 — Process: single source of truth for architecture locks (P2)

**Status:** done (2026-07-26) — authority order on docs/README + working roadmap; handoff linked from wiki hub.  
**Severity:** overlapping docs with drift  

**Problem**  
Multiple “authority” docs: AGENTS, package-surface-architecture, provider-seam, working roadmap, handoffs. After email/messaging and vector/rag land, inventory and locks diverged.

**Fix direction**

1. Architecture spec = locks only (update when product decision changes).
2. Working doc = inventory/status only (update every slice).
3. AGENTS = agent hard rules only (no living inventory).
4. Point handoffs at this file or merge into working doc after tasks complete.

**Acceptance**

- [ ] Cross-links state authority order (as at top of this file)
- [ ] No contradictory “email removed” after G-02
- [ ] This handoff file linked from `docs/README.md` or working doc “open questions / reviews” section

**Related paths**

- `docs/README.md`
- `docs/roadmap/package-surface-working.md`
- This file

---

## 8. Host-integration epic (later)

Full lock: [`docs/specs/host-integration-kernel.md`](../specs/host-integration-kernel.md).  
**Package = tool packs + host-integration kernel. Host = agent brain / policy / tenancy.** Never rebrand this package as the brain.

### Framed decisions (do not invent product)

| Decision | Status |
| --- | --- |
| Not an agent runtime; no PHI/RLS/confirmation/durable product orchestration here | **Locked** |
| Composio/Nango SaaS connector catalogs stay host | **Locked** |
| On-demand discovery over **host-registered ai-tools packs** (search/read, optional execute-by-id) | **Yes — tabled** until after bind/context/hooks |
| Composio-style cross-app “meta tools” | **Out of scope** forever |

### Kernel backlog (implement when product asks; after hygiene G-03…)

| ID | Item | Notes |
| --- | --- | --- |
| H-01 | Dynamic bind | **Done** — `bindModule` / `bindTool` |
| H-02 | Adapter context factory | **Done** — `context` + `createContext` on adapters |
| H-03 | Generic hooks | **Done** — `withHooks` / hooks on bind |
| H-04 | Richer `ToolMeta` | **Done** — additive host hints + catalog |
| H-05 | Registry + catalog discovery | **Tabled.** Search/read over registered tools; prefer names `catalog-search-tools` / `catalog-read-tool` (not “meta tools”) |
| H-06 | Public artifacts surface | **Done**: `@harryy/ai-tools/artifacts` with object/host providers and bounded range/line/create tools |
| H-07 | Task contracts | **Done**: host-backed task-definition Zod contracts and CRUD tools; no host persistence code |
| H-08 | Scheduler + EventBridge provider | **Done**: scheduler seam over the EventBridge vendor; single provider by explicit product decision |
| H-09 | Bedrock AgentCore packs | **Done** — `bedrock-agentcore-code-interpreter` + `bedrock-agentcore-browser` vendors |
| H-10 | Skills defs (portable) | **Done** — `modules/skills` schemas + list/get/search over host-bound catalog |
| H-11 | Host adoption | Loader: registry → bind → hooks → adapter; map legacy host tool ids → kebab ids |

### Prefer order when un-tabling host work

1. H-01 → H-02 → H-03 → H-04  
2. Host import of **existing** packs (H-11) in parallel once bind works  
3. H-05 catalog discovery  
4. H-06 through H-10 are done  

Other agent hygiene (G-03 mime, G-05 messaging no-ops, …) stays orthogonal.

---

## 9. Suggested execution order

| Order | Task | Why first |
| --- | --- | --- |
| 1 | **G-02** docs reconcile | Done |
| 2 | **G-01** S3 → AwsService | Done |
| 3 | **G-03** mime stub | **Done** — pack removed |
| 4 | **G-06** optional-spread policy | **Done** — AGENTS R-optional-spread |
| 5 | **G-05** messaging no-op honesty | **Done** — unsend off seam; intentional no-ops documented |
| 6 | **G-09** storage capability surface | **Cancelled** — storage seam removed |
| 7 | **G-04** messaging ArtifactRef media | **Done** — source / destination_key on seam |
| 8 | **G-11** consistency cleanup | **Done** |
| 9 | **G-08** defineProvider | **Done** — demoted |
| 10 | **G-07** email API honesty docs | **Done** |
| 11 | **G-10** iMessage webhook | **Done** — host inbound |
| 12 | **G-13** doc authority | **Done** |
| 13 | **G-12** platform backlog | Product-driven only |
| later | **§8 Host-integration** H-01… | After hygiene or when host-bind work is priority |

---

## 10. Verification rules for any fix

1. Read `AGENTS.md` + relevant gold file first.
2. Small vertical slice: contracts → client/tools → tests → `bun run check`.
3. Format only session-touched paths: `oxfmt --write <paths>`.
4. Public surface change → `bun run codegen` (never hand-edit exports).
5. Do **not** commit unless the user explicitly says to commit in the current message.
6. Prefer `HttpService` / `AwsService`; no new deps without approval.
7. Model-facing copy: no secrets/env/vault/`withAuth` language (`forbidden_model_copy`).
8. Host is inventory only for behavior naming.

```bash
oxfmt --write <session-touched-paths>
bun run check
# if exports/build changed:
bun run build && bun run typecheck
```

---

## Appendix A — Tool counts (approx at capture)

| Pack | `defineTool` count (order of magnitude) |
| --- | --- |
| katana | 27 |
| woocommerce | 26 |
| files | 13 |
| messaging | 12 |
| s3 | 11 |
| telegram | 10 |
| teams / slack / imessage | 9 each |
| amazon-sp-api | 9 |

| resend / cloudflare-email / email | 2 each |

## Appendix B — Known doc vs code conflicts (quick list)

| Doc claim | Code reality |
| --- | --- |
| No multi-provider email module | `src/modules/email` exists |
| No multi-provider messaging seam | `src/modules/messaging` exists |
| Email multi-provider Removed (working) | Reconciled: Done thin seam (G-02) |
| Artifact `store: 's3'` | Spec fixed to `store: 'object'` |
| mime = parse/build (old CHANGELOG) | mime pack removed; email-message = parse/build |
| All SigV4 via AwsService | S3 uses `AwsService` (G-01 done) |
| defineProvider for seams | Demoted; gold = switch + Ops classes |
| R-optional-spread | Prefer `...(x && {…})`; `!== undefined` when falsy-valid |

## Appendix C — Related existing handoffs

- `docs/handoffs/codex-knowledge-and-next.md` — knowledge/memory slice notes + gold reminders
- `docs/roadmap/package-surface-working.md` — living delivery board (update via G-02 / G-13)
- `docs/specs/package-surface-architecture.md` — architecture locks (update via G-02)
- `docs/specs/provider-seam.md` — multi-provider seam pattern (closer to truth)

---

*End of capture. Tasks G-01 … G-13 are backlog items only until the user assigns implementation.*
