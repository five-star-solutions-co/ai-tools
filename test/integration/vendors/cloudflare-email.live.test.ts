import { describe, expect, test } from 'bun:test'

import { CloudflareEmailClient } from '../../../src/vendors/cloudflare-email'
import { cloudflareAuthFromEnv, env } from '../helpers'

const cf = cloudflareAuthFromEnv()
const from = env('AI_TOOLS_CF_EMAIL_FROM')
const to = env('AI_TOOLS_CF_EMAIL_TO')
const run = cf && from && to ? describe : describe.skip

run('live vendor cloudflare-email', () => {
	test('send text email', async () => {
		const client = new CloudflareEmailClient({
			api_token: cf!.api_token,
			account_id: cf!.account_id
		})
		const result = await client.send({
			from: from!,
			to: to!,
			subject: `[ai-tools it] cf-email ${Date.now()}`,
			text: 'ai-tools integration test (cloudflare-email)'
		})
		expect(result).toBeDefined()
	})

	test('sendBatch two messages', async () => {
		const client = new CloudflareEmailClient({
			api_token: cf!.api_token,
			account_id: cf!.account_id
		})
		const result = await client.sendBatch({
			messages: [
				{
					from: from!,
					to: to!,
					subject: `[ai-tools it] cf-email batch a ${Date.now()}`,
					text: 'batch a'
				},
				{
					from: from!,
					to: to!,
					subject: `[ai-tools it] cf-email batch b ${Date.now()}`,
					text: 'batch b'
				}
			]
		})
		expect(result).toBeDefined()
	})
})
