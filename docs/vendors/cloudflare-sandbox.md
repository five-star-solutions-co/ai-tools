# Cloudflare Sandbox

| | |
| --- | --- |
| **Import** | `@harryy/ai-tools/cloudflare-sandbox` |
| **Kind** | **vendor** (`src/vendors/cloudflare-sandbox`) |
| **Module id** | `cloudflare-sandbox` |
| **Client** | `CloudflareSandboxClient` |

HTTP client for the [Cloudflare Sandbox bridge](https://developers.cloudflare.com/sandbox/bridge/): create isolated containers, run commands (SSE), execute code, and read/write workspace files.

The host **deploys** the bridge Worker and supplies its URL + `SANDBOX_API_KEY`. This pack does not embed the Workers Sandbox SDK.

## Auth

```ts
{
  base_url: string  // bridge origin, e.g. https://sandbox-bridge.example.workers.dev
  api_key: string   // Bearer SANDBOX_API_KEY
}
```

## Tools

| Tool | Purpose |
| --- | --- |
| `cloudflare-sandbox-health` | `GET /health` |
| `cloudflare-sandbox-create` | `POST /v1/sandbox` |
| `cloudflare-sandbox-destroy` | `DELETE /v1/sandbox/:id` |
| `cloudflare-sandbox-running` | `GET /v1/sandbox/:id/running` |
| `cloudflare-sandbox-exec` | `POST …/exec` (argv + SSE) |
| `cloudflare-sandbox-execute-code` | python3/node/sh via exec |
| `cloudflare-sandbox-write-file` / `read-file` | workspace files |
| `cloudflare-sandbox-write-files` / `read-files` | batch files |
| `cloudflare-sandbox-create-session` / `delete-session` | bridge Session-Id isolation |

## Bind

```ts
import { CloudflareSandboxClient, cloudflareSandboxModule } from '@harryy/ai-tools/cloudflare-sandbox'
import { withAuth } from '@harryy/ai-tools/core'

withAuth(cloudflareSandboxModule, {
  base_url: process.env.SANDBOX_API_URL!,
  api_key: process.env.SANDBOX_API_KEY!,
})

const client = new CloudflareSandboxClient({
  base_url: 'https://…workers.dev',
  api_key: '…',
})
const { sandbox_id } = await client.create()
const out = await client.executeCode({ sandbox_id, code: 'print(40+2)', language: 'python' })
await client.destroy({ sandbox_id })
```

Seam: `@harryy/ai-tools/code-sandbox` with `provider: 'cloudflare'`.

## Live IT

```bash
AI_TOOLS_CF_SANDBOX_BASE_URL=https://…workers.dev
AI_TOOLS_CF_SANDBOX_API_KEY=…
```
