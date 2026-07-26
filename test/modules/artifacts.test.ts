import { describe, expect, test } from 'bun:test'
import { isPlainObject } from 'es-toolkit'

import { runTool, validateModule } from '../../src/core'
import {
	artifactsCreateTool,
	artifactsModule,
	artifactsReadLinesTool,
	artifactsReadRangeTool
} from '../../src/modules/artifacts'
import type { ArtifactsOps } from '../../src/modules/artifacts'

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

	test('object provider reads an inclusive UTF-8 line range', async () => {
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
			{
				source: { store: 'object', key: 'lines.txt' },
				start_line: 2,
				end_line: 3
			},
			{ auth: { provider: 'object', storage }, fetch }
		)
		expect(result.text).toBe('two\nthree')
		expect(result.start_line).toBe(2)
		expect(result.end_line).toBe(3)
		expect(result.total_lines).toBe(4)
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
				start_line: input.start_line,
				end_line: input.start_line,
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

		const lines = await runTool(
			artifactsReadLinesTool,
			{ source: created.artifact, start_line: 1, end_line: 1 },
			{ auth }
		)
		expect(lines.text).toBe('line')
		expect(asRecord(lines.source)['store']).toBe('host')
	})
})
