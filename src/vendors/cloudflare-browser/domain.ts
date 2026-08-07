/**
 * Cloudflare Browser Rendering payload helpers (no HTTP).
 * HTML → text / title via html-to-text (edge + node). No hand-rolled HTML parsers.
 */

import { compile } from 'html-to-text'

import { ToolError } from '../../core/errors'
import type { CloudflareBrowserEngine, CloudflareBrowserRenderSource } from './contracts'

/**
 * Query bag for Browser Run `?browser=`.
 * Only emits when non-default (kitesurf); chromium is the API default when omitted.
 */
export function browserEngineQuery(
	engine: CloudflareBrowserEngine | undefined
): { browser: 'kitesurf' } | Record<string, never> {
	if (engine === 'kitesurf') return { browser: 'kitesurf' }
	return {}
}

/** Prefer per-call engine, then host auth default. */
export function resolveBrowserEngine(
	override: CloudflareBrowserEngine | undefined,
	authDefault: CloudflareBrowserEngine | undefined
): CloudflareBrowserEngine | undefined {
	return override ?? authDefault
}

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

const htmlToPlainText = compile({
	decodeEntities: true,
	preserveNewlines: false,
	wordwrap: false,
	selectors: [
		{ selector: 'script', format: 'skip' },
		{ selector: 'style', format: 'skip' },
		{ selector: 'noscript', format: 'skip' }
	]
})

const htmlToTitle = compile({
	decodeEntities: true,
	wordwrap: false,
	baseElements: { selectors: ['title'], orderBy: 'occurrence', returnDomByDefault: false },
	selectors: [{ selector: 'title', format: 'inline' }]
})

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

/** Document title via html-to-text (not a hand-rolled HTML parser). */
export function titleFromHtml(html: string): string | undefined {
	const title = htmlToTitle(html).trim()
	return title.length > 0 ? title : undefined
}

/** Visible page text via html-to-text. */
export function plainTextFromHtml(html: string): string {
	return htmlToPlainText(html).trim()
}
