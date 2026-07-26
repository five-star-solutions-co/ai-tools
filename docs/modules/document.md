# Document

| | |
| --- | --- |
| **Import** | `@harryy/ai-tools/document` |
| **Kind** | capability **seam** (`src/modules/document`) |
| **Module id** | `document` |
| **Auth** | Host: `{ storage: S3Auth }` for ArtifactRef IO |
| **Tools** | `document-read`, `document-build-*`, `document-edit-spreadsheet` |

**Reader / builder** plane. Not HTML print ([document-render](./document-render.md)) and not office→PDF ([file-convert](./file-convert.md)).

## Tools

| id | Role |
| --- | --- |
| `document-read` | Artifact / base64 / text → text, tables, slides |
| `document-build-text` | txt/md/json/csv/html → ArtifactRef |
| `document-build-spreadsheet` | sheet tables → xlsx |
| `document-build-document` | sections → docx |
| `document-build-presentation` | slides → pptx |
| `document-edit-spreadsheet` | cell patches on xlsx/csv |

## Formats (read)

txt, md, json, csv, html, pdf (text), docx, pptx, xlsx, image (metadata; use vision host-side for pixels).

## Bind

```ts
withAuth(documentModule, {
  storage: {
    access_key_id: '…',
    secret_access_key: '…',
    region: 'auto',
    bucket: 'artifacts',
  },
})
```

## Related

- [document-render](./document-render.md) — HTML/URL → PDF/PNG  
- [file-convert](./file-convert.md) — office → PDF  
- [document-extract](./document-extract.md) — OCR / async text jobs  
