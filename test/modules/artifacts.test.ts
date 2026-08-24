import { describe, expect, test } from 'bun:test'
import { isPlainObject } from 'es-toolkit'

import { isToolError, runTool, validateModule } from '../../src/core'
import {
	ArtifactsClient,
	artifactsCreateTool,
	artifactsModule,
	artifactsReadLinesTool,
	artifactsReadRangeTool
} from '../../src/modules/artifacts'
import type { ArtifactsClientOps, ArtifactsOps } from '../../src/modules/artifacts'

function asRecord(value: unknown): Record<string, unknown> {
	if (!isPlainObject(value)) throw new Error('expected object')
	return value
}

function asRequest(input: RequestInfo | URL, init?: RequestInit): Request {
	return input instanceof Request ? input : new Request(input, init)
}

const storage = {
	access_key_id: 'AKIAtest',
	secret_access_key: 'secret',
	region: 'auto',
	bucket: 'artifacts',
	endpoint: 'https://example.r2.cloudflarestorage.com'
} as const

describe('artifacts', () => {
	test('module contracts and tool ids', () => {
		expect(validateModule(artifactsModule).ok).toBe(true)
		expect(artifactsModule.tools.map((tool) => tool.id).sort()).toEqual([
			'artifacts-create',
			'artifacts-read-lines',
			'artifacts-read-range'
		])
	})

	test('object provider creates an artifact', async () => {
		const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
			const request = asRequest(input, init)
			expect(request.method).toBe('PUT')
			expect(request.url).toContain('/notes/hello.txt')
			expect(await request.text()).toBe('hello')
			return new Response(null, { status: 200 })
		}

		const result = await runTool(
			artifactsCreateTool,
			{
				key: 'notes/hello.txt',
				body: 'hello',
				encoding: 'utf8',
				media_type: 'text/plain',
				filename: 'hello.txt'
			},
			{ auth: { provider: 'object', storage }, fetch }
		)
		expect(result.artifact).toEqual({
			store: 'object',
			key: 'notes/hello.txt',
			byte_length: 5,
			media_type: 'text/plain',
			filename: 'hello.txt'
		})
	})

	test('object provider reads an inclusive byte range', async () => {
		const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
			const request = asRequest(input, init)
			if (request.method === 'HEAD') {
				return new Response(null, {
					status: 200,
					headers: { 'content-length': '11', 'content-type': 'text/plain', etag: '"v1"' }
				})
			}
			expect(request.method).toBe('GET')
			expect(request.headers.get('range')).toBe('bytes=6-10')
			return new Response('world', {
				status: 206,
				headers: { 'content-range': 'bytes 6-10/11', 'content-type': 'text/plain' }
			})
		}

		const result = await runTool(
			artifactsReadRangeTool,
			{
				source: { store: 'object', key: 'hello.txt' },
				start_byte: 6,
				end_byte: 10
			},
			{ auth: { provider: 'object', storage }, fetch }
		)
		expect(result.body_base64).toBe('d29ybGQ=')
		expect(result.start_byte).toBe(6)
		expect(result.end_byte).toBe(10)
		expect(result.total_bytes).toBe(11)
	})

	test('object provider reads a complete UTF-8 text artifact', async () => {
		const text = 'one\ntwo\nthree\nfour'
		const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
			const request = asRequest(input, init)
			if (request.method === 'HEAD') {
				return new Response(null, {
					status: 200,
					headers: { 'content-length': String(text.length), 'content-type': 'text/plain' }
				})
			}
			return new Response(text, {
				status: 206,
				headers: { 'content-range': `bytes 0-${text.length - 1}/${text.length}` }
			})
		}

		const result = await runTool(
			artifactsReadLinesTool,
			{ source: { store: 'object', key: 'lines.txt' } },
			{ auth: { provider: 'object', storage }, fetch }
		)
		expect(result.text).toBe(text)
		expect(result.start_line).toBe(1)
		expect(result.end_line).toBe(4)
		expect(result.total_lines).toBe(4)
	})

	test('object provider resolves bounded bytes and storage metadata for host delivery', async () => {
		const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
			const request = asRequest(input, init)
			if (request.method === 'HEAD') {
				return new Response(null, {
					status: 200,
					headers: { 'content-length': '5', 'content-type': 'text/plain' }
				})
			}
			expect(request.method).toBe('GET')
			return new Response('hello', {
				status: 206,
				headers: { 'content-range': 'bytes 0-4/5', 'content-type': 'text/plain' }
			})
		}
		const client = ArtifactsClient.fromAuth({ provider: 'object', storage }, { fetch })

		const resolved = await client.resolve({
			source: { store: 'object', key: 'hello.txt', filename: 'hello.txt' },
			max_bytes: 10
		})

		expect(new TextDecoder().decode(resolved.bytes)).toBe('hello')
		expect(resolved.artifact).toEqual({
			store: 'object',
			key: 'hello.txt',
			filename: 'hello.txt',
			media_type: 'text/plain',
			byte_length: 5
		})
	})

	test('host provider delegates all artifact verbs and validates refs', async () => {
		const backend: ArtifactsOps = {
			create: async (input) => ({
				artifact: {
					store: 'host',
					key: `host:${input.key}`,
					byte_length: input.body.length
				}
			}),
			readRange: async (input) => ({
				source: input.source,
				body_base64: 'YWJj',
				start_byte: input.start_byte,
				end_byte: input.end_byte,
				total_bytes: 3
			}),
			readLines: async (input) => ({
				source: input.source,
				text: 'line',
				start_line: 1,
				end_line: 1,
				total_lines: 1
			})
		}
		const auth = { provider: 'host', backend } as const

		const created = await runTool(artifactsCreateTool, { key: 'a.txt', body: 'a', encoding: 'utf8' }, { auth })
		expect(created.artifact.store).toBe('host')

		const range = await runTool(
			artifactsReadRangeTool,
			{ source: created.artifact, start_byte: 0, end_byte: 2 },
			{ auth }
		)
		expect(range.body_base64).toBe('YWJj')

		const lines = await runTool(artifactsReadLinesTool, { source: created.artifact }, { auth })
		expect(lines.text).toBe('line')
		expect(asRecord(lines.source)['store']).toBe('host')
	})

	test('host provider resolves bytes through the bounded client contract', async () => {
		let resolveCalls = 0
		const backend: ArtifactsClientOps = {
			create: async (input) => ({
				artifact: { store: 'host', key: input.key }
			}),
			readRange: async (input) => ({
				source: input.source,
				body_base64: '',
				start_byte: input.start_byte,
				end_byte: input.end_byte
			}),
			readLines: async (input) => ({
				source: input.source,
				text: '',
				start_line: 1,
				end_line: 1,
				total_lines: 0
			}),
			resolve: async (input) => {
				resolveCalls += 1
				return {
					artifact: {
						...input.source,
						media_type: 'application/octet-stream',
						filename: 'payload.bin'
					},
					bytes: new Uint8Array([1, 2, 3])
				}
			}
		}
		const client = ArtifactsClient.fromAuth({ provider: 'host', backend })

		const resolved = await client.resolve({
			source: { store: 'host', key: 'turn/payload' },
			max_bytes: 3
		})

		expect(resolveCalls).toBe(1)
		expect(resolved.bytes).toEqual(new Uint8Array([1, 2, 3]))
		expect(resolved.artifact).toEqual({
			store: 'host',
			key: 'turn/payload',
			media_type: 'application/octet-stream',
			filename: 'payload.bin',
			byte_length: 3
		})

		let errorCode: string | undefined
		try {
			await client.resolve({
				source: { store: 'host', key: 'turn/large', byte_length: 4 },
				max_bytes: 3
			})
		} catch (error) {
			if (isToolError(error)) errorCode = error.code
		}
		expect(errorCode).toBe('too_large')
		expect(resolveCalls).toBe(1)
	})
})
