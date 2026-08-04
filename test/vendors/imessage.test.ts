import { describe, expect, test } from 'bun:test'
import { isPlainObject } from 'es-toolkit'

import { isToolError, runTool, validateModule, withAuth } from '../../src/core'
import {
	ImessageClient,
	imessageModule,
	isImessageDefiniteRejection,
	isImessageOutcomeUnknown,
	toSettableReaction
} from '../../src/vendors/imessage'

function asRecord(value: unknown): Record<string, unknown> {
	if (!isPlainObject(value)) throw new Error('expected object')
	return value
}

function mockFetch(
	handler: (url: string, init: { method?: string; body?: string; headers: Headers }) => Response | Promise<Response>
) {
	const original = globalThis.fetch
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const request = input instanceof Request ? input : new Request(input, init)
		const url = request.url
		const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.clone().text()
		return handler(url, {
			method: request.method,
			...(body !== undefined && body.length > 0 && { body }),
			headers: request.headers
		})
	}) as typeof globalThis.fetch
	return () => {
		globalThis.fetch = original
	}
}

/** Minimal Advanced iMessage `message` envelope for SDK unwrap. */
function messageEnvelope(guid: string, chatGuid: string, text = 'x') {
	return {
		message: {
			guid,
			chatGuids: [chatGuid],
			dateCreated: new Date().toISOString(),
			isFromMe: true,
			isSent: true,
			isDelivered: true,
			content: { text, attachments: [], mentions: [], effects: [], subject: '' },
			appliedReactions: [],
			placedStickers: [],
			itemType: 0,
			isArchived: false,
			isAudioMessage: false,
			isAutoReply: false,
			isCorrupt: false,
			isDelayed: false,
			isDeliveredQuietly: false,
			isExpirable: false,
			isForward: false,
			isServiceMessage: false,
			isSpam: false,
			isSystemMessage: false,
			didNotifyRecipient: false,
			dataDetectorResultsPresent: false
		}
	}
}

