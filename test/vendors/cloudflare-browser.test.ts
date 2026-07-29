import { describe, expect, test } from 'bun:test'

import { validateModule } from '../../src/core'
import {
	CloudflareBrowserClient,
	cloudflareBrowserGetSessionTool,
	cloudflareBrowserModule,
	cloudflareBrowserRenderPdfTool,
	cloudflareBrowserRenderScreenshotTool,
	cloudflareBrowserStartSessionTool,
	cloudflareBrowserStopSessionTool
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

	test('render payloads use the Cloudflare top-level option contract', async () => {
		const bodies: Record<string, unknown>[] = []
		const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
			const request = input instanceof Request ? input : new Request(input, init)
			if (request.method === 'POST') {
				const body = await request.json()
				if (typeof body === 'object' && body !== null) bodies.push(body)
				return new Response(
					request.url.endsWith('/pdf')
						? new Uint8Array([0x25, 0x50, 0x44, 0x46])
						: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
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
		await client.renderScreenshot({ source: { url: 'https://example.com' } })

		expect(bodies[0]).toMatchObject({
			printBackground: true,
			preferCSSPageSize: true,
			setJavaScriptEnabled: true,
			url: 'https://example.com'
		})
		expect(bodies[0]).not.toHaveProperty('pdfOptions')
		expect(bodies[0]).not.toHaveProperty('rejectResourceTypes')
		expect(bodies[1]).toMatchObject({
			fullPage: true,
			setJavaScriptEnabled: true,
			type: 'png',
			url: 'https://example.com'
		})
		expect(bodies[1]).not.toHaveProperty('screenshotOptions')
		expect(bodies[1]).not.toHaveProperty('rejectResourceTypes')
	})
})
