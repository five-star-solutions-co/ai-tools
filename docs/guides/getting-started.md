# Getting started

## Install

```bash
bun add @harryy/ai-tools
```

Optional peer packages (only if you use the matching adapter):

```bash
bun add @mastra/core          # /mastra
bun add ai                    # /ai-sdk  (Vercel AI SDK)
bun add @tanstack/ai          # /tanstack
bun add @modelcontextprotocol/sdk   # registerMcpTools only
```

Runtime engines: **Bun ≥ 1.3.14** or **Node ≥ 24**. Edge runtimes work for packs marked `runtime: 'both'` or `'edge'`.

## Import map

There is **no root barrel**. Import by subpath. Full tables: [root README](../../README.md#subpaths) and [docs hub](../README.md).

| Kind | Examples |
| --- | --- |
| Brain | `@harryy/ai-tools/core`, `/http`, `/mastra`, `/ai-sdk`, … |
| Seams | `@harryy/ai-tools/email`, `/storage`, `/files`, … |
| Vendors | `@harryy/ai-tools/resend`, `/telegram`, `/s3`, … |

## Vendor pack (class client + tools)

```ts
import { withAuth } from '@harryy/ai-tools/core'
import { ResendClient, resendModule } from '@harryy/ai-tools/resend'
import { createMastraTools } from '@harryy/ai-tools/mastra'

// Host
const resend = new ResendClient({ api_key: process.env.RESEND_API_KEY! })
await resend.send({ to: 'a@example.com', from: 'b@example.com', subject: 'Hi', text: 'Hello' })

// Agent
const bound = withAuth(resendModule, { api_key: process.env.RESEND_API_KEY! })
export const tools = createMastraTools(bound)
```

## Multi-provider seam

```ts
import { withAuth } from '@harryy/ai-tools/core'
import { emailModule } from '@harryy/ai-tools/email'
import { createMastraTools } from '@harryy/ai-tools/mastra'

const bound = withAuth(emailModule, {
  provider: 'cloudflare',
  account_id: process.env.CF_ACCOUNT_ID!,
  api_token: process.env.CF_API_TOKEN!,
  sender: { email: 'verified@example.com', name: 'Product' },
})

export const tools = createMastraTools(bound)
```

Host chooses the backend with `provider` on auth. Tool inputs never include credentials.

## Pure packs (no auth)

```ts
import { emailMessageModule } from '@harryy/ai-tools/email-message'
import { createAiSdkTools } from '@harryy/ai-tools/ai-sdk'

export const tools = createAiSdkTools(emailMessageModule)
```

## Minimal custom tool

```ts
import { z } from 'zod'
import { defineModule, defineTool, runTool } from '@harryy/ai-tools/core'

const ping = defineTool({
  id: 'demo-ping',
  name: 'ping',
  description: 'Return ok. Use as a connectivity check.',
  inputSchema: z.object({}),
  outputSchema: z.object({ ok: z.literal(true) }),
  execute: async () => ({ ok: true as const }),
})

const demo = defineModule({
  id: 'demo',
  title: 'Demo',
  description: 'Demo module.',
  tools: [ping],
})

await runTool(ping, {})
// { ok: true }
```

## Direct execution (tests / scripts)

```ts
import { runTool, withAuth } from '@harryy/ai-tools/core'
import { emailModule, emailSendTool } from '@harryy/ai-tools/email'

const bound = withAuth(emailModule, {
  provider: 'resend',
  api_key: '…',
  sender: { email: 'verified@example.com', name: 'Product' },
})
const tool = bound.tools.find((t) => t.id === emailSendTool.id)!

await runTool(
  tool,
  {
    to: 'user@example.com',
    from: 'noreply@your-domain.example',
    subject: 'Hello',
    text: 'Hi',
  },
  { fetch: customFetch }, // optional injectable fetch
)
```

## Next

- [Auth and binding](./auth-and-binding.md)
- [Adapters](./adapters.md)
- [Authoring packs](./authoring-modules.md)
- [Docs hub](../README.md)
