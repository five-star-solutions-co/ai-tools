/**
 * Browser session helpers (no HTTP).
 * CDP mint for host AgentBrowser / Playwright — interactive loop stays outside this pack.
 */

import { ToolError } from '../../core/errors'
import type { BrowserSessionOutput } from './contracts'

/** Connection handle for a CDP client (Playwright `connectOverCDP`, puppeteer, AgentBrowser). */
export type BrowserCdpConnection = {
	session_id: string
	/** WebSocket debugger URL for Chrome DevTools Protocol. */
	websocket_url: string
	/**
	 * Optional HTTP headers for the WebSocket upgrade.
	 * Empty for most providers when the URL already embeds credentials / signed query.
	 */
	headers: Record<string, string>
	/** Hosted live-view / DevTools UI when the provider returns one. */
	live_view_url?: string
	status?: string
}

export type MintBrowserCdpOptions = {
	/**
	 * Extra WebSocket headers (e.g. Authorization for custom proxies).
	 * Merged after provider defaults; caller keys win.
	 */
	headers?: Record<string, string>
}

/**
 * Build a CDP connection object from a browser session (start/get/get-state).
 * Prefer this over driving click/type tools when the host runs a hybrid agent browser.
 *
 * @throws ToolError `bad_input` when the session has no automation stream endpoint.
 */
export function mintBrowserCdpConnection(
	session: BrowserSessionOutput,
	options: MintBrowserCdpOptions = {}
): BrowserCdpConnection {
	const websocket_url =
		session.streams?.automation_stream_endpoint?.trim() ||
		// Cloudflare vendor shape is mapped into streams by the seam provider
		undefined

	if (!websocket_url) {
		throw new ToolError(
			'Browser session has no automation stream (CDP) endpoint; start or get the session and ensure the provider returns streams.automation_stream_endpoint',
			{
				code: 'bad_input',
				details: { session_id: session.session_id }
			}
		)
	}

	const headers: Record<string, string> = { ...options.headers }

	const out: BrowserCdpConnection = {
		session_id: session.session_id,
		websocket_url,
		headers
	}
	const live = session.streams?.live_view_stream_endpoint?.trim()
	if (live) out.live_view_url = live
	if (session.status) out.status = session.status
	return out
}
