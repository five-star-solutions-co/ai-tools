import { gunzipSync } from 'fflate'

import { ToolError } from '../../../core/errors'

function reportDocumentError(message: string, code: 'too_large' | 'unsupported' | 'upstream'): never {
	throw new ToolError(message, { code })
}

export async function decompressReportDocumentBytes(
	bytes: Uint8Array,
	compressionAlgorithm: string | undefined,
	maxBytes: number
): Promise<Uint8Array> {
	if (bytes.byteLength > maxBytes) {
		reportDocumentError('Amazon report document exceeds max_bytes', 'too_large')
	}
	if (!compressionAlgorithm) return bytes
	if (compressionAlgorithm.toUpperCase() !== 'GZIP') {
		reportDocumentError(`Unsupported Amazon report compression: ${compressionAlgorithm}`, 'unsupported')
	}
	try {
		const output = gunzipSync(bytes, { out: new Uint8Array(maxBytes + 1) })
		if (output.byteLength > maxBytes) {
			reportDocumentError('Amazon report document exceeds max_bytes after decompression', 'too_large')
		}
		return output.slice()
	} catch (error) {
		if (error instanceof ToolError) throw error
		reportDocumentError('Failed to decompress Amazon report document', 'upstream')
	}
}
