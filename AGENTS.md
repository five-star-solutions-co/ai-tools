# @5ss/ai-tools

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
   - Multi-provider seam: `src/modules/email/providers/resend.ts`
   - SigV4 product client: `src/vendors/textract/client.ts` or `src/vendors/s3/client.ts` (`AwsService` only — no raw `AwsClient`)

Do not invent a new layout, naming scheme, or HTTP stack.

### R1 — Consistency over invention

- **Same problem → same shape.** Copy the gold file. Do not invent a second pattern.
- Host apps are **capability inventory only**. Never copy their layouts, names, or fetch wrappers.
- No `json`/`form`/`methodJson` dual helpers or dynamic `/${method}` routers on ofetch.
- No parallel HTTP stacks (`TelegramHttp`, raw `fetch` loops, custom retry frameworks) unless the user explicitly orders that design.

### R-optional-spread — preferred optional object fields

**Preferred** (truthy optional bags — house style on `fromContext` / transport options):

```ts
...(ctx.fetch && { fetch: ctx.fetch }),
...(ctx.signal && { signal: ctx.signal }),
...(input.caption && { caption: input.caption }),
```

**When the value can be falsy but valid** (e.g. `0`, `false`, `''`):

```ts
...(limit !== undefined && { limit }),
...(enabled !== undefined && { enabled }),
```

**Forbidden** (ternary empty-object soup for exactOptionalPropertyTypes):

```ts
// BANNED
...(options.fetch === undefined ? {} : { fetch: options.fetch }),
...(x === undefined ? {} : { key: x }),
```

**Also fine:** pass optionals straight into constructors when types allow `| undefined`, or assign with `if`:

```ts
new HttpService({ baseURL, headers, label, fetch: options.fetch, signal: options.signal })

const out: Result = { success: true }
if (id !== undefined) out.id = id
```

If TypeScript complains about `undefined` on an optional prop, fix the **type** (`prop?: T | undefined`) or use the preferred spreads / `if` assign — do **not** invent ternary empty-object soup.

### R2 — Two source roots (modules vs vendors)

