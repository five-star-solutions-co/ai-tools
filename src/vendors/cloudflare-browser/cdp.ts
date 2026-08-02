/**
 * Cloudflare Browser Rendering CDP mint (no HTTP).
 * Turns a session payload into Playwright / AgentBrowser connection options.
 */

import { ToolError } from '../../core/errors'
import type { CloudflareBrowserSessionOutput } from './contracts'

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
}

/**
 * Mint CDP connection options from a Cloudflare Browser session (startSession / getSession).
 */
export function mintCloudflareBrowserCdpConnection(
	session: CloudflareBrowserSessionOutput,
	options: MintCloudflareBrowserCdpOptions = {}
): CloudflareBrowserCdpConnection {
	const websocket_url = session.websocket_debugger_url?.trim()
	if (!websocket_url) {
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
		websocket_url,
		headers
	}
	if (session.devtools_frontend_url) out.live_view_url = session.devtools_frontend_url
	if (session.status) out.status = session.status
	return out
}
