import { describe, expect, test } from 'bun:test'

import { isToolError } from '../../src/core'
import { HttpService } from '../../src/transport/http-service'

describe('HttpService', () => {
	test('get parses json and uses baseURL', async () => {
		const original = globalThis.fetch
		globalThis.fetch = (async (input: RequestInfo | URL) => {
			const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
			expect(url).toBe('https://api.example.com/v1/items')
			return new Response(JSON.stringify({ ok: true }), {
				status: 200,
				headers: { 'content-type': 'application/json' }
			})
		}) as typeof globalThis.fetch

		try {
			const http = new HttpService({
				baseURL: 'https://api.example.com',
				label: 'Example'
			})
			const result = await http.get('/v1/items')
			expect(result.ok).toBe(true)
			expect(result.data).toEqual({ ok: true })
		} finally {
			globalThis.fetch = original
		}
	})

	test('post sends body', async () => {
		const original = globalThis.fetch
		globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
			expect(init?.method).toBe('POST')
			const body = typeof init?.body === 'string' ? init.body : ''
			expect(body).toContain('hello')
			return new Response(JSON.stringify({ id: '1' }), { status: 200 })
		}) as typeof globalThis.fetch

		try {
			const http = new HttpService({ baseURL: 'https://api.example.com', label: 'Example' })
			const result = await http.post('/send', { text: 'hello' })
			expect(result.data).toEqual({ id: '1' })
		} finally {
			globalThis.fetch = original
		}
	})

	test('throws ToolError on 404 by default', async () => {
		const original = globalThis.fetch
		globalThis.fetch = (async () => new Response('missing', { status: 404 })) as unknown as typeof globalThis.fetch

		try {
			const http = new HttpService({ baseURL: 'https://api.example.com', label: 'Example' })
			await http.get('/missing')
			expect.unreachable()
		} catch (error) {
			expect(isToolError(error)).toBe(true)
			if (isToolError(error)) expect(error.code).toBe('not_found')
		} finally {
			globalThis.fetch = original
		}
	})

	test('noThrow returns error status', async () => {
		const original = globalThis.fetch
		globalThis.fetch = (async () => new Response('nope', { status: 500 })) as unknown as typeof globalThis.fetch

		try {
			const http = new HttpService({ baseURL: 'https://api.example.com', label: 'Example' })
			const result = await http.get('/x', { noThrow: true })
			expect(result.status).toBe(500)
			expect(result.ok).toBe(false)
		} finally {
			globalThis.fetch = original
		}
	})

	test('bytes returns Uint8Array', async () => {
		const original = globalThis.fetch
		globalThis.fetch = (async () =>
			new Response(new Uint8Array([1, 2, 3]), { status: 200 })) as unknown as typeof globalThis.fetch

		try {
			const http = new HttpService({ baseURL: 'https://api.example.com', label: 'Example' })
			const result = await http.bytes('GET', '/bin')
			expect(result.bytes).toEqual(new Uint8Array([1, 2, 3]))
		} finally {
			globalThis.fetch = original
		}
	})

	test('maps FetchError wrapping AbortError to timeout', async () => {
		const { FetchError } = await import('ofetch')
		const { mapTransportNetworkError, isAbortErrorChain } = await import('../../src/transport/errors')
		const abort = new Error('aborted')
		abort.name = 'AbortError'
		const wrapped = new FetchError('[GET] aborted')
		// ofetch attaches cause on the error object
		Object.assign(wrapped, { cause: abort })
		expect(isAbortErrorChain(wrapped)).toBe(true)
		try {
			mapTransportNetworkError(wrapped, 'Example')
			expect.unreachable()
		} catch (error) {
			expect(isToolError(error)).toBe(true)
			if (isToolError(error)) expect(error.code).toBe('timeout')
		}
	})
})
