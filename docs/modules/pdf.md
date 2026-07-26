# PDF

| | |
| --- | --- |
| **Import** | `@harryy/ai-tools/pdf` |
| **Kind** | capability module |
| **Engine** | `pdf-lib` |

Artifact-backed PDF utilities. This module edits existing PDF containers. It does not render HTML, convert Office files, or extract page text.

| Tool | Purpose |
| --- | --- |
| `pdf-inspect` | Page count, dimensions, rotations, and document metadata |
| `pdf-merge` | Concatenate PDFs in order |
| `pdf-extract-pages` | Copy selected pages into one PDF |
| `pdf-split` | Write one PDF per source page |
| `pdf-rotate` | Rotate selected pages or the complete document |

Auth contains nested `storage` credentials. Inputs and outputs use `ArtifactRef`, so PDF bytes do not pass through the model.

```ts
import { PdfClient } from '@harryy/ai-tools/pdf'

const pdf = PdfClient.fromAuth({ storage })
const result = await pdf.extractPages({
  source,
  pages: [1, 3],
  output_key: 'deliverables/extract.pdf'
})
```
