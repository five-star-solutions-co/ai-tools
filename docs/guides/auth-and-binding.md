# Auth and binding

## Rules

1. **Hosts own secrets.** This package never stores, vaults, or encrypts credentials.
2. **Auth schemas are host-facing** (forms, env loaders, validation). Field `.describe()` text may name the credential purpose for humans configuring the host.
3. **Model-facing tool inputs never include auth.** Agents must not see API keys, tokens, or “pass your X-Api-Key” language in tool `description` / input field descriptions.
4. **Bind then project.** Call `withAuth` (static creds) or `bindModule` (per-invocation resolve) then pass into any adapter.
5. **snake_case** for host auth fields that mirror APIs (`api_key`, `bot_token`, `access_key_id`, `account_id`).

## Vendor pack

```ts
import { withAuth } from '@harryy/ai-tools/core'
import { telegramModule, TelegramClient } from '@harryy/ai-tools/telegram'

// Host client
const client = new TelegramClient({ bot_token: '…' })

// Agent tools (static credentials for this process)
const bound = withAuth(telegramModule, { bot_token: '…' })
```

## Dynamic bind (multi-tenant)

When credentials depend on org/session per tool call:

```ts
import { bindModule, withHooks } from '@harryy/ai-tools/core'
import { emailModule } from '@harryy/ai-tools/email'
import { createMastraTools } from '@harryy/ai-tools/mastra'

const bound = bindModule(emailModule, {
  resolveAuth: async (ctx) => {
    const orgId = ctx.extras?.['org_id']
    // host vault / DB — never on tool inputs
    return {
      provider: 'resend',
      api_key: await loadKey(orgId),
      sender: { email: 'verified@example.com', name: 'Product' },
    }
  },
  resolveContext: async () => ({
    // Merged over adapter context (signal/fetch preserved). Only set what you add:
    extras: { /* org_id, … */ },
  }),
  hooks: {
    beforeExecute: async ({ tool, ctx }) => {
      // host audit / allowlist (throw ToolError to deny)
    },
    onArtifact: async ({ tool, artifact, output, ctx }) => {
      // capture a schema-valid ArtifactRef; channel delivery remains host-owned
    },
    afterExecute: async ({ tool, output }) => {},
    onError: async ({ tool, error }) => {},
  },
})

// Adapter maps framework context → ToolContext (H-02)
const tools = createMastraTools(bound, {
  createContext: (mastraCtx) => ({
    signal: mastraCtx?.abortSignal,
    extras: { org_id: currentOrgId() },
  }),
})
```

`withAuth` stays the simple path. `bindModule` + `withHooks` + adapter `createContext` are the host-integration kernel (see [host-integration-kernel.md](../specs/host-integration-kernel.md)).

## Tool surface filter (`onlyTools` / `exceptTools`)

Hosts often enable a pack but not every tool. Filter by **stable kebab tool id** (order stays the module’s order). Unknown ids throw.

```ts
import { onlyTools, exceptTools, withAuth, bindModule } from '@harryy/ai-tools/core'
import { telegramModule } from '@harryy/ai-tools/telegram'

// Preferred: compose with withAuth / bind / hooks
const sendOnly = onlyTools(telegramModule, [
  'telegram-send-text',
  'telegram-edit-text',
])
const bound = withAuth(sendOnly, { bot_token: '…' })

// Or drop a few dangerous / unused tools
const noDownload = exceptTools(telegramModule, ['telegram-download-file'])

// Inline on bind helpers
withAuth(telegramModule, { bot_token: '…' }, {
  tools: { only: ['telegram-send-text'] },
})
bindModule(telegramModule, {
  resolveAuth: async () => ({ bot_token: '…' }),
  tools: { except: ['telegram-download-file'] },
})
```

