# iMessage (photon-rest-proxy)

| | |
| --- | --- |
| **Import** | `@5ss/ai-tools/imessage` |
| **Kind** | **vendor** (`src/vendors/imessage`) |
| **Module id** | `imessage` |
| **Client** | `ImessageClient` |
| **Runtime** | **`both`** (HTTP only — Workers-safe) |
| **Transport** | Hosted **photon-rest-proxy** → Spectrum gRPC (proxy owns Photon/SDK) |

Outbound iMessage goes through your **REST proxy**. This package does **not** embed `@photon-ai/advanced-imessage` or gRPC.

```text
host auth (base_url + project_id + project_secret)
        ↓  HttpService JSON
photon-rest-proxy  /v1/*
        ↓  Spectrum gRPC (inside proxy)
Apple Messages
```

Inbound webhooks stay on the host (no pack `webhook.ts`).

## Auth

```ts
{
  base_url: string          // proxy origin, e.g. https://photon-proxy.example.com
  project_id: string        // x-spectrum-project-id
  project_secret: string    // x-spectrum-project-secret
  phone?: string            // default line when the project has multiple numbers
}
```

## Proxy routes

| Client method | HTTP |
| --- | --- |
| `sendText` | `POST /v1/send` |
| `editText` | `POST /v1/edit` |
| `sendChatAction` / `stopTyping` | `POST /v1/typing` (`action: start\|stop`) |
| `setReaction` | `POST /v1/react` |
| `clearReaction` | `POST /v1/clear-reaction` (**target** `message_id` + `emoji`) |
| `unsend` | `POST /v1/unsend` |
| `read` | `POST /v1/read` |
| `sendMedia` | `POST /v1/media` |
| `downloadFile` | `POST /v1/download` (`file_id`; `space_id` optional) |
| `ensureChat` (host-only) | `POST /v1/ensure-chat` |

Request bodies use `platform: 'imessage'` and `space_id` for the chat guid (except ensure-chat, which sends `addresses`).

### Proxy gaps to fill (package already calls these contracts)

1. **`/v1/ensure-chat`** — create/resolve 1:1 or group; return `{ ok, space_id|chat_id, message_id? }`  
2. **`/v1/clear-reaction`** — clear by **target message_id + emoji** (not reaction message id)  
3. **`/v1/download`** — prefer attachment guid alone (`space_id` optional)  
4. **Stable `message_id`** on send / react / media when Spectrum returns one  

## Tools

| id | Notes |
| --- | --- |
| `imessage-send-text` | Returns required `message_id` |
| `imessage-edit-text` | |
| `imessage-send-chat-action` | Typing start |
| `imessage-set-reaction` | Tapback name or emoji |
| `imessage-clear-reaction` | Same target + emoji as set |
| `imessage-unsend` | |
| `imessage-read` | Whole chat |
| `imessage-send-media` | Base64 body |
| `imessage-download-file` | Attachment guid |

`chat_id` is the iMessage **chat guid** (e.g. `any;-;+15551111111`).

### Host-only: `ensureChat`

```ts
const { chat_id } = await client.ensureChat({ addresses: ['+15551234567'] })
```

## Bind

```ts
import { ImessageClient, imessageModule } from '@5ss/ai-tools/imessage'
import { withAuth } from '@5ss/ai-tools/core'

const client = new ImessageClient({
  base_url: process.env.IMESSAGE_PROXY_URL!,
  project_id: process.env.IMESSAGE_PROJECT_ID!,
  project_secret: process.env.IMESSAGE_PROJECT_SECRET!,
})

await client.sendText({
  chat_id: 'any;-;+15551111111',
  text: 'hello',
})

withAuth(imessageModule, {
  base_url: process.env.IMESSAGE_PROXY_URL!,
  project_id: process.env.IMESSAGE_PROJECT_ID!,
  project_secret: process.env.IMESSAGE_PROJECT_SECRET!,
})
```

## Live IT env

| Env | Role |
| --- | --- |
| `AI_TOOLS_IMESSAGE_BASE_URL` (or `AI_TOOLS_IMESSAGE_PROXY_URL`) | Proxy origin |
| `AI_TOOLS_IMESSAGE_PROJECT_ID` / `PROJECT_SECRET` | Spectrum headers |
| `AI_TOOLS_IMESSAGE_CHAT_ID` | Chat guid for smoke |
| `AI_TOOLS_IMESSAGE_PHONE` | Optional multi-line |
| `AI_TOOLS_IMESSAGE_FILE_ID` | Optional download smoke |

Seam: [messaging](../modules/messaging.md) with `provider: 'imessage'`.
