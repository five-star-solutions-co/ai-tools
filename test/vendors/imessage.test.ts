import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { isPlainObject } from 'es-toolkit'

import { isToolError, runTool, validateModule, withAuth } from '../../src/core'
import {
	DEFAULT_SPECTRUM_IMESSAGE_GRPC_ADDRESS,
	ImessageClient,
	imessageModule,
	isImessageDefiniteRejection,
	isImessageOutcomeUnknown,
	parseSpectrumTokenResponse,
	resolveSpectrumSession,
	spectrumImessageGrpcAddress,
	toSettableReaction
} from '../../src/vendors/imessage'

function asRecord(value: unknown): Record<string, unknown> {
	if (!isPlainObject(value)) throw new Error('expected object')
	return value
}

type MockMessage = { guid: string; chatGuids?: string[] }

function makeMockSdk(handlers: {
	sendText?: (chat: string, text: string) => Promise<MockMessage>
	edit?: (chat: string, id: string, text: string) => Promise<MockMessage>
	setReaction?: (...args: unknown[]) => Promise<MockMessage>
	unsend?: (...args: unknown[]) => Promise<void>
	setTyping?: (chat: string, on: boolean) => Promise<void>
	markRead?: (chat: string) => Promise<void>
	createChat?: (
		addresses: string[],
		opts?: unknown
	) => Promise<{ chat: { guid: string }; initialMessage?: MockMessage }>
	upload?: (input: { fileName: string; data: Uint8Array }) => Promise<{ attachment: { guid: string } }>
	sendAttachment?: (chat: string, attachmentGuid: string) => Promise<MockMessage>
	downloadStream?: (id: string) => AsyncIterable<{ type: string; data?: Uint8Array; info?: Record<string, unknown> }>
}) {
	return {
		messages: {
			sendText: handlers.sendText ?? (async () => ({ guid: 'msg_1' })),
			edit: handlers.edit ?? (async () => ({ guid: 'msg_1' })),
			setReaction: handlers.setReaction ?? (async () => ({ guid: 'reaction-1' })),
			unsend: handlers.unsend ?? (async () => undefined),
			sendAttachment: handlers.sendAttachment ?? (async () => ({ guid: 'media-1' }))
		},
		chats: {
			setTyping: handlers.setTyping ?? (async () => undefined),
			markRead: handlers.markRead ?? (async () => undefined),
			create:
				handlers.createChat ??
				(async (addresses: string[]) => ({
					chat: { guid: `any;-;${addresses[0]}` }
				}))
		},
		attachments: {
			upload: handlers.upload ?? (async () => ({ attachment: { guid: 'att-1' } })),
			downloadStream:
				handlers.downloadStream ??
				async function* () {
					yield { type: 'header', info: { fileName: 'photo.jpg', totalBytes: 2 } }
					yield { type: 'primaryChunk', data: new Uint8Array([97, 98]) }
				}
		},
		close: async () => undefined
	}
}

let createCalls: Array<Record<string, unknown>> = []
let mockSdk = makeMockSdk({})

beforeEach(() => {
	createCalls = []
	mockSdk = makeMockSdk({})
	void mock.module('@photon-ai/advanced-imessage/grpc', () => ({
		createGrpcClient: (opts: Record<string, unknown>) => {
			createCalls.push(opts)
			return mockSdk
		},
		AuthenticationError: class AuthenticationError extends Error {
			constructor(message?: string) {
				super(message)
				this.name = 'AuthenticationError'
			}
		},
		ConnectionError: class ConnectionError extends Error {
			constructor(message?: string) {
				super(message)
				this.name = 'ConnectionError'
			}
		},
		IMessageError: class IMessageError extends Error {
			code?: string
			retryable?: boolean
			constructor(message?: string) {
				super(message)
				this.name = 'IMessageError'
			}
		},
		NotFoundError: class NotFoundError extends Error {
			constructor(message?: string) {
				super(message)
				this.name = 'NotFoundError'
			}
		},
		RateLimitError: class RateLimitError extends Error {
			constructor(message?: string) {
				super(message)
				this.name = 'RateLimitError'
			}
		},
		ValidationError: class ValidationError extends Error {
			constructor(message?: string) {
				super(message)
				this.name = 'ValidationError'
			}
		}
	}))
})

afterEach(() => {
	mock.restore()
})

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

const spectrumAuth = {
	project_id: 'proj_1',
	project_secret: 'sec_1'
} as const

const directAuth = {
	address: 'imessage.spectrum.photon.codes:443',
	token: 'tok_1'
} as const

