# Microsoft Teams

| | |
| --- | --- |
| **Import** | `@5ss/ai-tools/teams` |
| **Kind** | **vendor** (`src/vendors/teams`) |
| **Module id** | `teams` |
| **Auth** | Host: `{ app_id, app_password, tenant_id? }` |

Microsoft Teams / Bot Framework vendor pack. Same layout as Telegram / Resend: class client + tools. Not a multi-provider messaging seam.

## Bind

```ts
import { teamsModule, TeamsClient, createLiveMessage, withAuth } from '@5ss/ai-tools/teams'

withAuth(teamsModule, { app_id: '…', app_password: '…' })
// optional tenant_id; omit for multi-tenant botframework.com token endpoint
const client = new TeamsClient({ app_id: '…', app_password: '…' })
```

## Auth + token

| Field | Role |
| --- | --- |
| `app_id` | Bot Framework application (client) id |
| `app_password` | Bot Framework application credential |
| `tenant_id` | Optional Azure AD tenant; default token tenant is `botframework.com` |

Token: `POST https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token` with `client_credentials` and scope `https://api.botframework.com/.default`. Access tokens are cached on the client instance (~`expires_in` with 60s skew).

## service_url

Bot Framework connector base is **per conversation**. Inbound activities carry `serviceUrl`; every outbound connector method takes `service_url` on input (except pure no-ops / auth-local helpers).

## Client methods → tools

| Method | Tool id |
| --- | --- |
| `sendText` | `teams-send-text` |
| `editText` | `teams-edit-text` |
| `sendChatAction` | `teams-send-chat-action` |
| `setReaction` | `teams-set-reaction` |
| `clearReaction` | `teams-clear-reaction` |
| `sendMedia` | `teams-send-media` |
| `downloadFile` | `teams-download-file` |
| `answerCallback` | `teams-answer-callback` |
| `getBot` | `teams-get-bot` |

### Connector map

| Method | HTTP |
| --- | --- |
| `sendText` / `sendMedia` / `sendChatAction` | `POST {service_url}/v3/conversations/{chat_id}/activities` |
| `editText` | `PUT {service_url}/v3/conversations/{chat_id}/activities/{message_id}` |
| `downloadFile` | `GET {file_id}` (content URL) with bearer token |
| `answerCallback` | `POST` absolute reply URL when `callback_query_id` is http(s); else no-op |
| `setReaction` / `clearReaction` | **Graph** `setReaction` / `unsetReaction` when auth has `tenant_id`; else no-op |
| `getBot` | local identity from bound `app_id` |

### Graph reactions

Bind a real Azure AD `tenant_id` (not multi-tenant `botframework.com` only). App registration needs Graph application permissions that allow chat/channel message reactions (e.g. `ChatMessage.ReadWrite` / channel equivalents — host scopes).

```ts
const client = new TeamsClient({ app_id, app_password, tenant_id })
await client.setReaction({ chat_id, message_id, emoji: '👍' })
// channel path:
await client.setReaction({ chat_id, message_id, emoji: '❤️', team_id, channel_id })
await client.clearReaction({ chat_id, message_id, emoji: '👍' }) // emoji required for Graph
```

## Helpers

| Export | Role |
| --- | --- |
| `parseTeamsActivity` | Activity → normalized inbound event (`service_url`, `callback_query_id` for invoke) |
| `isTeamsActivity` | structural activity check |
| `verifyTeamsAuthHeader` | bearer **presence** only — host must validate Bot Framework JWT |
| `createLiveMessage` | progressive `start` / `update` / `finalize` |
| `createTypingPulse` | renew typing while work runs |
| `isTeamsDefiniteRejection` / `isTeamsOutcomeUnknown` | live-message finalize policy |

## Live progressive text

```ts
const client = new TeamsClient({ app_id: '…', app_password: '…' })
const live = createLiveMessage({
  sendText: (text) => client.sendText({ chat_id, text, service_url }),
  editText: (message_id, text) => client.editText({ chat_id, message_id, text, service_url }),
  isDefiniteRejection: isTeamsDefiniteRejection,
  isOutcomeUnknown: isTeamsOutcomeUnknown,
})
await live.start('…')
await live.update('…partial…')
const { message_id } = await live.finalize('…final…')
```

## Layout (gold vendor)

```text
contracts.ts · domain.ts · client.ts · module.ts · webhook.ts · index.ts
```

Messaging vertical kit: `src/vendors/_messaging/`.
