# Browser

| | |
| --- | --- |
| **Import** | `@harryy/ai-tools/browser` |
| **Kind** | capability seam |
| **Providers** | `bedrock-agentcore`, `cloudflare` |

| Tool | Purpose |
| --- | --- |
| `browser-start-session` | Start a browser session |
| `browser-get-session` | Read status and stream metadata |
| `browser-stop-session` | Stop a browser session |
| `browser-navigate` | Open a URL (returns HTML when supported) |
| `browser-snapshot` | Page HTML or text |
| `browser-click` / `browser-type` / `browser-wait` | Interactive control when supported |
| `browser-screenshot` | PNG → object-store ArtifactRef |
| `browser-get-state` | Session status / streams |

## Provider support

| Action | Cloudflare | Bedrock AgentCore |
| --- | --- | --- |
| Session lifecycle | yes | yes |
| navigate / snapshot | yes (one-shot REST content API; pass `url`) | `unsupported` (use CDP automation stream) |
| screenshot | yes (needs `storage` on auth + `url`) | `unsupported` (use CDP) |
| click / type / wait | `unsupported` (use CDP stream) | `unsupported` (use CDP stream) |
| get-state | session status + streams | session status + streams |

Interactive CDP control stays host-side via `streams.automation_stream_endpoint` from start-session (Playwright / Puppeteer). This package does not embed a CDP client.

Cloudflare sessions support `session_timeout_seconds` from 60 to 600. Cloudflare does not accept the shared optional `name` or viewport fields, so those inputs return `bad_input` for that provider instead of being ignored.
