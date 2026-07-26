import { describe, expect, test } from 'bun:test'
import { isPlainObject } from 'es-toolkit'

import { runTool, validateModule, withAuth } from '../../src/core'
import { documentModule } from '../../src/modules/document'
import { bytesToBase64, utf8ToBytes } from '../../src/shared/bytes'
import {
	buildDocument,
	buildPresentation,
	buildSpreadsheet,
	detectFormat,
	readBytes
} from '../../src/modules/document/domain'

function asRecord(value: unknown): Record<string, unknown> {
	if (!isPlainObject(value)) throw new Error('expected object')
	return value
}

const storageAuth = {
	storage: {
		access_key_id: 'AKIAtest',
		secret_access_key: 'secret',
		region: 'auto',
		bucket: 'artifacts',
		endpoint: 'https://example.r2.cloudflarestorage.com'
	}
} as const

describe('document', () => {
	test('module contracts and tool ids', () => {
		expect(validateModule(documentModule).ok).toBe(true)
		expect(documentModule.tools.map((t) => t.id).sort()).toEqual([
			'document-build-document',
			'document-build-presentation',
			'document-build-spreadsheet',
			'document-build-text',
			'document-edit-spreadsheet',
			'document-read'
		])
	})

	test('detectFormat and read text/json/csv', async () => {
		expect(detectFormat({ filename: 'a.md' })).toBe('md')
		const csv = await readBytes('csv', utf8ToBytes('a,b\n1,2\n'), { filename: 't.csv' })
		expect(csv.tables?.[0]?.rows).toEqual([
			['a', 'b'],
			['1', '2']
		])
		const json = await readBytes('json', utf8ToBytes('{"ok":true}'), {})
		expect(json.text).toContain('ok')
	})

	test('build spreadsheet/document/presentation round-trip bytes', async () => {
		const xlsx = await buildSpreadsheet([
			{
				name: 'S1',
				rows: [
					['h1', 'h2'],
					[1, 2]
				]
			}
		])
		expect(xlsx.byteLength > 100).toBe(true)
		const readX = await readBytes('xlsx', xlsx, { filename: 'w.xlsx' })
		expect(readX.tables?.[0]?.rows[0]).toEqual(['h1', 'h2'])

		const docx = await buildDocument({
			title: 'T',
			sections: [{ heading: 'H', paragraphs: ['p1'] }]
		})
		const readD = await readBytes('docx', docx, { filename: 'd.docx' })
		expect(readD.text).toContain('T')
		expect(readD.text).toContain('p1')

		const pptx = await buildPresentation({
			title: 'Deck',
			slides: [{ title: 'One', bullets: ['a', 'b'] }]
		})
		const readP = await readBytes('pptx', pptx, { filename: 'd.pptx' })
		expect(readP.slides?.[0]?.title).toBe('One')
	})

	test('document-read tool with body_base64', async () => {
		const bound = withAuth(documentModule, storageAuth)
		const tool = bound.tools.find((t) => t.id === 'document-read')
		if (!tool) throw new Error('missing tool')
		const result = asRecord(
			await runTool(tool, {
				source: {
					body_base64: bytesToBase64(utf8ToBytes('hello world')),
					filename: 'note.txt'
				}
			})
		)
		expect(result['format']).toBe('txt')
		expect(result['text']).toBe('hello world')
	})

	test('document-build-text writes via S3 put', async () => {
		const bound = withAuth(documentModule, storageAuth)
		const tool = bound.tools.find((t) => t.id === 'document-build-text')
		if (!tool) throw new Error('missing tool')

		const original = globalThis.fetch
		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const req = input instanceof Request ? input : new Request(input, init)
			const url = decodeURIComponent(req.url)
			if (req.method === 'PUT' && url.includes('out.md')) {
				return new Response(null, { status: 200 })
			}
			return new Response(`unexpected ${req.method} ${url}`, { status: 500 })
		}) as typeof globalThis.fetch

		try {
			const result = asRecord(
				await runTool(tool, {
					format: 'md',
					content: '# Hi',
					output_key: 'docs/out.md',
					filename: 'out.md'
				})
			)
			const art = result['result']
			expect(isPlainObject(art)).toBe(true)
			if (isPlainObject(art)) {
				expect(art['key']).toBe('docs/out.md')
				expect(art['media_type']).toBe('text/markdown')
			}
		} finally {
			globalThis.fetch = original
		}
	})
})
