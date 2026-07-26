# Spec: Artifacts, document extract, file convert

Status: **locked for implementation**  
Package: `@harryy/ai-tools`

## Goals

- Keep **file bytes out of the LLM**. Tools pass **ArtifactRef** only.
- **One path** for all sizes (no small/large tiers).
- **Reuse** object-storage concepts and the package transport stack. Keep Office conversion and browser print out of the in-process `document` module; native read/build/edit libraries remain in `document`.
- Extract via **AWS Textract**; convert via **self-hosted Gotenberg LibreOffice** (office → PDF). HTML print via **document-render** (Chromium / Cloudflare Browser).

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
| `store` | Who owns bytes. **`object`** = bound object store (S3-compatible keys for extract/convert/render). **`host`** reserved for host-mapped keys. |
| `key` | Object key in the bound bucket (or host id later). |
| `media_type` | Optional hint (extension or sniffed). Tools may fill if missing. |
| `filename` | Optional display name. |
| `byte_length` | Optional size hint. |

Mime: prefer object head / `Content-Type`; otherwise filename extension; otherwise leave unset.

## Document extract (`@harryy/ai-tools/document-extract`)

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

## File convert (`@harryy/ai-tools/file-convert`)

**Backend:** self-hosted **[Gotenberg](https://gotenberg.dev/)** LibreOffice module.  
Closed path: **`office-to-pdf`** (docx, pptx, xlsx, odt, rtf, … → PDF).  
HTML/URL layout print is **document-render** (Chromium / Cloudflare Browser), not this module.

### Tools

| Tool id | sideEffect | Behavior |
| --- | --- | --- |
| `file-convert` | `write` | `path: office-to-pdf`; read `source` from S3; LO convert; write PDF ArtifactRef |
| `file-convert-batch` | `write` | Same, up to 10 items |

### Flow (one await)

1. Get object bytes from S3 (`source.key`).
2. `POST {gotenberg}/forms/libreoffice/convert` multipart.
3. Put PDF bytes to S3 at `output_key` (or derived `.pdf` key).
4. Return `{ source, result: ArtifactRef, path: 'office-to-pdf' }`.

### Auth (host-facing)

```ts
{
  provider: 'gotenberg'
  gotenberg_base_url: string
  gotenberg_api_username?: string
  gotenberg_api_password?: string
  storage: { access_key_id, secret_access_key, region, bucket, endpoint?, session_token? }
}
```

### Input (model-facing)

```ts
{
  source: ArtifactRef
  path: 'office-to-pdf'   // closed enum
  output_key?: string
  filename?: string
}
```

## README recommendation

Self-host **Gotenberg** for office→PDF (+ optional Chromium self-host).  
Managed **Cloudflare Browser** for HTML→PDF/PNG.  
**AWS Textract** for OCR/text extract.  
**S3/R2** for ArtifactRef storage (R2 OK for convert/render; **AWS S3 required** for Textract document location).

## Out of scope (v1)

- In-process pdf-parse / LibreOffice in this package  
- VERT as primary converter backend (browser/WASM-first)  
- Size-based dual code paths  
- Agent-facing base64 file payloads as primary API  

## Implementation map

| Package surface | Code |
| --- | --- |
| shared ref | `src/shared/artifact.ts` |
| S3 get/put helpers | `src/shared/s3-bytes.ts` (reuse aws4fetch patterns from s3-storage) |
| extract | `src/modules/document-extract/` |
| convert | `src/modules/file-convert/` |
| docs | this spec + module wiki pages |
