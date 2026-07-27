# @harryy/ai-tools wiki

Documentation hub. Root [README](../README.md) is the short entry point; this tree is the full map.

## Start here

| Page | Purpose |
| --- | --- |
| [Getting started](./guides/getting-started.md) | Install, import map, first bound pack |
| [Auth and binding](./guides/auth-and-binding.md) | Host-owned secrets, `withAuth`, model-facing rules |
| [Adapters](./guides/adapters.md) | Project kernel tools into frameworks |
| [Authoring packs](./guides/authoring-modules.md) | modules vs vendors, layout, scaffold, codegen |
| [Errors](./guides/errors.md) | `ToolError` codes and retry signals |
| [Versioning](./versioning.md) | semantic-release + conventional commits |
| [Changelog](../CHANGELOG.md) | Released notes |
| [Repo review / gap backlog](./handoffs/repo-review-standards-and-gaps.md) | Standards dump + G-task backlog (not an architecture lock) |
| [Working inventory](./roadmap/package-surface-working.md) | Delivery status board |
| [Document plane](./specs/document-plane.md) | Locked reader, builder, edit, and explicit-converter product scope |

**Authority when docs disagree:** `AGENTS.md` → shipped code + gold files → specs (`provider-seam`, http/aws) → pack docs → architecture + working roadmap.

## Brain

| Import | Doc |
| --- | --- |
| `@harryy/ai-tools/core` | [core](./packages/core.md) |
| `@harryy/ai-tools/http` | [HttpService / AwsService](./reference/http-and-aws-services.md) |
| `@harryy/ai-tools/mastra` | [mastra](./packages/mastra.md) |
| `@harryy/ai-tools/ai-sdk` | [ai-sdk](./packages/ai-sdk.md) |
| `@harryy/ai-tools/tanstack` | [tanstack](./packages/tanstack.md) |
| `@harryy/ai-tools/cloudflare` | [cloudflare](./packages/cloudflare.md) |
| `@harryy/ai-tools/mcp` | [mcp](./packages/mcp.md) |

## Seams (`src/modules/`)

Capability modules we own. Multi-provider seams take `{ provider, … }` on host auth.

| Import | Doc |
| --- | --- |
| `@harryy/ai-tools/email` | [email](./modules/email.md) — providers: `resend`, `cloudflare` |
| `@harryy/ai-tools/messaging` | [messaging](./modules/messaging.md) — providers: `telegram`, `slack`, `teams`, `imessage` |

| `@harryy/ai-tools/files` | [files](./modules/files.md) — path root over storage |
| `@harryy/ai-tools/document-extract` | [document-extract](./modules/document-extract.md) — `textract` |
| `@harryy/ai-tools/document-render` | [document-render](./modules/document-render.md) — `gotenberg`, `cloudflare-browser` |
| `@harryy/ai-tools/code-sandbox` | [code-sandbox](./modules/code-sandbox.md) — `cloudflare`, `bedrock-agentcore` |
| `@harryy/ai-tools/file-convert` | [file-convert](./modules/file-convert.md) — Gotenberg `office-to-pdf` |
| `@harryy/ai-tools/document` | [document](./modules/document.md) — read / build / edit text, documents, presentations, and spreadsheets |
| `@harryy/ai-tools/web-fetch` | [web-fetch](./modules/web-fetch.md) |
| `@harryy/ai-tools/vector-store` | [vector-store](./modules/vector-store.md) — providers: `qdrant`, `pinecone`, `supabase`, `mastra` |
| `@harryy/ai-tools/rag` | [rag](./modules/rag.md) — chunk + host embed route + nested vector-store |
| `@harryy/ai-tools/email-message` | [email-message](./modules/email-message.md) — pure MIME |
| `@harryy/ai-tools/content-type` | [content-type](./modules/content-type.md) — pure type ↔ extension |
| `@harryy/ai-tools/skills` | [skills](./modules/skills.md) — portable skill catalog (list/get/search) |
| `@harryy/ai-tools/pdf` | [pdf](./modules/pdf.md) |
| `@harryy/ai-tools/image` | [image](./modules/image.md) |
| `@harryy/ai-tools/crypto` | [crypto](./modules/crypto.md) |
| `@harryy/ai-tools/calendar` | [calendar](./modules/calendar.md) |
| `@harryy/ai-tools/queue` | [queue](./modules/queue.md) — provider: `sqs` |
| `@harryy/ai-tools/browser` | [browser](./modules/browser.md) — providers: `bedrock-agentcore`, `cloudflare` |

## Vendors (`src/vendors/`)

3rd-party packs. Full product API; class client + tools. Flat import (no `/vendors/` in path).

