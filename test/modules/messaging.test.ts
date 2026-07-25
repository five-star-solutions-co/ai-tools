import { describe, expect, test } from 'bun:test'
import { isPlainObject } from 'es-toolkit'

import { isToolError, runTool, validateModule, withAuth } from '../../src/core'
import {
	isMessagingDefiniteRejection,
	isMessagingOutcomeUnknown,
	MessagingClient,
	messagingModule
} from '../../src/modules/messaging'
import { ImessageClientError } from '../../src/vendors/imessage'
import { TelegramClientError } from '../../src/vendors/telegram'

function asRecord(value: unknown): Record<string, unknown> {
	if (!isPlainObject(value)) throw new Error('expected object')
	return value
}

function mockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
	const original = globalThis.fetch
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const req = input instanceof Request ? input : new Request(input, init)
		const nextInit: RequestInit = { method: req.method, headers: req.headers }
		if (init?.body !== undefined) nextInit.body = init.body
		return handler(req.url, nextInit)
	}) as typeof globalThis.fetch
	return () => {
		globalThis.fetch = original
	}
}

describe('messaging seam', () => {
	test('module contracts and tool ids', () => {
		expect(validateModule(messagingModule).ok).toBe(true)
		expect(messagingModule.tools.map((t) => t.id).sort()).toEqual([
			'messaging-answer-callback',
			'messaging-clear-reaction',
			'messaging-download-file',
			'messaging-edit-text',
			'messaging-read',
			'messaging-send-chat-action',
			'messaging-send-media',
			'messaging-send-media-batch',
			'messaging-send-text',
			'messaging-set-reaction',
			'messaging-stop-typing'
		])
	})

	test('telegram provider sendText via withAuth', async () => {
		const bound = withAuth(messagingModule, { provider: 'telegram', bot_token: '123:ABC' })
		const tool = bound.tools.find((t) => t.id === 'messaging-send-text')
		if (!tool) throw new Error('missing tool')

		const restore = mockFetch((url, init) => {
			expect(url).toContain('api.telegram.org/bot123:ABC/sendMessage')
			expect(init?.method).toBe('POST')
			return new Response(JSON.stringify({ ok: true, result: { message_id: 42 } }), { status: 200 })
		})
		try {
			const result = asRecord(await runTool(tool, { chat_id: '99', text: 'hello' }))
			expect(result['message_id']).toBe('42')
		} finally {
			restore()
		}
	})

	test('slack provider sendText via MessagingClient.fromAuth', async () => {
		const restore = mockFetch((url) => {
			expect(url).toContain('slack.com/api/chat.postMessage')
			return new Response(JSON.stringify({ ok: true, ts: '1710000000.000100', channel: 'C1' }), {
				status: 200
			})
		})
		try {
			const client = MessagingClient.fromAuth({ provider: 'slack', bot_token: 'xoxb-test' })
			const result = await client.sendText({ chat_id: 'C1', text: 'hi' })
			expect(result.message_id).toBe('1710000000.000100')
		} finally {
			restore()
		}
	})

	test('teams provider requires service_url on sendText', async () => {
		const client = MessagingClient.fromAuth({
			provider: 'teams',
			app_id: 'app',
			app_password: 'secret'
		})
		let code: string | undefined
		try {
			await client.sendText({ chat_id: 'conv', text: 'hi' })
		} catch (error) {
			if (isToolError(error)) code = error.code
		}
		expect(code).toBe('bad_input')
	})

	test('imessage provider sendText via proxy', async () => {
		const restore = mockFetch((url, init) => {
			expect(url).toBe('https://proxy.example.com/v1/send')
			const headers = new Headers(init?.headers)
			expect(headers.get('x-spectrum-project-id')).toBe('p')
			return new Response(JSON.stringify({ ok: true, message_id: 'im1', space_id: 'space-1' }), {
				status: 200
			})
		})
		try {
			const client = MessagingClient.fromAuth({
				provider: 'imessage',
				base_url: 'https://proxy.example.com',
				project_id: 'p',
				project_secret: 's'
			})
			const result = await client.sendText({ chat_id: 'space-1', text: 'hi' })
			expect(result.message_id).toBe('im1')
		} finally {
			restore()
		}
	})

	test('imessage sendText missing message_id is outcome_unknown (not space_id fallback)', async () => {
		const restore = mockFetch(() => {
			return new Response(JSON.stringify({ ok: true, space_id: 'space-1' }), { status: 200 })
		})
		try {
			const client = MessagingClient.fromAuth({
				provider: 'imessage',
				base_url: 'https://proxy.example.com',
				project_id: 'p',
				project_secret: 's'
			})
			let error: unknown
			try {
				await client.sendText({ chat_id: 'space-1', text: 'hi' })
			} catch (e) {
				error = e
			}
			expect(error).toBeInstanceOf(ImessageClientError)
			expect(isMessagingOutcomeUnknown(error)).toBe(true)
			expect(isMessagingDefiniteRejection(error)).toBe(false)
		} finally {
			restore()
		}
	})

	test('telegram network failure is outcome_unknown via seam classifiers', async () => {
		const restore = mockFetch(async () => {
			throw new TypeError('fetch failed')
		})
		try {
			const client = MessagingClient.fromAuth({ provider: 'telegram', bot_token: '123:ABC' })
			let error: unknown
			try {
				await client.sendText({ chat_id: '99', text: 'hello' })
			} catch (e) {
				error = e
			}
			expect(error).toBeInstanceOf(TelegramClientError)
			expect(isMessagingOutcomeUnknown(error)).toBe(true)
			expect(isMessagingDefiniteRejection(error)).toBe(false)
		} finally {
			restore()
		}
	})

	test('seam classifiers recognize vendor client errors', () => {
		const definite = new TelegramClientError({
			message: 'bad',
			failureKind: 'definite_rejection',
			method: 'test'
		})
		const unknown = new TelegramClientError({
			message: 'maybe',
			failureKind: 'outcome_unknown',
			method: 'test'
		})
		expect(isMessagingDefiniteRejection(definite)).toBe(true)
		expect(isMessagingOutcomeUnknown(definite)).toBe(false)
		expect(isMessagingOutcomeUnknown(unknown)).toBe(true)
		expect(isMessagingDefiniteRejection(new Error('plain'))).toBe(false)
	})

	test('teams provider sendText after token', async () => {
		const restore = mockFetch((url, init) => {
			if (url.includes('login.microsoftonline.com')) {
				return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }), { status: 200 })
			}
			expect(url).toContain('smba.trafficmanager.net')
			expect(url).toContain('/v3/conversations/')
			expect(init?.method).toBe('POST')
			return new Response(JSON.stringify({ id: 'act-1' }), { status: 200 })
		})
		try {
			const client = MessagingClient.fromAuth({
				provider: 'teams',
				app_id: 'app',
				app_password: 'secret'
			})
			const result = await client.sendText({
				chat_id: '19:abc@thread.tacv2',
				text: 'hello teams',
				service_url: 'https://smba.trafficmanager.net/amer/'
			})
			expect(result.message_id).toBe('act-1')
		} finally {
			restore()
		}
	})

	test('imessage setReaction returns reaction message_id', async () => {
		const restore = mockFetch((url) => {
			expect(url).toBe('https://proxy.example.com/v1/react')
			return new Response(JSON.stringify({ ok: true, message_id: 'react-99', space_id: 'space-1' }), { status: 200 })
		})
		try {
			const client = MessagingClient.fromAuth({
				provider: 'imessage',
				base_url: 'https://proxy.example.com',
				project_id: 'p',
				project_secret: 's'
			})
			const result = await client.setReaction({
				chat_id: 'space-1',
				message_id: 'msg-1',
				emoji: '👍'
			})
			expect(result.message_id).toBe('react-99')
		} finally {
			restore()
		}
	})

	test('telegram setReaction returns empty object', async () => {
		const restore = mockFetch((url) => {
			expect(url).toContain('setMessageReaction')
			return new Response(JSON.stringify({ ok: true, result: true }), { status: 200 })
		})
		try {
			const client = MessagingClient.fromAuth({ provider: 'telegram', bot_token: '123:ABC' })
			const result = await client.setReaction({
				chat_id: '99',
				message_id: '42',
				emoji: '👍'
			})
			expect(result.message_id).toBeUndefined()
		} finally {
			restore()
		}
	})

	test('telegram stopTyping is a successful no-op', async () => {
		const client = MessagingClient.fromAuth({ provider: 'telegram', bot_token: '123:ABC' })
		await client.stopTyping({ chat_id: '99' })
	})

	test('telegram read warns and no-ops', async () => {
		const warnings: string[] = []
		const original = console.warn
		console.warn = (...args: unknown[]) => {
			warnings.push(args.map(String).join(' '))
		}
		try {
			const client = MessagingClient.fromAuth({ provider: 'telegram', bot_token: '123:ABC' })
			await client.read({ chat_id: '99', message_id: '1' })
			expect(warnings.some((line) => line.includes('telegram') && line.includes('read'))).toBe(true)
		} finally {
			console.warn = original
		}
	})

	test('imessage stopTyping / read hit proxy', async () => {
		const seen: string[] = []
		const restore = mockFetch((url) => {
			seen.push(url)
			return new Response(JSON.stringify({ ok: true }), { status: 200 })
		})
		try {
			const client = MessagingClient.fromAuth({
				provider: 'imessage',
				base_url: 'https://proxy.example.com',
				project_id: 'p',
				project_secret: 's'
			})
			await client.stopTyping({ chat_id: 'space-1' })
			await client.read({ chat_id: 'space-1', message_id: 'in-1' })
			expect(seen).toEqual(['https://proxy.example.com/v1/typing', 'https://proxy.example.com/v1/read'])
		} finally {
			restore()
		}
	})

	test('imessage downloadFile uses chat_id without composite file_id', async () => {
		const restore = mockFetch((url, init) => {
			expect(url).toBe('https://proxy.example.com/v1/download')
			const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {}
			expect(body).toMatchObject({ space_id: 'space-1', file_id: 'att-1' })
			return new Response(
				JSON.stringify({
					ok: true,
					file_name: 'a.png',
					body_base64: Buffer.from('png').toString('base64')
				}),
				{ status: 200 }
			)
		})
		try {
			const client = MessagingClient.fromAuth({
				provider: 'imessage',
				base_url: 'https://proxy.example.com',
				project_id: 'p',
				project_secret: 's'
			})
			const out = await client.downloadFile({
				chat_id: 'space-1',
				file_id: 'att-1',
				file_name: 'a.png'
			})
			expect(out.file_name).toBe('a.png')
			expect(out.body_base64).toBeDefined()
			expect(out.body_base64!.length).toBeGreaterThan(0)
		} finally {
			restore()
		}
	})

	test('slack sendMediaBatch sends sequentially', async () => {
		let uploadSeq = 0
		const restore = mockFetch((url) => {
			if (url.includes('files.getUploadURLExternal')) {
				uploadSeq += 1
				return new Response(
					JSON.stringify({
						ok: true,
						upload_url: 'https://files.example.com/upload',
						file_id: `F${uploadSeq}`
					}),
					{ status: 200 }
				)
			}
			if (url.includes('files.example.com')) {
				return new Response(null, { status: 200 })
			}
			if (url.includes('files.completeUploadExternal')) {
				return new Response(
					JSON.stringify({
						ok: true,
						files: [{ id: `F${uploadSeq}`, permalink: 'https://slack.com/f' }]
					}),
					{ status: 200 }
				)
			}
			return new Response(JSON.stringify({ ok: false, error: `unexpected ${url}` }), { status: 500 })
		})
		try {
			const client = MessagingClient.fromAuth({ provider: 'slack', bot_token: 'xoxb-test' })
			const tiny = Buffer.from('x').toString('base64')
			const batch = await client.sendMediaBatch({
				chat_id: 'C1',
				items: [
					{ kind: 'document', body_base64: tiny, file_name: 'a.txt' },
					{ kind: 'document', body_base64: tiny, file_name: 'b.txt' }
				]
			})
			expect(batch.results.succeeded).toBe(2)
			expect(batch.results.failed).toBe(0)
			expect(batch.message_ids).toEqual(['F1', 'F2'])
		} finally {
			restore()
		}
	})

	test('sendMedia from ArtifactRef source loads object storage', async () => {
		const restore = mockFetch((url, init) => {
			if (url.includes('media.example') && (init?.method === 'GET' || !init?.method)) {
				return new Response(new Uint8Array([1, 2, 3]), {
					status: 200,
					headers: { 'content-type': 'image/png' }
				})
			}
			if (url.includes('sendDocument') || url.includes('sendPhoto')) {
				return new Response(JSON.stringify({ ok: true, result: { message_id: 7 } }), { status: 200 })
			}
			return new Response(`unexpected ${url}`, { status: 500 })
		})
		try {
			const client = MessagingClient.fromAuth({
				provider: 'telegram',
				bot_token: '123:ABC',
				storage: {
					access_key_id: 'AKIAtest',
					secret_access_key: 'secret',
					region: 'us-east-1',
					bucket: 'media',
					endpoint: 'https://media.example'
				}
			})
			const out = await client.sendMedia({
				chat_id: '99',
				kind: 'document',
				source: { store: 'object', key: 'inbox/a.bin', filename: 'a.bin' }
			})
			expect(out.message_id).toBe('7')
		} finally {
			restore()
		}
	})

	test('downloadFile with destination_key returns artifact without body_base64', async () => {
		const puts: string[] = []
		const restore = mockFetch((url, init) => {
			const method = (init?.method ?? 'GET').toUpperCase()
			if (url.includes('api.telegram.org') && url.includes('getFile')) {
				return new Response(JSON.stringify({ ok: true, result: { file_path: 'docs/x.txt', file_size: 5 } }), {
					status: 200
				})
			}
			if (url.includes('api.telegram.org/file/')) {
				return new Response(new Uint8Array([9, 9, 9, 9, 9]), { status: 200 })
			}
			if (method === 'PUT' && url.includes('out/x.txt')) {
				puts.push(url)
				return new Response(null, { status: 200 })
			}
			return new Response(`unexpected ${method} ${url}`, { status: 500 })
		})
		try {
			const client = MessagingClient.fromAuth({
				provider: 'telegram',
				bot_token: '123:ABC',
				storage: {
					access_key_id: 'AKIAtest',
					secret_access_key: 'secret',
					region: 'us-east-1',
					bucket: 'media',
					endpoint: 'https://media.example'
				}
			})
			const out = await client.downloadFile({
				file_id: 'AgAD',
				file_name: 'x.txt',
				destination_key: 'out/x.txt'
			})
			expect(out.artifact?.store).toBe('object')
			expect(out.artifact?.key).toBe('out/x.txt')
			expect(out.body_base64).toBeUndefined()
			expect(puts.some((u) => u.includes('out/x.txt'))).toBe(true)
		} finally {
			restore()
		}
	})

	test('sendMedia rejects missing body and source', async () => {
		const client = MessagingClient.fromAuth({ provider: 'telegram', bot_token: '123:ABC' })
		let threw = false
		try {
			await client.sendMedia({
				chat_id: '99',
				kind: 'document',
				file_name: 'a.txt'
			} as never)
		} catch {
			threw = true
		}
		expect(threw).toBe(true)
	})

	test('telegram sendMediaBatch uses sendMediaGroup for homogeneous 2+ photos', async () => {
		const restore = mockFetch((url) => {
			expect(url).toContain('sendMediaGroup')
			return new Response(
				JSON.stringify({
					ok: true,
					result: [{ message_id: 10 }, { message_id: 11 }]
				}),
				{ status: 200 }
			)
		})
		try {
			const client = MessagingClient.fromAuth({ provider: 'telegram', bot_token: '123:ABC' })
			const tiny = Buffer.from('x').toString('base64')
			const batch = await client.sendMediaBatch({
				chat_id: '99',
				items: [
					{ kind: 'photo', body_base64: tiny, file_name: 'a.jpg' },
					{ kind: 'photo', body_base64: tiny, file_name: 'b.jpg' }
				]
			})
			expect(batch.message_ids).toEqual(['10', '11'])
			expect(batch.results.succeeded).toBe(2)
			expect(batch.results.failed).toBe(0)
		} finally {
			restore()
		}
	})
})
