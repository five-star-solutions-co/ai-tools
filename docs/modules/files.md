# Files

| | |
| --- | --- |
| **Import** | `@harryy/ai-tools/files` |
| **Kind** | **seam** (`src/modules/files`) |
| **Module id** | `files` |
| **Auth** | Host: `root_prefix` + nested S3 `storage` (`s3AuthSchema`) |

Path-rooted file manage over **S3-compatible** object storage ([s3](../vendors/s3.md)). The model only sees paths **relative** to `root_prefix`. Host maps tenant → prefix + S3 credentials (AWS, R2 S3 endpoint, MinIO, …).

## Bind

```ts
withAuth(filesModule, {
  root_prefix: 'orgs/acme/files/',
  storage: {
    access_key_id: '…',
    secret_access_key: '…',
    region: 'auto',
    bucket: 'artifacts',
    endpoint: 'https://….r2.cloudflarestorage.com', // optional S3-compatible
  },
})
```

## Tools

| id | sideEffect | Behavior |
| --- | --- | --- |
| `files-list` | read | List files/folders under a relative path |
| `files-search` | read | Name-fragment match on last path segment |
| `files-stat` | read | Head metadata for one relative path |
| `files-get` | read | Download body (base64 default / utf8) |
| `files-put` | write | Upload or replace body |
| `files-delete` | delete | Delete one file |
| `files-copy` | write | Copy within the same root |
| `files-move` | write | Move within the same root |
| `files-mkdir` | write | Create folder marker (`path/.keep`) |
| `files-multipart-start` | write | Start multipart upload |
| `files-multipart-upload-part` | write | Upload one part |
| `files-multipart-complete` | write | Assemble parts |
| `files-multipart-abort` | delete | Abort in-progress multipart |

Nested `storage` is plain [s3](../vendors/s3.md) auth (no provider discriminator).
