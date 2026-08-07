import { describe, expect, test } from 'bun:test'
import { isPlainObject } from 'es-toolkit'

import { runTool, validateModule, withAuth } from '../../src/core'
import {
	isTeamsActivity,
	isTeamsDefiniteRejection,
	isTeamsOutcomeUnknown,
	parseTeamsActivity,
	TeamsClient,
	teamsModule,
	verifyTeamsAuthHeader
} from '../../src/vendors/teams'

function asRecord(value: unknown): Record<string, unknown> {
	if (!isPlainObject(value)) throw new Error('expected object')
	return value
}

function mockFetch(
	handler: (
		url: string,
		headers: Headers,
		init?: RequestInit,
		input?: RequestInfo | URL
	) => Response | Promise<Response>
) {
	const original = globalThis.fetch
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
		const headers = input instanceof Request ? new Headers(input.headers) : new Headers(init?.headers)
		return handler(url, headers, init, input)
	}) as typeof globalThis.fetch
	return () => {
		globalThis.fetch = original
	}
}

const auth = {
	app_id: 'app-123',
	app_password: 'secret-xyz'
}

const serviceUrl = 'https://smba.trafficmanager.net/amer/'

describe('teams webhook helpers', () => {
	test('verifyTeamsAuthHeader checks bearer presence only', () => {
		expect(verifyTeamsAuthHeader('Bearer abc.def')).toBe(true)
		expect(verifyTeamsAuthHeader('Bearer ')).toBe(false)
		expect(verifyTeamsAuthHeader(null)).toBe(false)
		expect(verifyTeamsAuthHeader('Basic x')).toBe(false)
	})

	test('isTeamsActivity requires type + conversation.id', () => {
		expect(isTeamsActivity({ type: 'message', conversation: { id: 'c1' } })).toBe(true)
		expect(isTeamsActivity({ type: 'message' })).toBe(false)
		expect(isTeamsActivity(null)).toBe(false)
	})

	test('parseTeamsActivity maps message + service_url', () => {
		const parsed = parseTeamsActivity({
			type: 'message',
			id: 'a1',
			text: 'hello',
			serviceUrl,
			conversation: { id: 'conv-9', conversationType: 'personal' },
			from: { id: 'user-1', name: 'Ada' },
			replyToId: 'a0'
		})
		expect(parsed.ok).toBe(true)
		if (!parsed.ok) return
		expect(parsed.event.channel).toBe('teams')
		expect(parsed.event.event_id).toBe('a1')
		expect(parsed.event.chat_id).toBe('conv-9')
		expect(parsed.event.message_id).toBe('a1')
		expect(parsed.event.text).toBe('hello')
		expect(parsed.event.user_id).toBe('user-1')
		expect(parsed.event.username).toBe('Ada')
		expect(parsed.event.service_url).toBe(serviceUrl)
		expect(parsed.event.reply_to).toBe('a0')
		expect(parsed.event.chat_type).toBe('personal')
	})

	test('parseTeamsActivity maps invoke callback fields', () => {
		const parsed = parseTeamsActivity({
			type: 'invoke',
			id: 'inv-1',
			serviceUrl,
			conversation: { id: 'conv-2' },
			from: { id: 'u2' },
			value: { action: 'approve', id: 7 }
		})
		expect(parsed.ok).toBe(true)
		if (!parsed.ok) return
		expect(parsed.event.raw_type).toBe('invoke')
		expect(parsed.event.callback_query_id).toBe('inv-1')
		expect(parsed.event.callback_data).toContain('approve')
		expect(parsed.event.service_url).toBe(serviceUrl)
	})

	test('parseTeamsActivity rejects empty message', () => {
		const parsed = parseTeamsActivity({
			type: 'message',
			id: 'a2',
			conversation: { id: 'c' }
		})
		expect(parsed.ok).toBe(false)
	})
})

