# Spec: Artifacts, document extract, file convert

Status: **locked for implementation**  
Package: `@harryy/ai-tools`

## Goals

- Keep **file bytes out of the LLM**. Tools pass **ArtifactRef** only.
- **One path** for all sizes (no small/large tiers).
- **Reuse** `s3-storage` concepts, `aws4fetch`, `ofetch` — no in-process Office/PDF stacks.
- Extract via **AWS Textract**; convert via **self-hosted Transmute**.

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

**Backend:** self-hosted **[Transmute](https://github.com/transmute-app/transmute)** (recommended).  
Privacy: files stay on your converter host. Offline relative to third-party SaaS.

### Tools

| Tool id | sideEffect | Behavior |
| --- | --- | --- |
| `file-convert` | `write` | Convert `source` ArtifactRef to `output_format`; write result to S3; return new ArtifactRef. |

### Flow (one await)

1. Get object bytes from S3 (`source.key`).
2. `POST {transmute}/api/files` multipart upload (Bearer API token).
3. `POST {transmute}/api/conversions` `{ id, output_format, quality? }` — **synchronous** Transmute path.
4. `GET {transmute}/api/files/{converted_id}` download bytes.
5. Put to S3 at `output_key` (or derived key).
6. Return `{ source, result: ArtifactRef, transmute_file_id? }`.

If Transmute is slow, the tool still awaits the HTTP call (host/Worker timeout applies). No agent-facing job id for convert v1 (Transmute sync conversions API).

### Auth (host-facing)

```ts
{
  transmute_base_url: string   // e.g. https://convert.internal:3313
  transmute_token: string      // Bearer (JWT or API key)
  storage: {
    access_key_id: string
    secret_access_key: string
    region: string
    bucket: string
    endpoint?: string            // R2/MinIO OK for convert storage
    session_token?: string
  }
}
```

### Input (model-facing)

```ts
{
  source: ArtifactRef
  output_format: string        // e.g. pdf, png, md
  output_key?: string          // default: derived from source key + extension
  quality?: string
  filename?: string            // upload name hint
}
```

## README recommendation

Self-host **Transmute** for conversion (REST API, private, Docker).  
Use **AWS Textract** for OCR/text extract (not offline).  
Use **S3/R2** for ArtifactRef storage (R2 OK for convert; **AWS S3 required** for Textract document location).

Optional later: Gotenberg for HTML→PDF only; Stirling-PDF for PDF ops.

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
