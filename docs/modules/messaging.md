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
import { messagingModule, MessagingClient } from '@harryy/ai-tools/messaging'

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

const client = MessagingClient.fromAuth({ provider: 'slack', bot_token: '…' })
await client.sendText({ chat_id: 'C…', text: 'hi' })
```

Teams connector calls require `service_url` on method inputs (from the inbound activity).  
iMessage `chat_id` is the Spectrum **space id**; outbound goes through photon-rest-proxy (Workers-safe HTTP).

### Provider gaps / quirks

| Verb | Telegram | Slack | Teams | iMessage |
| --- | --- | --- | --- | --- |
| sendMedia | yes | yes | yes | yes (`/v1/media`) |
| sendMediaBatch | native group when homogeneous 2–10 photos or documents; else sequential | sequential | sequential | sequential |
| downloadFile | yes | yes | yes | prefer `chat_id` + attachment `file_id`; legacy `space_id::message_id` still accepted |
| setReaction | yes (empty output) | yes (empty output) | yes (empty output) | returns reaction `message_id` for clear |
| clearReaction | empty list | emoji required | successful no-op | unsend reaction message id from setReaction |
| stopTyping | no-op | no-op | no-op | yes |
| read | warn + no-op | warn + no-op | warn + no-op | inbound message id only |
| unsend | warn + no-op | warn + no-op | warn + no-op | yes |

Host owns durable claims, authz, journaling of returned ids, and Teams OneDrive/R2 attachment paths that are not pure channel verbs.

## Tools

| id | Method |
| --- | --- |
| `messaging-send-text` | `sendText` |
| `messaging-edit-text` | `editText` |
| `messaging-send-chat-action` | `sendChatAction` |
| `messaging-stop-typing` | `stopTyping` |
| `messaging-set-reaction` | `setReaction` |
| `messaging-clear-reaction` | `clearReaction` |
| `messaging-send-media` | `sendMedia` |
| `messaging-send-media-batch` | `sendMediaBatch` |
| `messaging-download-file` | `downloadFile` |
| `messaging-answer-callback` | `answerCallback` |
| `messaging-read` | `read` |
| `messaging-unsend` | `unsend` |

## Progressive text

```ts
import { createLiveMessage, MessagingClient } from '@harryy/ai-tools/messaging'
import { isTelegramDefiniteRejection, isTelegramOutcomeUnknown } from '@harryy/ai-tools/telegram'

const client = MessagingClient.fromAuth({ provider: 'telegram', bot_token: '…' })
const live = createLiveMessage({
  sendText: (text) => client.sendText({ chat_id, text }),
  editText: (message_id, text) => client.editText({ chat_id, message_id, text }),
  isDefiniteRejection: isTelegramDefiniteRejection,
  isOutcomeUnknown: isTelegramOutcomeUnknown,
})
```

Use the matching vendor failure helpers for Slack / Teams / iMessage when bound to those providers.
