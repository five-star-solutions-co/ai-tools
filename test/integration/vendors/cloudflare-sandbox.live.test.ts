import { describe, expect, test } from 'bun:test'

import { CloudflareSandboxClient } from '../../../src/vendors/cloudflare-sandbox'
import { env } from '../env'

const baseUrl = env('AI_TOOLS_CF_SANDBOX_BASE_URL')
const apiKey = env('AI_TOOLS_CF_SANDBOX_API_KEY')
const run = baseUrl && apiKey ? describe : describe.skip

run('live vendor cloudflare-sandbox', () => {
	test(
		'create executeCode write/read destroy',
		async () => {
			const client = new CloudflareSandboxClient({
				base_url: baseUrl!,
				api_key: apiKey!
			})
			const health = await client.health()
			expect(health.ok).toBe(true)

			const { sandbox_id } = await client.create()
			expect(sandbox_id.length).toBeGreaterThan(0)
			try {
				const running = await client.running({ sandbox_id })
				expect(running.running).toBe(true)

				const code = await client.executeCode({
					sandbox_id,
					code: 'print(40 + 2)',
					language: 'python'
				})
				expect(code.success).toBe(true)
				expect(code.stdout).toContain('42')

				await client.writeFile({
					sandbox_id,
					path: 'it/hello.txt',
					text: 'ai-tools-it\n'
				})
				const read = await client.readFile({ sandbox_id, path: 'it/hello.txt' })
				expect(read.text).toContain('ai-tools-it')
			} finally {
				await client.destroy({ sandbox_id }).catch(() => undefined)
			}
		},
		{ timeout: 180_000 }
	)
})
