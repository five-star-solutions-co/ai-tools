# Telegram

| | |
| --- | --- |
| **Import** | `@5ss/ai-tools/telegram` |
| **Kind** | **vendor** (`src/vendors/telegram`) |
| **Module id** | `telegram` |
| **Auth** | Host: `{ bot_token }` |

Telegram Bot API vendor pack. Same layout as Resend / Cloudflare Email: class client + tools. Not a multi-provider messaging seam.

## Bind

```ts
import { telegramModule, TelegramClient, createLiveMessage, withAuth } from '@5ss/ai-tools/telegram'

withAuth(telegramModule, { bot_token: '…' })
const client = new TelegramClient({ bot_token: '…' })
```

## Client methods → tools

| Method | Tool id |
| --- | --- |
| `sendText` | `telegram-send-text` |
| `editText` | `telegram-edit-text` |
| `sendChatAction` | `telegram-send-chat-action` |
| `setReaction` | `telegram-set-reaction` |
| `clearReaction` | `telegram-clear-reaction` |
| `sendMedia` | `telegram-send-media` |
| `sendMediaGroup` | `telegram-send-media-group` |
| `downloadFile` | `telegram-download-file` |
| `answerCallback` | `telegram-answer-callback` |
| `getBot` | `telegram-get-bot` |
| `getWebhookInfo` / `setWebhook` / `deleteWebhook` | client only |

## Helpers

| Export | Role |
| --- | --- |
| `verifyTelegramWebhookSecret` | secret header check |
| `parseTelegramUpdate` | Update → normalized inbound event |
| `createLiveMessage` | progressive `start` / `update` / `finalize` |
| `createTypingPulse` | renew chat action while work runs |
| `isTelegramDefiniteRejection` / `isTelegramOutcomeUnknown` | live-message finalize policy |

## Live progressive text

```ts
const client = new TelegramClient({ bot_token: '…' })
const live = createLiveMessage({
  sendText: (text) => client.sendText({ chat_id, text }),
  editText: (message_id, text) => client.editText({ chat_id, message_id, text }),
  isDefiniteRejection: isTelegramDefiniteRejection,
  isOutcomeUnknown: isTelegramOutcomeUnknown,
})
await live.start('…')
await live.update('…partial…')
const { message_id } = await live.finalize('…final…')
```
