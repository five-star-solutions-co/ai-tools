import { describe, expect, test } from 'bun:test'
import { isPlainObject } from 'es-toolkit'

import { isToolError, runTool, validateModule, withAuth } from '../../src/core'
import { ResendClient, resendModule, resendSendBatchTool, resendSendTool } from '../../src/vendors/resend'

function asRecord(value: unknown): Record<string, unknown> {
	if (!isPlainObject(value)) throw new Error('expected object')
	return value
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

function bodyFromInit(init?: RequestInit): Record<string, unknown> {
	const raw = init?.body
	if (typeof raw !== 'string') throw new Error('expected string body')
	return asRecord(JSON.parse(raw))
}

const auth = { api_key: 're_test_secret' } as const

describe('resend', () => {
	test('module contracts and tool ids', () => {
		expect(validateModule(resendModule).ok).toBe(true)
		expect(resendModule.auth.type).toBe('custom')
		expect(resendModule.tools.map((t) => t.id).sort()).toEqual(['resend-send', 'resend-send-batch'])
		expect(resendSendTool.id).toBe('resend-send')
		expect(resendSendBatchTool.id).toBe('resend-send-batch')
	})

	test('client send: URL, auth header, body shape (reply_to + attachment map)', async () => {
		const restore = mockFetch((url, init) => {
			expect(url).toBe('https://api.resend.com/emails')
			expect(init?.method).toBe('POST')
			const headers = new Headers(init?.headers)
			expect(headers.get('Authorization')).toBe('Bearer re_test_secret')
			expect(headers.get('Content-Type')).toContain('application/json')
			const body = bodyFromInit(init)
			expect(body['to']).toEqual(['hello@example.com'])
			expect(body['from']).toBe('From <from@example.com>')
			expect(body['subject']).toBe('Hi')
			expect(body['text']).toBe('Body')
			expect(body['reply_to']).toBe('reply@example.com')
			expect(body['replyTo']).toBeUndefined()
			expect(body['attachments']).toEqual([
				{
					filename: 'a.txt',
					content: 'dGVzdA==',
					content_type: 'text/plain',
					content_disposition: 'attachment'
				}
			])
			return new Response(JSON.stringify({ id: 'msg_1' }), { status: 200 })
		})

		try {
			const client = new ResendClient(auth)
			const result = await client.send({
				to: 'hello@example.com',
				from: { email: 'from@example.com', name: 'From' },
				subject: 'Hi',
				text: 'Body',
				reply_to: 'reply@example.com',
				attachments: [{ content: 'dGVzdA==', filename: 'a.txt', type: 'text/plain', disposition: 'attachment' }]
			})
			expect(result).toEqual({ success: true, id: 'msg_1' })
		} finally {
			restore()
		}
	})

	test('maps content_id for inline CID images', async () => {
		const restore = mockFetch((_url, init) => {
			const body = bodyFromInit(init)
			expect(body['attachments']).toEqual([
				{
					filename: 'logo.png',
					content: 'aW1n',
					content_type: 'image/png',
					content_disposition: 'inline',
					content_id: 'logo'
				}
			])
			return new Response(JSON.stringify({ id: 'msg_cid' }), { status: 200 })
		})

		try {
			const client = new ResendClient(auth)
			const result = await client.send({
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
			expect(result).toEqual({ success: true, id: 'msg_cid' })
		} finally {
			restore()
		}
	})

	test('send tool via withAuth + fromContext', async () => {
		const bound = withAuth(resendModule, auth)
		const tool = bound.tools.find((t) => t.id === 'resend-send')
		if (!tool) throw new Error('missing send tool')

		const restore = mockFetch(() => new Response(JSON.stringify({ id: 'msg_2' }), { status: 200 }))
		try {
			const result = asRecord(
				await runTool(tool, {
					to: 'a@example.com',
					from: 'b@example.com',
					subject: 'Hi',
					html: '<p>x</p>'
				})
			)
			expect(result).toEqual({ success: true, id: 'msg_2' })
		} finally {
			restore()
		}
	})

	test('batch tool returns per-message results', async () => {
		const bound = withAuth(resendModule, auth)
		const tool = bound.tools.find((t) => t.id === 'resend-send-batch')
		if (!tool) throw new Error('missing batch tool')

		let calls = 0
		const restore = mockFetch(() => {
			calls += 1
			return new Response(JSON.stringify({ id: `msg_${calls}` }), { status: 200 })
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
		const client = new ResendClient(auth)
		const many = Array.from({ length: 51 }, (_, i) => `u${i}@example.com`)
		try {
			await client.send({ to: many, from: 'from@example.com', subject: 'Hi', text: 'x' })
			expect.unreachable()
		} catch (error) {
			expect(isToolError(error)).toBe(true)
			if (isToolError(error)) expect(error.code).toBe('bad_input')
		}
	})

	test('HTTP 403 maps forbidden via HttpService', async () => {
		const restore = mockFetch(() => new Response('nope', { status: 403 }))
		try {
			// ofetch binds fetch at HttpService construct — mock before client.
			const client = new ResendClient(auth)
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
		expect(() => new ResendClient({ api_key: '' })).toThrow()
	})
})
