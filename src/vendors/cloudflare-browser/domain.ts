/**
 * Cloudflare Browser Rendering payload helpers (no HTTP).
 */

import { ToolError } from '../../core/errors'
import type { CloudflareBrowserRenderSource } from './contracts'

/** Resource types blocked by default (no network subresources). */
export const blockedBrowserResourceTypes = [
	'document',
	'stylesheet',
	'image',
	'media',
	'font',
	'script',
	'texttrack',
	'xhr',
	'fetch',
	'prefetch',
	'eventsource',
	'websocket',
	'manifest',
	'signedexchange',
	'ping',
	'cspviolationreport',
	'preflight',
	'other'
] as const

export function sourceBody(source: CloudflareBrowserRenderSource): Record<string, unknown> {
	if (source.html) return { html: source.html }
	if (source.url) return { url: source.url }
	throw new ToolError('Provide html or url', { code: 'bad_input' })
}

export function assertBinaryPrefix(bytes: Uint8Array, kind: 'pdf' | 'screenshot'): void {
	if (kind === 'pdf') {
		const sig = new TextEncoder().encode('%PDF-')
		const ok = bytes.byteLength >= sig.byteLength && sig.every((b, i) => bytes[i] === b)
		if (!ok) throw new ToolError('Cloudflare Browser returned non-PDF body', { code: 'upstream' })
		return
	}
	const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
	const ok = bytes.byteLength >= png.byteLength && png.every((b, i) => bytes[i] === b)
	if (!ok) throw new ToolError('Cloudflare Browser returned non-PNG body', { code: 'upstream' })
}

export function defaultRenderKey(kind: 'pdf' | 'screenshot', outputKey: string | undefined): string {
	if (outputKey) return outputKey
	const stamp = Date.now()
	return kind === 'pdf' ? `renders/${stamp}.pdf` : `renders/${stamp}.png`
}

/** Best-effort title from rendered HTML. */
export function titleFromHtml(html: string): string | undefined {
	const match = html.match(/<title[^>]*>([^<]*)<\/title>/i)
	const title = match?.[1]?.trim()
	return title && title.length > 0 ? title : undefined
}
