# Email Message

| | |
| --- | --- |
| **Import** | `@5ss/ai-tools/email-message` |
| **Module id** | `email-message` |
| **Runtime** | `both` |
| **Auth** | **none** |
| **Libraries** | `postal-mime` (parse), `mimetext` (build) |

Parse and build RFC 822 / MIME **email messages** **without sending**. Pair with [email](./email.md) when you need delivery.

For **content-type ↔ extension** lookup, use [content-type](./content-type.md) (`@5ss/ai-tools/content-type`).

## Install / import

```ts
import {
  emailMessageModule,
  parseEmailMessageTool,
  buildEmailMessageTool,
} from '@5ss/ai-tools/email-message'
```

No `withAuth` required.

## Tools

### `email-message-parse` (`parseEmailMessage`) — sideEffect `read`

| Input | Notes |
| --- | --- |
| `raw` | Full message string |
| `encoding?` | `utf8` (default) or `base64` |

### `email-message-build` (`buildEmailMessage`) — sideEffect `none`

Build a raw message from from/to/subject/text/html/headers/attachments.
