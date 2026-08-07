# Code Sandbox

| | |
| --- | --- |
| **Import** | `@5ss/ai-tools/code-sandbox` |
| **Kind** | capability seam |
| **Providers** | `cloudflare`, `bedrock-agentcore` |

Isolated code execution: start/stop sessions, run source or shell commands, read/write files through a host-bound provider.

| Tool | Purpose |
| --- | --- |
| `code-sandbox-start-session` | Start sandbox session |
| `code-sandbox-get-session` | Status / running |
| `code-sandbox-stop-session` | Stop / destroy |
| `code-sandbox-execute-code` | Run source (default python) |
| `code-sandbox-execute-command` | Shell command |
| `code-sandbox-write-files` / `read-files` | Files |
| `code-sandbox-list-files` / `remove-files` | List / remove (provider-dependent) |

## Auth

```ts
// Cloudflare Sandbox bridge
{ provider: 'cloudflare', base_url: string, api_key: string }

// Amazon Bedrock AgentCore Code Interpreter
{
  provider: 'bedrock-agentcore',
  access_key_id: string,
  secret_access_key: string,
  region: string,
  session_token?: string,
  code_interpreter_id?: string
}
```

## Notes

- `session_id` is the provider session key (bridge sandbox id or AgentCore session id).
- Cloudflare has no native REPL route; code runs via container runtimes (`python3 -c`, `node -e`, …).
- AgentCore file list/read shapes are normalized best-effort from invoke payloads.
