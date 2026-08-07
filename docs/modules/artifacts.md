# Artifacts

| | |
| --- | --- |
| **Import** | `@5ss/ai-tools/artifacts` |
| **Kind** | capability **seam** (`src/modules/artifacts`) |
| **Module id** | `artifacts` |
| **Providers** | `object`, `host` |
| **Tools** | create, bounded byte-range read, bounded line read |

Portable `ArtifactRef` creation, validation, output discovery, bounded model reads,
and host-facing byte resolution. The package keeps large or arbitrary file reads
out of the model-facing surface.

## Tools

| id | Role |
| --- | --- |
| `artifacts-create` | Create a small artifact from UTF-8 or base64 content |
| `artifacts-read-range` | Read an explicit inclusive byte range as base64 |
| `artifacts-read-lines` | Read an explicit inclusive line range from UTF-8 text |

Create and read ranges are capped by `MAX_ARTIFACT_CREATE_BYTES` and `MAX_ARTIFACT_READ_BYTES`. Use multipart file tools for larger writes.

## Structured-output discovery

`runTool` and every framework adapter built on it can report file outputs without
parsing model text:

```ts
const bound = bindModule(module, {
  resolveAuth,
  hooks: {
    onArtifact: async ({ artifact, ctx, tool, output }) => {
      await captureArtifact({ artifact, ctx, tool, output })
    },
  },
})
```

`onArtifact` runs once for each unique, schema-valid `ArtifactRef` in the
validated structured output. `findArtifactRefs(output)` exposes the same
discovery as a pure helper. Markdown links such as `artifact-ref:...` are not
inspected.

## Resolve for host delivery

`ArtifactsClient.resolve` is a host API, not a model tool. It requires an
explicit byte limit and returns bytes plus normalized `ArtifactRef` metadata:

```ts
const client = ArtifactsClient.fromAuth(artifactsAuth, ctx)
const resolved = await client.resolve({
  source: artifact,
  max_bytes: channelFileLimit,
})

await turnArtifactSink.capture({
  bytes: resolved.bytes,
  filename: resolved.artifact.filename,
  media_type: resolved.artifact.media_type,
})
```

The package owns reference validation, storage access, missing-object handling,
and byte-limit enforcement. The host owns authorization, destination selection,
turn capture, channel upload, audit, and channel-specific limits.

## Object-store bind

```ts
withAuth(artifactsModule, {
  provider: 'object',
  storage: {
    access_key_id: '…',
    secret_access_key: '…',
    region: 'auto',
    bucket: 'artifacts',
    endpoint: 'https://….r2.cloudflarestorage.com',
  },
})
```

## Host bind

Hosts may bind `provider: 'host'` with `create`, `readRange`, and `readLines`
callbacks. Add the optional `resolve` callback when the host needs complete bytes
for delivery. Host callbacks resolve only `ArtifactRef` values whose `store` is
`host`; the package validates callback outputs and enforces the caller's
`max_bytes` limit.

Tenant authorization, persistence, retention, and artifact lifecycle stay on the host.