| Root | Holds | Rule |
| --- | --- | --- |
| **`src/modules/*`** | **Our seams** | We own the contract; backends swappable when real (`email`, `messaging`, `files`, `document-render`, pure helpers like `content-type`) |
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
import { emailModule } from '@5ss/ai-tools/email'                 // seam (module)
import { ResendClient, resendModule } from '@5ss/ai-tools/resend' // vendor
import { telegramModule } from '@5ss/ai-tools/telegram'           // vendor (chat)
import { S3Client, s3Module } from '@5ss/ai-tools/s3'             // vendor (object store)
```

- Codegen owns `package.json` `exports`, `generated/*` (including `module-manifest.json`), `src/generated/module-keys.ts`.
- `tsdown.config.ts` is hand-maintained for build options; its **entry map is loaded from** `generated/module-manifest.json` at build time — do not paste pack paths into it.
- Never hand-edit codegen-owned files; run `bun run codegen` after adding a pack under `src/modules|vendors/<key>/` with `index.ts`.
- Do **not** nest public imports (`@5ss/ai-tools/vendors/resend`).

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
| **Tiny pure packs** | Tools only (class optional) | e.g. `content-type`, `email-message` |

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
- Tool ids: stable kebab-case. Seams: capability-prefixed (`messaging-send-text`). Vendors: vendor-prefixed (`resend-send`, `telegram-send-text`).
- Prefer **snake_case** on host auth and domain fields that mirror APIs (`api_key`, `account_id`) unless an existing pack already shipped camelCase for that surface.
- Host is inventory only for product behavior; package owns clean names.

### R7b — Model-facing copy (agent / tool descriptions) — gold bar

Applies to **tool `description`**, module `description` when projected, and every tool input `.describe()`.

| Rule | Detail |
| --- | --- |
| **What/when/bounds only** | What the tool does, when to use it, limits. No install steps, env, vault, host wiring, `withAuth`. |
| **No secrets language** | No API keys, bearer tokens, `process.env` (enforced by `validateTool` / `forbidden_model_copy`). |
| **Seams: no vendor brand names** | Capability modules (`messaging`, `email`, `files`, `vector-store`, …) must **not** name products (Telegram, Slack, Teams, iMessage, Resend, S3, Pinecone, …). Use **channel**, **bound store**, **bound provider**, **conversation**. Provider gaps live in host docs / pack docs — **not** agent tool text. |
| **Vendors: product name OK** | Vendor packs may say “Resend” / “Telegram” — the tool id is already vendor-prefixed. Still no secrets/env/vault. |
| **No provider comparison lists** | Do not write “works on A; no-op on B/C” in seam tool descriptions. Prefer capability language; no-ops stay silent or generic (“when supported”). |
| **Auth field describes** | Host-facing schemas may mention provider-specific credential shapes; still prefer clean names. |

Enforced for seam module ids in `src/core/contracts.ts` (`SEAM_MODULE_IDS` + brand regex).

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

- **Agent brain / agent runtime** — this package is tool packs + host-integration kernel only (see `docs/specs/host-integration-kernel.md`)  
- Multi-tenant policy, PHI routing, vaults, WORM/audit products  
- Agent allowlists, confirmation UX (host)  
- Composio/Nango SaaS OAuth catalogs and connector-style “meta tools”  
- Live network as default CI  
- Starting long-lived servers for verification  

## Slice discipline

- Small vertical slices: contract → client/tools → tests → `bun run check` green → **user review** → commit only if asked.
- Prefer `HttpService` / `AwsService` class clients; set auth as headers (or SigV4).
- Stop and ask for new dependencies, public API breaks, free-form HTTP, or unlocked product defaults.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:970c3bf2 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

## Agent Context Profiles

The managed Beads block is task-tracking guidance, not permission to override repository, user, or orchestrator instructions.

- **Conservative (default)**: Use `bd` for task tracking. Do not run git commits, git pushes, or Dolt remote sync unless explicitly asked. At handoff, report changed files, validation, and suggested next commands.
- **Minimal**: Keep tool instruction files as pointers to `bd prime`; use the same conservative git policy unless active instructions say otherwise.
- **Team-maintainer**: Only when the repository explicitly opts in, agents may close beads, run quality gates, commit, and push as part of session close. A current "do not commit" or "do not push" instruction still wins.

## Session Completion

This protocol applies when ending a Beads implementation workflow. It is subordinate to explicit user, repository, and orchestrator instructions.

1. **File issues for remaining work** - Create beads for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **Handle git/sync by active profile**:
   ```bash
   # Conservative/minimal/default: report status and proposed commands; wait for approval.
   git status

   # Team-maintainer opt-in only, unless current instructions forbid it:
   git pull --rebase
   bd dolt push
   git push
   git status
   ```
5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step

**Critical rules:**
- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.
<!-- END BEADS INTEGRATION -->

<!-- BEGIN BEADS CODEX SETUP: generated by bd setup codex -->
## Beads Issue Tracker

Use Beads (`bd`) for durable task tracking in repositories that include it. Use the `beads` skill at `.agents/skills/beads/SKILL.md` (project install) or `~/.agents/skills/beads/SKILL.md` (global install) for Beads workflow guidance, then use the `bd` CLI for issue operations.

### Quick Reference

```bash
bd ready                # Find available work
bd show <id>            # View issue details
bd update <id> --claim  # Claim work
bd close <id>           # Complete work
bd prime                # Refresh Beads context
```

### Rules

- Use `bd` for all task tracking; do not create markdown TODO lists.
- Run `bd prime` when Beads context is missing or stale. Codex 0.129.0+ can load Beads context automatically through native hooks; use `/hooks` to inspect or toggle them.
- Keep persistent project memory in Beads via `bd remember`; do not create ad hoc memory files.

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.
<!-- END BEADS CODEX SETUP -->
