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

This seam intentionally exposes session lifecycle only. Interactive navigation and page control use the returned automation stream in a host runtime. The module does not invent REST click or scrape operations.

Cloudflare sessions support `session_timeout_seconds` from 60 to 600. Cloudflare does not accept the shared optional `name` or viewport fields, so those inputs return `bad_input` for that provider instead of being ignored.
