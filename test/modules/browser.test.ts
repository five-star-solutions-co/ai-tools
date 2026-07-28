import { describe, expect, test } from 'bun:test'

import { isToolError, runTool, validateModule } from '../../src/core'
import {
	browserClickTool,
	browserGetSessionTool,
	browserModule,
	browserNavigateTool,
	browserStartSessionTool,
	browserStopSessionTool
} from '../../src/modules/browser'

const auth = {
	provider: 'bedrock-agentcore',
	access_key_id: 'AKIAtest',
	secret_access_key: 'secret',
	region: 'us-east-1'
} as const

describe('browser', () => {
	test('module contracts and capability tool ids', () => {
		expect(validateModule(browserModule).ok).toBe(true)
		expect(browserModule.tools.map((tool) => tool.id).sort()).toEqual([
			'browser-click',
			'browser-get-session',
			'browser-get-state',
			'browser-navigate',
			'browser-screenshot',
			'browser-snapshot',
			'browser-start-session',
			'browser-stop-session',
			'browser-type',
			'browser-wait'
		])
	})

	test('bound provider serves start, get, and stop', async () => {
		const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
			const request = input instanceof Request ? input : new Request(input, init)
			if (request.url.includes('/sessions/start')) {
				return Response.json({ sessionId: 'b1', status: 'READY' })
			}
			if (request.url.includes('/sessions/get')) {
				return Response.json({ sessionId: 'b1', status: 'READY' })
			}
			if (request.url.includes('/sessions/stop')) {
				return Response.json({ sessionId: 'b1', status: 'TERMINATED' })
			}
			return new Response('unexpected path', { status: 500 })
		}
		const ctx = { auth, fetch }

		expect((await runTool(browserStartSessionTool, {}, ctx)).session_id).toBe('b1')
		expect((await runTool(browserGetSessionTool, { session_id: 'b1' }, ctx)).status).toBe('READY')
		expect((await runTool(browserStopSessionTool, { session_id: 'b1' }, ctx)).status).toBe('TERMINATED')
	})

	test('Cloudflare provider serves start, get, and stop with generic streams', async () => {
		const sessionId = '1909cef7-23e8-4394-bc31-27404bf4348f'
		const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
			const request = input instanceof Request ? input : new Request(input, init)
			if (request.method === 'POST') {
				expect(new URL(request.url).searchParams.get('keep_alive')).toBe('300000')
				return Response.json({
					sessionId,
					webSocketDebuggerUrl: `wss://api.cloudflare.com/browser/${sessionId}`
				})
			}
			if (request.url.includes('/devtools/session/')) {
				return Response.json({
					sessionId,
					devtoolsFrontendUrl: `https://live.browser.run/session/${sessionId}`,
					webSocketDebuggerUrl: `wss://api.cloudflare.com/browser/${sessionId}`
				})
			}
			if (request.method === 'DELETE') return Response.json({ status: 'closing' })
			return new Response('unexpected path', { status: 500 })
		}
		const ctx = {
			auth: { provider: 'cloudflare', account_id: 'account', api_token: 'token' } as const,
			fetch
		}

		const started = await runTool(browserStartSessionTool, { session_timeout_seconds: 300 }, ctx)
		expect(started.streams?.automation_stream_endpoint).toContain(sessionId)
		const got = await runTool(browserGetSessionTool, { session_id: sessionId }, ctx)
		expect(got.streams?.live_view_stream_endpoint).toContain(sessionId)
		expect((await runTool(browserStopSessionTool, { session_id: sessionId }, ctx)).status).toBe('closing')
	})

	test('Cloudflare navigate uses content API; click is unsupported', async () => {
		const sessionId = '1909cef7-23e8-4394-bc31-27404bf4348f'
		const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
			const request = input instanceof Request ? input : new Request(input, init)
			if (request.url.includes('/browser-rendering/content')) {
				return new Response('<html><title>Hi</title><body>ok</body></html>', {
					status: 200,
					headers: { 'content-type': 'text/html' }
				})
			}
			return new Response('unexpected', { status: 500 })
		}
		const ctx = {
			auth: { provider: 'cloudflare', account_id: 'account', api_token: 'token' } as const,
			fetch
		}
		const nav = await runTool(browserNavigateTool, { session_id: sessionId, url: 'https://example.com/' }, ctx)
		expect(nav.title).toBe('Hi')
		expect(nav.html).toContain('ok')
		try {
			await runTool(browserClickTool, { session_id: sessionId, selector: '#x' }, ctx)
			expect.unreachable()
		} catch (error) {
			expect(isToolError(error) && error.code === 'unsupported').toBe(true)
		}
	})

	test('Cloudflare provider rejects unsupported start fields and timeout bounds', async () => {
		const ctx = {
			auth: { provider: 'cloudflare', account_id: 'account', api_token: 'token' } as const,
			fetch: async () => Response.json({})
		}
		expect(runTool(browserStartSessionTool, { name: 'named' }, ctx)).rejects.toMatchObject({ code: 'bad_input' })
		expect(runTool(browserStartSessionTool, { session_timeout_seconds: 30 }, ctx)).rejects.toMatchObject({
			code: 'bad_input'
		})
	})
})
