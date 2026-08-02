# Cloudflare Sandbox

| | |
| --- | --- |
| **Import** | `@harryy/ai-tools/cloudflare-sandbox` |
| **Kind** | **vendor** (`src/vendors/cloudflare-sandbox`) |
| **Module id** | `cloudflare-sandbox` |
| **Client** | `CloudflareSandboxClient` |

HTTP client for the [Cloudflare Sandbox bridge](https://developers.cloudflare.com/sandbox/bridge/): create isolated containers, run commands (SSE), execute code, and read/write workspace files (text or binary).

The host **deploys** the bridge Worker and supplies its URL + `SANDBOX_API_KEY`. This pack does not embed the Workers Sandbox SDK.

**Hybrid:** keep `CloudflareSandboxClient` as the first-class host export (Workspace / agent shell). Prefer host workspace for multi-step interactive shell; use pack tools for one-shot workflow steps. Catalog: categories `compute`, `sandbox`, `cloudflare`; classification `standard`.

### Exec extras

- `env` on `exec` — optional process environment when the bridge accepts `env` on the body.
- Client `exec(input, { onStdout, onStderr })` — callbacks while walking the buffered SSE body (not true wire streaming yet).

## Auth

```ts
{
  base_url: string  // bridge origin, e.g. https://sandbox-bridge.example.workers.dev
  api_key: string   // Bearer SANDBOX_API_KEY
  storage?: S3Auth  // optional; required for importArtifact / exportArtifact
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
| `cloudflare-sandbox-write-file` / `read-file` | workspace files (`text` or `body_base64`; read `encoding` utf8\|base64) |
| `cloudflare-sandbox-write-files` / `read-files` | batch files |
| `cloudflare-sandbox-list-files` / `remove-files` | list via find / remove via rm |
| `cloudflare-sandbox-import-artifact` | object-store ArtifactRef → sandbox path (needs `storage`) |
| `cloudflare-sandbox-export-artifact` | sandbox path → object-store ArtifactRef (needs `storage`) |
| `cloudflare-sandbox-create-session` / `delete-session` | bridge Session-Id isolation |

Bridge file PUT/GET is raw bytes (max **32 MiB**). Prefer `body_base64` + `encoding: 'base64'` for binary; keep `text` for source/config.

## Bind

```ts
import { CloudflareSandboxClient, cloudflareSandboxModule } from '@harryy/ai-tools/cloudflare-sandbox'
import { withAuth } from '@harryy/ai-tools/core'

withAuth(cloudflareSandboxModule, {
  base_url: process.env.SANDBOX_API_URL!,
  api_key: process.env.SANDBOX_API_KEY!,
  // storage: { access_key_id, secret_access_key, region, bucket, endpoint? }
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
