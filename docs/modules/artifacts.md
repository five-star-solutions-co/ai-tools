# Artifacts

| | |
| --- | --- |
| **Import** | `@harryy/ai-tools/artifacts` |
| **Kind** | capability **seam** (`src/modules/artifacts`) |
| **Module id** | `artifacts` |
| **Providers** | `object`, `host` |
| **Tools** | create, bounded byte-range read, bounded line read |

Portable `ArtifactRef` creation and bounded reads. The package keeps large or arbitrary file reads out of the model-facing surface.

## Tools

| id | Role |
| --- | --- |
| `artifacts-create` | Create a small artifact from UTF-8 or base64 content |
| `artifacts-read-range` | Read an explicit inclusive byte range as base64 |
| `artifacts-read-lines` | Read an explicit inclusive line range from UTF-8 text |

Create and read ranges are capped by `MAX_ARTIFACT_CREATE_BYTES` and `MAX_ARTIFACT_READ_BYTES`. Use multipart file tools for larger writes.

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

Hosts may bind `provider: 'host'` with `create`, `readRange`, and `readLines` callbacks. Host callbacks resolve only `ArtifactRef` values whose `store` is `host`; the package validates callback outputs before returning them to the agent.

Tenant authorization, persistence, retention, and artifact lifecycle stay on the host.
