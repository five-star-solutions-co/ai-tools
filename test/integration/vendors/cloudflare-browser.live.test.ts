import { describe, expect, test } from 'bun:test'

import { CloudflareBrowserClient } from '../../../src/vendors/cloudflare-browser'
import { env, s3AuthFromEnv } from '../helpers'

const accountId = env('AI_TOOLS_CF_BROWSER_ACCOUNT_ID') ?? env('AI_TOOLS_CF_EMAIL_ACCOUNT_ID')
const apiToken = env('AI_TOOLS_CF_BROWSER_API_TOKEN')
const storage = s3AuthFromEnv('AI_TOOLS_S3')
const runRender = accountId && apiToken && storage ? describe : describe.skip
const runSession = accountId && apiToken ? describe : describe.skip

runRender('live vendor cloudflare-browser rendering', () => {
	test('renderPdf html to storage', async () => {
		const client = new CloudflareBrowserClient({
			account_id: accountId!,
			api_token: apiToken!,
			storage: storage!
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
			account_id: accountId!,
			api_token: apiToken!,
			storage: storage!
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
		'start get and stop session',
		async () => {
			const client = new CloudflareBrowserClient({
				account_id: accountId!,
				api_token: apiToken!
			})
			const started = await client.startSession({ keep_alive_seconds: 300 })
			expect(started.session_id.length).toBeGreaterThan(0)
			try {
				const got = await client.getSession({ session_id: started.session_id })
				expect(got.session_id).toBe(started.session_id)
				expect(got.websocket_debugger_url ?? started.websocket_debugger_url).toBeTruthy()
			} finally {
				await client.stopSession({ session_id: started.session_id })
			}
		},
		{ timeout: 60_000 }
	)
})
