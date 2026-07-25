# Messaging

| | |
| --- | --- |
| **Import** | `@harryy/ai-tools/messaging` |
| **Kind** | multi-provider **seam** (`src/modules/messaging`) |
| **Module id** | `messaging` |
| **Providers** | `telegram`, `slack`, `teams`, `imessage` |

Shared channel verbs over full vendor packs. Native-only APIs stay on the vendor packs ([telegram](../vendors/telegram.md), [slack](../vendors/slack.md), [teams](../vendors/teams.md), [imessage](../vendors/imessage.md)).

## Bind

```ts
import { withAuth } from '@harryy/ai-tools/core'
import {
  messagingModule,
  MessagingClient,
  isMessagingDefiniteRejection,
  isMessagingOutcomeUnknown,
} from '@harryy/ai-tools/messaging'

withAuth(messagingModule, { provider: 'telegram', bot_token: '…' })
withAuth(messagingModule, { provider: 'slack', bot_token: 'xoxb-…' })
withAuth(messagingModule, {
  provider: 'teams',
  app_id: '…',
  app_password: '…',
})
withAuth(messagingModule, {
  provider: 'imessage',
  base_url: 'https://photon-proxy.example.com',
  project_id: '…',
  project_secret: '…',
})

// Optional nested S3 for ArtifactRef media (send source / download destination_key)
withAuth(messagingModule, {
  provider: 'telegram',
  bot_token: '…',
  storage: {
    access_key_id: '…',
    secret_access_key: '…',
    region: 'auto',
    bucket: 'media',
  },
})

const client = MessagingClient.fromAuth({ provider: 'slack', bot_token: '…' })
await client.sendText({ chat_id: 'C…', text: 'hi' })
```

Teams connector calls require `service_url` on method inputs (from the inbound activity).  
iMessage `chat_id` is the Spectrum **space id**; outbound goes through **photon-rest-proxy** REST (`/v1/send`, `/v1/react`, …). A host that only exposes `/v1/imessage/execute` is not a drop-in `base_url`.

### Media bytes

| Path | Send | Download |
| --- | --- | --- |
| Small / host already has bytes | `body_base64` | returns `body_base64` |
| Large / keep bytes out of the model | `source: { store: 'object', key }` + auth `storage` | `destination_key` + auth `storage` → returns `artifact` |

Exactly one of `body_base64` or `source` on send. `source.store` must be `object`. Host-owned keys (`store: 'host'`) are not resolved by this pack.

### Provider gaps / quirks

| Verb | Telegram | Slack | Teams | iMessage |
| --- | --- | --- | --- | --- |
| sendMedia | yes | yes | yes | yes (`/v1/media`); **requires** `message_id` (never falls back to space id) |
| sendMediaBatch | native group when homogeneous 2–10 photos or documents; else sequential | sequential | sequential | sequential |
| downloadFile | yes | yes | yes | prefer `chat_id` + attachment `file_id`; legacy `space_id::message_id` still accepted |
| setReaction | yes (empty output) | yes (empty output) | **presentation no-op** (Bot Framework has no bot reaction API; host may use Graph) | returns reaction `message_id` for clear |
| clearReaction | empty list | emoji required | **presentation no-op** | unsend reaction message id from setReaction |
| sendChatAction / stopTyping | typing / no-op stop | **assistant.threads.setStatus** when `reply_to_message_id` = thread_ts; else no-op; stop clears status | typing / no-op stop | real typing start/stop |
| read | intentional no-op | intentional no-op | intentional no-op | inbound message id only |
| unsend | **not on seam** — use [imessage](../vendors/imessage.md) vendor | same | same | vendor only |

**Batch:** max **10** items (`MAX_MESSAGING_MEDIA_BATCH`). Hosts needing more must chunk. Sequential batches may return **partial** success (`results`); replaying the whole batch after a mid-batch failure can duplicate earlier items — hosts should retry only failed indexes or use their own durable claim strategy.

Host owns durable claims, authz, journaling of returned ids, Teams OneDrive/R2 attachment paths, and any Graph reaction path beyond the Teams presentation no-ops. For Slack busy UI, pass the thread root ts as `reply_to_message_id` on `sendChatAction` / `stopTyping`. Message delete/unsend is **not** a seam verb — use the channel vendor (iMessage `unsend`).

## Failure classification

```ts
import {
  isMessagingDefiniteRejection,
  isMessagingOutcomeUnknown,
} from '@harryy/ai-tools/messaging'

try {
  await client.sendText({ chat_id, text })
} catch (error) {
  if (isMessagingOutcomeUnknown(error)) {
    // Do not assume non-delivery; retry may duplicate.
  } else if (isMessagingDefiniteRejection(error)) {
    // Safe to treat as not delivered.
  }
}
```

Transport network/abort failures on the messaging vendors are rethrown as the matching `*ClientError` with `failure_kind: outcome_unknown` so these helpers work without per-provider switches.

## Tools

| id | Method |
| --- | --- |
| `messaging-send-text` | `sendText` |
| `messaging-edit-text` | `editText` |
| `messaging-send-chat-action` | `sendChatAction` |
| `messaging-stop-typing` | `stopTyping` |
| `messaging-set-reaction` | `setReaction` |
| `messaging-clear-reaction` | `clearReaction` |
| `messaging-send-media` | `sendMedia` (`body_base64` **or** `source` ArtifactRef) |
| `messaging-send-media-batch` | `sendMediaBatch` |
| `messaging-download-file` | `downloadFile` (`body_base64` **or** `artifact` via `destination_key`) |
| `messaging-answer-callback` | `answerCallback` |
| `messaging-read` | `read` |

## Progressive text

```ts
import {
  createLiveMessage,
  MessagingClient,
  isMessagingDefiniteRejection,
  isMessagingOutcomeUnknown,
} from '@harryy/ai-tools/messaging'

const client = MessagingClient.fromAuth({ provider: 'telegram', bot_token: '…' })
const live = createLiveMessage({
  sendText: (text) => client.sendText({ chat_id, text }),
  editText: (message_id, text) => client.editText({ chat_id, message_id, text }),
  isDefiniteRejection: isMessagingDefiniteRejection,
  isOutcomeUnknown: isMessagingOutcomeUnknown,
})
```
