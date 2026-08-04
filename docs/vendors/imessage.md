# iMessage (Photon Advanced iMessage HTTP)

| | |
| --- | --- |
| **Import** | `@harryy/ai-tools/imessage` |
| **Kind** | **vendor** (`src/vendors/imessage`) |
| **Module id** | `imessage` |
| **Client** | `ImessageClient` |
| **Runtime** | `both` (HTTP `fetch` only — no gRPC in this pack) |
| **SDK** | [`@photon-ai/advanced-imessage`](https://github.com/photon-hq/advanced-imessage-ts) `createHttpClient` |

Outbound iMessage via Photon’s **Advanced iMessage HTTP middleware** (imessage-server-v2-http). The pack does **not** use photon-rest-proxy or gRPC.

### Inbound (out of pack scope)

Native / Spectrum webhooks terminate on the **host**. This pack does not export `webhook.ts`.

**Pack owns:** outbound HTTP via `@photon-ai/advanced-imessage/http`.  
**Host owns:** inbound webhook HTTP, signature/secret handling, durable turn/outbox.

## Auth

```ts
{
  address: string   // middleware host or http(s):// URL
  token: string     // Bearer token
  server?: string   // optional dedicated instance id → x-photon-server
  tls?: boolean     // default true for bare hosts; false for local http://
}
```

## Tools

| id | SDK |
| --- | --- |
| `imessage-send-text` | `messages.sendText` |
| `imessage-edit-text` | `messages.edit` |
| `imessage-send-chat-action` | `chats.setTyping(true)` |
| `imessage-set-reaction` | `messages.setReaction(..., true)` |
| `imessage-clear-reaction` | `messages.setReaction(..., false)` — needs **target** message + same emoji |
| `imessage-unsend` | `messages.unsend` |
| `imessage-read` | `chats.markRead` (whole chat) |
| `imessage-send-media` | `attachments.upload` + `messages.sendAttachment` (+ optional caption text) |
| `imessage-download-file` | `attachments.downloadStream` (`file_id` = attachment guid) |

`chat_id` is the iMessage **chat guid** (e.g. `any;-;+15551111111`).

### Reactions

Tapbacks: `love`, `like`, `dislike`, `laugh`, `emphasize`, `question`.  
Other strings send as `{ kind: "emoji", emoji }`.

**Clear** uses the **target** message guid + the same emoji/tapback (not a separate reaction message id).

### Media and download

- `sendMedia` uploads bytes then sends by attachment guid; optional caption is a follow-up text.
- `downloadFile` needs attachment **guid** as `file_id`.

## Bind

```ts
import { ImessageClient, imessageModule } from '@harryy/ai-tools/imessage'
import { withAuth } from '@harryy/ai-tools/core'

const client = new ImessageClient({
  address: process.env.IMESSAGE_HTTP_ADDRESS!,
  token: process.env.IMESSAGE_TOKEN!,
})

await client.sendText({
  chat_id: 'any;-;+15551111111',
  text: 'hello',
})

await client.setReaction({
  chat_id: 'any;-;+15551111111',
  message_id: 'target-msg-guid',
  emoji: 'love',
})
// later: await client.clearReaction({ chat_id, message_id: 'target-msg-guid', emoji: 'love' })

withAuth(imessageModule, { /* same auth */ })
```

## Messaging seam

```ts
withAuth(messagingModule, {
  provider: 'imessage',
  address: 'https://imessage.example.com',
  token: '…',
})
```

Messaging `clearReaction` for iMessage **requires** `emoji`.  
Messaging `downloadFile` `file_id` is the attachment guid (optional `chat_id`; legacy `space_id::attachment_guid` still accepted).

## Live progressive text

Use `createLiveMessage` with `isImessageDefiniteRejection` / `isImessageOutcomeUnknown`.
