# Bedrock AgentCore Browser

| | |
| --- | --- |
| **Import** | `@5ss/ai-tools/bedrock-agentcore-browser` |
| **Kind** | vendor pack |
| **Auth** | AWS keys + region; optional `browser_id` (default `aws.browser.v1`) |

## Tools (v1)

- `start-session` — returns `session_id` + automation/live-view stream endpoints when provided  
- `stop-session`  
- `get-session`  

**Not in v1:** faked click/type REST tools. Interactive control uses the automation stream (host/Playwright).

## Bind

```ts
withAuth(bedrockAgentCoreBrowserModule, {
  access_key_id: '…',
  secret_access_key: '…',
  region: 'us-east-1',
})
```
