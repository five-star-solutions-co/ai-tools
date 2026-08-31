import { describe, expect, test } from 'bun:test'

import { validateModule } from '../../src/core'
import {
	CloudflareBrowserClient,
	cloudflareBrowserGetSessionTool,
	cloudflareBrowserModule,
	cloudflareBrowserRenderPdfTool,
	cloudflareBrowserRenderScreenshotTool,
	cloudflareBrowserStartSessionTool,
	cloudflareBrowserStopSessionTool,
	mintCloudflareBrowserCdpConnection
} from '../../src/vendors/cloudflare-browser'

describe('cloudflare-browser', () => {
	test('module contracts and tool ids', () => {
		expect(validateModule(cloudflareBrowserModule).ok).toBe(true)
		expect(cloudflareBrowserModule.auth.type).toBe('custom')
		expect(cloudflareBrowserModule.tools.map((t) => t.id).sort()).toEqual([
			'cloudflare-browser-get-session',
			'cloudflare-browser-render-pdf',
			'cloudflare-browser-render-screenshot',
			'cloudflare-browser-start-session',
			'cloudflare-browser-stop-session'
		])
		expect(cloudflareBrowserRenderPdfTool.id).toBe('cloudflare-browser-render-pdf')
		expect(cloudflareBrowserRenderScreenshotTool.id).toBe('cloudflare-browser-render-screenshot')
		expect(cloudflareBrowserStartSessionTool.id).toBe('cloudflare-browser-start-session')
		expect(cloudflareBrowserGetSessionTool.id).toBe('cloudflare-browser-get-session')
		expect(cloudflareBrowserStopSessionTool.id).toBe('cloudflare-browser-stop-session')
	})

	test('start get and stop session lifecycle', async () => {
		const sessionId = '1909cef7-23e8-4394-bc31-27404bf4348f'
		const requests: string[] = []
		const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
			const request = input instanceof Request ? input : new Request(input, init)
			requests.push(`${request.method} ${request.url}`)
			expect(request.headers.get('authorization')).toBe('Bearer token')
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
			return new Response('unexpected request', { status: 500 })
		}
		const client = new CloudflareBrowserClient({ account_id: 'account', api_token: 'token' }, { fetch })

		const started = await client.startSession({ keep_alive_seconds: 300 })
		expect(started).toMatchObject({
			session_id: sessionId,
			status: 'active',
			websocket_debugger_url: `wss://api.cloudflare.com/browser/${sessionId}`
		})
		const got = await client.getSession({ session_id: sessionId })
		expect(got.devtools_frontend_url).toContain(sessionId)
		expect(await client.stopSession({ session_id: sessionId })).toEqual({
			session_id: sessionId,
			status: 'closing'
		})
		expect(requests).toHaveLength(3)
	})

	test('render payloads use the Cloudflare quick-action option contract', async () => {
		const bodies: Record<string, unknown>[] = []
		const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
			const request = input instanceof Request ? input : new Request(input, init)
			if (request.method === 'POST') {
				const body = await request.json()
				if (typeof body === 'object' && body !== null) bodies.push(body)
				return new Response(
					request.url.includes('/pdf')
						? // %PDF- prefix required by assertBinaryPrefix
							new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])
						: // PNG signature (8 bytes)
							new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
					{ status: 200 }
				)
			}
			if (request.method === 'PUT') return new Response(null, { status: 200 })
			return new Response('unexpected request', { status: 500 })
		}
		const client = new CloudflareBrowserClient(
			{
				account_id: 'account',
				api_token: 'token',
				storage: {
					access_key_id: 'access',
					bucket: 'artifacts',
					endpoint: 'https://storage.example.com',
					region: 'auto',
					secret_access_key: 'secret'
				}
			},
			{ fetch }
		)

		await client.renderPdf({ source: { url: 'https://example.com' } })
		await client.renderScreenshot({
			source: { url: 'https://example.com' },
			viewport: { device_scale_factor: 2, height: 1080, width: 1920 }
		})

		expect(bodies[0]).toMatchObject({
			pdfOptions: {
				preferCSSPageSize: true,
				printBackground: true
			},
			setJavaScriptEnabled: true,
			url: 'https://example.com'
		})
		expect(bodies[0]).not.toHaveProperty('preferCSSPageSize')
		expect(bodies[0]).not.toHaveProperty('printBackground')
		expect(bodies[0]).not.toHaveProperty('rejectResourceTypes')
		expect(bodies[1]).toMatchObject({
			screenshotOptions: {
				fullPage: true,
				type: 'png'
			},
			setJavaScriptEnabled: true,
			url: 'https://example.com',
			viewport: { deviceScaleFactor: 2, height: 1080, width: 1920 }
		})
		expect(bodies[1]).not.toHaveProperty('fullPage')
		expect(bodies[1]).not.toHaveProperty('type')
		expect(bodies[1]).not.toHaveProperty('rejectResourceTypes')
	})

	test('kitesurf engine is sent as ?browser=kitesurf via HttpService query', async () => {
		const urls: string[] = []
		const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
			const request = input instanceof Request ? input : new Request(input, init)
			urls.push(request.url)
			if (request.method === 'POST' && request.url.includes('/devtools/browser')) {
				return Response.json({
					sessionId: '1909cef7-23e8-4394-bc31-27404bf4348f',
					webSocketDebuggerUrl: 'wss://api.cloudflare.com/browser/session'
				})
			}
			if (request.method === 'POST' && request.url.includes('/content')) {
				return new Response('<html><title>Hi</title></html>', {
					status: 200,
					headers: { 'Content-Type': 'text/html' }
				})
			}
			if (request.method === 'POST') {
				return new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), { status: 200 })
			}
			if (request.method === 'PUT') return new Response(null, { status: 200 })
			return new Response('unexpected request', { status: 500 })
		}
		const storage = {
			access_key_id: 'access',
			bucket: 'artifacts',
			endpoint: 'https://storage.example.com',
			region: 'auto',
			secret_access_key: 'secret'
		}
		const authDefault = new CloudflareBrowserClient(
			{ account_id: 'account', api_token: 'token', browser: 'kitesurf', storage },
			{ fetch }
		)
		await authDefault.renderScreenshot({ source: { url: 'https://example.com' } })
		await authDefault.fetchContent({ url: 'https://example.com' })
		await authDefault.startSession({ keep_alive_seconds: 60 })
		const cfUrls = () => urls.filter((u) => u.includes('api.cloudflare.com'))
		expect(cfUrls().length).toBeGreaterThanOrEqual(3)
		expect(cfUrls().every((u) => new URL(u).searchParams.get('browser') === 'kitesurf')).toBe(true)

		urls.length = 0
		const chromiumDefault = new CloudflareBrowserClient(
			{ account_id: 'account', api_token: 'token', storage },
			{ fetch }
		)
		await chromiumDefault.renderScreenshot({ source: { url: 'https://example.com' }, browser: 'kitesurf' })
		expect(new URL(cfUrls()[0]!).searchParams.get('browser')).toBe('kitesurf')

		urls.length = 0
		await chromiumDefault.renderScreenshot({ source: { url: 'https://example.com' } })
		expect(new URL(cfUrls()[0]!).searchParams.has('browser')).toBe(false)
	})

	test('mintCloudflareBrowserCdpConnection appends browser=kitesurf when missing', () => {
		const base = mintCloudflareBrowserCdpConnection({
			session_id: '1909cef7-23e8-4394-bc31-27404bf4348f',
			websocket_debugger_url: 'wss://api.cloudflare.com/browser/session'
		})
		expect(base.websocket_url).toBe('wss://api.cloudflare.com/browser/session')

		const withEngine = mintCloudflareBrowserCdpConnection(
			{
				session_id: '1909cef7-23e8-4394-bc31-27404bf4348f',
				websocket_debugger_url: 'wss://api.cloudflare.com/browser/session'
			},
			{ browser: 'kitesurf' }
		)
		expect(new URL(withEngine.websocket_url).searchParams.get('browser')).toBe('kitesurf')

		const alreadySet = mintCloudflareBrowserCdpConnection(
			{
				session_id: '1909cef7-23e8-4394-bc31-27404bf4348f',
				websocket_debugger_url: 'wss://api.cloudflare.com/browser/session?browser=chromium'
			},
			{ browser: 'kitesurf' }
		)
		expect(new URL(alreadySet.websocket_url).searchParams.get('browser')).toBe('chromium')
	})
})
