/**
 * Gotenberg form/path helpers (no HTTP).
 */

import { ToolError } from '../../core/errors'
import type { ArtifactRef } from '../../shared/artifact'
import { toArrayBuffer } from '../../shared/bytes'
import type { GotenbergRenderSource } from './contracts'

export function appendSource(form: FormData, source: GotenbergRenderSource): void {
	if (source.html) {
		const bytes = new TextEncoder().encode(source.html)
		const blob = new Blob([toArrayBuffer(bytes)], { type: 'text/html' })
		form.append('files', blob, 'index.html')
		return
	}
	if (source.url) {
		form.append('url', source.url)
		return
	}
	throw new ToolError('Provide html or url', { code: 'bad_input' })
}

export function htmlPath(kind: 'pdf' | 'screenshot', source: GotenbergRenderSource): string {
	if (source.html) {
		return kind === 'pdf' ? '/forms/chromium/convert/html' : '/forms/chromium/screenshot/html'
	}
	return kind === 'pdf' ? '/forms/chromium/convert/url' : '/forms/chromium/screenshot/url'
}

export function defaultRenderKey(kind: 'pdf' | 'screenshot', outputKey: string | undefined): string {
	if (outputKey) return outputKey
	const stamp = Date.now()
	return kind === 'pdf' ? `renders/${stamp}.pdf` : `renders/${stamp}.png`
}

/** LibreOffice route — office suite docs → PDF. */
export const LIBREOFFICE_CONVERT_PATH = '/forms/libreoffice/convert'

export function basenameFromKey(key: string): string {
	const parts = key.replace(/\/+$/, '').split('/')
	const last = parts[parts.length - 1]
	return last && last.length > 0 ? last : 'document'
}

export function officeUploadName(source: ArtifactRef, filename?: string): string {
	if (filename && filename.trim().length > 0) return filename.trim()
	if (source.filename && source.filename.trim().length > 0) return source.filename.trim()
	return basenameFromKey(source.key)
}

export function officeToPdfResultKey(sourceKey: string, outputKey: string | undefined): string {
	if (outputKey) return outputKey
	const base = sourceKey.replace(/\.[^./]+$/, '')
	return `${base}.pdf`
}

export function guessOfficeMediaType(filename: string, hint?: string): string {
	if (hint && hint.length > 0) return hint
	const lower = filename.toLowerCase()
	if (lower.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
	if (lower.endsWith('.doc')) return 'application/msword'
	if (lower.endsWith('.pptx')) return 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
	if (lower.endsWith('.ppt')) return 'application/vnd.ms-powerpoint'
	if (lower.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
	if (lower.endsWith('.xls')) return 'application/vnd.ms-excel'
	if (lower.endsWith('.odt')) return 'application/vnd.oasis.opendocument.text'
	if (lower.endsWith('.odp')) return 'application/vnd.oasis.opendocument.presentation'
	if (lower.endsWith('.ods')) return 'application/vnd.oasis.opendocument.spreadsheet'
	if (lower.endsWith('.rtf')) return 'application/rtf'
	if (lower.endsWith('.csv')) return 'text/csv'
	if (lower.endsWith('.txt')) return 'text/plain'
	return 'application/octet-stream'
}