| Helper | Meaning |
| --- | --- |
| `onlyTools(module, ids)` | Keep only these tool ids (allowlist) |
| `exceptTools(module, ids)` | Drop these tool ids (denylist) |
| `filterModuleTools(module, selection)` | Same, object form |
| `ToolSelection` | `{ only: string[] }` **or** `{ except: string[] }` — shared contract for host wrappers |

```ts
import type { ToolSelection, BindModuleOptions } from '@harryy/ai-tools/core'

function bindCustomModule<TAuth>(
  module: ModuleDefinition<TAuth>,
  options: BindModuleOptions<TAuth> // options.tools?: ToolSelection
) {
  return bindModule(module, options)
}
```

Unknown tool ids are a **hard error** with structured details (`module_id`, `unknown_tool_ids`, `available_tool_ids`). No silent ignore.

Names intentionally avoid security-policy jargon (`allow`/`deny`); hosts still own agent allowlists. This only shrinks the **module tool list** before projection.

## Multi-provider seam

Capability modules use a **provider** discriminator on auth. Nested vendor fields stay snake_case.

```ts
import { withAuth } from '@harryy/ai-tools/core'
import { emailModule } from '@harryy/ai-tools/email'
import { s3Module } from '@harryy/ai-tools/s3'

const boundEmail = withAuth(emailModule, {
  provider: 'resend',
  api_key: '…',
  sender: { email: 'verified@example.com', name: 'Product' },
})
withAuth(emailModule, {
  provider: 'cloudflare',
  account_id: '…',
  api_token: '…',
  sender: { email: 'verified@example.com', name: 'Product' },
})

// Object store: use vendor packs (s3 / r2 / supabase-storage), not a storage seam
const boundS3 = withAuth(s3Module, {
  access_key_id: '…',
  secret_access_key: '…',
  region: 'auto',
  bucket: 'my-bucket',
  endpoint: 'https://….r2.cloudflarestorage.com', // optional S3-compatible
})
```

- Validates credentials against the module’s auth Zod schema.
- Returns a **bound module** whose tools close over auth in `ToolContext`.
- Tool inputs never include credentials.

## `withAuthTool`

Bind a single tool when you do not want the whole module surface.

## Auth types on modules

| `auth.type` | Meaning |
| --- | --- |
| `none` | No credentials (e.g. content-type, email-message). |
| `custom` | Zod schema of host fields; client turns them into headers / AwsService credentials. |

## Tool context

```ts
type ToolContext = {
  auth?: unknown
  fetch?: typeof fetch
  signal?: AbortSignal
  now?: () => Date
  extras?: Record<string, unknown>
}
```

Hosts/tests inject `fetch` and `signal` without changing tool schemas. Adapters accept `context` + `createContext` so framework `abortSignal` (and host extras) become `ToolContext`.

## ToolMeta hints (optional)

`defineTool` accepts additive host-facing hints on `meta` (not enforced by the kernel):

`idempotent`, `longRunning`, `requiresConfirmation`, `supportsCancel`, `supportsProgress`, `network`, `artifacts`, `tags`.

Catalog entries (`toToolCatalogEntry`) surface the same fields for discovery UIs.

## Module catalog metadata

Each pack declares catalog fields on its own `defineModule` in `module.ts` (not a central core registry):

| Field | Role |
| --- | --- |
| `categories: string[]` | UI filters, MCP catalog, skill grouping |
| `classification?: 'standard' \| 'pii' \| 'phi'` | Host sensitivity hint (not enforced here) |
| `tags?: string[]` | Module-level search / badges |

`toModuleCatalogEntry` projects `categories`, `classification`, and `tags` (tags default to `[]`). Host auth binding stays outside this package.

## Security checklist for pack authors

- [ ] No secrets on `inputSchema`.
- [ ] Model `description` talks about capability, bounds, side effects, result shape only.
- [ ] Errors never echo tokens or full request signing material.
- [ ] Size/rate limits fail with stable `ToolError` codes (`too_large`, `rate_limited`, …).

See [Errors](./errors.md) and [Authoring packs](./authoring-modules.md).
