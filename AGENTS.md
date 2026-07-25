# @harryy/ai-tools

Reusable AI tools: one package, subpath exports, kernel-first tools, host-bound auth, optional framework adapters.

Repository rules constrain agent behavior. They do not teach package usage (see README / `docs/`).

## Authority

- The user owns product decisions: which packs exist, public API shape, dependency and script changes.
- Do not invent tools, adapters, export surfaces, or defaults without an explicit request.
- Global agent policy still applies. This file only adds package-specific constraints.

## HARD RULES — never skip (agent must obey)

These override convenience, host inventory code, and “I’ll clean it up later.” Violation = stop and fix before any other work.

### R-commit — Never commit unless the user explicitly asks

- **Do not** run `git commit`, `git add`+commit, amend, or create commits unless the **current user message** explicitly says to commit (`commit`, `git commit`, `commit this`).
- **Do not** commit after a green check, “done,” “looks good,” or a multi-step plan that only mentioned commit earlier.
- Leave work **uncommitted for review** until the user asks to commit.
- One explicit “commit” = **one** commit of the requested work — not follow-up commits unless asked again.
- Default: **no git** (including status/diff/log) unless the user asked for a git action or an explicit commit.

### R0 — Read order before any code change

1. This file (`AGENTS.md`)
2. `docs/reference/http-and-aws-services.md` (if the task touches network I/O) — `src/transport/`
3. `docs/specs/package-surface-architecture.md` (modules vs vendors) and/or `docs/specs/provider-seam.md` (multi-provider seams only)
4. **Clone a gold file:**
   - Vendor pack: `src/vendors/resend/` (`client.ts`, `module.ts`, `contracts.ts`)
   - Multi-provider seam: `src/modules/storage/providers/supabase.ts`
   - SigV4 product client: `src/vendors/textract/client.ts` or `src/vendors/s3/client.ts` (`AwsService` only — no raw `AwsClient`)

Do not invent a new layout, naming scheme, or HTTP stack.

### R1 — Consistency over invention

- **Same problem → same shape.** Copy the gold file. Do not invent a second pattern.
- Host repos (e.g. Five Star) are **capability inventory only**. Never copy their layouts, names, or fetch wrappers.
- No `json`/`form`/`methodJson` dual helpers or dynamic `/${method}` routers on ofetch.
- No parallel HTTP stacks (`TelegramHttp`, raw `fetch` loops, custom retry frameworks) unless the user explicitly orders that design.

### R-no-spread-undefined — NEVER write this pattern

**Forbidden** (exactOptionalPropertyTypes workarounds by spread):

```ts
// BANNED — never write this again
...(options.fetch === undefined ? {} : { fetch: options.fetch }),
...(x === undefined ? {} : { key: x }),
```

**Required instead:**

```ts
// Pass optionals normally (types allow `| undefined` where needed)
new HttpService({ baseURL, headers, label, fetch: options.fetch, signal: options.signal })

// Or assign after base object
const out: Result = { success: true }
if (id !== undefined) out.id = id
```

If TypeScript complains about `undefined` on an optional prop, fix the **type** (`prop?: T | undefined`) or assign with `if`, do **not** invent spread soup.

### R2 — Two source roots (modules vs vendors)

| Root | Holds | Rule |
| --- | --- | --- |
| **`src/modules/*`** | **Our seams** | We own the contract; backends swappable when real (`storage`, `files`, `document-render`, pure helpers like `mime`) |
| **`src/vendors/*`** | **3rd-party products** | Full API of one vendor; grow over time (`resend`, `cloudflare-email`, `telegram`, `slack`, `woocommerce`, …) |

- **Seams → modules.** Multi-provider only when 2+ backends share the same verbs (`defineProvider` + auth `{ provider, … }`).
- **3rd party → vendors.** Including email ESPs **and** chat platforms (Telegram, Slack, …). Not a thin multi-provider “messaging” or “email” seam that shrinks the real API.
- Do **not** put fat single-vendor APIs under `modules/` as fake multi-provider seams.
- Vendor **vertical kits** (not packs): `src/vendors/_email/`, `_storage/`, `_messaging/`, … Underscore prefix = skipped by codegen. Shared by packs in that category only.
- Cross-channel chat helpers: `src/vendors/_messaging` (codegen-skipped kit; not a pack).

