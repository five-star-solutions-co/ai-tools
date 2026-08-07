# Email

| | |
| --- | --- |
| **Import** | `@5ss/ai-tools/email` |
| **Kind** | multi-provider **seam** (`src/modules/email`) |
| **Module id** | `email` |
| **Providers** | `resend`, `cloudflare` |
| **Tools** | `email-send`, `email-send-batch` |

Thin **send/batch only** seam over [Resend](../vendors/resend.md) and [Cloudflare Email](../vendors/cloudflare-email.md). Domains, templates, receiving, webhooks, and other ESP APIs are **not** on this seam (and mostly not on the vendor packs yet — see each vendor’s mapped table).

## Bind

```ts
import { withAuth } from '@5ss/ai-tools/core'
import { emailModule } from '@5ss/ai-tools/email'
import { createMastraTools } from '@5ss/ai-tools/mastra'

const bound = withAuth(emailModule, {
  provider: 'resend',
  api_key: '…',
  sender: { email: 'orbit@domain.com', name: 'Orbit' },
})
// or
withAuth(emailModule, {
  provider: 'cloudflare',
  account_id: '…',
  api_token: '…',
  sender: { email: 'orbit@domain.com', name: 'Orbit' },
})

const tools = createMastraTools(bound)
```

For host DX without the seam, use the vendor clients directly: [ResendClient](../vendors/resend.md), [CloudflareEmailClient](../vendors/cloudflare-email.md).

## Tools

| id | sideEffect |
| --- | --- |
| `email-send` | `send` |
| `email-send-batch` | `send` |

The model supplies recipients, subject, html/text, reply-to, and optional
attachments. `from` and raw headers are not model inputs. The required
auth-bound `sender` is injected by `EmailClient` and cannot be overridden.

Seam delivery errors use the provider-neutral message
`Email delivery was rejected`. The original provider error remains attached as
the internal `cause` for host telemetry. Raw vendor clients keep their required
`from` inputs and native errors.

Max 5 MiB; batch max 20.