| Import | Doc |
| --- | --- |
| `@harryy/ai-tools/resend` | [resend](./vendors/resend.md) |
| `@harryy/ai-tools/cloudflare-email` | [cloudflare-email](./vendors/cloudflare-email.md) |
| `@harryy/ai-tools/telegram` | [telegram](./vendors/telegram.md) |
| `@harryy/ai-tools/slack` | [slack](./vendors/slack.md) |
| `@harryy/ai-tools/teams` | [teams](./vendors/teams.md) |
| `@harryy/ai-tools/imessage` | [imessage](./vendors/imessage.md) — via photon-rest-proxy |
| `@harryy/ai-tools/s3` | [s3](./vendors/s3.md) |
| `@harryy/ai-tools/sqs` | [sqs](./vendors/sqs.md) |

| `@harryy/ai-tools/qdrant` | [qdrant](./vendors/qdrant.md) |
| `@harryy/ai-tools/pinecone` | [pinecone](./vendors/pinecone.md) |
| `@harryy/ai-tools/supabase-vector` | [supabase-vector](./vendors/supabase-vector.md) — pgvector |
| `@harryy/ai-tools/mastra-vector` | [mastra-vector](./vendors/mastra-vector.md) — `@mastra/pg` PgVector |
| `@harryy/ai-tools/textract` | [textract](./vendors/textract.md) |
| `@harryy/ai-tools/eventbridge-scheduler` | [eventbridge-scheduler](./vendors/eventbridge-scheduler.md) |
| `@harryy/ai-tools/bedrock-agentcore-code-interpreter` | [bedrock-agentcore-code-interpreter](./vendors/bedrock-agentcore-code-interpreter.md) |
| `@harryy/ai-tools/bedrock-agentcore-browser` | [bedrock-agentcore-browser](./vendors/bedrock-agentcore-browser.md) |

| `@harryy/ai-tools/gotenberg` | [gotenberg](./vendors/gotenberg.md) |
| `@harryy/ai-tools/cloudflare-browser` | [cloudflare-browser](./vendors/cloudflare-browser.md) |
| `@harryy/ai-tools/cloudflare-sandbox` | [cloudflare-sandbox](./vendors/cloudflare-sandbox.md) |
| `@harryy/ai-tools/woocommerce` | [woocommerce](./vendors/woocommerce.md) |
| `@harryy/ai-tools/katana` | [katana](./vendors/katana.md) |
| `@harryy/ai-tools/amazon-sp-api` | [amazon-sp-api](./vendors/amazon-sp-api.md) |

### Vertical kits (not published)

| Dir | Used by |
| --- | --- |
| `vendors/_email/` | resend, cloudflare-email (+ email seam) |
| `vendors/_storage/` | s3 (+ nested S3 on files / convert / render) |
| `vendors/_messaging/` | telegram (live message / typing pulse helpers) |
| `vendors/_vector/` | qdrant, pinecone, supabase-vector (+ vector-store seam) |

## Specs and reference

| Doc | Purpose |
| --- | --- |
| [package-surface-architecture](./specs/package-surface-architecture.md) | modules vs vendors layout and import rules |
| [host-integration-kernel](./specs/host-integration-kernel.md) | bind/context/hooks/catalog; not an agent brain |
| [provider-seam](./specs/provider-seam.md) | Multi-provider capability modules |
| [document-plane](./specs/document-plane.md) | Reader, builder, edit, and explicit-converter product lock |
| [artifacts-extract-convert](./specs/artifacts-extract-convert.md) | ArtifactRef extract / convert / render |
| [http-and-aws-services](./reference/http-and-aws-services.md) | Transport classes |
| [package-surface-working](./roadmap/package-surface-working.md) | Delivery board (working) |
| [integration-tests](./integration-tests.md) | Live vendor + seam tests; Docker + local Supabase ports |

## Mental model

```text
Host app  (agent brain / policy / tenancy — NOT this package)
  ├── owns secrets / vaults / allowlists / confirmation / durable runs
  ├── new VendorClient(auth)          // host DX
  ├── withAuth / bindModule(...)      // closes auth + context into tools
  └── adapter projector               // Mastra | AI SDK | TanStack | CF | MCP | runTool
        └── kernel ToolDefinition     // id, schemas, execute
              └── pack client.fromContext(ctx)
```

- This package is **tool packs + host-integration kernel**, not an agent runtime.
- **Kernel** is the only place tools are authored.
- **Adapters** only project; they never re-implement vendor calls.
- **Auth schemas** are host-facing; model-facing tool inputs never include keys.
- **Codegen** owns package exports for packs under `src/modules|vendors/<key>/` with `index.ts`.
- Auth and domain fields that mirror APIs use **snake_case**.
- Optional **catalog / on-demand discovery** over host-registered tools is in scope; Composio SaaS catalogs are not (see [host-integration-kernel](./specs/host-integration-kernel.md)).

## Contributing

Agent rules: [AGENTS.md](../AGENTS.md). Update docs in the same change as public contract moves.
