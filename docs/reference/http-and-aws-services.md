# Transport: HttpService and AwsService

`src/transport/` — ofetch HTTP + optional SigV4. That is the whole stack.

| File | Role |
| --- | --- |
| `http-service.ts` | `HttpService` |
| `aws-service.ts` | `AwsService extends HttpService` (signing fetch) |
| `errors.ts` | Status / network → `ToolError` |
| `index.ts` | Public `@5ss/ai-tools/http` re-exports |

Auth is just **headers** on the client (or SigV4 on AwsService):

```ts
new HttpService({
  baseURL: 'https://api.example.com',
  headers: { Authorization: `Bearer ${token}` },
  label: 'Example',
})
```

ofetch does not invent auth. You set headers (or AwsService signs). No separate auth-applicator layer.

```ts
import { HttpService } from '../../transport/http-service'

const http = new HttpService({ baseURL, headers, label: 'Resend', fetch, signal })
await http.post('/emails', body)
await http.bytes('GET', '/file')
await http.bytes('GET', '/bounded-file', { maxBytes: 5 * 1024 * 1024 })
await http.get('/x', { noThrow: true })
// Query string via ofetch `query` (not path string concat)
await http.post('/browser-rendering/screenshot', body, { query: { browser: 'kitesurf' } })
```

```ts
import { AwsService } from '../../transport/aws-service'

const aws = new AwsService({ accessKeyId, secretAccessKey, region, service: 's3', label: 'S3' })
await aws.put(url, body)
await aws.sign(url, { signQuery: true })
```

| API | Role |
| --- | --- |
| `query` | Parsed body; throws `ToolError` on non-2xx by default |
| `bytes` | Binary body; optional `maxBytes` uses a bounded stream |
| `get` / `post` / `put` / `patch` / `delete` / `head` | Sugar |
| `noThrow` / `allowStatuses` | Opt out of default throw |
| `AwsService.sign` | Presigned URLs |

Product clients **own** the transport instance in the constructor. Tools never call HttpService.

## Directory ownership

| Dir | Owns |
| --- | --- |
| `src/transport/` | HTTP only |
| `src/shared/` | `artifact`, `batch`, `bytes`, `content-type`, `pagination` |
| `src/vendors/` | 3rd-party packs |
| `src/vendors/_email/` | Email vertical kit (address, limits, schemas) |
| `src/vendors/_storage/` | Storage I/O schemas (shared by s3 + nested S3 bindings) |
| `src/vendors/_messaging/` | Chat helpers (`createLiveMessage`, `createTypingPulse`) |
| `src/modules/` | Capability seams |

## Gold client shape

See `src/vendors/resend/client.ts` and `src/vendors/cloudflare-email/client.ts`:

1. Parse auth with Zod → `ToolError` `bad_auth` on failure.
2. Construct one `HttpService` with fixed `baseURL` (+ headers).
3. Methods: domain preflight → `http.post` / `bytes` → domain parse.
4. `static fromContext(ctx)` via `requireAuth`.
5. Tools: `Client.fromContext(ctx).method(input)`.
