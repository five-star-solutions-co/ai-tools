# @5ss/ai-tools

Reusable **AI tools** with strict Zod schemas and model-facing contracts. Define once in the kernel; project to **Mastra**, **Vercel AI SDK**, **TanStack AI**, **Cloudflare Workers AI**, **MCP**, or call via class clients / `runTool`.

[![ci](https://github.com/five-star-solutions-co/ai-tools/actions/workflows/ci.yml/badge.svg)](https://github.com/five-star-solutions-co/ai-tools/actions/workflows/ci.yml)
[![release](https://github.com/five-star-solutions-co/ai-tools/actions/workflows/release.yml/badge.svg)](https://github.com/five-star-solutions-co/ai-tools/actions/workflows/release.yml)

**Docs:** [docs/README.md](./docs/README.md) · **Changelog:** [CHANGELOG.md](./CHANGELOG.md) · **Release:** [docs/versioning.md](./docs/versioning.md)

## Why

- **One authoring path** — `defineTool` / `defineModule` only; adapters never re-implement business logic.
- **Host-owned secrets** — auth schemas + `withAuth`; model inputs never carry API keys.
- **Two product roots** — `modules/` (our seams) vs `vendors/` (3rd-party packs); flat public imports.
- **Class clients + tools** — host uses `new ResendClient(auth)`; agents use the same implementation via tools.
- **Subpath imports** — tree-shake friendly; no root mega-barrel.
- **Honest runtimes** — `node` | `edge` | `both`.
- **Stable tool ids** — kebab-case, vendor- or capability-prefixed.

## Install

```bash
bun add @5ss/ai-tools

# optional peers for adapters you use:
bun add @mastra/core
bun add ai
bun add @tanstack/ai
bun add @modelcontextprotocol/sdk   # registerMcpTools only
```

Requires **Bun ≥ 1.3.14** or **Node ≥ 24**.

## Quick start

```ts
import { withAuth } from '@5ss/ai-tools/core'
import { resendModule, ResendClient } from '@5ss/ai-tools/resend'
import { createMastraTools } from '@5ss/ai-tools/mastra'

// Host DX (class client)
const resend = new ResendClient({ api_key: process.env.RESEND_API_KEY! })
await resend.send({ to: 'a@example.com', from: 'b@example.com', subject: 'Hi', text: 'Hello' })

// Agent tools (same implementation)
const bound = withAuth(resendModule, { api_key: process.env.RESEND_API_KEY! })
export const tools = createMastraTools(bound)
```

Multi-provider **seam** (host picks provider on auth):

```ts
import { withAuth } from '@5ss/ai-tools/core'
import { emailModule } from '@5ss/ai-tools/email'

const bound = withAuth(emailModule, {
  provider: 'resend',
  api_key: process.env.RESEND_API_KEY!,
  sender: { email: 'verified@example.com', name: 'Product' },
})
```

No-auth pure helpers:

```ts
import { emailMessageModule } from '@5ss/ai-tools/email-message'
import { createAiSdkTools } from '@5ss/ai-tools/ai-sdk'

export const tools = createAiSdkTools(emailMessageModule)
```

## Architecture

```text
src/
  core/          kernel (defineTool, withAuth, runTool, …)
  transport/     HttpService / AwsService  →  @5ss/ai-tools/http
  adapters/      mastra · ai-sdk · tanstack · cloudflare · mcp
  modules/       our seams (email, messaging, files, …)
  vendors/       3rd-party packs (resend, telegram, s3, …)
                 + vertical kits: _email · _storage · _messaging · _vector (not published)
  shared/        bytes, batch, artifact, content-type, pagination
```

| Root | Role |
| --- | --- |
| **`modules/`** | Capability seams we own; usually multi-provider, with explicit product-locked host or single-provider seams |
| **`vendors/`** | Full first-party API of one product; grow tools over time |
| **`vendors/_…`** | Vertical kits (codegen-skipped); shared by packs in that category |

Public imports are **flat**: `@5ss/ai-tools/resend`, not `@5ss/ai-tools/vendors/resend`.

```text
defineTool / defineModule
        │
        ├─► Host:   Class client  (new ResendClient(auth).send(…))
        ├─► Agent:  withAuth(module) → tools → adapters
        └─► Direct: runTool(tool, input, ctx)
```

## Subpaths

### Brain

| Import | Role | Docs |
| --- | --- | --- |
| `@5ss/ai-tools/core` | Kernel, contracts, `withAuth`, `runTool` | [core](./docs/packages/core.md) |
| `@5ss/ai-tools/http` | `HttpService` / `AwsService` | [http transport](./docs/reference/http-and-aws-services.md) |
| `@5ss/ai-tools/mastra` | Mastra projector | [mastra](./docs/packages/mastra.md) |
| `@5ss/ai-tools/ai-sdk` | Vercel AI SDK projector | [ai-sdk](./docs/packages/ai-sdk.md) |
| `@5ss/ai-tools/tanstack` | TanStack AI projector | [tanstack](./docs/packages/tanstack.md) |
| `@5ss/ai-tools/cloudflare` | Workers AI tool defs | [cloudflare](./docs/packages/cloudflare.md) |
| `@5ss/ai-tools/mcp` | MCP list/call + register | [mcp](./docs/packages/mcp.md) |

### Seams (`modules/`)

| Import | Kind | Tools (ids) | Docs |
| --- | --- | --- | --- |
| `@5ss/ai-tools/email` | multi-provider | `email-send`, `email-send-batch` | [email](./docs/modules/email.md) |
| `@5ss/ai-tools/messaging` | multi-provider | `messaging-send-text`, edit, media, reactions, … (telegram/slack/teams/imessage) | [messaging](./docs/modules/messaging.md) |
| `@5ss/ai-tools/files` | path root over nested S3 | `files-*` | [files](./docs/modules/files.md) |
| `@5ss/ai-tools/artifacts` | object + host providers | `artifacts-create`, `-read-range`, `-read-lines` | [artifacts](./docs/modules/artifacts.md) |
| `@5ss/ai-tools/vector-store` | qdrant, pinecone, supabase, mastra | `vector-store-*` | [vector-store](./docs/modules/vector-store.md) |
| `@5ss/ai-tools/rag` | embed + nested vector-store | `rag-*` | [rag](./docs/modules/rag.md) |
| `@5ss/ai-tools/document-extract` | multi-provider | `document-extract-text`, `-status`, `-text-batch` | [document-extract](./docs/modules/document-extract.md) |
| `@5ss/ai-tools/document-render` | cloudflare-browser | `document-render-pdf`, `-screenshot`, batches | [document-render](./docs/modules/document-render.md) |
| `@5ss/ai-tools/web-fetch` | host policy | `web-fetch-get`, `web-fetch-request` | [web-fetch](./docs/modules/web-fetch.md) |
| `@5ss/ai-tools/email-message` | pure (no auth) | `email-message-parse`, `email-message-build` | [email-message](./docs/modules/email-message.md) |
| `@5ss/ai-tools/content-type` | pure (no auth) | `content-type-get`, `-extension`, `-extensions` | [content-type](./docs/modules/content-type.md) |
| `@5ss/ai-tools/skills` | host-bound catalog | `skills-list`, `skills-get`, `skills-search` | [skills](./docs/modules/skills.md) |
| `@5ss/ai-tools/tasks` | host-backed definitions | `tasks-create`, `-get`, `-list`, `-update`, `-delete` | [tasks](./docs/modules/tasks.md) |
| `@5ss/ai-tools/scheduler` | eventbridge provider | `scheduler-create`, `-update`, `-get`, `-list`, `-delete` | [scheduler](./docs/modules/scheduler.md) |
| `@5ss/ai-tools/image` | artifact transforms | metadata, resize, crop, thumbnail, convert | [image](./docs/modules/image.md) |
| `@5ss/ai-tools/crypto` | Web Crypto | hash, HMAC sign/verify, random bytes | [crypto](./docs/modules/crypto.md) |
| `@5ss/ai-tools/calendar` | pure iCalendar | build and parse ICS | [calendar](./docs/modules/calendar.md) |
| `@5ss/ai-tools/queue` | sqs provider | enqueue, receive, acknowledge, extend visibility | [queue](./docs/modules/queue.md) |
| `@5ss/ai-tools/browser` | AgentCore + Cloudflare providers | start, get, stop | [browser](./docs/modules/browser.md) |

### Vendors (`vendors/`)

| Import | Tools (ids) | Docs |
| --- | --- | --- |
| `@5ss/ai-tools/resend` | `resend-send`, `resend-send-batch` | [resend](./docs/vendors/resend.md) |
| `@5ss/ai-tools/cloudflare-email` | `cloudflare-email-send`, `-send-batch` | [cloudflare-email](./docs/vendors/cloudflare-email.md) |
| `@5ss/ai-tools/telegram` | `telegram-send-text`, `-edit-text`, media, reactions, … | [telegram](./docs/vendors/telegram.md) |
| `@5ss/ai-tools/slack` | `slack-send-text`, edit, media, reactions, files, … | [slack](./docs/vendors/slack.md) |
| `@5ss/ai-tools/teams` | `teams-send-text`, edit, media, Bot Framework activities | [teams](./docs/vendors/teams.md) |
| `@5ss/ai-tools/imessage` | send/edit/react/unsend/read via photon-rest-proxy (HTTP) | [imessage](./docs/vendors/imessage.md) |
| `@5ss/ai-tools/s3` | `s3-*` (+ signed URL, multipart) | [s3](./docs/vendors/s3.md) |
| `@5ss/ai-tools/sqs` | `sqs-send`, `-receive`, `-delete`, `-change-visibility` | [sqs](./docs/vendors/sqs.md) |
| `@5ss/ai-tools/qdrant` | `qdrant-upsert`, `-query`, `-delete` | [qdrant](./docs/vendors/qdrant.md) |
| `@5ss/ai-tools/pinecone` | `pinecone-upsert`, `-query`, `-delete` | [pinecone](./docs/vendors/pinecone.md) |
| `@5ss/ai-tools/supabase-vector` | `supabase-vector-*` (pgvector/PostgREST) | [supabase-vector](./docs/vendors/supabase-vector.md) |
| `@5ss/ai-tools/mastra-vector` | `mastra-vector-*` (PgVector, node) | [mastra-vector](./docs/vendors/mastra-vector.md) |
| `@5ss/ai-tools/textract` | `textract-extract-text`, `-get-status`, `-extract-text-batch` | [textract](./docs/vendors/textract.md) |
| `@5ss/ai-tools/eventbridge-scheduler` | create/update/get/list/delete (task_ref) | [eventbridge-scheduler](./docs/vendors/eventbridge-scheduler.md) |
| `@5ss/ai-tools/bedrock-agentcore-code-interpreter` | session + execute + files | [bedrock-agentcore-code-interpreter](./docs/vendors/bedrock-agentcore-code-interpreter.md) |
| `@5ss/ai-tools/bedrock-agentcore-browser` | start/stop/get session + stream endpoints | [bedrock-agentcore-browser](./docs/vendors/bedrock-agentcore-browser.md) |

| `@5ss/ai-tools/cloudflare-browser` | sessions + PDF/screenshot quick actions | [cloudflare-browser](./docs/vendors/cloudflare-browser.md) |
| `@5ss/ai-tools/woocommerce` | orders, notes, refunds, products, variations, customers, coupons, categories | [woocommerce](./docs/vendors/woocommerce.md) |
| `@5ss/ai-tools/katana` | sales/purchase/manufacturing orders, products, materials, customers, suppliers, inventory | [katana](./docs/vendors/katana.md) |
| `@5ss/ai-tools/amazon-sp-api` | orders + items, FBA inventory, reports + documents, catalog search | [amazon-sp-api](./docs/vendors/amazon-sp-api.md) |
| `@5ss/ai-tools/shipstation` | paginated labels and shipments | [shipstation](./docs/vendors/shipstation.md) |

Auth fields are **snake_case** (`api_key`, `bot_token`, `access_key_id`, …).

## Guides

| Guide | Purpose |
| --- | --- |
| [Getting started](./docs/guides/getting-started.md) | Install, import map, first bind |
| [Auth and binding](./docs/guides/auth-and-binding.md) | Host-owned secrets, `withAuth` |
| [Adapters](./docs/guides/adapters.md) | Project kernel tools into frameworks |
| [Authoring packs](./docs/guides/authoring-modules.md) | modules vs vendors, layout, codegen |
| [Errors](./docs/guides/errors.md) | `ToolError` codes and retry |
| [HTTP / AWS transport](./docs/reference/http-and-aws-services.md) | `HttpService` / `AwsService` |
| [Package surface](./docs/specs/package-surface-architecture.md) | modules · vendors architecture |
| [Provider seam](./docs/specs/provider-seam.md) | Multi-provider capability modules |

## Develop

```bash
bun install
bun run hooks:install
oxfmt --write <touched-paths>
bun run check          # format:check + lint + codegen:check + test
bun run codegen
bun run new-module <kebab-key> [--title …] [--description …] [--auth none|custom]
bun run build
```

Codegen owns `package.json` exports for packs under `src/modules|vendors/<key>/` with `index.ts`. Underscore kits (`_email`, `_storage`, `_messaging`) are skipped.

## Artifacts (extract · render)

- Objects are **S3 keys** (`ArtifactRef`), not base64 in the model. Spec: [artifacts-extract-convert](./docs/specs/artifacts-extract-convert.md).
- **Extract:** Amazon Textract (object must live in AWS S3 Textract can read).
- **Render (HTML/URL):** Cloudflare Browser Rendering → storage `ArtifactRef` (`document-render`).

## Release

**[semantic-release](https://semantic-release.gitbook.io/)** on every push to `main`. No manual version bump. Commit type only chooses the bump.

| Commit | Version |
| --- | --- |
| `feat:` | minor |
| `BREAKING CHANGE` / `type!:` | major |
| anything else | patch |

Details: [docs/versioning.md](./docs/versioning.md).

## License

[MIT](./LICENSE) © harryy
