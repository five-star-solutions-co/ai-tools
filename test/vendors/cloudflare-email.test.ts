import { describe, expect, test } from 'bun:test'
import { isPlainObject } from 'es-toolkit'

import { isToolError, runTool, validateModule, withAuth } from '../../src/core'
import {
	CloudflareEmailClient,
	cloudflareEmailModule,
	cloudflareEmailSendBatchTool,
	cloudflareEmailSendTool
} from '../../src/vendors/cloudflare-email'

function asRecord(value: unknown): Record<string, unknown> {
	if (!isPlainObject(value)) throw new Error('expected object')
	return value
}

function bodyFromInit(init?: RequestInit): Record<string, unknown> {
	const raw = init?.body
	if (typeof raw !== 'string') throw new Error('expected string body')
	return asRecord(JSON.parse(raw))
}

function mockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
	const original = globalThis.fetch
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
		return handler(url, init)
	}) as typeof globalThis.fetch
	return () => {
		globalThis.fetch = original
	}
}

const auth = { account_id: 'acc_123', api_token: 'tok_secret' } as const

const okBody = {
	success: true,
	result: {
		delivered: ['hello@example.com'],
		queued: [] as string[],
		permanent_bounces: [] as string[]
	}
}

describe('cloudflare-email', () => {
	test('module contracts and tool ids', () => {
		expect(validateModule(cloudflareEmailModule).ok).toBe(true)
		expect(cloudflareEmailModule.auth.type).toBe('custom')
		expect(cloudflareEmailModule.tools.map((t) => t.id).sort()).toEqual([
			'cloudflare-email-send',
			'cloudflare-email-send-batch'
		])
		expect(cloudflareEmailSendTool.id).toBe('cloudflare-email-send')
		expect(cloudflareEmailSendBatchTool.id).toBe('cloudflare-email-send-batch')
	})

	test('client send: URL, auth header, body shape (replyTo camelCase)', async () => {
		const restore = mockFetch((url, init) => {
			expect(url).toBe('https://api.cloudflare.com/client/v4/accounts/acc_123/email/sending/send')
			expect(init?.method).toBe('POST')
			const headers = new Headers(init?.headers)
			expect(headers.get('Authorization')).toBe('Bearer tok_secret')
			expect(headers.get('Content-Type')).toContain('application/json')
			const body = bodyFromInit(init)
			expect(body['to']).toEqual(['hello@example.com'])
			expect(body['from']).toEqual({ email: 'from@example.com', name: 'From' })
			expect(body['subject']).toBe('Hi')
			expect(body['text']).toBe('Body')
			expect(body['replyTo']).toEqual('reply@example.com')
			expect(body['reply_to']).toBeUndefined()
			expect(body['attachments']).toEqual([
				{
					content: 'dGVzdA==',
					filename: 'a.txt',
					type: 'text/plain',
					disposition: 'attachment'
				}
			])
			return new Response(JSON.stringify(okBody), { status: 200 })
		})

		try {
			const client = new CloudflareEmailClient(auth)
			const result = await client.send({
				to: 'hello@example.com',
				from: { email: 'from@example.com', name: 'From' },
				subject: 'Hi',
				text: 'Body',
				reply_to: 'reply@example.com',
				attachments: [{ content: 'dGVzdA==', filename: 'a.txt', type: 'text/plain', disposition: 'attachment' }]
			})
			expect(result).toEqual({ success: true, accepted: ['hello@example.com'] })
		} finally {
			restore()
		}
	})

	test('maps content_id to contentId for inline CID images', async () => {
		const restore = mockFetch((_url, init) => {
			const body = bodyFromInit(init)
			expect(body['html']).toBe('<p><img src="cid:logo"/></p>')
			expect(body['attachments']).toEqual([
				{
					content: 'aW1n',
					filename: 'logo.png',
					type: 'image/png',
					disposition: 'inline',
					contentId: 'logo'
				}
			])
			expect(JSON.stringify(body)).not.toContain('content_id')
			return new Response(JSON.stringify(okBody), { status: 200 })
		})

		try {
			const client = new CloudflareEmailClient(auth)
			await client.send({
				to: 'hello@example.com',
				from: 'from@example.com',
				subject: 'Logo',
				html: '<p><img src="cid:logo"/></p>',
				attachments: [
					{
						content: 'aW1n',
						filename: 'logo.png',
						type: 'image/png',
						disposition: 'inline',
						content_id: 'logo'
					}
				]
			})
		} finally {
			restore()
		}
	})

	test('send tool via withAuth + fromContext', async () => {
		const bound = withAuth(cloudflareEmailModule, auth)
		const tool = bound.tools.find((t) => t.id === 'cloudflare-email-send')
		if (!tool) throw new Error('missing send tool')

		const restore = mockFetch(() => new Response(JSON.stringify(okBody), { status: 200 }))
		try {
			const result = asRecord(
				await runTool(tool, {
					to: 'hello@example.com',
					from: 'from@example.com',
					subject: 'Hi',
					html: '<p>x</p>'
				})
			)
			expect(result['success']).toBe(true)
			expect(result['accepted']).toEqual(['hello@example.com'])
		} finally {
			restore()
		}
	})

	test('batch tool returns per-message results', async () => {
		const bound = withAuth(cloudflareEmailModule, auth)
		const tool = bound.tools.find((t) => t.id === 'cloudflare-email-send-batch')
		if (!tool) throw new Error('missing batch tool')

		let calls = 0
		const restore = mockFetch(() => {
			calls += 1
			return new Response(
				JSON.stringify({
					success: true,
					result: { delivered: [`u${calls}@example.com`], queued: [], permanent_bounces: [] }
				}),
				{ status: 200 }
			)
		})

		try {
			const result = asRecord(
				await runTool(tool, {
					messages: [
						{ to: 'a@example.com', from: 'f@example.com', subject: '1', text: 'a' },
						{ to: 'b@example.com', from: 'f@example.com', subject: '2', text: 'b' }
					]
				})
			)
			expect(result['succeeded']).toBe(2)
			expect(result['failed']).toBe(0)
			expect(calls).toBe(2)
		} finally {
			restore()
		}
	})

	test('recipient limit', async () => {
		const client = new CloudflareEmailClient(auth)
		const many = Array.from({ length: 51 }, (_, i) => `u${i}@example.com`)
		try {
			await client.send({ to: many, from: 'from@example.com', subject: 'Hi', text: 'x' })
			expect.unreachable()
		} catch (error) {
			expect(isToolError(error)).toBe(true)
			if (isToolError(error)) expect(error.code).toBe('bad_input')
		}
	})

	test('success:false maps bad_auth', async () => {
		const restore = mockFetch(
			() =>
				new Response(JSON.stringify({ success: false, errors: [{ code: 10000, message: 'Authentication error' }] }), {
					status: 200
				})
		)
		try {
			// ofetch binds fetch at HttpService construct — mock before client.
			const client = new CloudflareEmailClient(auth)
			await client.send({ to: 'a@example.com', from: 'b@example.com', subject: 'Hi', text: 'x' })
			expect.unreachable()
		} catch (error) {
			expect(isToolError(error)).toBe(true)
			if (isToolError(error)) expect(error.code).toBe('bad_auth')
		} finally {
			restore()
		}
	})

	test('HTTP 403 maps forbidden via HttpService', async () => {
		const restore = mockFetch(() => new Response('nope', { status: 403 }))
		try {
			const client = new CloudflareEmailClient(auth)
			await client.send({ to: 'a@example.com', from: 'b@example.com', subject: 'Hi', text: 'x' })
			expect.unreachable()
		} catch (error) {
			expect(isToolError(error)).toBe(true)
			if (isToolError(error)) expect(error.code).toBe('forbidden')
		} finally {
			restore()
		}
	})

	test('invalid auth rejected at construct', () => {
		expect(() => new CloudflareEmailClient({ account_id: '', api_token: 'x' })).toThrow()
	})
})
