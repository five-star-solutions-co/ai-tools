# Spec: Artifacts, document extract, document render

Status: **locked for implementation**  
Package: `@5ss/ai-tools`

## Goals

- Keep **file bytes out of the LLM**. Tools pass **ArtifactRef** only.
- **One path** for all sizes (no small/large tiers).
- **Reuse** object-storage concepts and the package transport stack.
- Extract via **AWS Textract**. HTML/URL print via **document-render** (Cloudflare Browser).

## ArtifactRef

```ts
{
  store: 'object' | 'host'
  key: string
  media_type?: string
  filename?: string
  byte_length?: number
}
```

| Field | Meaning |
| --- | --- |
| `store` | Who owns bytes. **`object`** = bound object store (S3-compatible keys for extract/render). **`host`** reserved for host-mapped keys. |
| `key` | Object key in the bound bucket (or host id later). |
| `media_type` | Optional hint (extension or sniffed). Tools may fill if missing. |
| `filename` | Optional display name. |
| `byte_length` | Optional size hint. |

Mime: prefer object head / `Content-Type`; otherwise filename extension; otherwise leave unset.

## Document extract (`@5ss/ai-tools/document-extract`)

**Backend:** AWS Textract via **aws4fetch** (no Node PDF libraries).

### Tools

| Tool id | sideEffect | Behavior |
| --- | --- | --- |
| `document-extract-text` | `read` | Start extract, **poll internally** until done or `poll_timeout_ms`. |
| `document-extract-status` | `read` | Check Textract `job_id`; return text when ready. |

### `document-extract-text` result shapes

**Completed within timeout:**

```ts
{
  status: 'succeeded'
  job_id: string
  text: string
  page_count?: number
  source: ArtifactRef
}
```

**Still running after timeout (acknowledged):**

```ts
{
  status: 'pending'
  job_id: string
  text?: undefined
  source: ArtifactRef
}
```

**Failed:**

```ts
{
  status: 'failed'
  job_id?: string
  error: string
  source: ArtifactRef
}
```

Or throw `ToolError` for bad auth / missing object / invalid ref.

### Internal algorithm (extract-text)

1. Validate `source.store === 's3'` and auth.
2. `StartDocumentTextDetection` with `DocumentLocation.S3Object` = `{ Bucket, Name: key }` (AWS S3, same region as Textract).
3. Loop: `GetDocumentTextDetection` with backoff until `JobStatus` is `SUCCEEDED` | `FAILED` | `PARTIAL_SUCCESS`, or elapsed ≥ `poll_timeout_ms`.
4. On success: concatenate `LINE` blocks into `text`, return `succeeded`.
5. On timeout: return `pending` + `job_id` (no second Start).
6. On failure status: return `failed` or `ToolError`.

### `document-extract-status`

Input: `{ job_id: string }`  
Output: same result shape (`succeeded` with text, `pending`, or `failed`).  
One `GetDocumentTextDetection` call (paginate tokens if needed for full text). **No re-start.**

### Auth (host-facing)

```ts
{
  access_key_id: string
  secret_access_key: string
  region: string              // Textract + S3 region
  bucket: string              // S3 bucket for DocumentLocation
  session_token?: string
  poll_timeout_ms?: number    // default 60000
  poll_interval_ms?: number   // default 2000, cap reasonable
}
```

**Requirement:** Object must be in **AWS S3** (not R2/MinIO) for Textract `S3Object`. Document this clearly.

### Runtime

`both` (HTTP + aws4fetch).

## Document render (`@5ss/ai-tools/document-render`)

**Backend:** **Cloudflare Browser Rendering** (`provider: 'cloudflare-browser'`).  
HTML or URL → PDF / PNG; writes `ArtifactRef` to nested object storage.

### Tools

| Tool id | sideEffect | Behavior |
| --- | --- | --- |
| `document-render-pdf` | `write` | HTML/URL → PDF ArtifactRef |
| `document-render-screenshot` | `write` | HTML/URL → PNG ArtifactRef |
| `document-render-pdf-batch` / `-screenshot-batch` | `write` | Up to 10 items |

### Auth (host-facing)

```ts
{
  provider: 'cloudflare-browser'
  account_id: string
  api_token: string
  browser?: 'chromium' | 'kitesurf'
  storage: { access_key_id, secret_access_key, region, bucket, endpoint?, session_token? }
}
```

## README recommendation

Managed **Cloudflare Browser** for HTML→PDF/PNG.  
**AWS Textract** for OCR/text extract.  
**S3/R2** for ArtifactRef storage (R2 OK for render; **AWS S3 required** for Textract document location).

## Out of scope (v1)

- In-process office builders / LibreOffice conversion in this package  
- Size-based dual code paths  
- Agent-facing base64 file payloads as primary API  

## Implementation map

| Package surface | Code |
| --- | --- |
| shared ref | `src/shared/artifact.ts` |
| extract | `src/modules/document-extract/` |
| render | `src/modules/document-render/` |
| docs | this spec + module wiki pages |
