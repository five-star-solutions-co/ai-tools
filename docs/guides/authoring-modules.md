# Authoring packs (modules and vendors)

## Two roots

| Root | Use when | Public import |
| --- | --- | --- |
| `src/modules/<key>/` | **Seam we own** (multi-provider or pure helpers) | `@harryy/ai-tools/<key>` |
| `src/vendors/<key>/` | **3rd-party product** full pack | `@harryy/ai-tools/<key>` |

Underscore kits (`src/vendors/_email/`, `_storage/`, `_messaging/`) are **not** packs: codegen skips them; they are only shared helpers for packs in that vertical.

## Layout (same shape both roots)

```text
src/modules|vendors/<kebab-key>/
  contracts.ts    # Zod I/O + auth schema
  domain.ts       # optional preflight / parse (no HTTP)
  client.ts       # public class client (HttpService / AwsService)
  providers/      # modules only: multi-provider ops
  webhook.ts      # chat vendors only: verify + parse
  module.ts       # defineModule + defineTool → client
  index.ts        # public re-exports (codegen entry)
test/modules|vendors/<kebab-key>.test.ts
docs/modules/<kebab-key>.md   # seams only
docs/vendors/<kebab-key>.md   # vendor packs only
```

Folder name = package subpath. Gold vendor: `src/vendors/resend/` + `docs/vendors/resend.md`. Gold seam: `src/modules/email/` + `docs/modules/email.md`.

## Scaffold

```bash
bun run new-module weather --title "Weather" --description "Forecast tools." --auth none
# or --auth custom
```

Creates sources + test under **modules**, formats, runs codegen. For a vendor pack, copy `src/vendors/resend/` and rename.

## Vendor client + tools pattern

```ts
// client.ts
export class ResendClient {
  constructor(auth: ResendAuth, options: ResendClientOptions = {}) { /* HttpService */ }
  static fromContext(ctx: ToolContext): ResendClient { /* requireAuth */ }
  async send(input: ResendSendInput): Promise<ResendSendOutput> {
    const payload = preflightSend(input)
    const { data } = await this.#http.post('/emails', payload, { label: 'Resend send' })
    return parseSendResult(data)
  }
}

// module.ts
export const resendSendTool = defineTool({
  id: 'resend-send',
  name: 'resendSend',
  // …
  execute: async (input, ctx) => ResendClient.fromContext(ctx).send(input),
})
```

## Contracts checklist

- Tool `id`: stable **kebab-case**. Vendors: vendor-prefixed (`telegram-send-text`). Seams: capability-prefixed (`messaging-send-text`).
- `description` and input `.describe()`: **model selection and argument filling only** (what / when / bounds).
- **Seams: no vendor brand names** in tool or module descriptions (no Telegram/Slack/Resend/S3/…). Use channel / bound store language. See AGENTS **R7b**.
- **Vendors:** product name OK; still no secrets/env/vault language.
- Auth and domain fields: **snake_case**.
- `runtime`: honest (`node` | `edge` | `both`).
- `sideEffect`: `none` | `read` | `write` | `delete` | `send`.
- Prefer `HttpService` / `AwsService` (no raw fetch loops).
- Prefer `es-toolkit` for object/list helpers.
- Fail with `ToolError` and stable codes; never leak secrets.
- Tests mock network; do not require live keys for `bun run check`.

## Forbidden

- Dynamic `/${method}` routers or dual json/form helpers on ofetch.
- Secrets on tool inputs.
- Hand-editing codegen-owned exports / tsdown / module-keys / manifest.
- Putting fat single-vendor APIs under `modules/` as fake multi-provider seams.
- Shared dumpster in `shared/` for vendor-vertical helpers (use `vendors/_…` kits).

## Codegen ownership

Do **not** hand-edit:

- `package.json` → `exports` (pack entries)
- `tsdown.config.ts` entry map
- `generated/module-manifest.json`
- `src/generated/module-keys.ts`

Run `bun run codegen` (also part of `build`). `codegen:check` fails CI on drift.

## Docs

When adding or changing a pack, update:

1. Seam → `docs/modules/<key>.md`; vendor → `docs/vendors/<key>.md`
2. `docs/README.md` tables
3. Root `README.md` subpath tables
4. `CHANGELOG.md` under Unreleased when public
