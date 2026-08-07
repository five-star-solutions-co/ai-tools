# iMessage (Photon Spectrum Cloud + gRPC)

| | |
| --- | --- |
| **Import** | `@harryy/ai-tools/imessage` |
| **Kind** | **vendor** (`src/vendors/imessage`) |
| **Module id** | `imessage` |
| **Client** | `ImessageClient` |
| **Runtime** | **`node` only** (gRPC — not Workers/edge) |
| **SDK** | [`@photon-ai/advanced-imessage/grpc`](https://github.com/photon-hq/advanced-imessage-ts) `createGrpcClient` |
| **Peers** | `nice-grpc`, `nice-grpc-common`, `@grpc/grpc-js` (optional peers; required for this pack) |

Outbound iMessage aligned with [spectrum-ts cloud auth](https://github.com/photon-hq/spectrum-ts/blob/main/packages/imessage/src/auth.ts): Spectrum Cloud token mint → Photon’s **managed gRPC** hosts. There is **no** public HTTP middleware in Spectrum Cloud.

## Two layers (do not conflate)

| Layer | Role | Credentials |
| --- | --- | --- |
| **Spectrum Cloud** | Mints temporary iMessage tokens | `project_id` + `project_secret` |
| **Advanced iMessage gRPC** | Talks to the iMessage plane | gRPC `address` + temporary bearer |

```text
project_id + project_secret
        ↓  POST https://spectrum.photon.codes/projects/{id}/imessage/tokens
temporary token (+ dedicated instance map)
        ↓  createGrpcClient
shared:  imessage.spectrum.photon.codes:443
dedicated: {instanceId}.imsg.photon.codes:443
        ↓
Apple Messages
```

Inbound can use gRPC event streams on the host, or Spectrum webhooks — this pack does not export `webhook.ts`.

## Auth

### Preferred: Spectrum Cloud

```ts
{
  project_id: string
  project_secret: string
  server?: string                    // required if Spectrum returns multiple dedicated instances
  spectrum_cloud_url?: string        // default https://spectrum.photon.codes
  spectrum_imessage_address?: string // shared gRPC host override (SPECTRUM_IMESSAGE_ADDRESS)
}
```

### Direct gRPC (spectrum-ts `clients[]` shape)

```ts
{
  address: string  // e.g. imessage.spectrum.photon.codes:443
  token: string    // temporary bearer — not project secret
  tls?: boolean    // default true
}
```

## Tools

| id | SDK |
| --- | --- |
| `imessage-send-text` | `messages.sendText` |
| `imessage-edit-text` | `messages.edit` |
| `imessage-send-chat-action` | `chats.setTyping(true)` |
| `imessage-set-reaction` | `messages.setReaction(..., true)` |
| `imessage-clear-reaction` | `messages.setReaction(..., false)` |
| `imessage-unsend` | `messages.unsend` |
| `imessage-read` | `chats.markRead` |
| `imessage-send-media` | `attachments.upload` + `messages.sendAttachment` |
| `imessage-download-file` | `attachments.downloadStream` |

`chat_id` is the iMessage **chat guid** (e.g. `any;-;+15551111111`).

### Host-only: `ensureChat`

```ts
const { chat_id } = await client.ensureChat({ addresses: ['+15551234567'] })
```

## Bind

```ts
import { ImessageClient, imessageModule } from '@harryy/ai-tools/imessage'
import { withAuth } from '@harryy/ai-tools/core'

const client = new ImessageClient({
  project_id: process.env.IMESSAGE_PROJECT_ID!,
  project_secret: process.env.IMESSAGE_PROJECT_SECRET!,
})

await client.sendText({
  chat_id: 'any;-;+15551111111',
  text: 'hello',
})

withAuth(imessageModule, {
  project_id: process.env.IMESSAGE_PROJECT_ID!,
  project_secret: process.env.IMESSAGE_PROJECT_SECRET!,
})
```

## Messaging seam

```ts
withAuth(messagingModule, {
  provider: 'imessage',
  project_id: '…',
  project_secret: '…',
})
```

Messaging `clearReaction` for iMessage **requires** `emoji`.

## Install peers

```bash
bun add nice-grpc nice-grpc-common @grpc/grpc-js
```

## Live progressive text

Use `createLiveMessage` with `isImessageDefiniteRejection` / `isImessageOutcomeUnknown`.
