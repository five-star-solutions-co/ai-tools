import { describe, expect, test } from 'bun:test'

import { EmailClient } from '../../../src/modules/email'
import { cloudflareAuthFromEnv, env } from '../helpers'

const resendKey = env('AI_TOOLS_RESEND_API_KEY')
const resendFrom = env('AI_TOOLS_RESEND_FROM')
const resendTo = env('AI_TOOLS_RESEND_TO')
const runResend = resendKey && resendFrom && resendTo ? describe : describe.skip

const cf = cloudflareAuthFromEnv()
const cfFrom = env('AI_TOOLS_CF_EMAIL_FROM')
const cfTo = env('AI_TOOLS_CF_EMAIL_TO')
const runCf = cf && cfFrom && cfTo ? describe : describe.skip

runResend('live seam email (resend)', () => {
	test('send + sendBatch', async () => {
		const client = EmailClient.fromAuth({
			provider: 'resend',
			api_key: resendKey!
		})
		const out = await client.send({
			from: resendFrom!,
			to: resendTo!,
			subject: `[ai-tools it] email seam ${Date.now()}`,
			text: 'email seam integration'
		})
		expect(out).toBeDefined()
		const batch = await client.sendBatch({
			messages: [
				{
					from: resendFrom!,
					to: resendTo!,
					subject: `[ai-tools it] email seam batch a ${Date.now()}`,
					text: 'a'
				},
				{
					from: resendFrom!,
					to: resendTo!,
					subject: `[ai-tools it] email seam batch b ${Date.now()}`,
					text: 'b'
				}
			]
		})
		expect(batch).toBeDefined()
	})
})

runCf('live seam email (cloudflare)', () => {
	test(
		'send + sendBatch',
		async () => {
			const client = EmailClient.fromAuth({
				provider: 'cloudflare',
				api_token: cf!.api_token,
				account_id: cf!.account_id
			})
			const out = await client.send({
				from: cfFrom!,
				to: cfTo!,
				subject: `[ai-tools it] email seam cf ${Date.now()}`,
				text: 'email seam cloudflare'
			})
			expect(out).toBeDefined()
			const batch = await client.sendBatch({
				messages: [
					{
						from: cfFrom!,
						to: cfTo!,
						subject: `[ai-tools it] email seam cf batch a ${Date.now()}`,
						text: 'a'
					},
					{
						from: cfFrom!,
						to: cfTo!,
						subject: `[ai-tools it] email seam cf batch b ${Date.now()}`,
						text: 'b'
					}
				]
			})
			expect(batch).toBeDefined()
		},
		{ timeout: 60_000 }
	)
})