### R3 — Exports: flat; tree keeps module vs vendor

| Layer | module vs vendor? |
| --- | --- |
| Source / codegen / docs | **Yes** — `modules/` vs `vendors/` |
| Public import path | **No different style** — flat kebab name only |

```ts
import { storageModule } from '@harryy/ai-tools/storage'           // seam (module)
import { ResendClient, resendModule } from '@harryy/ai-tools/resend' // vendor
import { telegramModule } from '@harryy/ai-tools/telegram'         // vendor (chat)
```

- Codegen owns `package.json` `exports`, `tsdown.config.ts`, `generated/*`, `src/generated/module-keys.ts`.
- Never hand-edit those; run `bun run codegen` after adding a pack under `src/modules|vendors/<key>/` with `index.ts`.
- Do **not** nest public imports (`@harryy/ai-tools/vendors/resend`).

### R4 — Client + tools + adapters (not “everything is a class”)

One kernel tool list; three consumption paths:

```text
defineTool / defineModule  (kernel — only real tool definitions)
        │
        ├─► Host:   Class client  (new ResendClient(auth).send(...))
        ├─► Agent:  withAuth(module) → tools
        └─► AI:     createMastraTools / createAiSdkTools / MCP / … (project tools only)
```

| Piece | Shape | When |
| --- | --- | --- |
| **Client** | **Class**, constructor auth, `fromContext(ctx)` | Multi-method packs (vendors, rich seams) |
| **Tools** | `defineTool` on `defineModule`; execute → `Client.fromContext(ctx).method(...)` | Agent / model surface |
| **Adapters** | Generic projectors only | Never re-implement HTTP or per-pack factories |
| **Pure helpers** | Functions | `createLiveMessage`, webhook verify/parse, pure mime helpers |
| **Tiny pure packs** | Tools only (class optional) | e.g. `mime`, `content-type` |

**Forbidden:** tools calling ofetch/paths; adapters owning business logic; second tool systems; making tools the only public API when a host client is needed.

### R5 — File layout (same for modules and vendors)

```text
src/modules|vendors/<key>/
  contracts.ts    # Zod I/O + auth schema + domain types
  domain.ts       # optional shared preflight (no HTTP)
  client.ts       # public class client (owns HttpService / AwsService)
  providers/      # modules only: multi-provider ops (real seams)
  webhook.ts      # chat vendors only: verify + parse
  module.ts       # defineModule + defineTool adapters over client
  index.ts        # public re-exports (client, module, types)
```

### R6 — Transport classes (HTTP + AWS)

**New code uses classes** (see `src/transport/http-service.ts`, `src/transport/aws-service.ts`):

```ts
// Non-SigV4
const http = new HttpService({ baseURL: '…', headers: { … }, label: 'Resend', fetch, signal })
await http.post('/emails', body)
await http.query('GET', '/path', { query: { cursor } })
await http.bytes('GET', '/file')

// SigV4
const aws = new AwsService({
  accessKeyId, secretAccessKey, region, service: 's3', label: 'S3', fetch, signal,
})
await aws.put(absoluteUrl, body, { headers: { 'content-type': '…' } })
await aws.get(absoluteUrl)
await aws.sign(url, { signQuery: true })
```

| API | Role |
| --- | --- |
| `query` | Parsed body; **throws ToolError on non-2xx by default** |
| `bytes` | Binary body |
| `get` / `post` / `put` / `patch` / `delete` / `head` | Sugar |
| `noThrow` / `allowStatuses` | Opt out of default throw |
| `AwsService.sign` | Presigned URLs |

Product clients **own** the transport instance (constructor), not free sibling `createXService` functions.

| Forbidden | Use instead |
| --- | --- |
| Raw `fetch` loops for JSON/HTTP | `HttpService` |
| Raw `AwsClient` soup in providers | `AwsService` |
| Dual body helpers / dynamic method routers | Named product methods → `http.post` / `aws.put` |
| Paths in tools/module execute | Only inside product client/provider |
| Free transport helper wrappers | `HttpService` / `AwsService` directly |

### R7 — Auth and naming

