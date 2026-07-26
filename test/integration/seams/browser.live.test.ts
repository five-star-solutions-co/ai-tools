import { describe, expect, test } from 'bun:test'

import { BrowserClient } from '../../../src/modules/browser'
import {
	awsCredentialsFromEnv,
	browserNavigateUrlFromEnv,
	browserSkipNavigateFromEnv,
	cloudflareAuthFromEnv,
	env
} from '../env'
import { cdpNavigate } from '../helpers/cdp-navigate'

const aws = awsCredentialsFromEnv()
const browserId = env('AI_TOOLS_AWS_BROWSER_ID')
const navigateUrl = browserNavigateUrlFromEnv()
const skipNavigate = browserSkipNavigateFromEnv()
const runBedrock = aws ? describe : describe.skip

const cf = cloudflareAuthFromEnv()
const runCloudflare = cf ? describe : describe.skip

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
				account_id: cf!.account_id,
				api_token: cf!.api_token
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
