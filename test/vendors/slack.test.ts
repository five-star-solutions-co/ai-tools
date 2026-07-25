import { describe, expect, test } from 'bun:test'
import { createHmac } from 'node:crypto'
import { isPlainObject } from 'es-toolkit'

import { runTool, validateModule, withAuth } from '../../src/core'
import {
	isSlackDefiniteRejection,
	isSlackOutcomeUnknown,
	parseSlackEvent,
	SlackClient,
	slackModule,
	verifySlackRequestSignature
} from '../../src/vendors/slack'
import { classifySlackFailure, parseSlackResult } from '../../src/vendors/slack/domain'

function asRecord(value: unknown): Record<string, unknown> {
	if (!isPlainObject(value)) throw new Error('expected object')
	return value
}

describe('slack webhook helpers', () => {
	test('verifies request signature', () => {
		const signingSecret = '8f742231b10e8888abcd99yyyzzz85a5'
		const timestamp = '1531420618'
		const rawBody = '{"token":"x","type":"url_verification","challenge":"abc"}'
		const base = `v0:${timestamp}:${rawBody}`
		const signature = `v0=${createHmac('sha256', signingSecret).update(base, 'utf8').digest('hex')}`

		expect(
			verifySlackRequestSignature({
				signing_secret: signingSecret,
				raw_body: rawBody,
				timestamp,
				signature,
				nowSeconds: 1531420618
			})
		).toBe(true)

		expect(
			verifySlackRequestSignature({
				signing_secret: signingSecret,
				raw_body: rawBody,
				timestamp,
				signature: 'v0=deadbeef',
				nowSeconds: 1531420618
			})
		).toBe(false)

		expect(
			verifySlackRequestSignature({
				signing_secret: signingSecret,
				raw_body: rawBody,
				timestamp,
				signature,
				nowSeconds: 1531420618 + 600
			})
		).toBe(false)
	})

	test('parses url_verification challenge', () => {
		const parsed = parseSlackEvent({
			type: 'url_verification',
			challenge: 'challenge-token-xyz'
		})
		expect(parsed.ok).toBe(true)
		if (!parsed.ok) return
		expect('challenge' in parsed && parsed.challenge).toBe('challenge-token-xyz')
	})

	test('parses event_callback message', () => {
		const parsed = parseSlackEvent({
			type: 'event_callback',
			event_id: 'Ev123',
			team_id: 'T1',
			event: {
				type: 'message',
				user: 'U9',
				text: 'hello',
				ts: '1355517523.000005',
				channel: 'C100',
				channel_type: 'im',
				event_ts: '1355517523.000005'
			}
		})
		expect(parsed.ok).toBe(true)
		if (!parsed.ok || !('event' in parsed)) return
		expect(parsed.event.channel).toBe('slack')
		expect(parsed.event.event_id).toBe('Ev123')
		expect(parsed.event.chat_id).toBe('C100')
		expect(parsed.event.message_id).toBe('1355517523.000005')
		expect(parsed.event.text).toBe('hello')
		expect(parsed.event.user_id).toBe('U9')
	})

	test('parses block_actions with response_url', () => {
		const parsed = parseSlackEvent({
			type: 'block_actions',
			trigger_id: 'trig-1',
			user: { id: 'U1', username: 'alice' },
			channel: { id: 'C2' },
			message: { ts: '1.2' },
			response_url: 'https://hooks.slack.com/actions/T/B/x',
			actions: [{ action_id: 'btn', value: 'go' }]
		})
		expect(parsed.ok).toBe(true)
		if (!parsed.ok || !('event' in parsed)) return
		expect(parsed.event.callback_query_id).toBe('https://hooks.slack.com/actions/T/B/x')
		expect(parsed.event.callback_data).toBe('go')
		expect(parsed.event.chat_id).toBe('C2')
	})
})

describe('slack domain', () => {
	test('parseSlackResult maps ok false to definite rejection', () => {
		let caught: unknown
		try {
			parseSlackResult('Slack chat.postMessage', 200, { ok: false, error: 'channel_not_found' })
		} catch (error) {
			caught = error
		}
		expect(isSlackDefiniteRejection(caught)).toBe(true)
		expect(isSlackOutcomeUnknown(new Error('nope'))).toBe(false)
	})

	test('classifySlackFailure treats rate_limited as outcome_unknown', () => {
		expect(classifySlackFailure(200, 'rate_limited')).toBe('outcome_unknown')
		expect(classifySlackFailure(200, 'invalid_auth')).toBe('definite_rejection')
		expect(classifySlackFailure(500, undefined)).toBe('outcome_unknown')
	})
})

