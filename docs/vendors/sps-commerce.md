# SPS Commerce

Public vendor pack: `SpsCommerceClient`, `spsCommerceModule`, and 25 `sps-commerce-*` tools. The client has 34 named instance methods, including nine host-only byte/descriptor methods. The pack covers 26 verified business method/path combinations: Transaction v5, Shipping Label v1, public Packing Slip v1, and Community Submission v1.

Public import: `@5ss/ai-tools/sps-commerce`.

This is mocked integration coverage, **not live SPS certification**. Production routing and rendering depend on the customer's agreement, enabled APIs, retailer templates, and account permissions.

## Authentication and host setup

```ts
import { SpsCommerceClient, spsCommerceModule } from '@5ss/ai-tools/sps-commerce'
import { withAuth } from '@5ss/ai-tools/core'

const auth = {
	client_id: 'host-supplied-client-id',
	client_secret: 'host-supplied-client-secret'
}
const client = new SpsCommerceClient(auth)
const tools = withAuth(spsCommerceModule, auth).tools

const page = await client.listTransactions({ path: '/out/', limit: 100 })
// Request the next page explicitly with page.paging?.next?.cursor.
```

Alternatively, bind `{ access_token: 'host-managed-token' }`. The two credential shapes are mutually exclusive. Both serialize through plain `spsCommerceModule.auth.schema.toJSONSchema()` after narrowing `auth.type` to `custom`; hosts must support the resulting `anyOf` alternatives without replacing or flattening the schema. Tokens, client credentials, storage bindings, and download-origin permissions are never tool inputs.

Artifact storage and download-origin permissions are runtime settings, separate from credentials.
`SpsCommerceClientOptions` accepts `artifacts` and `document_origins`; tools read those same fields
from `ToolContext.extras`. `spsCommerceRuntimeSchema` validates this runtime configuration.
**Binding API change:** move previous `auth.artifacts` and `auth.document_origins` values to client
options or execution-context extras. The strict credential schemas reject these fields inside auth.
No browser OAuth flow, credential-schema override, or new tool input is introduced.

Machine-to-machine authentication uses JSON `POST https://auth.spscommerce.com/oauth/token`, with `grant_type: "client_credentials"` and audience exactly `https://spscommerce.com`. Returned `expires_in` controls expiry, with a refresh margin of 10% of the lifetime capped at 60 seconds. Concurrent refreshes with the same abort signal are deduplicated; requests with different signals do not share an abortable refresh. Failed refreshes are not retained.

Tokens are weakly cached by the bound auth object's identity, credential values, and injected fetch implementation. Reuse the same auth object for repeated clients or bound tool calls. New credential objects get independent caches; credential changes invalidate the old cache. No process-wide map keyed by credential strings is used. `fetch`, `signal`, and `now` are injectable client options; tools inherit these from their invocation context.

Business requests use `https://api.spscommerce.com`. The public material does not establish separate sandbox API origins for this pack. Trial access can restrict rendering to sample retailer templates, and sandbox transactions do not route into the partner network. Delegated authorization-code/refresh flows remain host-owned; supply their resulting access token.

## Transaction API v5

