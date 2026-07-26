import { describe, expect, test } from 'bun:test'

import { CloudflareBrowserClient } from '../../../src/vendors/cloudflare-browser'
import { browserNavigateUrlFromEnv, browserSkipNavigateFromEnv, cloudflareAuthFromEnv, s3AuthFromEnv } from '../helpers'
import { cdpNavigate } from '../helpers/cdp-navigate'

const cf = cloudflareAuthFromEnv()
const storage = s3AuthFromEnv()
const navigateUrl = browserNavigateUrlFromEnv()
const skipNavigate = browserSkipNavigateFromEnv()
const runRender = cf ? describe : describe.skip
const runSession = cf ? describe : describe.skip

runRender('live vendor cloudflare-browser rendering', () => {
	test('renderPdf html to storage', async () => {
		const client = new CloudflareBrowserClient({
			account_id: cf!.account_id,
			api_token: cf!.api_token,
			storage
		})
		const out = await client.renderPdf({
			source: { html: '<html><body><h1>ai-tools cf browser it</h1></body></html>' },
			filename: 'cf-browser-it.pdf'
		})
		expect(out.kind).toBe('pdf')
		expect(out.result.key).toBeTruthy()
	})

	test('renderScreenshot html to storage', async () => {
		const client = new CloudflareBrowserClient({
			account_id: cf!.account_id,
			api_token: cf!.api_token,
			storage
		})
		const out = await client.renderScreenshot({
			source: { html: '<html><body><h1>ai-tools cf browser shot</h1></body></html>' },
			filename: 'cf-browser-it.png'
		})
		expect(out.kind).toBe('screenshot')
		expect(out.result.key).toBeTruthy()
	})
})

runSession('live vendor cloudflare-browser sessions', () => {
	test(
		'start get stop + optional CDP navigate',
		async () => {
			const client = new CloudflareBrowserClient({
				account_id: cf!.account_id,
				api_token: cf!.api_token
			})
			const started = await client.startSession({ keep_alive_seconds: 300 })
			expect(started.session_id.length).toBeGreaterThan(0)
			try {
				const got = await client.getSession({ session_id: started.session_id })
				expect(got.session_id).toBe(started.session_id)
				const stream = got.websocket_debugger_url ?? started.websocket_debugger_url
				expect(stream).toBeTruthy()

				if (!skipNavigate && stream) {
					const ok = await cdpNavigate(stream, navigateUrl, 25_000)
					if (!ok) {
						console.warn('[cloudflare-browser live] CDP navigate did not complete; session lifecycle still OK')
					}
				}
			} finally {
				await client.stopSession({ session_id: started.session_id })
			}
		},
		{ timeout: 60_000 }
	)
})
