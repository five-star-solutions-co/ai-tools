/**
 * Cloudflare Browser Rendering CDP mint (no HTTP).
 * Turns a session payload into Playwright / AgentBrowser connection options.
 */

import { ToolError } from '../../core/errors'
import type { CloudflareBrowserEngine, CloudflareBrowserSessionOutput } from './contracts'
import { browserEngineQuery } from './domain'

export type CloudflareBrowserCdpConnection = {
	session_id: string
	websocket_url: string
	/**
	 * Headers for the WebSocket upgrade when the host must attach the API token.
	 * Cloudflare's webSocketDebuggerUrl is often self-contained; pass api_token when your
	 * runtime requires Authorization on the upgrade.
	 */
	headers: Record<string, string>
	live_view_url?: string
	status?: string
}

export type MintCloudflareBrowserCdpOptions = {
	/** Cloudflare API token — sets Authorization: Bearer when provided. */
	api_token?: string
	/** Extra headers; caller keys win over defaults. */
	headers?: Record<string, string>
	/**
	 * Ensure `browser=kitesurf` on the WebSocket URL when the session was started with Kitesurf
	 * and the upstream URL omitted the query (idempotent if already present).
	 */
	browser?: CloudflareBrowserEngine
}

/**
 * Append engine query params without clobbering existing search keys.
 */
function withBrowserQuery(websocketUrl: string, engine: CloudflareBrowserEngine | undefined): string {
	const extra = browserEngineQuery(engine)
	if (!('browser' in extra)) return websocketUrl
	const url = new URL(websocketUrl)
	if (!url.searchParams.has('browser')) {
		url.searchParams.set('browser', extra.browser)
	}
	return url.toString()
}

/**
 * Mint CDP connection options from a Cloudflare Browser session (startSession / getSession).
 */
export function mintCloudflareBrowserCdpConnection(
	session: CloudflareBrowserSessionOutput,
	options: MintCloudflareBrowserCdpOptions = {}
): CloudflareBrowserCdpConnection {
	const rawUrl = session.websocket_debugger_url?.trim()
	if (!rawUrl) {
		throw new ToolError('Cloudflare Browser session has no websocket_debugger_url; start or get the session first', {
			code: 'bad_input',
			details: { session_id: session.session_id }
		})
	}

	const headers: Record<string, string> = {}
	if (options.api_token) {
		headers['Authorization'] = `Bearer ${options.api_token}`
	}
	if (options.headers) {
		Object.assign(headers, options.headers)
	}

	const out: CloudflareBrowserCdpConnection = {
		session_id: session.session_id,
		websocket_url: withBrowserQuery(rawUrl, options.browser),
		headers
	}
	if (session.devtools_frontend_url) out.live_view_url = session.devtools_frontend_url
	if (session.status) out.status = session.status
	return out
}
