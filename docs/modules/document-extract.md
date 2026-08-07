# Document Extract

| | |
| --- | --- |
| **Import** | `@5ss/ai-tools/document-extract` |
| **Kind** | multi-provider **seam** (`src/modules/document-extract`) |
| **Module id** | `document-extract` |
| **Auth** | Host union: `provider: 'textract'` (+ more later) |
| **Source** | `ArtifactRef` with `store: 'object'` |

## Tools

| id | sideEffect |
| --- | --- |
| `document-extract-text` | `read` |
| `document-extract-status` | `read` |
| `document-extract-text-batch` | `read` |

## Output modes

| `output` | Behavior |
| --- | --- |
| `inline` (default) | Return full `text`. Fails with `too_large` if over **100k** characters — use `artifact` or `chunks`. |
| `artifact` | Write extracted text to object storage; return `artifact` ArtifactRef (no full text). Optional `destination_key`. |
| `chunks` | Split text into overlapping chunks (`chunk.max_chars` / `overlap`) for RAG handoff; return `chunks[]` (no full text). |

Same `output` options apply to `document-extract-status` and batch.

## Bind (Textract)

```ts
withAuth(documentExtractModule, {
  provider: 'textract',
  access_key_id: '…',
  secret_access_key: '…',
  region: 'us-east-1',
  bucket: 'docs', // AWS S3 bucket Textract can read (also used for artifact output)
  key_prefix?: 'orgs/acme/',
})
```

Textract requires a real AWS S3 object location. Vendor pack: [textract](../vendors/textract.md). Spec: [artifacts-extract-convert](../specs/artifacts-extract-convert.md).
