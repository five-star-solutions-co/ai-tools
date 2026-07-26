import { fileTypeFromBuffer } from 'file-type'

import { ToolError } from '../../../core/errors'
import { extensionFromMediaType, resolveFileExtension } from '../../../shared/content-type'
import { documentFormatSchema } from '../contracts'
import type { DocumentFormat } from '../contracts'

type FormatHints = {
	format?: DocumentFormat | undefined
	filename?: string | undefined
	media_type?: string | undefined
}

const LEGACY_OFFICE_EXTENSIONS = new Set(['doc', 'ppt', 'xls'])

function fromExtension(extension: string | undefined): DocumentFormat | undefined {
	if (!extension) return undefined
	const normalized = extension.toLowerCase()
	const parsed = documentFormatSchema.safeParse(normalized)
	if (parsed.success) return parsed.data
	if (normalized === 'htm') return 'html'
	if (LEGACY_OFFICE_EXTENSIONS.has(normalized)) {
		throw new ToolError('Legacy Office binaries must use office-to-pdf conversion before document read', {
			code: 'unsupported',
			details: { extension: normalized }
		})
	}
	return undefined
}

function fromMediaType(mediaType: string | undefined): DocumentFormat | undefined {
	if (!mediaType) return undefined
	const normalized = mediaType.split(';', 1)[0]?.trim().toLowerCase()
	if (!normalized) return undefined
	if (normalized.startsWith('image/')) return 'image'
	return fromExtension(extensionFromMediaType(normalized))
}

function fromHints(input: FormatHints): DocumentFormat | undefined {
	if (input.format) return input.format
	const mediaTypeFormat = fromMediaType(input.media_type)
	if (mediaTypeFormat) return mediaTypeFormat
	if (!input.filename) return undefined
	return fromExtension(resolveFileExtension({ filename: input.filename, fallback: '' }))
}

export function detectFormat(input: FormatHints): DocumentFormat {
	const format = fromHints(input)
	if (format) return format
	throw new ToolError('Could not detect document format; pass format or filename', { code: 'bad_input' })
}

export async function detectFormatFromBytes(bytes: Uint8Array, input: FormatHints): Promise<DocumentFormat> {
	if (input.format) return input.format
	const detected = await fileTypeFromBuffer(bytes)
	const byteFormat = fromMediaType(detected?.mime)
	if (byteFormat) return byteFormat
	return detectFormat(input)
}
