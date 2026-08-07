# `@5ss/ai-tools/ai-sdk`

Project kernel tools to the Vercel [AI SDK](https://sdk.vercel.ai) `tool` / dynamic tool surface.

## Peer

```bash
bun add ai   # >= 5.0
```

## API

```ts
import { createAiSdkTool, createAiSdkTools } from '@5ss/ai-tools/ai-sdk'

createAiSdkTool(tool)
createAiSdkTools(moduleOrTools)
```

Uses AI SDK **dynamic tools** where needed so Zod 4 schemas project cleanly under erased types.

## Example

```ts
import { withAuth } from '@5ss/ai-tools/core'
import { emailModule } from '@5ss/ai-tools/email'
import { createAiSdkTools } from '@5ss/ai-tools/ai-sdk'

const tools = createAiSdkTools(
  withAuth(emailModule, {
    provider: 'cloudflare',
    account_id: '…',
    api_token: '…',
    sender: { email: 'verified@example.com', name: 'Product' },
  }),
)
// pass into generateText / streamText tools option per AI SDK docs
```

## Related

- [Adapters guide](../guides/adapters.md)
