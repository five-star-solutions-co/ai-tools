import { describe, expect, test } from 'bun:test'
import { isPlainObject } from 'es-toolkit'

import { isToolError, runTool, validateModule, withAuth } from '../../src/core'
import {
	emailAuthSchema,
	emailModule,
	emailSendBatchTool,
	emailSendInputSchema,
	emailSendTool
} from '../../src/modules/email'

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

describe('email', () => {
	test('module contracts and tool ids', () => {
		expect(validateModule(emailModule).ok).toBe(true)
		expect(emailModule.auth.type).toBe('custom')
		expect(emailModule.tools.map((t) => t.id).sort()).toEqual(['email-send', 'email-send-batch'])
		expect(emailSendTool.id).toBe('email-send')
		expect(emailSendBatchTool.id).toBe('email-send-batch')
		expect(Object.keys(emailSendInputSchema.shape)).toEqual([
			'to',
			'subject',
			'html',
			'text',
			'cc',
			'bcc',
			'reply_to',
			'attachments'
		])
	})

	test('resend provider injects the locked sender and ignores model overrides', async () => {
		const bound = withAuth(emailModule, {
			provider: 'resend',
			api_key: 're_secret',
			sender: { email: 'orbit@domain.com', name: 'Orbit' }
		})
		const tool = bound.tools.find((t) => t.id === 'email-send')
		if (!tool) throw new Error('missing send tool')

		const restore = mockFetch((url, init) => {
			expect(url).toBe('https://api.resend.com/emails')
			const headers = new Headers(init?.headers)
			expect(headers.get('Authorization')).toBe('Bearer re_secret')
			const body = bodyFromInit(init)
			expect(body['to']).toEqual(['a@example.com'])
			expect(body['from']).toBe('Orbit <orbit@domain.com>')
			expect(body['reply_to']).toBe('reply@example.com')
			expect(body['headers']).toBeUndefined()
			return new Response(JSON.stringify({ id: 'msg_r1' }), { status: 200 })
		})

		try {
			const result = asRecord(
				await runTool(tool, {
					to: 'a@example.com',
					from: 'attacker@example.com',
					subject: 'Hi',
					text: 'Body',
					reply_to: 'reply@example.com',
					headers: { 'x-model-header': 'blocked' }
				})
			)
			expect(result).toEqual({ success: true, id: 'msg_r1' })
		} finally {
			restore()
		}
	})

	test('cloudflare provider: path, auth header, accepted output', async () => {
		const bound = withAuth(emailModule, {
			provider: 'cloudflare',
			account_id: 'acc_1',
			api_token: 'tok_1',
			sender: { email: 'orbit@domain.com', name: 'Orbit' }
		})
		const tool = bound.tools.find((t) => t.id === 'email-send')
		if (!tool) throw new Error('missing send tool')

		const restore = mockFetch((url, init) => {
			expect(url).toBe('https://api.cloudflare.com/client/v4/accounts/acc_1/email/sending/send')
			const headers = new Headers(init?.headers)
			expect(headers.get('Authorization')).toBe('Bearer tok_1')
			const body = bodyFromInit(init)
			expect(body['replyTo']).toEqual('reply@example.com')
			expect(body['reply_to']).toBeUndefined()
			expect(body['from']).toEqual({ address: 'orbit@domain.com', name: 'Orbit' })
			return new Response(
				JSON.stringify({
					success: true,
					result: { delivered: ['a@example.com'], queued: [], permanent_bounces: [] }
				}),
				{ status: 200 }
			)
		})

		try {
			const result = asRecord(
				await runTool(tool, {
					to: 'a@example.com',
					subject: 'Hi',
					text: 'Body',
					reply_to: 'reply@example.com'
				})
			)
			expect(result).toEqual({ success: true, accepted: ['a@example.com'] })
		} finally {
			restore()
		}
	})

	test('batch tool returns per-message results (resend)', async () => {
		const bound = withAuth(emailModule, {
			provider: 'resend',
			api_key: 're_secret',
			sender: { email: 'orbit@domain.com', name: 'Orbit' }
		})
		const tool = bound.tools.find((t) => t.id === 'email-send-batch')
		if (!tool) throw new Error('missing batch tool')

		let calls = 0
		const restore = mockFetch((_url, init) => {
			calls += 1
			expect(bodyFromInit(init)['from']).toBe('Orbit <orbit@domain.com>')
			return new Response(JSON.stringify({ id: `msg_${calls}` }), { status: 200 })
		})

		try {
			const result = asRecord(
				await runTool(tool, {
					messages: [
						{ to: 'a@example.com', subject: '1', text: 'a' },
						{ to: 'b@example.com', subject: '2', text: 'b' }
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

	test('provider errors are neutral while preserving the original cause', async () => {
		const bound = withAuth(emailModule, {
			provider: 'cloudflare',
			account_id: 'acc_1',
			api_token: 'tok_1',
			sender: { email: 'orbit@domain.com', name: 'Orbit' }
		})
		const tool = bound.tools.find((candidate) => candidate.id === 'email-send')
		if (!tool) throw new Error('missing send tool')
		const restore = mockFetch(() => new Response(null, { status: 403 }))

		let caught: unknown
		try {
			await runTool(tool, {
				to: 'a@example.com',
				subject: 'Hi',
				text: 'Body'
			})
		} catch (error) {
			caught = error
		} finally {
			restore()
		}

		expect(isToolError(caught)).toBe(true)
		if (isToolError(caught)) {
			expect(caught.message).toBe('Email delivery was rejected')
			expect(caught.details).toBeUndefined()
			expect(isToolError(caught.cause)).toBe(true)
			if (isToolError(caught.cause)) {
				expect(caught.cause.message).toBe('Cloudflare Email send failed with HTTP 403')
			}
		}
	})

	test('batch results do not expose provider error messages', async () => {
		const bound = withAuth(emailModule, {
			provider: 'cloudflare',
			account_id: 'acc_1',
			api_token: 'tok_1',
			sender: { email: 'orbit@domain.com', name: 'Orbit' }
		})
		const tool = bound.tools.find((candidate) => candidate.id === 'email-send-batch')
		if (!tool) throw new Error('missing batch tool')
		const restore = mockFetch(() => new Response(null, { status: 403 }))

		try {
			const output = asRecord(
				await runTool(tool, {
					messages: [{ to: 'a@example.com', subject: 'Hi', text: 'Body' }]
				})
			)
			const results = output['results']
			if (!Array.isArray(results)) throw new Error('missing batch results')
			const first = asRecord(results[0])
			const error = asRecord(first['error'])
			expect(error['message']).toBe('Email delivery was rejected')
			expect(String(error['message'])).not.toContain('Cloudflare')
		} finally {
			restore()
		}
	})

	test('sender is required in provider auth', () => {
		const parsed = emailAuthSchema.safeParse({ provider: 'resend', api_key: 're_secret' })
		expect(parsed.success).toBe(false)
	})
})
