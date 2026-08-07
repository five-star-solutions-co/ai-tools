# `@5ss/ai-tools/mcp`

Project kernel tools to [Model Context Protocol](https://modelcontextprotocol.io) list/call shapes, with optional registration onto a host-owned MCP server.

## Peer

```bash
# only required for registerMcpTools
bun add @modelcontextprotocol/sdk   # >= 1.0
```

## API

```ts
import {
  createMcpToolListItem,
  createMcpTools,
  registerMcpTools,
} from '@5ss/ai-tools/mcp'
```

| Helper | Use |
| --- | --- |
| `createMcpToolListItem` | One tool → MCP list item (name, description, inputSchema) |
| `createMcpTools` | Module/list → list + call helpers |
| `registerMcpTools(server, moduleOrTools, options?)` | Register on host `McpServer`-like object |

Tool **names** use kernel tool `id` values.

## Example

```ts
import { emailMessageModule } from '@5ss/ai-tools/email-message'
import { createMcpTools, registerMcpTools } from '@5ss/ai-tools/mcp'

const mcp = createMcpTools(emailMessageModule)
// expose mcp.tools to ListTools; route CallTool through mcp.call

// or, with SDK server:
// registerMcpTools(server, emailMessageModule)
```

Credentialed modules: `withAuth` first.

## Related

- [Adapters guide](../guides/adapters.md)
