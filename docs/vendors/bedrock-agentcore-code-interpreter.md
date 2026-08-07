# Bedrock AgentCore Code Interpreter

| | |
| --- | --- |
| **Import** | `@5ss/ai-tools/bedrock-agentcore-code-interpreter` |
| **Kind** | vendor pack |
| **Auth** | AWS keys + region; optional `code_interpreter_id` (default `aws.codeinterpreter.v1`) |

## Tools

Session: start / stop / get.  
Invoke: execute-code, execute-command, start-command, get-task, stop-task.  
Files: list / read / write / remove.

## Bind

```ts
withAuth(bedrockAgentCoreCodeInterpreterModule, {
  access_key_id: '…',
  secret_access_key: '…',
  region: 'us-east-1',
})
```