const auth = {
	address: 'http://localhost:8080',
	token: 'tok_1',
	tls: false
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

	test('toSettableReaction maps tapbacks and free emoji', () => {
		expect(toSettableReaction('love')).toEqual({ kind: 'love' })
		expect(toSettableReaction('❤️')).toEqual({ kind: 'emoji', emoji: '❤️' })
	})

	test('network failure on send is outcome_unknown', async () => {
		const restore = mockFetch(async () => {
			throw new TypeError('fetch failed')
		})
		try {
			const client = new ImessageClient(auth)
			let error: unknown
			try {
				await client.sendText({ chat_id: 'any;-;+15551111111', text: 'hello' })
			} catch (e) {
				error = e
			}
			expect(isImessageOutcomeUnknown(error)).toBe(true)
		} finally {
			restore()
		}
	})

	test('sendText posts to Advanced iMessage HTTP middleware', async () => {
		const restore = mockFetch((url, init) => {
			expect(url).toContain('/v1/messages:sendText')
			expect(init?.method).toBe('POST')
			const headers = new Headers(init?.headers)
			expect(headers.get('authorization')).toBe('Bearer tok_1')
			const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {}
			expect(body.chatGuid).toBe('any;-;+15551111111')
			expect(body.text).toBe('hello')
			return new Response(JSON.stringify(messageEnvelope('msg_1', body.chatGuid, body.text)), {
				status: 200,
				headers: { 'content-type': 'application/json' }
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
			() =>
				new Response(JSON.stringify(messageEnvelope('m2', 'any;-;space-a', 'hi')), {
					status: 200,
					headers: { 'content-type': 'application/json' }
				})
		)
		try {
			const result = asRecord(await runTool(tool, { chat_id: 'any;-;space-a', text: 'hi' }))
			expect(result['message_id']).toBe('m2')
			expect(result['space_id']).toBe('any;-;space-a')
		} finally {
			restore()
		}
	})

	test('maps 401 to definite rejection', async () => {
		const restore = mockFetch(
			() => new Response(JSON.stringify({ message: 'unauthorized', code: 'unauthenticated' }), { status: 401 })
		)
		try {
			const client = new ImessageClient(auth)
			let caught: unknown
			try {
				await client.sendText({ chat_id: 's', text: 'x' })
			} catch (error) {
				caught = error
			}
			expect(isImessageDefiniteRejection(caught) || isToolError(caught)).toBe(true)
		} finally {
			restore()
		}
	})

	test('setReaction and clearReaction use setReaction isSet true/false', async () => {
		const chat = 'any;-;+15551111111'
		const bodies: Record<string, unknown>[] = []
		const restore = mockFetch((url, init) => {
			expect(url).toContain('/v1/messages:setReaction')
			const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {}
			bodies.push(body)
			return new Response(JSON.stringify(messageEnvelope('reaction-or-target', chat)), {
				status: 200,
				headers: { 'content-type': 'application/json' }
			})
		})

		try {
			const client = new ImessageClient(auth)
			const reaction = await client.setReaction({
				chat_id: chat,
				message_id: 'target-1',
				emoji: 'love'
			})
			expect(reaction.message_id).toBe('reaction-or-target')
			await client.clearReaction({
				chat_id: chat,
				message_id: 'target-1',
				emoji: 'love'
			})
			expect(bodies).toHaveLength(2)
			// first call sets reaction; second clears (isSet omitted/false)
			expect(bodies[0]?.['isSet']).toBe(true)
			expect(bodies[1]?.['isSet'] === false || bodies[1]?.['isSet'] === undefined).toBe(true)
			const target0 = asRecord(bodies[0]?.['target'] ?? {})
			expect(target0['messageGuid'] ?? target0['message_guid']).toBe('target-1')
		} finally {
			restore()
		}
	})

	test('sendMedia uploads then sendAttachment', async () => {
		const chat = 'any;-;+15551111111'
		const paths: string[] = []
		const restore = mockFetch((url) => {
			paths.push(url)
			if (url.includes('/v1/attachments:upload')) {
				return new Response(
					JSON.stringify({
						attachment: {
							guid: 'att-1',
							fileName: 'a.png',
							mimeType: 'image/png',
							totalBytes: 2,
							transferState: 'finished',
							isOutgoing: true,
							isSticker: false,
							isHidden: false,
							uti: 'public.png'
						}
					}),
					{ status: 200, headers: { 'content-type': 'application/json' } }
				)
			}
			if (url.includes('/v1/messages:sendAttachment')) {
				return new Response(JSON.stringify(messageEnvelope('media-1', chat)), {
					status: 200,
					headers: { 'content-type': 'application/json' }
				})
			}
			if (url.includes('/v1/messages:sendText')) {
				return new Response(JSON.stringify(messageEnvelope('cap-1', chat, 'cap')), {
					status: 200,
					headers: { 'content-type': 'application/json' }
				})
			}
			return new Response(JSON.stringify({ message: 'unexpected ' + url }), { status: 500 })
		})

		try {
			const client = new ImessageClient(auth)
			const result = await client.sendMedia({
				chat_id: chat,
				kind: 'photo',
				body_base64: btoa('hi'),
				file_name: 'a.png',
				content_type: 'image/png',
				caption: 'cap'
			})
			expect(result.message_id).toBe('media-1')
			expect(paths.some((p) => p.includes('attachments:upload'))).toBe(true)
			expect(paths.some((p) => p.includes('sendAttachment'))).toBe(true)
		} finally {
			restore()
		}
	})

	test('downloadFile streams attachment data', async () => {
		const restore = mockFetch((url) => {
			if (url.includes('/data')) {
				return new Response(new Uint8Array([97, 98]), {
					status: 200,
					headers: { 'content-type': 'application/octet-stream' }
				})
			}
			if (url.includes('/v1/attachments/att-msg-1')) {
				return new Response(
					JSON.stringify({
						attachment: {
							guid: 'att-msg-1',
							fileName: 'photo.jpg',
							mimeType: 'image/jpeg',
							totalBytes: 2,
							transferState: 'finished',
							isOutgoing: false,
							isSticker: false,
							isHidden: false,
							uti: 'public.jpeg'
						}
					}),
					{ status: 200, headers: { 'content-type': 'application/json' } }
				)
			}
			return new Response(JSON.stringify({ message: 'unexpected ' + url }), { status: 500 })
		})

		try {
			const client = new ImessageClient(auth)
			const result = await client.downloadFile({
				file_id: 'att-msg-1',
				file_name: 'photo.jpg'
			})
			expect(result.file_name).toBe('photo.jpg')
			expect(result.body_base64).toBe(btoa('ab'))
		} finally {
			restore()
		}
	})
})
