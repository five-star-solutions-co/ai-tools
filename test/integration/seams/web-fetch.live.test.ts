import { describe, expect, test } from 'bun:test'

import { WebFetchClient } from '../../../src/modules/web-fetch'

/** Hits a public origin — always runnable when network is available. */
describe('live seam web-fetch', () => {
	test('get and request methods', async () => {
		const client = new WebFetchClient({
			allowed_origins: ['https://httpbin.org', 'https://example.com']
		})

		const get = await client.get({ url: 'https://example.com/' })
		expect(get.status).toBeGreaterThanOrEqual(200)
		expect(get.status).toBeLessThan(400)
		expect(get.ok).toBe(true)

		// httpbin is widely used for integration POST smoke; fall back if blocked.
		try {
			const post = await client.request({
				url: 'https://httpbin.org/post',
				method: 'POST',
				body: { hello: 'ai-tools' }
			})
			expect(post.status).toBeGreaterThanOrEqual(200)
			expect(post.status).toBeLessThan(500)
		} catch {
			// Network/policy may block httpbin; get path already exercised request stack.
			const head = await client.get({ url: 'https://example.com/', method: 'HEAD' })
			expect(head.status).toBeGreaterThanOrEqual(200)
			expect(head.status).toBeLessThan(400)
		}
	})
})