describe('slack module', () => {
	test('passes contracts', () => {
		expect(validateModule(slackModule).ok).toBe(true)
		expect(slackModule.tools.map((t) => t.id).sort()).toEqual([
			'slack-answer-callback',
			'slack-clear-reaction',
			'slack-download-file',
			'slack-edit-text',
			'slack-get-bot',
			'slack-send-chat-action',
			'slack-send-media',
			'slack-send-text',
			'slack-set-reaction'
		])
	})

	test('sendText tool posts chat.postMessage', async () => {
		const bound = withAuth(slackModule, { bot_token: 'xoxb-test' })
		const tool = bound.tools.find((t) => t.id === 'slack-send-text')
		if (!tool) throw new Error('missing tool')

		const original = globalThis.fetch
		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
			expect(url).toBe('https://slack.com/api/chat.postMessage')
			expect(init?.method).toBe('POST')
			const headers = new Headers(init?.headers)
			expect(headers.get('authorization')).toBe('Bearer xoxb-test')
			const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {}
			expect(body.channel).toBe('C99')
			expect(body.text).toBe('hi')
			expect(body.thread_ts).toBe('1.5')
			return new Response(JSON.stringify({ ok: true, ts: '11.0', channel: 'C99' }), {
				status: 200,
				headers: { 'content-type': 'application/json' }
			})
		}) as typeof globalThis.fetch

		try {
			const result = asRecord(
				await runTool(tool, {
					chat_id: 'C99',
					text: 'hi',
					reply_to_message_id: '1.5'
				})
			)
			expect(result['message_id']).toBe('11.0')
		} finally {
			globalThis.fetch = original
		}
	})

	test('sendChatAction without thread is a no-op success', async () => {
		const bound = withAuth(slackModule, { bot_token: 'xoxb-test' })
		const tool = bound.tools.find((t) => t.id === 'slack-send-chat-action')
		if (!tool) throw new Error('missing tool')
		const result = asRecord(await runTool(tool, { chat_id: 'C1', action: 'typing' }))
		expect(result['ok']).toBe(true)
	})

	test('sendChatAction with reply_to_message_id sets assistant.threads.setStatus', async () => {
		const bound = withAuth(slackModule, { bot_token: 'xoxb-test' })
		const tool = bound.tools.find((t) => t.id === 'slack-send-chat-action')
		if (!tool) throw new Error('missing tool')

		const original = globalThis.fetch
		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
			expect(url).toBe('https://slack.com/api/assistant.threads.setStatus')
			const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {}
			expect(body.channel_id).toBe('D1')
			expect(body.thread_ts).toBe('1724264405.531769')
			expect(body.status).toBe('is checking the request…')
			return new Response(JSON.stringify({ ok: true }), {
				status: 200,
				headers: { 'content-type': 'application/json' }
			})
		}) as typeof globalThis.fetch

		try {
			const result = asRecord(
				await runTool(tool, {
					chat_id: 'D1',
					action: 'typing',
					reply_to_message_id: '1724264405.531769'
				})
			)
			expect(result['ok']).toBe(true)
		} finally {
			globalThis.fetch = original
		}
	})

	test('client stopTyping clears assistant status when thread_ts set', async () => {
		const original = globalThis.fetch
		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
			expect(url).toBe('https://slack.com/api/assistant.threads.setStatus')
			const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {}
			expect(body.status).toBe('')
			expect(body.thread_ts).toBe('1.0')
			return new Response(JSON.stringify({ ok: true }), {
				status: 200,
				headers: { 'content-type': 'application/json' }
			})
		}) as typeof globalThis.fetch

		try {
			const client = new SlackClient({ bot_token: 'xoxb-test' })
			await client.stopTyping({ chat_id: 'D1', reply_to_message_id: '1.0' })
		} finally {
			globalThis.fetch = original
		}
	})

	test('client maps definite rejection from ok false', async () => {
		const original = globalThis.fetch
		globalThis.fetch = (async (_input: RequestInfo | URL, _init?: RequestInit) =>
			new Response(JSON.stringify({ ok: false, error: 'invalid_auth' }), {
				status: 200,
				headers: { 'content-type': 'application/json' }
			})) as typeof globalThis.fetch

		try {
			const client = new SlackClient({ bot_token: 'xoxb-t' })
			let caught: unknown
			try {
				await client.sendText({ chat_id: 'C1', text: 'x' })
			} catch (error) {
				caught = error
			}
			expect(isSlackDefiniteRejection(caught)).toBe(true)
		} finally {
			globalThis.fetch = original
		}
	})

	test('sendMedia uses form getUploadURLExternal then POST bytes then complete', async () => {
		const original = globalThis.fetch
		const steps: string[] = []
		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
			const method = init?.method ?? 'GET'
			if (url.includes('files.getUploadURLExternal')) {
				steps.push('getUploadURL')
				expect(method).toBe('POST')
				const headers = new Headers(init?.headers)
				expect(headers.get('content-type')).toContain('application/x-www-form-urlencoded')
				const raw =
					typeof init?.body === 'string' ? init.body : init?.body instanceof URLSearchParams ? init.body.toString() : ''
				expect(raw).toContain('filename=')
				expect(raw).toContain('length=')
				return new Response(
					JSON.stringify({
						ok: true,
						upload_url: 'https://files.slack.com/upload/v1/TEST',
						file_id: 'F123'
					}),
					{ status: 200, headers: { 'content-type': 'application/json' } }
				)
			}
			if (url.includes('files.slack.com/upload')) {
				steps.push('upload')
				expect(method).toBe('POST')
				return new Response('', { status: 200 })
			}
			if (url.includes('files.completeUploadExternal')) {
				steps.push('complete')
				const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {}
				expect(body.channel_id).toBe('C99')
				expect(body.files?.[0]?.id).toBe('F123')
				return new Response(
					JSON.stringify({
						ok: true,
						files: [{ id: 'F123', shares: { public: { C99: [{ ts: '99.1' }] } } }]
					}),
					{ status: 200, headers: { 'content-type': 'application/json' } }
				)
			}
			return new Response(JSON.stringify({ ok: false, error: 'unexpected' }), { status: 200 })
		}) as typeof globalThis.fetch

		try {
			const client = new SlackClient({ bot_token: 'xoxb-t' })
			const out = await client.sendMedia({
				chat_id: 'C99',
				kind: 'document',
				file_name: 'note.txt',
				body_base64: Buffer.from('hello slack').toString('base64'),
				content_type: 'text/plain'
			})
			expect(steps).toEqual(['getUploadURL', 'upload', 'complete'])
			expect(out.message_id).toBe('99.1')
		} finally {
			globalThis.fetch = original
		}
	})
})
