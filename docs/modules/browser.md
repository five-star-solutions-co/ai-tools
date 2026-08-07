# Browser

| | |
| --- | --- |
| **Import** | `@harryy/ai-tools/browser` |
| **Kind** | capability seam |
| **Providers** | `bedrock-agentcore`, `cloudflare` |
| **Categories** | `browser`, `automation` |
| **Classification** | `standard` |

## Hybrid model (recommended)

| Path | Use for |
| --- | --- |
| **Session lifecycle + CDP mint** | Multi-step agent browsing (Mastra AgentBrowser / Playwright) |
| **One-shot REST** | navigate / snapshot / screenshot without a full agent loop |
| **Interactive REST tools** | Migration only — often `unsupported`; prefer CDP |

```ts
import { BrowserClient, mintBrowserCdpConnection } from '@harryy/ai-tools/browser'

const client = new BrowserClient(auth)
const session = await client.startSession()
const cdp = mintBrowserCdpConnection(session)
// host: connect Playwright / AgentBrowser to cdp.websocket_url (+ cdp.headers)
```

Cloudflare vendor helper: `mintCloudflareBrowserCdpConnection` from `@harryy/ai-tools/cloudflare-browser` (optional `api_token` → Authorization header; optional `browser: 'kitesurf'` to ensure the WebSocket URL carries the engine query).

Cloudflare host auth may set `browser: 'kitesurf'` for the lightweight Workers engine on sessions, one-shot navigate/snapshot/screenshot (via vendor client). Default is Chromium when omitted.

REST interactive tools (`click` / `type` / `wait`) stay for migration; do not remove until host CDP path is live.

| Tool | Path | Tags |
| --- | --- | --- |
| `browser-start/get/stop-session` | lifecycle | `session`, `lifecycle` |
| `browser-get-state` | lifecycle | `session`, `lifecycle` |
| `browser-navigate` / `snapshot` / `screenshot` | one-shot | `one-shot` |
| `browser-click` / `type` / `wait` | session-agent (secondary) | `session-agent`, `interactive`, `secondary` |

## Provider support

| Action | Cloudflare | Bedrock AgentCore |
| --- | --- | --- |
| Session lifecycle | yes | yes |
| navigate / snapshot | yes (one-shot REST content API; pass `url`) | `unsupported` (use CDP automation stream) |
| screenshot | yes (needs `storage` on auth + `url`) | `unsupported` (use CDP) |
| click / type / wait | `unsupported` (use CDP stream) | `unsupported` (use CDP stream) |
| get-state | session status + streams | session status + streams |

This package does not embed a CDP client.

Cloudflare sessions support `session_timeout_seconds` from 60 to 600. Cloudflare does not accept the shared optional `name` or viewport fields, so those inputs return `bad_input` for that provider instead of being ignored.
