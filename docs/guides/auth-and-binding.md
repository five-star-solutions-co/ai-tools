# Auth and binding

## Rules

1. **Hosts own secrets.** This package never stores, vaults, or encrypts credentials.
2. **Auth schemas are host-facing** (forms, env loaders, validation). Field `.describe()` text may name the credential purpose for humans configuring the host.
3. **Model-facing tool inputs never include auth.** Agents must not see API keys, tokens, or “pass your X-Api-Key” language in tool `description` / input field descriptions.
4. **Bind once, project many times.** Call `withAuth(module, credentials)` then pass the bound module into any adapter.
5. **snake_case** for host auth fields that mirror APIs (`api_key`, `bot_token`, `access_key_id`, `account_id`).

## Vendor pack

```ts
import { withAuth } from '@harryy/ai-tools/core'
import { telegramModule, TelegramClient } from '@harryy/ai-tools/telegram'

// Host client
const client = new TelegramClient({ bot_token: '…' })

// Agent tools
const bound = withAuth(telegramModule, { bot_token: '…' })
```

## Multi-provider seam

Capability modules use a **provider** discriminator on auth. Nested vendor fields stay snake_case.

```ts
import { withAuth } from '@harryy/ai-tools/core'
import { emailModule } from '@harryy/ai-tools/email'
import { s3Module } from '@harryy/ai-tools/s3'

const boundEmail = withAuth(emailModule, { provider: 'resend', api_key: '…' })
withAuth(emailModule, {
  provider: 'cloudflare',
  account_id: '…',
  api_token: '…',
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

Hosts/tests inject `fetch` and `signal` without changing tool schemas.

## Security checklist for pack authors

- [ ] No secrets on `inputSchema`.
- [ ] Model `description` talks about capability, bounds, side effects, result shape only.
- [ ] Errors never echo tokens or full request signing material.
- [ ] Size/rate limits fail with stable `ToolError` codes (`too_large`, `rate_limited`, …).

See [Errors](./errors.md) and [Authoring packs](./authoring-modules.md).
