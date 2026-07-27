# Spec: Agent document plane

Status: **locked product direction**  
Package: `@harryy/ai-tools`  
Date: 2026-07-26

Related:

- [document](../modules/document.md): in-process read, build, and edit tools
- [presentation](../modules/presentation.md): isolated PPTX read, build, and edit tools
- [document-render](../modules/document-render.md): browser print and screenshots
- [file-convert](../modules/file-convert.md): explicit office-to-PDF conversion
- [document-extract](../modules/document-extract.md): OCR and asynchronous extraction
- [artifacts-extract-convert](./artifacts-extract-convert.md): ArtifactRef pipelines

## Product

Build a product-agent document plane that can understand, create, and edit real user files. Conversion is a small support path, not the product.

The product has three tool families and four first-class verbs:

| Family or verb | Job |
| --- | --- |
| Reader | Open common attachments into model-usable text, tables, slides, page text, and optional page images |
| Builder | Produce native deliverables from structured content |
| Edit | Patch an existing supported file without forcing a rebuild |
| Converter | Change formats only through explicit paths |

## Reader

Core document inputs are txt, Markdown, JSON, CSV, HTML, PDF, DOCX, XLSX, and common images. PPTX input belongs to the separate presentation capability.

- Text formats return content directly.
- HTML returns source HTML plus visible text.
- DOCX returns text, HTML, and tables when present.
- PPTX returns slides, notes, text, and tables when present.
- XLSX and CSV return row-major tables plus text.
- PDF returns combined text, page count, per-page text, and selected rendered page images when requested.
- Images return byte metadata and pixel dimensions when the format header exposes them. Pixel understanding remains host vision.
- Legacy Office binaries such as DOC, PPT, and XLS use the explicit office-to-PDF path before reading. They are not parsed as modern OOXML.

Clean document reading and scan extraction are separate jobs. OCR belongs to `document-extract`.

## Builder

Native builders produce:

- txt, Markdown, JSON, CSV, and HTML
- DOCX from document structure
- PPTX from slide structure
- XLSX from sheet and cell structure

PDF and PNG are composed outputs:

- HTML-first layouts use `document-render`.
- Office deliverables use `file-convert` when PDF is the required final container.

Building a presentation, document, or workbook is not conversion.

## Edit

Editing is a first-class product verb.

The shipped base contract is:

| Format | Edit contract |
| --- | --- |
| txt, Markdown, JSON, HTML | Ordered exact-text replacements; JSON remains valid |
| CSV, XLSX | Cell patches by sheet, row, and column |
| DOCX | Ordered text replacements across body, headers, footers, notes, and comments while retaining the OOXML package |
| PPTX | Ordered global text replacements across slide content while retaining layout, media, and speaker notes |

Every requested replacement must match. The edit fails before writing an output when any requested text is absent.

The product goal remains richer structural editing over time, including slide, section, table, style, and media operations. PDF and image editing require specialist later surfaces. The package must not claim unsupported edit depth or substitute a rebuild without telling the host.

## Runtime packaging boundary

The product remains one package with flat subpath exports, but document and presentation code are separate runtime graphs:

| Import | Capability | Packaging |
| --- | --- | --- |
| `@harryy/ai-tools/document` | Text, PDF, DOCX, XLSX/CSV, images | Node ESM and CommonJS consumer bundles |
| `@harryy/ai-tools/presentation` | PPTX | Node ESM only until the PPTX dependency graph is CommonJS-compatible |

The document entry must never transitively import the PPTX parser or its core package. Filtering presentation tools after importing a shared client is not sufficient.

## Converter

The converter is a closed path set:

| Path | Engine |
| --- | --- |
| Office to PDF | Self-hosted Gotenberg LibreOffice |
| HTML or URL to PDF | Browser print through Gotenberg Chromium or Cloudflare Browser |
| HTML or URL to PNG | Browser screenshot through Gotenberg Chromium or Cloudflare Browser |

There is no arbitrary `from` plus `to` router, no generic conversion catalog, and no Transmute integration.

## Ownership

| Concern | Package | Host |
| --- | --- | --- |
| Document schemas, native read/build/edit, provider clients | Yes | |
| Object-storage ArtifactRef reads and writes | Clients and contracts | Credential and root binding |
| OCR, browser print, office conversion | Explicit package tools | Provider selection and infrastructure URL |
| Pixel understanding | | Model and vision attachment wiring |
| Tool allowlists, confirmation, tenant policy, secrets | | Yes |
| Attach, send, and durable delivery | Files and messaging tools | Workflow orchestration |

## Delivery order

1. Explicit conversion cleanup and Transmute removal
2. Common attachment reader with PDF page views
3. Native document, presentation, spreadsheet, and text builders
4. First-class edit tools, with richer format-specific operations added by product demand
5. Optional PDF operations, richer OCR, image transforms, and interactive browsing as separate capabilities

## Non-goals

- A universal conversion service
- Thousands of conversion pairs
- OCR hidden inside clean-document reading
- Interactive browsing hidden inside print
- Artifact storage or message delivery hidden inside conversion
- Treating conversion as a presentation, document, or spreadsheet authoring engine
