import { describe, expect, test } from 'bun:test'

import { BedrockAgentCoreBrowserClient } from '../../../src/vendors/bedrock-agentcore-browser'
import { awsCredentialsFromEnv, browserNavigateUrlFromEnv, browserSkipNavigateFromEnv, env } from '../env'
import { cdpNavigate } from '../helpers/cdp-navigate'

const aws = awsCredentialsFromEnv()
const browserId = env('AI_TOOLS_AWS_BROWSER_ID')
/** When set (default example.com), attempt CDP Page.navigate on automation stream. */
const navigateUrl = browserNavigateUrlFromEnv()
const skipNavigate = browserSkipNavigateFromEnv()
const run = aws ? describe : describe.skip

function client() {
	return new BedrockAgentCoreBrowserClient({
		access_key_id: aws!.access_key_id,
		secret_access_key: aws!.secret_access_key,
		region: aws!.region,
		...(aws!.session_token && { session_token: aws!.session_token }),
		...(browserId && { browser_id: browserId })
	})
}

run('live vendor bedrock-agentcore-browser', () => {
	test(
		'start get stop + optional CDP navigate via automation stream',
		async () => {
			const c = client()
			const started = await c.startSession({
				name: 'ai-tools-it-nav',
				session_timeout_seconds: 300,
				viewport_width: 1280,
				viewport_height: 720
			})
			expect(started.session_id.length).toBeGreaterThan(0)

			try {
				const got = await c.getSession({ session_id: started.session_id })
				expect(got.session_id).toBe(started.session_id)

				const stream = got.streams?.automation_stream_endpoint ?? started.streams?.automation_stream_endpoint

				if (!skipNavigate && stream) {
					// Best-effort navigation. AWS may require extra signed WS headers in some regions;
					// lifecycle still passes if CDP connect is rejected.
					const ok = await cdpNavigate(stream, navigateUrl, 25_000)
					if (!ok) {
						// Soft signal: stream present but CDP navigate failed (headers/policy).
						// Do not fail the pack lifecycle test.
						console.warn(
							'[bedrock-agentcore-browser live] CDP navigate did not complete; session lifecycle still OK. Stream:',
							stream
						)
					} else {
						expect(ok).toBe(true)
					}
				} else if (!stream) {
					console.warn('[bedrock-agentcore-browser live] no automation_stream_endpoint on start/get; skipped navigate')
				}
			} finally {
				await c.stopSession({ session_id: started.session_id })
			}
		},
		{ timeout: 90_000 }
	)
})
