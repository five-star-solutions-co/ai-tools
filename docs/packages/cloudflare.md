# `@5ss/ai-tools/cloudflare`

Project kernel tools into **Cloudflare Workers AI–style tool definitions** (JSON Schema + execute wiring). This is a definition projector, not a Cloudflare API client for email/R2 (see product modules).

## API

```ts
import {
  createCloudflareAiToolDefinition,
  createCloudflareAiTools,
} from '@5ss/ai-tools/cloudflare'
import type { CloudflareAiToolDefinition, CloudflareAiToolset } from '@5ss/ai-tools/cloudflare'
```

| Helper | Use |
| --- | --- |
| `createCloudflareAiToolDefinition` | One tool → definition object |
| `createCloudflareAiTools` | Module or list → toolset |

Schemas are projected to JSON Schema for Workers AI tool calling shapes.

## Related

- Product: [cloudflare-email](../vendors/cloudflare-email.md) (vendor pack), object store via [s3](../vendors/s3.md) with R2 S3-compatible endpoint
- [Adapters guide](../guides/adapters.md)
