import { describe, expect, test } from 'bun:test'

import { CodeSandboxClient } from '../../../src/modules/code-sandbox'
import { awsCredentialsFromEnv, env } from '../env'

const cfBase = env('AI_TOOLS_CF_SANDBOX_BASE_URL')
const cfKey = env('AI_TOOLS_CF_SANDBOX_API_KEY')
const aws = awsCredentialsFromEnv()

const runCf = cfBase && cfKey ? describe : describe.skip
const runAws = aws ? describe : describe.skip

runCf('live seam code-sandbox cloudflare', () => {
	test(
		'start execute stop',
		async () => {
			const client = CodeSandboxClient.fromAuth({
				provider: 'cloudflare',
				base_url: cfBase!,
				api_key: cfKey!
			})
			const started = await client.startSession()
			try {
				const out = await client.executeCode({
					session_id: started.session_id,
					code: 'print("seam-ok")',
					language: 'python'
				})
				expect(out.success).toBe(true)
				expect(out.stdout ?? '').toContain('seam-ok')
			} finally {
				await client.stopSession({ session_id: started.session_id }).catch(() => undefined)
			}
		},
		{ timeout: 180_000 }
	)
})

// Only when AWS keys present. Fails hard on quota (no soft-skip — host must raise limits or omit keys).
runAws('live seam code-sandbox bedrock-agentcore', () => {
	test(
		'start execute stop',
		async () => {
			const client = CodeSandboxClient.fromAuth({
				provider: 'bedrock-agentcore',
				...aws!
			})
			const started = await client.startSession({
				name: 'ai-tools-seam-it',
				session_timeout_seconds: 300
			})
			try {
				const out = await client.executeCode({
					session_id: started.session_id,
					code: 'print(2+2)',
					language: 'python'
				})
				expect(out.session_id).toBe(started.session_id)
			} finally {
				await client.stopSession({ session_id: started.session_id }).catch(() => undefined)
			}
		},
		{ timeout: 180_000 }
	)
})
