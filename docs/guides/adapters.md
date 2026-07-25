# Adapters

Adapters **project** kernel tools into framework shapes. They do not implement product logic.

## Pattern

```ts
import { withAuth } from '@harryy/ai-tools/core'
import { s3Module } from '@harryy/ai-tools/s3'
import { createMastraTools } from '@harryy/ai-tools/mastra'
import { createAiSdkTools } from '@harryy/ai-tools/ai-sdk'
import { createTanStackTools } from '@harryy/ai-tools/tanstack'
import { createCloudflareAiTools } from '@harryy/ai-tools/cloudflare'
import { createMcpTools, registerMcpTools } from '@harryy/ai-tools/mcp'

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

Pass either a **module**, a **tool array**, or a **single tool** (each adapter documents accepted inputs). Auth modules must be bound first.

## Framework pages

| Adapter | Import | Notes |
| --- | --- | --- |
| Mastra | `@harryy/ai-tools/mastra` | [mastra.md](../packages/mastra.md) — tool `id` is the stable name |
| AI SDK | `@harryy/ai-tools/ai-sdk` | [ai-sdk.md](../packages/ai-sdk.md) — uses dynamic tools for Zod 4 |
| TanStack AI | `@harryy/ai-tools/tanstack` | [tanstack.md](../packages/tanstack.md) |
| Cloudflare Workers AI | `@harryy/ai-tools/cloudflare` | [cloudflare.md](../packages/cloudflare.md) — definition objects, not a runtime |
| MCP | `@harryy/ai-tools/mcp` | [mcp.md](../packages/mcp.md) — list/call shapes + optional register |

## Rules

- **Generic only.** No per-module factory (`createCloudflareEmailMastraTool` is forbidden).
- **Peers optional.** Adapter packages are optional peerDependencies; import only what you install.
- **Kernel remains source of truth** for schemas and execute.

## Direct call without an adapter

Use `runTool` from `@harryy/ai-tools/core` for scripts, tests, and custom hosts.
