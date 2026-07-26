# Image

| | |
| --- | --- |
| **Import** | `@harryy/ai-tools/image` |
| **Kind** | capability module |
| **Engine** | `sharp` |

Artifact-backed image inspection and transforms.

| Tool | Purpose |
| --- | --- |
| `image-metadata` | Decode format, dimensions, color space, channels, alpha, and page count |
| `image-resize` | Resize by width, height, or bounding box |
| `image-crop` | Extract a pixel rectangle |
| `image-thumbnail` | Fit within bounds without enlargement |
| `image-convert` | Encode JPEG, PNG, WebP, AVIF, TIFF, or GIF |

The package delegates image decoding and encoding to `sharp`. Content types and extensions are resolved through the shared MIME library.

```ts
import { ImageClient } from '@harryy/ai-tools/image'

const image = ImageClient.fromAuth({ storage })
const result = await image.thumbnail({
  source,
  width: 512,
  height: 512,
  output_key: 'images/thumbnail.webp'
})
```
