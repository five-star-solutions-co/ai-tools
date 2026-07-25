# iMessage (photon-rest-proxy)

| | |
| --- | --- |
| **Import** | `@harryy/ai-tools/imessage` |
| **Kind** | **vendor** (`src/vendors/imessage`) |
| **Module id** | `imessage` |
| **Client** | `ImessageClient` |
| **Runtime** | `both` (HTTP only — gRPC stays in the proxy container) |

Outbound iMessage via a hosted **[photon-rest-proxy](https://github.com/harryy2510)** (or your deploy of `~/Desktop/hariom/photon-rest-proxy`). The pack never talks to Photon gRPC directly.

### Inbound (out of pack scope)

Photon / Spectrum **native webhooks** terminate on the **host** (HTTP route + secret storage + tenant map). This pack does **not** export `webhook.ts` verify/parse helpers: the inbound shape is product-specific and host-owned. Compare Telegram/Slack/Teams packs, which normalize bot platform webhooks for agent tools.

**Pack owns:** outbound REST via photon-rest-proxy (`ImessageClient` + tools).  
**Host owns:** inbound webhook HTTP, signature/secret handling, and durable turn/outbox.

## Auth

```ts
{
  base_url: string          // proxy origin, e.g. https://photon-proxy.example.com
  project_id: string        // → x-spectrum-project-id
  project_secret: string    // → x-spectrum-project-secret
  phone?: string            // optional default multi-line phone
}
```

## Tools

| id | Proxy |
| --- | --- |
| `imessage-send-text` | `POST /v1/send` |
| `imessage-edit-text` | `POST /v1/edit` |
| `imessage-send-chat-action` | `POST /v1/typing` (start) |
| `imessage-set-reaction` | `POST /v1/react` (returns **reaction** `message_id`) |
| `imessage-clear-reaction` | `POST /v1/clear-reaction` (unsend that reaction message) |
| `imessage-unsend` | `POST /v1/unsend` |
| `imessage-read` | `POST /v1/read` |
| `imessage-send-media` | `POST /v1/media` |
| `imessage-download-file` | `POST /v1/download` |

`chat_id` is the Spectrum **space id** (e.g. `any;-;+15551111111`).

### Reactions

Spectrum models a reaction as its own Message. `setReaction` returns that reaction’s `message_id`. Pass **that** id to `clearReaction` (not the id of the message that was reacted to).

### Media and download

- `sendMedia` sends base64 bytes as a Spectrum `attachment` (optional caption as follow-up text).
- `downloadFile` needs both `chat_id` (space) and `file_id` (attachment/voice **message** id from inbound).

## Channel parity

| Verb | Telegram | Slack | Teams | iMessage (proxy) |
| --- | --- | --- | --- | --- |
| sendMedia | yes | yes | yes | yes |
| downloadFile | yes | yes | yes | yes |
| clearReaction | empty reaction list | emoji required | successful no-op | unsend reaction message id |

## Bind

```ts
import { ImessageClient, imessageModule } from '@harryy/ai-tools/imessage'
import { withAuth } from '@harryy/ai-tools/core'

const client = new ImessageClient({
  base_url: 'https://photon-proxy.example.com',
  project_id: process.env.SPECTRUM_PROJECT_ID!,
  project_secret: process.env.SPECTRUM_PROJECT_SECRET!,
})

await client.sendText({
  chat_id: 'any;-;+15551111111',
  text: 'hello',
})

const reaction = await client.setReaction({
  chat_id: 'any;-;+15551111111',
  message_id: 'target-msg',
  emoji: '❤️',
})
// later: await client.clearReaction({ chat_id, message_id: reaction.message_id! })

withAuth(imessageModule, { /* same auth */ })
```

## Messaging seam

```ts
withAuth(messagingModule, {
  provider: 'imessage',
  base_url: 'https://photon-proxy.example.com',
  project_id: '…',
  project_secret: '…',
})
```

Messaging `downloadFile` has no `chat_id` field — pass `file_id` as `space_id::message_id` (double colon). Messaging `clearReaction` must receive the **reaction** message id (same Spectrum rule). Prefer vendor tools when you need full iMessage shapes.

## Live progressive text

Use `createLiveMessage` with `isImessageDefiniteRejection` / `isImessageOutcomeUnknown`.