- Auth only via client constructor / `withAuth` / `ctx.auth` / `requireAuth`. **Never** on tool inputs.
- Tool ids: stable kebab-case. Seams: capability-prefixed (`storage-get-object`). Vendors: vendor-prefixed (`resend-send`, `telegram-send-text`).
- Model-facing copy: what/when/bounds only — no secrets, env, vault, host wiring.
- Prefer **snake_case** on host auth and domain fields that mirror APIs (`api_key`, `account_id`) unless an existing pack already shipped camelCase for that surface.
- Host is inventory only for product behavior; package owns clean names.

### R8 — Before writing new code

1. Name the gold file you are cloning.
2. State: module (seam) or vendor (3rd party); list client methods + ofetch endpoints (or SigV4).
3. If you cannot point at an existing same-shape file, **stop and ask**.

### R9 — Gate

- Format only session-touched paths: `oxfmt --write <paths>`
- Done = `bun run check` green. No `--no-verify`. No “tests later.”
- **Green check ≠ commit.** See **R-commit**.

## Architecture locks (summary)

- Single package; **flat** public imports; codegen-owned exports.
- **modules/** = our seams; **vendors/** = 3rd-party full packs (including chat platforms and email ESPs).
- Kernel (`defineTool` / `defineModule`) is the only tool authoring surface; adapters only project.
- Class clients for multi-call host DX; tools for agents; both wrap the same implementation.
- `HttpService` / `AwsService` for all product HTTP (`src/transport/`). See `docs/reference/http-and-aws-services.md`.
- Layout: `transport/` / `shared/` / `core/` / `adapters/` locked; `modules/` = seams; `vendors/` = packs + `_vertical` kits.
- Batch: `runBatchItems` in `shared/batch` (`p-map` + optional `p-retry`). Not inside transport.
- Composio/Nango stay host SaaS OAuth + PHI catalog; this package does not replace them.
- Prefer `es-toolkit` / `es-toolkit/compat` over hand-rolled typeof/array helpers.
- Type safety: no assertions except unchained `as const`; untrusted boundaries use `unknown` + narrowing.
- Named exports; lowercase kebab-case filenames; `dist/` never hand-edited.

## Quality bars

### Model-facing contract

- `description` and input `.describe()` are for model selection and argument filling only.
- Never put API keys, env names, vault language, install steps, or host wiring in model-facing copy.
- Auth field descriptions are host-facing (schema validation), not agent tool args.

### Type safety (`src/`)

- No `as T` / `as any` / non-null `!` / `@ts-ignore` / `@ts-expect-error` except unchained `as const`.
- Untrusted boundaries: `unknown` + runtime checks (Zod, guards).

### Implementation

- Tree-shake friendly; no side-effect registration at import time.
- Fail with stable `ToolError` codes; never leak secrets in errors.
- Default tests mock network; no live provider required for the main gate.

### Public surface

- Brain (`core`, `http`, adapters): `src/<name>/` + codegen brain config.
- Product packs: add `src/modules|vendors/<key>/index.ts` then `bun run codegen`.
- Docs under `docs/`; versions via semantic-release / conventional commits. Do not hand-bump version for releases.

## Dependencies and tooling

- Package manager **Bun**; versions **exact**.
- Do not add/remove/upgrade/downgrade dependencies, lockfile, or package scripts without explicit approval for that change.
- Formatter **oxfmt**; linter **oxlint** type-aware; codegen parser **oxc-parser**; build **tsdown**; hooks **lefthook**.
- Do not introduce Prettier, ESLint, or Husky.

## Verification

```bash
# while editing
oxfmt --write <session-touched-paths>

# claim done
bun run check
```

`bun run check` = format:check + type-aware lint + codegen:check + tests.

If public surface / build emit changed: also `bun run build` and `bun run typecheck`.

**Do not claim done if `check` failed.** Fix session-caused failures; do not weaken configs; do not `--no-verify`.

## Out of scope for this package

- Multi-tenant policy, PHI routing, vaults, WORM/audit products  
- Agent runtimes, allowlists, confirmation UX (host)  
- Live network as default CI  
- Starting long-lived servers for verification  

## Slice discipline

- Small vertical slices: contract → client/tools → tests → `bun run check` green → **user review** → commit only if asked.
- Prefer `HttpService` / `AwsService` class clients; set auth as headers (or SigV4).
- Stop and ask for new dependencies, public API breaks, free-form HTTP, or unlocked product defaults.
