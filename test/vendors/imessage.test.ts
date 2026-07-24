import { describe, expect, test } from 'bun:test'
import { isPlainObject } from 'es-toolkit'

import { isToolError, runTool, validateModule, withAuth } from '../../src/core'
import {
	ImessageClient,
	imessageModule,
	isImessageDefiniteRejection,
	isImessageOutcomeUnknown
} from '../../src/vendors/imessage'

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

const auth = {
	base_url: 'https://proxy.example.com',
	project_id: 'proj_1',
	project_secret: 'sec_1'
} as const

describe('imessage', () => {
	test('module contracts and tool ids', () => {
		expect(validateModule(imessageModule).ok).toBe(true)
		expect(imessageModule.tools.map((t) => t.id).sort()).toEqual([
			'imessage-clear-reaction',
			'imessage-download-file',
			'imessage-edit-text',
			'imessage-read',
			'imessage-send-chat-action',
			'imessage-send-media',
			'imessage-send-text',
			'imessage-set-reaction',
			'imessage-unsend'
		])
	})

	test('sendText without message_id is outcome_unknown', async () => {
		const restore = mockFetch(() => new Response(JSON.stringify({ ok: true, space_id: 'space-only' }), { status: 200 }))
		try {
			const client = new ImessageClient(auth)
			let error: unknown
			try {
				await client.sendText({ chat_id: 'space-only', text: 'hello' })
			} catch (e) {
				error = e
			}
			expect(isImessageOutcomeUnknown(error)).toBe(true)
			expect(isImessageDefiniteRejection(error)).toBe(false)
		} finally {
			restore()
		}
	})

	test('network failure on send is outcome_unknown', async () => {
		const restore = mockFetch(async () => {
			throw new TypeError('fetch failed')
		})
		try {
			const client = new ImessageClient(auth)
			let error: unknown
			try {
				await client.sendText({ chat_id: 'space-1', text: 'hello' })
			} catch (e) {
				error = e
			}
			expect(isImessageOutcomeUnknown(error)).toBe(true)
		} finally {
			restore()
		}
	})

	test('sendText posts to proxy with spectrum headers', async () => {
		const restore = mockFetch((url, init) => {
			expect(url).toBe('https://proxy.example.com/v1/send')
			expect(init?.method).toBe('POST')
			const headers = new Headers(init?.headers)
			expect(headers.get('x-spectrum-project-id')).toBe('proj_1')
			expect(headers.get('x-spectrum-project-secret')).toBe('sec_1')
			const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {}
			expect(body.space_id).toBe('any;-;+15551111111')
			expect(body.text).toBe('hello')
			expect(body.platform).toBe('imessage')
			return new Response(JSON.stringify({ ok: true, message_id: 'msg_1', space_id: body.space_id }), {
				status: 200
			})
		})

		try {
			const client = new ImessageClient(auth)
			const result = await client.sendText({
				chat_id: 'any;-;+15551111111',
				text: 'hello'
			})
			expect(result).toEqual({ message_id: 'msg_1', space_id: 'any;-;+15551111111' })
		} finally {
			restore()
		}
	})

	test('sendText tool via withAuth', async () => {
		const bound = withAuth(imessageModule, auth)
		const tool = bound.tools.find((t) => t.id === 'imessage-send-text')
		if (!tool) throw new Error('missing tool')

		const restore = mockFetch(
			() => new Response(JSON.stringify({ ok: true, message_id: 'm2', space_id: 'space-a' }), { status: 200 })
		)
		try {
			const result = asRecord(await runTool(tool, { chat_id: 'space-a', text: 'hi' }))
			expect(result['message_id']).toBe('m2')
			expect(result['space_id']).toBe('space-a')
		} finally {
			restore()
		}
	})

	test('maps 401 to definite rejection', async () => {
		const restore = mockFetch(
			() => new Response(JSON.stringify({ error: 'unauthorized', detail: 'Missing header' }), { status: 401 })
		)
		try {
			const client = new ImessageClient(auth)
			let caught: unknown
			try {
				await client.sendText({ chat_id: 's', text: 'x' })
			} catch (error) {
				caught = error
			}
			expect(isImessageDefiniteRejection(caught)).toBe(true)
			expect(isImessageOutcomeUnknown(new Error('nope'))).toBe(false)
		} finally {
			restore()
		}
	})

	test('setReaction returns reaction message_id; clearReaction unsends it', async () => {
		const seen: string[] = []
		const restore = mockFetch((url, init) => {
			seen.push(url)
			const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {}
			if (url.endsWith('/v1/react')) {
				expect(body.message_id).toBe('target-1')
				expect(body.emoji).toBe('❤️')
				return new Response(JSON.stringify({ ok: true, message_id: 'reaction-9', space_id: body.space_id }), {
					status: 200
				})
			}
			if (url.endsWith('/v1/clear-reaction')) {
				expect(body.message_id).toBe('reaction-9')
				return new Response(JSON.stringify({ ok: true, space_id: body.space_id }), { status: 200 })
			}
			return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 })
		})

		try {
			const client = new ImessageClient(auth)
			const reaction = await client.setReaction({
				chat_id: 'space-1',
				message_id: 'target-1',
				emoji: '❤️'
			})
			expect(reaction.message_id).toBe('reaction-9')
			await client.clearReaction({
				chat_id: 'space-1',
				message_id: 'reaction-9'
			})
			expect(seen.some((u) => u.endsWith('/v1/react'))).toBe(true)
			expect(seen.some((u) => u.endsWith('/v1/clear-reaction'))).toBe(true)
		} finally {
			restore()
		}
	})

	test('sendMedia posts base64 to /v1/media', async () => {
		const restore = mockFetch((url, init) => {
			expect(url).toBe('https://proxy.example.com/v1/media')
			const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {}
			expect(body.space_id).toBe('space-1')
			expect(body.file_name).toBe('a.png')
			expect(body.body_base64).toBe(btoa('hi'))
			expect(body.mime_type).toBe('image/png')
			expect(body.caption).toBe('cap')
			return new Response(JSON.stringify({ ok: true, message_id: 'media-1', space_id: 'space-1' }), { status: 200 })
		})

		try {
			const client = new ImessageClient(auth)
			const result = await client.sendMedia({
				chat_id: 'space-1',
				kind: 'photo',
				body_base64: btoa('hi'),
				file_name: 'a.png',
				content_type: 'image/png',
				caption: 'cap'
			})
			expect(result).toEqual({ message_id: 'media-1', space_id: 'space-1' })
		} finally {
			restore()
		}
	})

	test('downloadFile posts space + file_id', async () => {
		const restore = mockFetch((url, init) => {
			expect(url).toBe('https://proxy.example.com/v1/download')
			const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {}
			expect(body.space_id).toBe('space-1')
			expect(body.file_id).toBe('att-msg-1')
			return new Response(
				JSON.stringify({
					ok: true,
					space_id: 'space-1',
					file_name: 'photo.jpg',
					file_size: 2,
					body_base64: btoa('ab')
				}),
				{ status: 200 }
			)
		})

		try {
			const client = new ImessageClient(auth)
			const result = await client.downloadFile({
				chat_id: 'space-1',
				file_id: 'att-msg-1'
			})
			expect(result.file_name).toBe('photo.jpg')
			expect(result.file_size).toBe(2)
			expect(result.body_base64).toBe(btoa('ab'))
		} finally {
			restore()
		}
	})

	test('downloadFile without chat_id is bad_input', async () => {
		const client = new ImessageClient(auth)
		try {
			await client.downloadFile({ file_id: 'only-file' })
			expect(true).toBe(false)
		} catch (error) {
			expect(isToolError(error) && error.code === 'bad_input').toBe(true)
		}
	})
})
