import { ToolError } from '../../core/errors'
import { bytesToUtf8 } from '../../shared/bytes'
import type { DocumentFormat, DocumentReadOutput } from './contracts'
import { readDocument } from './formats/document'
import { readImageMetadata } from './formats/image'
import { readPdf } from './formats/pdf'
import { readPresentation } from './formats/presentation'
import { readSpreadsheet } from './formats/spreadsheet'
import { readHtml, readJson } from './formats/text'

export { buildDocument, patchDocx } from './formats/document'
export { detectFormat, detectFormatFromBytes } from './formats/format'
export { renderPdfPages } from './formats/pdf'
export { buildPresentation, patchPptx } from './formats/presentation'
export { buildSpreadsheet, patchSpreadsheet } from './formats/spreadsheet'
export { mediaTypeForTextFormat, patchTextDocument } from './formats/text'

type DocumentMetadata = {
	filename?: string | undefined
	media_type?: string | undefined
}

function baseOutput(format: DocumentFormat, bytes: Uint8Array, metadata: DocumentMetadata): DocumentReadOutput {
	return {
		format,
		byte_length: bytes.byteLength,
		...(metadata.filename && { filename: metadata.filename }),
		...(metadata.media_type && { media_type: metadata.media_type })
	}
}

export async function readBytes(
	format: DocumentFormat,
	bytes: Uint8Array,
	metadata: DocumentMetadata
): Promise<DocumentReadOutput> {
	const base = baseOutput(format, bytes, metadata)
	switch (format) {
		case 'txt':
		case 'md':
			return { ...base, text: bytesToUtf8(bytes) }
		case 'json':
			return { ...base, text: readJson(bytes) }
		case 'html':
			return { ...base, ...readHtml(bytesToUtf8(bytes)) }
		case 'csv':
		case 'xlsx':
			return { ...base, ...(await readSpreadsheet(format, bytes)) }
		case 'docx':
			return { ...base, ...(await readDocument(bytes)) }
		case 'pptx':
			return { ...base, ...(await readPresentation(bytes)) }
		case 'pdf':
			return { ...base, ...(await readPdf(bytes)) }
		case 'image': {
			const image = readImageMetadata(bytes)
			return image ? { ...base, image } : base
		}
		default:
			throw new ToolError('Unsupported format for read', { code: 'unsupported' })
	}
}