Source: [SPS Transaction documentation](https://developercenter.spscommerce.com/#/docs/transaction-api).

| HTTP method and path | Client method | Tool ID |
| --- | --- | --- |
| GET `/transactions/v5/data/{directory-path}` | `listTransactions` | `sps-commerce-list-transactions` |
| POST `/transactions/v5/data/{file-path}` | `uploadTransaction`, host `uploadTransactionBytes` | `sps-commerce-upload-transaction` |
| GET `/transactions/v5/data/{file-path}` | `readTransaction`, host `readTransactionBytes` | `sps-commerce-read-transaction` |
| DELETE `/transactions/v5/data/{file-path}` | `deleteTransaction` | `sps-commerce-delete-transaction` |
| GET `/transactions/v5/history` | `listTransactionHistory` | `sps-commerce-list-transaction-history` |

- This API exchanges exact file bytes, often RSX XML. It is not JSON order/invoice CRUD and does not translate EDI.
- Paths are case-sensitive. Supply ordinary, unescaped paths, optionally beginning with `/`. Directory paths must end in `/`; `""` and `"/"` select the root. Segment encoding preserves spaces and case. Traversal segments, empty interior segments, URL origins, percent escapes, backslashes, query/fragment syntax, and control characters are rejected before I/O.
- Uploads use `application/octet-stream`; optional `metadata` keys become `sps-meta-{key}` headers. Header injection is rejected.
- Uploading to an existing path overwrites it. Uploads are not declared idempotent and are never automatically retried, including after authentication failures, rate limits, network errors, or redirects.
- SPS documents a 2 GB upload ceiling. The host byte method enforces 2,000,000,000 bytes; artifact uploads additionally require `max_bytes` within the artifact resolver's limit. The captured success table says 201 while a response selector says 200; both successful responses are accepted.
- List filters are `limit` (1–1000), `cursor`, and case-sensitive `entryNamePrefix`. Omitted limits retain SPS's documented default of 1000. Native `paging`, cursor URLs, and nullable collections are retained, never auto-followed.
- History supports `limit`, `offset`, `after`, and `until`. Timestamps use `YYYY-MM-DDTHH:mm:ss` without a timezone suffix. Omitted limit/offset preserve the vendor defaults, 100/0. The reference's offset-range prose and examples conflict; the pack accepts nonnegative offsets and preserves returned paging links rather than calculating a new offset.
- Reports can lag transfers by five minutes. History items retain their native fields and status logs, including explicit null values.
- Reading never deletes the file. The host decides when processing succeeded, then explicitly calls `deleteTransaction`. This file-consumption action does **not** accept a business order. SPS may independently remove inbound files after processing.

## Shipping Label API v1

Source: [SPS Shipping Label documentation](https://developercenter.spscommerce.com/#/docs/shipping-doc-api/labels/get_all_labels).

| HTTP method and path | Client method | Tool ID |
| --- | --- | --- |
| GET `/label/v1/` | `listLabels` | `sps-commerce-list-labels` |
| GET `/label/v1/{label-id}` | `getLabel` | `sps-commerce-get-label` |
| GET `/label/v1/{label-id}/schema` | `getLabelSchema` | `sps-commerce-get-label-schema` |
| GET `/label/v1/{label-id}/sample-json` | `getLabelSample` | `sps-commerce-get-label-sample` |
| GET `/label/v1/{label-id}/sample-pdf` | `getLabelSamplePdf`, host `getLabelSamplePdfBytes` | `sps-commerce-get-label-sample-pdf` |
| GET `/label/v1/{label-id}/sample/{sample-uid}/sample-pdf` | Same methods with `sample_uid` | Same tool with `sample_uid` |
| POST `/label/v1/{label-id}/pdf` | `renderLabelPdf`, host `renderLabelPdfBytes` | `sps-commerce-render-label-pdf` |
| POST `/label/v1/{label-id}/zpl` | `renderLabelZpl`, host `renderLabelZplBytes` | `sps-commerce-render-label-zpl` |
| POST `/label/v1/{label-id}/pdf/batches` | `createLabelPdfBatch` | `sps-commerce-create-label-pdf-batch` |
| POST `/label/v1/{label-id}/zpl/batches` | `createLabelZplBatch` | `sps-commerce-create-label-zpl-batch` |
| GET `/label/v1/batches/{batchId}` | `getLabelBatchStatus`, host `getLabelBatch` | `sps-commerce-get-label-batch-status` |
| Completed batch descriptor → bounded document GET | `getLabelBatchResult`, host `getLabelBatchResultBytes` | `sps-commerce-get-label-batch-result` |

The final row is a composite download, not an additional invented SPS API endpoint.

### Template selection and render controls

Lists return one native page. Filters: `newest`, `limit`, `offset`, `name`, `ownerName`, `ownerID`, and `canRender`. String filters default to contains; `name__EQ`, `ownerName__EQ`, and `ownerID__EQ` request exact matching. `false` and `offset: 0` are preserved.

Schemas support `download`, `pretty`, and `pendingChange`. Retrieve the selected template's schema and sample JSON before constructing `data`. There is no universal `Header`/`Pack`/EDI schema. The pack validates that `data` is JSON; SPS performs the selected template's business/schema validation. No local JSON Schema engine or schema compilation cache is added.

PDF render options: `perPage` (1 or 4), `pendingChange`, `startPackCount`, `totalPackCount`, `collate`, `copies`, and `pages`. Pages are serialized in the documented JSON-array query syntax, for example `pages=[2,5]`.

ZPL additionally accepts `mediaType` (`T`, `D`), `printMode` (`T`, `P`, `R`, `A`, `C`, `D`, `F`, `L`, `U`, `K`), `dpi` (152, 203, 300, 600), and `zplCommand` (`DG`, `DY`, `GFA`). 600 DPI requires explicit `DY`; printer compatibility remains host-owned.

Synchronous render bodies are bounded to 8,000,000 UTF-8 bytes, conservatively interpreting the published 8 MB ceiling. The same local ceiling protects asynchronous label submissions. Defaults are omitted unless a private byte response must be selected: renders explicitly use the documented `url=false` mode. The alternative `url=true` mode produces an expiring 24-hour link, so it is deliberately not a model-facing result or a separate tool.

ZPL rendering returns **JSON containing `zplData: string[]`**, not one plain ZPL string. The byte method and artifact preserve that native JSON document and its per-label boundaries. Read the artifact outside the model to send individual commands to a printer.

### Batch lifecycle

PDF/ZPL batch creation returns `batchId` and `statusURL`. `asyncValidation` is forwarded when provided; its SPS default is true. Creation does not poll, fetch results, or assume validation succeeded.

`getLabelBatchStatus` returns `In Progress`, `Completed`, or `Failed`, including native `validationErrors`, nested per-item validation details, and nullable fields. It excludes signed `resultURL` values. Host-only `getLabelBatch` retains the original descriptor, including its temporary URL; treat that value as sensitive.

`getLabelBatchResult` first verifies completion, then retrieves the document through a separate, unauthenticated `HttpService`. Its origin must match the host-bound `document_origins` allowlist exactly. The default allowlist is empty; configure actual approved origins for your SPS deployment. The captured example uses `https://cdn.test.spsapps.net`, which is evidence of a test CDN, not a production-origin default. HTTPS is mandatory; userinfo and fragments are rejected. Redirects are disabled, and SPS authorization is never forwarded to the document origin.

## Packing Slip API v1

Source: [SPS Packing Slip documentation](https://developercenter.spscommerce.com/#/docs/shipping-doc-api/packing_slips/get_all_packing_slip).

| HTTP method and path | Client method | Tool ID |
| --- | --- | --- |
| GET `/packing-slip/v1/` | `listPackingSlips` | `sps-commerce-list-packing-slips` |
| GET `/packing-slip/v1/{slip-id}` | `getPackingSlip` | `sps-commerce-get-packing-slip` |
| GET `/packing-slip/v1/{slip-id}/schema` | `getPackingSlipSchema` | `sps-commerce-get-packing-slip-schema` |
| GET `/packing-slip/v1/{slip-id}/sample-json` | `getPackingSlipSample` | `sps-commerce-get-packing-slip-sample` |
| GET `/packing-slip/v1/{slip-id}/sample-pdf` | `getPackingSlipSamplePdf`, host `getPackingSlipSamplePdfBytes` | `sps-commerce-get-packing-slip-sample-pdf` |
| GET `/packing-slip/v1/{slip-id}/sample/{sample-uid}/sample-pdf` | Same methods with `sample_uid` | Same tool with `sample_uid` |
| POST `/packing-slip/v1/{slip-id}/pdf` | `renderPackingSlipPdf`, host `renderPackingSlipPdfBytes` | `sps-commerce-render-packing-slip-pdf` |

List and schema filters match their documented label counterparts. Sample PDF requests support `pendingChange` and optional `sample_uid`. Rendering accepts template-specific `data` and `pendingChange`; it does not invent label-layout or ZPL options for packing slips.

## Community Submission API v1

Source: [public OpenAPI 3.1 document, API version 1.0.0](https://api.spscommerce.com/submissions/openapi.json).

| HTTP method and path | Client method | Tool ID |
| --- | --- | --- |
| GET `/submissions/v1/forms` | `listSubmissionForms` | `sps-commerce-list-submission-forms` |
| GET `/submissions/v1/forms/{id}` | `getSubmissionForm` | `sps-commerce-get-submission-form` |
| POST `/submissions/v1/trading-partners` | `createTradingPartners` | `sps-commerce-create-trading-partners` |

Forms preserve `results`, native `paging.totalCount/limit/offset`, enabled fields, campaign metadata, and nulls. Listing supports `limit` 1–50 and `offset` ≥0, leaving the vendor defaults (1 and 0) unchanged when omitted.

Trading-partner creation implements the complete public nested input:

- Required form ID, trading-partner name/ID, three-character country, business contact, and included data exchanges.
- Business and third-party contacts; first/last names, email patterns, lengths, telephone, and titles follow the OpenAPI.
- Additional IDs 2–10, preserving the documented absence of a maximum length for ID 4.
- Address, annual order/SKU metrics, buyer information, dates, notes, carrier service, sponsored solutions, and supplier groups.
- All 23 fulfillment-model document lists and the published exempted-model enum.
- Required-but-nullable third-party first name is distinct from an omitted field.

At least one data exchange must be true, as required by the public prose. Retrieve the form first and select only exchanges and fulfillment documents that it enables; SPS enforces account/form-specific choices. No hidden form read or default exchange selection occurs during creation.

The success response retains every entry in `createdTradingPartners`; one submission can create multiple records. Creation is an explicit, non-replayed write. Its `application/problem+json` errors are mapped by HTTP status without placing provider bodies, customer details, or credentials in exceptions.

## Artifacts, limits, and failure behavior

Model-facing transaction reads, sample PDFs, renders, and batch-result downloads return `{ artifact: ArtifactRef }`, not binary/base64 content or signed URLs. Transaction uploads take a source `ArtifactRef`. Supply runtime `artifacts` with the existing artifacts module's `host` or `object` shape:

```ts
// artifactsAuth is your existing ArtifactsAuth binding.
const client = new SpsCommerceClient(
	{ access_token: 'host-managed-token' },
	{ artifacts: artifactsAuth }
)

const result = await client.readTransaction({
	path: '/out/order.xml',
	destination: 'sps/received/order.xml',
	max_bytes: 5_000_000
})
```

For agent tools, bind credentials with `withAuth` or `bindModule` and provide
`extras: { artifacts: artifactsAuth, document_origins: approvedOrigins }` in the execution context.
`bindModule.resolveContext` can supply these settings per invocation. Omit `document_origins`
unless batch-document origins have been explicitly approved; the default remains an empty allowlist.

`max_bytes` is explicit on every artifact/byte operation and must fit `MAX_ARTIFACT_READ_BYTES`; there is no unbounded download option. The transport cancels streams as soon as either declared or observed size exceeds the bound. Missing storage fails before rendering or downloading. Storage failure never triggers a second remote render/upload, deletion, or acknowledgment.

Host-only methods ending in `Bytes` return `{ bytes: Uint8Array, media_type }`; `uploadTransactionBytes` accepts raw bytes. Ordinary metadata/list methods need no artifact backend.

All I/O uses `HttpService`, with an injected fetch boundary that disables redirects. No mutation or read is automatically retried. Read errors can retain retryability hints and `retry_after_ms`; write errors do not invite automatic replay. HTTP 401, 403, 404, 413, and 429 map to `bad_auth`, `forbidden`, `not_found`, `too_large`, and `rate_limited`; cancellation maps to `timeout`. Error text and nested causes are sanitized to exclude credentials, signed document locations, provider payloads, and storage details.

Artifact-producing tools have `sideEffect: "write"` because they create stored objects, even when the SPS operation is GET. Upload, explicit delete, and trading-partner creation include confirmation hints. Host policy still owns actual confirmation and authorization.

## Deliberate exclusions and documentation gaps

- Static label/slip schema links require sign-in. Per-template schemas remain authenticated runtime resources; no schemas or sample documents were fetched from an account during implementation.
- No complete RSX/XSD contract was captured. The pack does not invent universal purchase-order, acknowledgment, shipment-notice, or invoice schemas or an EDI translator.
- Packing-slip batch creation, append, process, status, error/result, and per-shipment result pages are marked `internal=true`. They are excluded pending public customer-access confirmation. The process page also conflicts on POST versus PUT.
- Transaction schemas are based on captured response examples, not a complete formal schema. Native fields are retained rather than guessed or normalized away.
- Transaction history offset prose/example arithmetic and upload success status examples conflict; behavior follows the documented request shape without inventing pagination or replay rules.
- OAuth consent, redirects, token persistence, and delegated refresh are host responsibilities; no account-management or generic HTTP tools are added.
- No live provider requests or account mutations were made. Tests use injected mocked fetch and host artifact backends.

Validation belongs to `test/vendors/sps-commerce.test.ts`: exact routes and request options, token caching/expiry/deduplication, bound tools, full nested submission contracts, native pagination/nulls, asynchronous states, malformed responses, rate limits, no replay, path/header safety, cancellation, byte bounds, storage failure, and document-origin/auth isolation.

Credential/runtime separation additionally covers plain JSON Schema projection, exclusive auth
alternatives, rejection of runtime fields inside credentials, per-invocation storage for both
authentication methods, and sanitized rejection of malformed runtime settings before HTTP.
SDK release and consuming-application dependency updates remain separate from local verification.
