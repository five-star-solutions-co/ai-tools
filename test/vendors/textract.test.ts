import { describe, expect, test } from 'bun:test'
import { isPlainObject } from 'es-toolkit'

import { isToolError, runTool, validateModule, withAuth } from '../../src/core'
import { TextractClient, textractExtractTextTool, textractModule } from '../../src/vendors/textract'

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
	access_key_id: 'AKIAtest',
	secret_access_key: 'secret',
	region: 'us-east-1',
	bucket: 'docs',
	poll_timeout_ms: 5_000,
	poll_interval_ms: 200
} as const

describe('textract', () => {
	test('module contracts and tool ids', () => {
		expect(validateModule(textractModule).ok).toBe(true)
		expect(textractModule.tools.map((t) => t.id).sort()).toEqual([
			'textract-extract-text',
			'textract-extract-text-batch',
			'textract-get-status'
		])
		expect(textractExtractTextTool.id).toBe('textract-extract-text')
	})

	test('client extractText: start + poll success', async () => {
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
			const client = new TextractClient(auth)
			const result = await client.extractText({
				source: { store: 'object', key: 'inbox/a.pdf', filename: 'a.pdf' }
			})
			expect(result.status).toBe('succeeded')
			expect(result.job_id).toBe('job-1')
			expect(result.text).toContain('Hello page')
			expect(result.page_count).toBe(1)
			expect(getCalls).toBeGreaterThan(0)
		} finally {
			restore()
		}
	})

	test('client surfaces AWS error body on StartDocumentTextDetection 400', async () => {
		const restore = mockFetch((input, init) => {
			const target = amzTarget(input, init)
			if (target.includes('StartDocumentTextDetection')) {
				return new Response(
					JSON.stringify({
						__type: 'InvalidS3ObjectException',
						Message: 'Unable to get object metadata from S3.'
					}),
					{ status: 400, headers: { 'content-type': 'application/x-amz-json-1.1' } }
				)
			}
			return new Response('unexpected', { status: 500 })
		})
		try {
			const client = new TextractClient(auth)
			let caught: unknown
			try {
				await client.extractText({ source: { store: 'object', key: 'missing.pdf' } })
			} catch (error) {
				caught = error
			}
			expect(caught).toMatchObject({
				message: expect.stringContaining('InvalidS3ObjectException'),
				details: expect.objectContaining({ status: 400, bucket: 'docs', region: 'us-east-1' })
			})
		} finally {
			restore()
		}
	})

	test('tool path via withAuth', async () => {
		const bound = withAuth(textractModule, auth)
		const tool = bound.tools.find((t) => t.id === 'textract-extract-text')
		if (!tool) throw new Error('missing tool')

		const restore = mockFetch((input, init) => {
			const target = amzTarget(input, init)
			if (target.includes('StartDocumentTextDetection')) {
				return new Response(JSON.stringify({ JobId: 'job-2' }), { status: 200 })
			}
			if (target.includes('GetDocumentTextDetection')) {
				return new Response(
					JSON.stringify({
						JobStatus: 'SUCCEEDED',
						Blocks: [{ BlockType: 'LINE', Text: 'Tool path' }],
						DocumentMetadata: { Pages: 1 }
					}),
					{ status: 200 }
				)
			}
			return new Response('nope', { status: 500 })
		})

		try {
			const result = asRecord(
				await runTool(tool, {
					source: { store: 'object', key: 'x.pdf' }
				})
			)
			expect(result['status']).toBe('succeeded')
			expect(result['text']).toContain('Tool path')
		} finally {
			restore()
		}
	})

	test('host store rejected', async () => {
		const client = new TextractClient(auth)
		try {
			await client.extractText({ source: { store: 'host', key: 'local' } })
			expect.unreachable()
		} catch (error) {
			expect(isToolError(error)).toBe(true)
			if (isToolError(error)) expect(error.code).toBe('bad_input')
		}
	})

	test('invalid auth rejected at construct', () => {
		expect(() => new TextractClient({ ...auth, access_key_id: '' })).toThrow()
	})

	test('key_prefix: DocumentLocation.S3Object.Name uses wire key; source stays logical', async () => {
		let startBody = ''
		const restore = mockFetch(async (input, init) => {
			const target = amzTarget(input, init)
			if (target.includes('StartDocumentTextDetection')) {
				if (input instanceof Request) {
					startBody = await input.clone().text()
				} else if (typeof init?.body === 'string') {
					startBody = init.body
				}
				return new Response(JSON.stringify({ JobId: 'job-pref' }), {
					status: 200,
					headers: { 'content-type': 'application/x-amz-json-1.1' }
				})
			}
			if (target.includes('GetDocumentTextDetection')) {
				return new Response(
					JSON.stringify({
						JobStatus: 'SUCCEEDED',
						Blocks: [{ BlockType: 'LINE', Text: 'Scoped' }],
						DocumentMetadata: { Pages: 1 }
					}),
					{ status: 200, headers: { 'content-type': 'application/x-amz-json-1.1' } }
				)
			}
			return new Response(`unexpected target=${target}`, { status: 500 })
		})

		try {
			const client = new TextractClient({ ...auth, key_prefix: 'tenants/acme' })
			const result = await client.extractText({
				source: { store: 'object', key: 'inbox/a.pdf', filename: 'a.pdf' }
			})
			expect(result.status).toBe('succeeded')
			expect(result.source).toEqual({ store: 'object', key: 'inbox/a.pdf', filename: 'a.pdf' })
			const parsed = JSON.parse(startBody) as {
				DocumentLocation?: { S3Object?: { Name?: string; Bucket?: string } }
			}
			expect(parsed.DocumentLocation?.S3Object?.Bucket).toBe('docs')
			expect(parsed.DocumentLocation?.S3Object?.Name).toBe('tenants/acme/inbox/a.pdf')
		} finally {
			restore()
		}
	})

	test('key_prefix: already-prefixed ArtifactRef.key is not double-prefixed on the wire', async () => {
		let startBody = ''
		const restore = mockFetch(async (input, init) => {
			const target = amzTarget(input, init)
			if (target.includes('StartDocumentTextDetection')) {
				if (input instanceof Request) {
					startBody = await input.clone().text()
				} else if (typeof init?.body === 'string') {
					startBody = init.body
				}
				return new Response(JSON.stringify({ JobId: 'job-mig' }), {
					status: 200,
					headers: { 'content-type': 'application/x-amz-json-1.1' }
				})
			}
			if (target.includes('GetDocumentTextDetection')) {
				return new Response(JSON.stringify({ JobStatus: 'SUCCEEDED', Blocks: [], DocumentMetadata: { Pages: 1 } }), {
					status: 200,
					headers: { 'content-type': 'application/x-amz-json-1.1' }
				})
			}
			return new Response('nope', { status: 500 })
		})
		try {
			const client = new TextractClient({ ...auth, key_prefix: 'tenants/acme/' })
			await client.extractText({
				source: { store: 'object', key: 'tenants/acme/inbox/a.pdf' }
			})
			const parsed = JSON.parse(startBody) as { DocumentLocation?: { S3Object?: { Name?: string } } }
			expect(parsed.DocumentLocation?.S3Object?.Name).toBe('tenants/acme/inbox/a.pdf')
		} finally {
			restore()
		}
	})
})
