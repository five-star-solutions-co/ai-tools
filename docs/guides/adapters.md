# Adapters

Adapters **project** kernel tools into framework shapes. They do not implement product logic.

## Pattern

```ts
import { withAuth } from '@5ss/ai-tools/core'
import { s3Module } from '@5ss/ai-tools/s3'
import { createMastraTools } from '@5ss/ai-tools/mastra'
import { createAiSdkTools } from '@5ss/ai-tools/ai-sdk'
import { createTanStackTools } from '@5ss/ai-tools/tanstack'
import { createCloudflareAiTools } from '@5ss/ai-tools/cloudflare'
import { createMcpTools, registerMcpTools } from '@5ss/ai-tools/mcp'

const bound = withAuth(s3Module, {
  access_key_id: '…',
  secret_access_key: '…',
  region: 'auto',
  bucket: '…',
})

createMastraTools(bound)
createAiSdkTools(bound)
createTanStackTools(bound)
createCloudflareAiTools(bound)
createMcpTools(bound)
// registerMcpTools(mcpServer, bound) // host-owned McpServer
```

Pass either a **module**, a **tool array**, or a **single tool** (each adapter documents accepted inputs). Auth modules must be bound first (`withAuth` or `bindModule`).

Optional second argument on projectors (H-02):

```ts
createMastraTools(bound, {
  context: { /* static */ },
  // Merged over framework defaults — abortSignal kept unless you override `signal`
  createContext: (_mastraCtx) => ({
    extras: { org_id: '…' },
  }),
})
```

Same merge rules on AI SDK, TanStack, Cloudflare. MCP `registerMcpTools`: `context` may be a value **or** factory; `createContext` is additive.

## Framework pages

| Adapter | Import | Notes |
| --- | --- | --- |
| Mastra | `@5ss/ai-tools/mastra` | [mastra.md](../packages/mastra.md) — tool `id` is the stable name |
| AI SDK | `@5ss/ai-tools/ai-sdk` | [ai-sdk.md](../packages/ai-sdk.md) — uses dynamic tools for Zod 4 |
| TanStack AI | `@5ss/ai-tools/tanstack` | [tanstack.md](../packages/tanstack.md) |
| Cloudflare Workers AI | `@5ss/ai-tools/cloudflare` | [cloudflare.md](../packages/cloudflare.md) — definition objects, not a runtime |
| MCP | `@5ss/ai-tools/mcp` | [mcp.md](../packages/mcp.md) — list/call shapes + optional register |

## Rules

- **Generic only.** No per-module factory (`createCloudflareEmailMastraTool` is forbidden).
- **Peers optional.** Adapter packages are optional peerDependencies; import only what you install.
- **Kernel remains source of truth** for schemas and execute.

## Direct call without an adapter

Use `runTool` from `@5ss/ai-tools/core` for scripts, tests, and custom hosts.
