# Spec: Provider seam for capability modules

Status: **locked**  
Package: `@harryy/ai-tools`  
Scope: **modules only** (`src/modules/*`). Vendors: [package-surface-architecture.md](./package-surface-architecture.md).

## Goals

- Tools are **capability-generic** (email, artifacts, tasks, scheduler).
- Hosts pick a **provider** at bind time via auth `{ provider, … }`.
- Provider implementations are isolated behind a **type class** (`*Ops`) per module.
- Auth never appears on model-facing tool schemas.
- Batch tools, list pagination, and rate-limit errors are first-class.

## Kernel

| API | Role |
| --- | --- |
| `requireAuth` | Parse `ctx.auth` with module union schema |
| `withAuth` | Host bind (unchanged entry point) |
| `defineProvider` / `resolveProvider` | **Optional helpers only** — exported from core but **not** the gold pattern. No shipped module registers providers with them. Prefer the layout below. |

### Gold seam pattern (use this)

1. Auth: Zod **discriminated union** on `provider` in `contracts.ts`.
2. Ops: a shared `*Ops` type class; one **class per provider** under `providers/*.ts` wrapping the vendor client.
3. Client: `switch (auth.provider)` (or equivalent) → provider instance; tools call `*Client.fromContext(ctx)`.

Gold example: `src/modules/email/` (`providers/resend.ts`, `providers/cloudflare.ts`).

An explicit product decision may lock a host-backed or single-provider seam before a second provider exists. The provider discriminator and ops boundary remain required so the model-facing contract does not become vendor-shaped.

## Module layout

```text
src/modules/<capability>/
  contracts.ts      # Zod I/O + Ops type class + auth union
  client.ts         # switch provider → Ops
  module.ts         # generic tools + auth union
  providers/*.ts    # thin wrap of vendors/* clients
  index.ts
```

## Auth

- Discriminated union on `provider`.
- Host-only: `withAuth(module, { provider: 'resend', api_key: '…' })` (snake_case auth fields).
- Nested host credentials allowed (e.g. file-convert `storage: { access_key_id, secret_access_key, region, bucket, … }` — nested storage is S3 auth, not a second provider union).
- Pure modules (`email-message`, `content-type`) use `auth: { type: 'none' }`.

## ArtifactRef

```ts
{ store: 'object' | 'host', key: string, media_type?, filename?, byte_length? }
```

`object` means the bound object store described by host auth.

## Current providers

| Module | Providers |
| --- | --- |
| `email` | `cloudflare`, `resend` |
| `artifacts` | `object`, `host` |
| `document-extract` | `textract` |
| `document-render` | `gotenberg`, `cloudflare-browser` |
| `file-convert` | `gotenberg` LibreOffice `office-to-pdf` (+ nested S3 `storage`) |
| `files` | nested S3 `storage` + `root_prefix` (not a multi-provider seam) |
| `tasks` | `host` task-definition backend |
| `scheduler` | `eventbridge` |
| `queue` | `sqs` |
| `browser` | `bedrock-agentcore`, `cloudflare` |
| `code-sandbox` | `cloudflare`, `bedrock-agentcore` |
| `vector-store` | `qdrant`, `pinecone`, `supabase`, `mastra` (wrap vendor packs) |
| `rag` | nested `vector_store` + OpenAI-compatible `embed` auth |

Adding a provider: new file under `providers/`, register in module array, extend auth union, docs row. Model tool catalog stays stable.
