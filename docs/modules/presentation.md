# Presentation

| | |
| --- | --- |
| **Import** | `@harryy/ai-tools/presentation` |
| **Kind** | capability **seam** (`src/modules/presentation`) |
| **Module id** | `presentation` |
| **Runtime** | Node ESM only |
| **Auth** | Host: `{ storage: S3Auth }` for ArtifactRef IO |
| **Tools** | `presentation-read`, `presentation-build`, `presentation-edit` |

PPTX reader, builder, and editor. This is intentionally separate from [`document`](./document.md) so core document consumers do not resolve `@office-open/pptx`, `@office-open/core`, PptxGenJS, or pptx-automizer.

## Implementation ownership

| Job | Library |
| --- | --- |
| PPTX read | `@office-open/pptx` |
| PPTX build | PptxGenJS |
| PPTX slide-content edit | `pptx-automizer` |

`@office-open/core` currently contains top-level await in its shared Node compression path. Presentation therefore remains Node ESM-only until that dependency exposes runtime-conditional packaging without top-level await in the CommonJS graph.

## Tools

| id | Role |
| --- | --- |
| `presentation-read` | PPTX artifact or inline bytes to slides, notes, text, and tables |
| `presentation-build` | Structured slides to a PPTX ArtifactRef |
| `presentation-edit` | Layout-preserving global text replacements in a PPTX artifact |

## Edit semantics

- Replacements are ordered and exact.
- Each replacement updates every match in slide content, including text boxes and table cells.
- Speaker notes are preserved but are not edited.
- Existing package parts, styles, layout, and media remain in the OOXML archive.
- Every requested replacement must match or the operation fails without writing an output.

## Bind

```ts
withAuth(presentationModule, {
  storage: {
    access_key_id: '…',
    secret_access_key: '…',
    region: 'auto',
    bucket: 'artifacts',
  },
})
```

## Related

- [document](./document.md) — CommonJS-safe text, PDF, DOCX, spreadsheet, and image operations
- [document plane spec](../specs/document-plane.md) — locked product scope
- [file-convert](./file-convert.md) — legacy Office and office-to-PDF conversion
