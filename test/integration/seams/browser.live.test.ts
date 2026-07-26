import { describe, expect, test } from 'bun:test'

import { BrowserClient } from '../../../src/modules/browser'
import { awsCredentialsFromEnv, env } from '../env'

const aws = awsCredentialsFromEnv({ regionEnv: 'AI_TOOLS_BEDROCK_AGENTCORE_REGION' })
const browserId = env('AI_TOOLS_BEDROCK_AGENTCORE_BROWSER_ID')
const run = aws ? describe : describe.skip
const cloudflareAccountId = env('AI_TOOLS_CF_BROWSER_ACCOUNT_ID') ?? env('AI_TOOLS_CF_EMAIL_ACCOUNT_ID')
const cloudflareApiToken = env('AI_TOOLS_CF_BROWSER_API_TOKEN')
const runCloudflare = cloudflareAccountId && cloudflareApiToken ? describe : describe.skip

run('live seam browser', () => {
	test(
		'start get and stop through bound provider',
		async () => {
			const client = BrowserClient.fromAuth({
				provider: 'bedrock-agentcore',
				...aws!,
				...(browserId && { browser_id: browserId })
			})
			const started = await client.startSession({ name: 'ai-tools-seam', session_timeout_seconds: 300 })
			expect(started.session_id.length).toBeGreaterThan(0)
			try {
				const got = await client.getSession({ session_id: started.session_id })
				expect(got.session_id).toBe(started.session_id)
			} finally {
				await client.stopSession({ session_id: started.session_id })
			}
		},
		{ timeout: 90_000 }
	)
})

runCloudflare('live seam browser cloudflare provider', () => {
	test(
		'start get and stop through Cloudflare provider',
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
				expect(got.streams?.automation_stream_endpoint ?? started.streams?.automation_stream_endpoint).toBeTruthy()
			} finally {
				await client.stopSession({ session_id: started.session_id })
			}
		},
		{ timeout: 60_000 }
	)
})
