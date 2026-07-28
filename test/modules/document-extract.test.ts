import { describe, expect, test } from 'bun:test'
import { isPlainObject } from 'es-toolkit'

import { isToolError, runTool, validateModule, withAuth } from '../../src/core'
import {
	documentExtractModule,
	documentExtractTextTool,
	DocumentExtractClient
} from '../../src/modules/document-extract'

function asRecord(value: unknown): Record<string, unknown> {
	if (!isPlainObject(value)) throw new Error('expected object')
	return value
}

function amzTarget(input: RequestInfo | URL, init?: RequestInit): string {
	if (input instanceof Request) {
		return input.headers.get('X-Amz-Target') ?? input.headers.get('x-amz-target') ?? ''
	}
	const headers = init?.headers
	if (headers instanceof Headers) {
		return headers.get('X-Amz-Target') ?? headers.get('x-amz-target') ?? ''
	}
	if (headers !== undefined && !Array.isArray(headers) && typeof headers === 'object') {
		for (const [key, value] of Object.entries(headers)) {
			if (key.toLowerCase() === 'x-amz-target' && typeof value === 'string') return value
		}
	}
	return ''
}

function mockFetch(handler: (input: RequestInfo | URL, init?: RequestInit) => Response | Promise<Response>) {
	const original = globalThis.fetch
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) =>
		handler(input, init)) as typeof globalThis.fetch
	return () => {
		globalThis.fetch = original
	}
}

const auth = {
	provider: 'textract' as const,
	access_key_id: 'AKIAtest',
	secret_access_key: 'secret',
	region: 'us-east-1',
	bucket: 'docs',
	poll_timeout_ms: 5_000,
	poll_interval_ms: 200
}

describe('document-extract', () => {
	test('module contracts and tool ids', () => {
		expect(validateModule(documentExtractModule).ok).toBe(true)
		expect(documentExtractTextTool.id).toBe('document-extract-text')
		expect(documentExtractModule.tools.map((t) => t.id).sort()).toEqual([
			'document-extract-status',
			'document-extract-text',
			'document-extract-text-batch'
		])
	})

	test('textract provider starts job and returns text when ready', async () => {
		const bound = withAuth(documentExtractModule, auth)
		const tool = bound.tools.find((t) => t.id === 'document-extract-text')
		if (!tool) throw new Error('missing tool')

		let getCalls = 0
		const restore = mockFetch((input, init) => {
			const target = amzTarget(input, init)
			if (target.includes('StartDocumentTextDetection')) {
				return new Response(JSON.stringify({ JobId: 'job-1' }), {
					status: 200,
					headers: { 'content-type': 'application/x-amz-json-1.1' }
				})
			}
			if (target.includes('GetDocumentTextDetection')) {
				getCalls += 1
				return new Response(
					JSON.stringify({
						JobStatus: 'SUCCEEDED',
						Blocks: [{ BlockType: 'LINE', Text: 'Hello page' }],
						DocumentMetadata: { Pages: 1 }
					}),
					{ status: 200, headers: { 'content-type': 'application/x-amz-json-1.1' } }
				)
			}
			return new Response(`unexpected target=${target}`, { status: 500 })
		})

		try {
			const result = asRecord(
				await runTool(tool, {
					source: { store: 'object', key: 'inbox/a.pdf', filename: 'a.pdf' }
				})
			)
			expect(result['status']).toBe('succeeded')
			expect(result['job_id']).toBe('job-1')
			expect(result['text']).toContain('Hello page')
			expect(getCalls).toBeGreaterThan(0)
		} finally {
			restore()
		}
	})

	test('DocumentExtractClient.fromAuth extractText', async () => {
		const restore = mockFetch((input, init) => {
			const target = amzTarget(input, init)
			if (target.includes('StartDocumentTextDetection')) {
				return new Response(JSON.stringify({ JobId: 'job-c' }), { status: 200 })
			}
			if (target.includes('GetDocumentTextDetection')) {
				return new Response(
					JSON.stringify({
						JobStatus: 'SUCCEEDED',
						Blocks: [{ BlockType: 'LINE', Text: 'Client path' }],
						DocumentMetadata: { Pages: 1 }
					}),
					{ status: 200 }
				)
			}
			return new Response('nope', { status: 500 })
		})

		try {
			const client = DocumentExtractClient.fromAuth(auth)
			const result = await client.extractText({
				source: { store: 'object', key: 'c.pdf' }
			})
			expect(result.status).toBe('succeeded')
			expect(result.text).toContain('Client path')
		} finally {
			restore()
		}
	})

	test('invalid auth rejected at withAuth', () => {
		try {
			withAuth(documentExtractModule, { ...auth, access_key_id: '' })
			expect.unreachable()
		} catch (error) {
			expect(isToolError(error)).toBe(true)
			if (isToolError(error)) expect(error.code).toBe('bad_auth')
		}
	})

	test('output chunks returns chunks without full text', async () => {
		const restore = mockFetch((input, init) => {
			const target = amzTarget(input, init)
			if (target.includes('StartDocumentTextDetection')) {
				return new Response(JSON.stringify({ JobId: 'job-ch' }), { status: 200 })
			}
			if (target.includes('GetDocumentTextDetection')) {
				return new Response(
					JSON.stringify({
						JobStatus: 'SUCCEEDED',
						Blocks: [
							{ BlockType: 'LINE', Text: 'Hello page one.' },
							{ BlockType: 'LINE', Text: 'Hello page two.' }
						],
						DocumentMetadata: { Pages: 1 }
					}),
					{ status: 200 }
				)
			}
			return new Response('nope', { status: 500 })
		})
		try {
			const client = DocumentExtractClient.fromAuth(auth)
			const result = await client.extractText({
				source: { store: 'object', key: 'docs/a.pdf' },
				output: 'chunks',
				chunk: { max_chars: 20, overlap: 0 }
			})
			expect(result.status).toBe('succeeded')
			expect(result.output).toBe('chunks')
			expect(result.text).toBeUndefined()
			expect(result.chunks?.length).toBeGreaterThan(0)
			expect(result.chunks?.[0]?.id).toContain('docs/a.pdf')
		} finally {
			restore()
		}
	})

	test('output inline fails when text exceeds max', async () => {
		const long = 'x'.repeat(100_001)
		const restore = mockFetch((input, init) => {
			const target = amzTarget(input, init)
			if (target.includes('StartDocumentTextDetection')) {
				return new Response(JSON.stringify({ JobId: 'job-big' }), { status: 200 })
			}
			if (target.includes('GetDocumentTextDetection')) {
				return new Response(
					JSON.stringify({
						JobStatus: 'SUCCEEDED',
						Blocks: [{ BlockType: 'LINE', Text: long }],
						DocumentMetadata: { Pages: 1 }
					}),
					{ status: 200 }
				)
			}
			return new Response('nope', { status: 500 })
		})
		try {
			const client = DocumentExtractClient.fromAuth(auth)
			await client.extractText({
				source: { store: 'object', key: 'big.pdf' },
				output: 'inline'
			})
			expect.unreachable()
		} catch (error) {
			expect(isToolError(error) && error.code === 'too_large').toBe(true)
		} finally {
			restore()
		}
	})
})
