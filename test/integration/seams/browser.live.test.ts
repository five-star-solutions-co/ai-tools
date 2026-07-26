import { describe, expect, test } from 'bun:test'

import { BrowserClient } from '../../../src/modules/browser'
import { awsCredentialsFromEnv, env } from '../env'
import { cdpNavigate } from '../helpers/cdp-navigate'

const aws = awsCredentialsFromEnv({ regionEnv: 'AI_TOOLS_BEDROCK_AGENTCORE_REGION' })
const browserId = env('AI_TOOLS_BEDROCK_AGENTCORE_BROWSER_ID')
const navigateUrl = env('AI_TOOLS_BEDROCK_BROWSER_NAVIGATE_URL') ?? 'https://example.com'
const skipNavigate = env('AI_TOOLS_BEDROCK_BROWSER_SKIP_NAVIGATE') === '1'
const runBedrock = aws ? describe : describe.skip

const cloudflareAccountId = env('AI_TOOLS_CF_BROWSER_ACCOUNT_ID') ?? env('AI_TOOLS_CF_EMAIL_ACCOUNT_ID')
const cloudflareApiToken = env('AI_TOOLS_CF_BROWSER_API_TOKEN')
const runCloudflare = cloudflareAccountId && cloudflareApiToken ? describe : describe.skip

runBedrock('live seam browser bedrock-agentcore provider', () => {
	test(
		'start get stop + optional CDP navigate',
		async () => {
			const client = BrowserClient.fromAuth({
				provider: 'bedrock-agentcore',
				...aws!,
				...(browserId && { browser_id: browserId })
			})
			const started = await client.startSession({
				name: 'ai-tools-seam-nav',
				session_timeout_seconds: 300,
				viewport_width: 1280,
				viewport_height: 720
			})
			expect(started.session_id.length).toBeGreaterThan(0)
			try {
				const got = await client.getSession({ session_id: started.session_id })
				expect(got.session_id).toBe(started.session_id)

				const stream = got.streams?.automation_stream_endpoint ?? started.streams?.automation_stream_endpoint
				if (!skipNavigate && stream) {
					const ok = await cdpNavigate(stream, navigateUrl, 25_000)
					if (!ok) {
						console.warn('[browser seam] CDP navigate did not complete; lifecycle still OK. Stream:', stream)
					}
				}
			} finally {
				await client.stopSession({ session_id: started.session_id })
			}
		},
		{ timeout: 90_000 }
	)
})

runCloudflare('live seam browser cloudflare provider', () => {
	test(
		'start get stop + optional CDP navigate via debugger URL',
		async () => {
			const client = BrowserClient.fromAuth({
				provider: 'cloudflare',
				account_id: cloudflareAccountId!,
				api_token: cloudflareApiToken!
			})
			const started = await client.startSession({ session_timeout_seconds: 300 })
			expect(started.session_id.length).toBeGreaterThan(0)
			try {
				const got = await client.getSession({ session_id: started.session_id })
				expect(got.session_id).toBe(started.session_id)

				const stream = got.streams?.automation_stream_endpoint ?? started.streams?.automation_stream_endpoint
				expect(stream).toBeTruthy()

				if (!skipNavigate && stream) {
					const ok = await cdpNavigate(stream, navigateUrl, 25_000)
					if (!ok) {
						console.warn('[browser seam cloudflare] CDP navigate did not complete; lifecycle still OK. Stream:', stream)
					}
				}
			} finally {
				await client.stopSession({ session_id: started.session_id })
			}
		},
		{ timeout: 60_000 }
	)
})
