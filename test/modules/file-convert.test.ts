import { describe, expect, test } from 'bun:test'
import { isPlainObject } from 'es-toolkit'

import { runTool, validateModule, withAuth } from '../../src/core'
import { fileConvertModule, fileConvertTool } from '../../src/modules/file-convert'

function asRecord(value: unknown): Record<string, unknown> {
	if (!isPlainObject(value)) throw new Error('expected object')
	return value
}

describe('file-convert', () => {
	test('passes contracts', () => {
		expect(validateModule(fileConvertModule).ok).toBe(true)
		expect(fileConvertTool.id).toBe('file-convert')
		expect(fileConvertTool.meta.sideEffect).toBe('write')
		expect(fileConvertModule.tools.some((t) => t.id === 'file-convert-batch')).toBe(true)
	})

	test('gotenberg provider converts office doc to pdf and writes result', async () => {
		const bound = withAuth(fileConvertModule, {
			provider: 'gotenberg',
			gotenberg_base_url: 'http://gotenberg.example',
			storage: {
				access_key_id: 'AKIAtest',
				secret_access_key: 'secret',
				region: 'auto',
				bucket: 'artifacts',
				endpoint: 'https://example.r2.cloudflarestorage.com'
			}
		})
		const tool = bound.tools[0]
		if (!tool) throw new Error('missing tool')

		const original = globalThis.fetch
		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
			const method = init?.method ?? (input instanceof Request ? input.method : 'GET')

			if (url.includes('artifacts') && url.includes('in.docx') && method === 'GET') {
				return new Response(new Uint8Array([1, 2, 3, 4]), { status: 200 })
			}
			if (url.includes('gotenberg.example') && url.includes('/forms/libreoffice/convert') && method === 'POST') {
				return new Response(new Uint8Array([9, 9, 9]), {
					status: 200,
					headers: { 'content-type': 'application/pdf' }
				})
			}
			if (url.includes('artifacts') && method === 'PUT') {
				expect(url).toContain('in.pdf')
				return new Response(null, { status: 200 })
			}
			return new Response(`unexpected ${method} ${url}`, { status: 500 })
		}) as typeof globalThis.fetch

		try {
			const result = asRecord(
				await runTool(tool, {
					source: {
						store: 'object',
						key: 'docs/in.docx',
						filename: 'in.docx',
						media_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
					},
					path: 'office-to-pdf'
				})
			)
			expect(result['path']).toBe('office-to-pdf')
			const out = result['result']
			expect(isPlainObject(out)).toBe(true)
			if (isPlainObject(out)) {
				expect(out['store']).toBe('object')
				expect(out['key']).toBe('docs/in.pdf')
				expect(out['byte_length']).toBe(3)
				expect(out['media_type']).toBe('application/pdf')
			}
		} finally {
			globalThis.fetch = original
		}
	})
})
