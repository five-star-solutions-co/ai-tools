# Content Type

| | |
| --- | --- |
| **Import** | `@5ss/ai-tools/content-type` |
| **Module id** | `content-type` |
| **Runtime** | `both` |
| **Auth** | **none** |
| **Library** | [`mime`](https://www.npmjs.com/package/mime) (mime-db) |

Content type ↔ file extension lookup. **Not** email message parse/build — those are in [email-message](./email-message.md).

## Install / import

```ts
import {
  contentTypeModule,
  contentTypeGetTool,
  contentTypeExtensionTool,
  contentTypeExtensionsTool
} from '@5ss/ai-tools/content-type'
```

No `withAuth` required.

## Tools

### `content-type-get` (`getContentType`) — sideEffect `none`

| Input | Notes |
| --- | --- |
| `path` | File path, filename, or extension (`report.pdf`, `pdf`, `.txt`) |

| Output | Notes |
| --- | --- |
| `media_type` | Content type string or `null` when unknown |

### `content-type-extension` (`getContentTypeExtension`) — sideEffect `none`

| Input | Notes |
| --- | --- |
| `media_type` | Content type; charset ignored |

| Output | Notes |
| --- | --- |
| `extension` | Preferred extension without leading dot, or `null` |

### `content-type-extensions` (`getContentTypeExtensions`) — sideEffect `none`

Same input as `content-type-extension`. Returns `extensions: string[]` (all known aliases, empty when unknown).

## Shared helpers

Other modules import helpers from the same `mime` package via `src/shared/content-type.ts` — no hand-rolled extension tables.
