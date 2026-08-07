# Cloudflare Email

| | |
| --- | --- |
| **Import** | `@5ss/ai-tools/cloudflare-email` |
| **Kind** | **vendor** (`src/vendors/cloudflare-email`) — not an email multi-provider seam |
| **Module id** | `cloudflare-email` |
| **Client** | `CloudflareEmailClient` |
| **Tools** | `cloudflare-email-send`, `cloudflare-email-send-batch` |

**Cloudflare Email Sending** vendor pack: host class client + agent tools on the same implementation. Mapped surface today is **send only**.

### Mapped vs not mapped

| Mapped (this pack) | Not mapped (use Cloudflare API / host / later) |
| --- | --- |
| Send one email | Domains / routing / DNS setup |
| Send batch (max 20) | Receiving / workers email routing, lists, analytics |
| | Full Email Routing / Email Security product surface |

Seam with shared send verbs: [email](../modules/email.md).

## Host (class client)

```ts
import { CloudflareEmailClient } from '@5ss/ai-tools/cloudflare-email'

const email = new CloudflareEmailClient({
  account_id: process.env.CF_ACCOUNT_ID!,
  api_token: process.env.CF_API_TOKEN!,
})

await email.send({
  to: 'user@example.com',
  from: { email: 'noreply@yourdomain.com', name: 'App' },
  subject: 'Hello',
  text: 'Plain body',
  html: '<p>HTML body</p>',
  reply_to: 'support@yourdomain.com',
})

await email.sendBatch({ messages: [/* up to 20 */] })
```

Optional injectables: `new CloudflareEmailClient(auth, { fetch, signal })`.

## Agent (module + tools)

```ts
import { withAuth } from '@5ss/ai-tools/core'
import { cloudflareEmailModule, cloudflareEmailSendTool } from '@5ss/ai-tools/cloudflare-email'
import { createMastraTools } from '@5ss/ai-tools/mastra'

const bound = withAuth(cloudflareEmailModule, {
  account_id: '…',
  api_token: '…',
})

const tools = createMastraTools(bound)
// withAuthTool(cloudflareEmailSendTool, auth)
```

Tools only call `CloudflareEmailClient.fromContext(ctx)` — no HTTP in `module.ts`.

## Auth (host-bound)

```ts
{ account_id: string, api_token: string }
```

Never on tool inputs.

## API

| Client method | HTTP |
| --- | --- |
| `send` | `POST /accounts/{account_id}/email/sending/send` |
| `sendBatch` | N × `send` via `runBatchItems` (partial failure OK) |

Payload uses Cloudflare REST field names (`replyTo` camelCase, attachments `{ content, filename, type, disposition?, contentId? }`). Domain input stays snake_case (`reply_to`, `content_id`) for host/tool consistency with other email packs. Optional `content_id` on attachments enables HTML `cid:…` inline images (pair with `disposition: 'inline'`).

## Email vertical (`vendors/_email`)

Address schemas, size/recipient limits, and address formatting live in **`src/vendors/_email/`** (not published; skipped by codegen). Any email vendor pack reuses it. Not in `shared/`.

## Layout

```text
vendors/_email/              # vertical kit (underscore = not a pack)
  schemas.ts · address.ts · limits.ts · index.ts
vendors/cloudflare-email/
  contracts.ts · domain.ts · client.ts · module.ts · index.ts
```

Seam: [email](../modules/email.md).