describe('imessage', () => {
	test('module contracts and tool ids', () => {
		expect(validateModule(imessageModule).ok).toBe(true)
		expect(imessageModule.runtime).toBe('node')
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
		expect(imessageModule.runtime).toBe('node')
	})

	test('toSettableReaction maps tapbacks and free emoji', () => {
		expect(toSettableReaction('love')).toEqual({ kind: 'love' })
		expect(toSettableReaction('❤️')).toEqual({ kind: 'emoji', emoji: '❤️' })
	})

	test('spectrumImessageGrpcAddress matches spectrum-ts routing', () => {
		expect(spectrumImessageGrpcAddress({ type: 'shared', token: 't', expiresIn: 60 })).toBe(
			DEFAULT_SPECTRUM_IMESSAGE_GRPC_ADDRESS
		)
		expect(
			spectrumImessageGrpcAddress(
				{ type: 'shared', token: 't', expiresIn: 60 },
				{ sharedAddress: 'custom.example:443' }
			)
		).toBe('custom.example:443')
		expect(spectrumImessageGrpcAddress({ type: 'dedicated', token: 't', server: 'inst-a', expiresIn: 60 })).toBe(
			'inst-a.imsg.photon.codes:443'
		)
	})

	test('parseSpectrumTokenResponse shared and dedicated', () => {
		expect(
			parseSpectrumTokenResponse({
				succeed: true,
				data: { type: 'shared', token: 'tmp', expiresIn: 900 }
			})
		).toEqual({ type: 'shared', token: 'tmp', expiresIn: 900 })

		const dedicated = parseSpectrumTokenResponse({
			type: 'dedicated',
			auth: { a: 'tok-a' },
			numbers: { a: '+1' },
			expiresIn: 100
		})
		expect(dedicated.type).toBe('dedicated')
		if (dedicated.type === 'dedicated') {
			expect(dedicated.auth.a).toBe('tok-a')
		}
	})

	test('resolveSpectrumSession multi-instance requires server', () => {
		expect(() =>
			resolveSpectrumSession(
				{
					type: 'dedicated',
					auth: { a: '1', b: '2' },
					numbers: {},
					expiresIn: 60
				},
				undefined
			)
		).toThrow()
	})

	test('Spectrum shared: mints token and createGrpcClient on managed host', async () => {
		const restore = mockFetch((url, init) => {
			expect(url).toContain('/projects/proj_1/imessage/tokens')
			expect(init.method).toBe('POST')
			expect(init.headers.get('authorization')).toBe(`Basic ${btoa('proj_1:sec_1')}`)
			return new Response(
				JSON.stringify({
					succeed: true,
					data: { type: 'shared', token: 'tmp_shared', expiresIn: 900 }
				}),
				{ status: 200, headers: { 'content-type': 'application/json' } }
			)
		})
		mockSdk = makeMockSdk({
			sendText: async (chat, text) => {
				expect(chat).toBe('any;-;+15551111111')
				expect(text).toBe('hello')
				return { guid: 'msg_s' }
			}
		})
		try {
			const client = new ImessageClient(spectrumAuth)
			const result = await client.sendText({ chat_id: 'any;-;+15551111111', text: 'hello' })
			expect(result).toEqual({ message_id: 'msg_s', space_id: 'any;-;+15551111111' })
			expect(createCalls).toHaveLength(1)
			expect(createCalls[0]?.['address']).toBe(DEFAULT_SPECTRUM_IMESSAGE_GRPC_ADDRESS)
			expect(createCalls[0]?.['tls']).toBe(true)
			expect(createCalls[0]?.['autoIdempotency']).toBe(true)
			expect(createCalls[0]?.['retry']).toBe(true)
			const tokenFn = createCalls[0]?.['token']
			expect(typeof tokenFn).toBe('function')
			expect(await (tokenFn as () => Promise<string>)()).toBe('tmp_shared')
			expect(client.grpcAddress).toBe(DEFAULT_SPECTRUM_IMESSAGE_GRPC_ADDRESS)
			expect(client.server).toBeUndefined()
		} finally {
			restore()
		}
	})

	test('Spectrum dedicated single instance uses {id}.imsg.photon.codes:443', async () => {
		const restore = mockFetch(
			() =>
				new Response(
					JSON.stringify({
						succeed: true,
						data: {
							type: 'dedicated',
							auth: { 'only-one': 'tok-only' },
							numbers: { 'only-one': '+15550001111' },
							expiresIn: 900
						}
					}),
					{ status: 200, headers: { 'content-type': 'application/json' } }
				)
		)
		try {
			const client = new ImessageClient(spectrumAuth)
			await client.sendText({ chat_id: 'any;-;+15550001111', text: 'hi' })
			expect(createCalls[0]?.['address']).toBe('only-one.imsg.photon.codes:443')
			expect(client.server).toBe('only-one')
			const tokenFn = createCalls[0]?.['token'] as () => Promise<string>
			expect(await tokenFn()).toBe('tok-only')
		} finally {
			restore()
		}
	})

	test('Spectrum dedicated multi-instance without server fails bad_auth', async () => {
		const restore = mockFetch(
			() =>
				new Response(
					JSON.stringify({
						succeed: true,
						data: {
							type: 'dedicated',
							auth: { 'inst-a': 'tok-a', 'inst-b': 'tok-b' },
							numbers: {},
							expiresIn: 900
						}
					}),
					{ status: 200, headers: { 'content-type': 'application/json' } }
				)
		)
		try {
			const client = new ImessageClient(spectrumAuth)
			let caught: unknown
			try {
				await client.sendText({ chat_id: 'any;-;x', text: 'hi' })
			} catch (error) {
				caught = error
			}
			expect(isToolError(caught)).toBe(true)
			if (isToolError(caught)) {
				expect(caught.code).toBe('bad_auth')
				expect(caught.details?.['instance_ids']).toEqual(['inst-a', 'inst-b'])
			}
		} finally {
			restore()
		}
	})

	test('direct gRPC auth uses address + token', async () => {
		const client = new ImessageClient(directAuth)
		const result = await client.sendText({ chat_id: 'any;-;space-a', text: 'hi' })
		expect(result.message_id).toBe('msg_1')
		expect(createCalls[0]?.['address']).toBe('imessage.spectrum.photon.codes:443')
		expect(createCalls[0]?.['token']).toBe('tok_1')
	})

	test('sendText tool via withAuth', async () => {
		const bound = withAuth(imessageModule, directAuth)
		const tool = bound.tools.find((t) => t.id === 'imessage-send-text')
		if (!tool) throw new Error('missing tool')
		const result = asRecord(await runTool(tool, { chat_id: 'any;-;space-a', text: 'hi' }))
		expect(result['message_id']).toBe('msg_1')
		expect(result['space_id']).toBe('any;-;space-a')
	})

	test('ensureChat returns chat_id', async () => {
		mockSdk = makeMockSdk({
			createChat: async (addresses, opts) => {
				expect(addresses).toEqual(['+15551234567'])
				expect(asRecord(opts ?? {})['message']).toBe('hi there')
				return {
					chat: { guid: 'any;-;+15551234567' },
					initialMessage: { guid: 'open-1' }
				}
			}
		})
		const client = new ImessageClient(directAuth)
		const result = await client.ensureChat({
			addresses: ['+15551234567'],
			message: 'hi there'
		})
		expect(result).toEqual({ chat_id: 'any;-;+15551234567', message_id: 'open-1' })
	})

	test('setReaction and clearReaction', async () => {
		const calls: unknown[] = []
		mockSdk = makeMockSdk({
			setReaction: async (...args) => {
				calls.push(args)
				return { guid: 'reaction-or-target' }
			}
		})
		const client = new ImessageClient(directAuth)
		const chat = 'any;-;+15551111111'
		await client.setReaction({ chat_id: chat, message_id: 'target-1', emoji: 'love' })
		await client.clearReaction({ chat_id: chat, message_id: 'target-1', emoji: 'love' })
		expect(calls).toHaveLength(2)
		expect(calls[0]).toEqual([chat, 'target-1', { kind: 'love' }, true])
		expect(calls[1]).toEqual([chat, 'target-1', { kind: 'love' }, false])
	})

	test('sendMedia uploads then sendAttachment', async () => {
		const steps: string[] = []
		mockSdk = makeMockSdk({
			upload: async () => {
				steps.push('upload')
				return { attachment: { guid: 'att-1' } }
			},
			sendAttachment: async () => {
				steps.push('sendAttachment')
				return { guid: 'media-1' }
			},
			sendText: async () => {
				steps.push('caption')
				return { guid: 'cap-1' }
			}
		})
		const client = new ImessageClient(directAuth)
		const result = await client.sendMedia({
			chat_id: 'any;-;+15551111111',
			kind: 'photo',
			body_base64: btoa('hi'),
			file_name: 'a.png',
			caption: 'cap'
		})
		expect(result.message_id).toBe('media-1')
		expect(steps).toEqual(['upload', 'sendAttachment', 'caption'])
	})

	test('downloadFile streams attachment data', async () => {
		const client = new ImessageClient(directAuth)
		const result = await client.downloadFile({ file_id: 'att-msg-1', file_name: 'photo.jpg' })
		expect(result.file_name).toBe('photo.jpg')
		expect(result.body_base64).toBe(btoa('ab'))
	})

	test('network-style failure is outcome_unknown', async () => {
		mockSdk = makeMockSdk({
			sendText: async () => {
				throw new TypeError('fetch failed')
			}
		})
		const client = new ImessageClient(directAuth)
		let error: unknown
		try {
			await client.sendText({ chat_id: 'any;-;x', text: 'hello' })
		} catch (e) {
			error = e
		}
		expect(isImessageOutcomeUnknown(error)).toBe(true)
	})

	test('classifiers export', () => {
		expect(typeof isImessageDefiniteRejection).toBe('function')
		expect(typeof isImessageOutcomeUnknown).toBe('function')
	})
})