describe('teams module', () => {
	test('passes contracts', () => {
		expect(validateModule(teamsModule).ok).toBe(true)
		expect(teamsModule.tools.map((t) => t.id).sort()).toEqual([
			'teams-answer-callback',
			'teams-clear-reaction',
			'teams-download-file',
			'teams-edit-text',
			'teams-get-bot',
			'teams-send-chat-action',
			'teams-send-media',
			'teams-send-text',
			'teams-set-reaction'
		])
	})

	test('sendText tool exchanges token then posts activity', async () => {
		const bound = withAuth(teamsModule, auth)
		const tool = bound.tools.find((t) => t.id === 'teams-send-text')
		if (!tool) throw new Error('missing tool')

		let tokenCalls = 0
		const restore = mockFetch((url, headers, init) => {
			if (url.includes('login.microsoftonline.com')) {
				tokenCalls += 1
				expect(url).toBe('https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token')
				expect(init?.method?.toUpperCase() ?? 'POST').toBe('POST')
				const body = typeof init?.body === 'string' ? init.body : ''
				expect(body).toContain('grant_type=client_credentials')
				expect(body).toContain('client_id=app-123')
				expect(body).toContain('scope=https%3A%2F%2Fapi.botframework.com%2F.default')
				return new Response(JSON.stringify({ access_token: 'tok-1', expires_in: 3600 }), {
					status: 200,
					headers: { 'content-type': 'application/json' }
				})
			}
			expect(url).toBe(`${serviceUrl.replace(/\/$/, '')}/v3/conversations/conv-1/activities`)
			expect(headers.get('Authorization')).toBe('Bearer tok-1')
			const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {}
			expect(body.type).toBe('message')
			expect(body.text).toBe('hi teams')
			expect(body.replyToId).toBe('parent-9')
			return new Response(JSON.stringify({ id: 'act-42' }), {
				status: 200,
				headers: { 'content-type': 'application/json' }
			})
		})

		try {
			const result = asRecord(
				await runTool(tool, {
					chat_id: 'conv-1',
					text: 'hi teams',
					reply_to_message_id: 'parent-9',
					service_url: serviceUrl
				})
			)
			expect(tokenCalls).toBe(1)
			expect(result['message_id']).toBe('act-42')
		} finally {
			restore()
		}
	})

	test('client caches access token across calls', async () => {
		let tokenCalls = 0
		const restore = mockFetch((url) => {
			if (url.includes('login.microsoftonline.com')) {
				tokenCalls += 1
				return new Response(JSON.stringify({ access_token: 'tok-cache', expires_in: 3600 }), {
					status: 200
				})
			}
			return new Response(JSON.stringify({ id: 'm1' }), { status: 200 })
		})

		try {
			const client = new TeamsClient(auth)
			await client.sendText({ chat_id: 'c', text: 'one', service_url: serviceUrl })
			await client.sendText({ chat_id: 'c', text: 'two', service_url: serviceUrl })
			expect(tokenCalls).toBe(1)
		} finally {
			restore()
		}
	})

	test('setReaction and clearReaction are no-ops without tenant_id', async () => {
		const client = new TeamsClient(auth)
		await client.setReaction({ chat_id: 'c', message_id: 'm', emoji: '👍' })
		await client.clearReaction({ chat_id: 'c', message_id: 'm', emoji: '👍' })
	})

	test('setReaction uses Graph when tenant_id is bound', async () => {
		const calls: string[] = []
		const restore = mockFetch((url, _headers, init) => {
			calls.push(url)
			if (url.includes('login.microsoftonline.com')) {
				return new Response(JSON.stringify({ access_token: 'g-tok', expires_in: 3600 }), { status: 200 })
			}
			if (url.includes('graph.microsoft.com') && url.includes('setReaction')) {
				expect(url).toContain('/chats/chat-1/messages/')
				const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {}
				expect(body.reactionType).toBe('👍')
				return new Response(null, { status: 204 })
			}
			return new Response(JSON.stringify({ message: 'unexpected ' + url }), { status: 500 })
		})
		try {
			const client = new TeamsClient({ ...auth, tenant_id: 'tid-1' })
			await client.setReaction({ chat_id: 'chat-1', message_id: 'msg-1', emoji: 'like' })
			expect(calls.some((u) => u.includes('graph.microsoft.com'))).toBe(true)
		} finally {
			restore()
		}
	})

	test('getBot returns identity from auth', async () => {
		const client = new TeamsClient(auth)
		const bot = await client.getBot()
		expect(bot).toEqual({
			bot_id: 'app-123',
			username: 'teams-bot',
			display_name: 'Teams Bot'
		})
	})

	test('maps definite rejection on sendText', async () => {
		const restore = mockFetch((url) => {
			if (url.includes('login.microsoftonline.com')) {
				return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }), { status: 200 })
			}
			return new Response(JSON.stringify({ message: 'Bad Request' }), { status: 400 })
		})

		try {
			const client = new TeamsClient(auth)
			let caught: unknown
			try {
				await client.sendText({ chat_id: 'c', text: 'x', service_url: serviceUrl })
			} catch (error) {
				caught = error
			}
			expect(isTeamsDefiniteRejection(caught)).toBe(true)
			expect(isTeamsOutcomeUnknown(new Error('nope'))).toBe(false)
		} finally {
			restore()
		}
	})

	test('answerCallback no-ops non-URL callback ids', async () => {
		const client = new TeamsClient(auth)
		await client.answerCallback({ callback_query_id: 'inv-1' })
	})
})
