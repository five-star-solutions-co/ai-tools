# Document

| | |
| --- | --- |
| **Import** | `@harryy/ai-tools/document` |
| **Kind** | capability **seam** (`src/modules/document`) |
| **Module id** | `document` |
| **Runtime** | Node |
| **Auth** | Host: `{ storage: S3Auth }` for ArtifactRef IO |
| **Tools** | `document-read`, `document-build-*`, `document-edit-*` |

Reader, builder, and edit plane. Not HTML print ([document-render](./document-render.md)) and not office-to-PDF ([file-convert](./file-convert.md)).

## Implementation ownership

The module is a thin router over format libraries, not a document parser framework:

| Job | Library |
| --- | --- |
| MIME lookup | `mime` through the shared content-type helpers |
| Binary signature detection | `file-type` |
| HTML → model-readable text | `html-to-text` |
| CSV / XLSX read, build, edit | ExcelJS, including its CSV reader/writer |
| DOCX read / build / edit | `@office-kit/docx` + Mammoth HTML projection |
| PPTX build | PptxGenJS |
| PPTX read | `@office-open/pptx` |
| PPTX slide-content edit | `pptx-automizer` |
| PDF text / page rendering | unpdf + pdfjs |
| Image dimensions | `image-size` |

The small format router defines which product formats are supported. It does not maintain its own MIME database, CSV parser, HTML parser, image header parser, or XML regex parser.

## Tools

| id | Role |
| --- | --- |
| `document-read` | Artifact, base64, or text to model-usable text, HTML, tables, slides, page text, and optional PDF page images |
| `document-build-text` | txt/md/json/csv/html → ArtifactRef |
| `document-build-spreadsheet` | sheet tables → xlsx |
| `document-build-document` | sections → docx |
| `document-build-presentation` | slides → pptx |
| `document-edit-text` | exact replacements in txt/md/json/html |
| `document-edit-document` | layout-preserving text replacements in docx |
| `document-edit-presentation` | layout-preserving global text replacements in pptx |
| `document-edit-spreadsheet` | cell patches on xlsx/csv |

## Formats (read)

| Format | Output |
| --- | --- |
| txt, md, json | text |
| csv, xlsx | text and row-major tables |
| html | source HTML and visible text |
| docx | text, HTML, and tables |
| pptx | slides, notes, text, and tables |
| pdf | text, page count, per-page text, and selected page-image ArtifactRefs |
| image | byte metadata and dimensions when available; use host vision for pixels |

Legacy DOC, PPT, and XLS use [file-convert](./file-convert.md) `office-to-pdf` before reading. The reader does not pretend binary Office files are OOXML.

## PDF page images

Pass `pdf_page_images` on `document-read`:

```ts
{
  source: { artifact: { store: 'object', key: 'inbox/report.pdf' } },
  pdf_page_images: {
    page_numbers: [1, 4],
    output_key_prefix: 'derived/report-pages',
    scale: 1.5
  }
}
```

The output keeps per-page text and adds `image: ArtifactRef` to the requested pages. Up to 20 pages may be rendered per call.

## Edit semantics

- Replacements are ordered and exact.
- Text and DOCX replacements choose `match: 'first' | 'all'`.
- DOCX edits cover the body, headers, footers, footnotes, endnotes, and comments.
- PPTX edits replace every match in slide content, including text boxes and table cells. Speaker notes are preserved but not edited.
- Existing package parts, styles, layout, and media remain in the OOXML archive.
- Every requested replacement must match or the operation fails without writing an output.
- Spreadsheet patches use 1-based row and column indexes.

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

- [document plane spec](../specs/document-plane.md) — locked product scope
- [document-render](./document-render.md) — HTML/URL → PDF/PNG  
- [file-convert](./file-convert.md) — office → PDF  
- [document-extract](./document-extract.md) — OCR / async text jobs  
