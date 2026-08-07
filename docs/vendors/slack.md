# Slack

| | |
| --- | --- |
| **Import** | `@5ss/ai-tools/slack` |
| **Kind** | **vendor** (`src/vendors/slack`) |
| **Module id** | `slack` |
| **Auth** | Host: `{ bot_token }` |

Slack Web API vendor pack. Same layout as Telegram / Resend: class client + tools. Not a multi-provider messaging seam.

## Bind

```ts
import { slackModule, SlackClient, createLiveMessage, withAuth } from '@5ss/ai-tools/slack'

withAuth(slackModule, { bot_token: 'xoxb-…' })
const client = new SlackClient({ bot_token: 'xoxb-…' })
```

## Client methods → tools

| Method | Tool id | Web API |
| --- | --- | --- |
| `sendText` | `slack-send-text` | `chat.postMessage` |
| `editText` | `slack-edit-text` | `chat.update` |
| `sendChatAction` | `slack-send-chat-action` | `assistant.threads.setStatus` when `reply_to_message_id` is thread_ts; else no-op |
| `stopTyping` | client only (seam: `messaging-stop-typing`) | `assistant.threads.setStatus` with empty status when thread_ts set |
| `setReaction` | `slack-set-reaction` | `reactions.add` |
| `clearReaction` | `slack-clear-reaction` | `reactions.remove` (emoji required) |
| `sendMedia` | `slack-send-media` | `files.getUploadURLExternal` + PUT + `files.completeUploadExternal` |
| `downloadFile` | `slack-download-file` | `files.info` + GET `url_private_download` |
| `answerCallback` | `slack-answer-callback` | POST `response_url` when id is https URL |
| `getBot` | `slack-get-bot` | `auth.test` |
| `postEphemeral` | client only | `chat.postEphemeral` |
| `listConversations` | client only | `conversations.list` |
| `setAssistantStatus` | client only | full `assistant.threads.setStatus` (+ `loading_messages`) |
| `setSuggestedPrompts` | client only | `assistant.threads.setSuggestedPrompts` |
| `publishHome` | client only | `views.publish` |
| `startStream` / `appendStream` / `stopStream` | client only | `chat.*Stream` |
| `authRevoke` | client only | `auth.revoke` |
| `usersInfo` | client only | `users.info` |
| `usersConversations` | client only | `users.conversations` |
| `conversationsInfo` / `History` / `Replies` | client only | authorized reference reads |
| `sendMediaBatch` | client only | multi-file external upload (one complete) |
| `downloadFileBytes` | client only | same as download without base64 |

Host media may pass `body: Uint8Array` instead of `body_base64` on `sendMedia` / `sendMediaBatch`.

## Helpers

| Export | Role |
| --- | --- |
| `verifySlackRequestSignature` | HMAC-SHA256 `v0:{ts}:{body}` vs `X-Slack-Signature` |
| `parseSlackEvent` | Events API / interactive body → normalized inbound event or challenge |
| `extractSlackUserMentions` / `extractSlackChannelRefs` | parse mrkdwn references |
| `formatSlackUserMention` / `formatSlackChannelRef` / `formatSlackMessagePermalink` | build mrkdwn / archive URLs |
| `stripLeadingSlackBotMention` / `slackMrkdwnToPlainText` | inbound text cleanup |
| `createLiveMessage` | progressive `start` / `update` / `finalize` |
| `createTypingPulse` | renew chat action while work runs |
| `isSlackDefiniteRejection` / `isSlackOutcomeUnknown` | live-message finalize policy |

## Live progressive text

```ts
const client = new SlackClient({ bot_token: '…' })
const live = createLiveMessage({
  sendText: (text) => client.sendText({ chat_id, text }),
  editText: (message_id, text) => client.editText({ chat_id, message_id, text }),
  isDefiniteRejection: isSlackDefiniteRejection,
  isOutcomeUnknown: isSlackOutcomeUnknown,
})
await live.start('…')
await live.update('…partial…')
const { message_id } = await live.finalize('…final…')
```

## Webhooks

```ts
import { parseSlackEvent, verifySlackRequestSignature } from '@5ss/ai-tools/slack'

const ok = verifySlackRequestSignature({
  signing_secret,
  raw_body,
  timestamp: req.headers.get('x-slack-request-timestamp') ?? '',
  signature: req.headers.get('x-slack-signature') ?? '',
})

const parsed = parseSlackEvent(JSON.parse(raw_body))
if (parsed.ok && 'challenge' in parsed) {
  // url_verification — return parsed.challenge to Slack
}
if (parsed.ok && 'event' in parsed) {
  // route parsed.event (channel: 'slack')
}
```

## Auth

`{ bot_token: string }` — host-bound only (never tool input). Authorization header: `Bearer ${bot_token}`.

## Layout (gold vendor)

```text
contracts.ts · domain.ts · client.ts · module.ts · webhook.ts · index.ts
```

Messaging vertical kit: `src/vendors/_messaging/`.
