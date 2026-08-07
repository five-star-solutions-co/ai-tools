# Amazon Textract

| | |
| --- | --- |
| **Import** | `@5ss/ai-tools/textract` |
| **Kind** | **vendor** (`src/vendors/textract`) |
| **Module id** | `textract` |
| **Client** | `TextractClient` |
| **Transport** | AwsService (Textract + S3 object location) |

Async document text detection. Source object must live in **AWS S3** (Textract `S3Object`).

## Auth

```ts
{
  access_key_id: string
  secret_access_key: string
  region: string
  bucket: string
  session_token?: string
  poll_timeout_ms?: number   // default 60000
  poll_interval_ms?: number
}
```

## Tools

| id | sideEffect |
| --- | --- |
| `textract-extract-text` | `read` |
| `textract-get-status` | `read` |
| `textract-extract-text-batch` | `read` |

`extract-text` starts a job and polls until done, failed, or timeout → `pending` + `job_id` (then use status).

## Bind

```ts
import { TextractClient, textractModule } from '@5ss/ai-tools/textract'
import { withAuth } from '@5ss/ai-tools/core'

new TextractClient({
  access_key_id: '…',
  secret_access_key: '…',
  region: 'us-east-1',
  bucket: 'docs',
})

withAuth(textractModule, { /* same */ })
```

Seam: [document-extract](../modules/document-extract.md) with `provider: 'textract'`.
