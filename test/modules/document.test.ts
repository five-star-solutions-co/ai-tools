import { describe, expect, test } from 'bun:test'
import { isPlainObject } from 'es-toolkit'

import { runTool, validateModule, withAuth } from '../../src/core'
import { documentModule } from '../../src/modules/document'
import { base64ToBytes, bytesToBase64, bytesToUtf8, utf8ToBytes } from '../../src/shared/bytes'
import {
	buildDocument,
	buildPresentation,
	buildSpreadsheet,
	detectFormat,
	detectFormatFromBytes,
	patchDocx,
	patchPptx,
	patchSpreadsheet,
	patchTextDocument,
	renderPdfPages,
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

function buildMinimalPdf(): Uint8Array {
	const objects = [
		'<< /Type /Catalog /Pages 2 0 R >>',
		'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
		'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 120] /Contents 4 0 R >>',
		'<< /Length 0 >>\nstream\n\nendstream'
	]
	let pdf = '%PDF-1.4\n'
	const offsets = [0]
	for (let index = 0; index < objects.length; index += 1) {
		offsets.push(new TextEncoder().encode(pdf).byteLength)
		pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`
	}
	const xrefOffset = new TextEncoder().encode(pdf).byteLength
	pdf += `xref\n0 ${objects.length + 1}\n`
	pdf += '0000000000 65535 f \n'
	for (const offset of offsets.slice(1)) {
		pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
	}
	pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
	return utf8ToBytes(pdf)
}

describe('document', () => {
	test('module contracts and tool ids', () => {
		expect(validateModule(documentModule).ok).toBe(true)
		expect(documentModule.tools.map((t) => t.id).sort()).toEqual([
			'document-build-document',
			'document-build-presentation',
			'document-build-spreadsheet',
			'document-build-text',
			'document-edit-document',
			'document-edit-presentation',
			'document-edit-spreadsheet',
			'document-edit-text',
			'document-read'
		])
	})

	test('detectFormat and read text/json/csv/html/image', async () => {
		expect(detectFormat({ filename: 'a.md' })).toBe('md')
		expect(() => detectFormat({ filename: 'legacy.doc' })).toThrow('office-to-pdf')
		const csv = await readBytes('csv', utf8ToBytes('a,b\n1,2\n'), { filename: 't.csv' })
		expect(csv.tables?.[0]?.rows).toEqual([
			['a', 'b'],
			[1, 2]
		])
		const json = await readBytes('json', utf8ToBytes('{"ok":true}'), {})
		expect(json.text).toContain('ok')
		const html = await readBytes(
			'html',
			utf8ToBytes(
				'<style>.hidden{display:none}</style><h1>Hello &amp; welcome</h1><p>World</p><script>ignore()</script>'
			),
			{}
		)
		expect(html.html).toContain('<h1>')
		expect(html.text).toContain('Hello & welcome')
		expect(html.text).toContain('World')
		expect(html.text).not.toContain('ignore')

		const png = base64ToBytes(
			'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
		)
		expect(await detectFormatFromBytes(png, {})).toBe('image')
		const image = await readBytes('image', png, { media_type: 'image/png' })
		expect(image.image).toEqual({ width: 1, height: 1 })
	})

	test('uses ExcelJS CSV parsing and writing for quoted and multiline values', async () => {
		const source = utf8ToBytes('name,notes\nAlice,"hello,\nworld"\n')
		const read = await readBytes('csv', source, { filename: 'people.csv' })
		expect(read.tables?.[0]?.rows).toEqual([
			['name', 'notes'],
			['Alice', 'hello,\nworld']
		])

		const patched = await patchSpreadsheet(source, 'csv', [{ row: 2, col: 2, value: 'updated, safely' }])
		expect(bytesToUtf8(patched.bytes)).toContain('"updated, safely"')
		const roundTrip = await readBytes('csv', patched.bytes, {})
		expect(roundTrip.tables?.[0]?.rows[1]).toEqual(['Alice', 'updated, safely'])
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
			slides: [{ title: 'One', bullets: ['a', 'b'], notes: 'Speaker context' }]
		})
		const readP = await readBytes('pptx', pptx, { filename: 'd.pptx' })
		expect(readP.slides?.[0]?.title).toBe('One')
		expect(readP.slides?.[0]?.notes).toContain('Speaker context')
	})

	test('reads PDF page text shape and renders selected pages as PNG', async () => {
		const pdf = buildMinimalPdf()
		const read = await readBytes('pdf', pdf, { filename: 'blank.pdf' })
		expect(read.page_count).toBe(1)
		expect(read.pages?.[0]?.page_number).toBe(1)

		const rendered = await renderPdfPages(pdf, [1], 1)
		expect(rendered[0]?.bytes.byteLength).toBeGreaterThan(100)
		expect(rendered[0]?.width).toBe(200)
		expect(rendered[0]?.height).toBe(120)
	})

	test('edits text, docx, and pptx through their format libraries', async () => {
		const markdown = patchTextDocument(utf8ToBytes('# Old\nOld'), 'md', [{ find: 'Old', replace: 'New', match: 'all' }])
		expect(new TextDecoder().decode(markdown)).toBe('# New\nNew')

		const docx = await buildDocument({
			title: 'Old title',
			sections: [{ heading: 'Old heading', paragraphs: ['Keep this paragraph'] }]
		})
		const patchedDocxBytes = await patchDocx(docx, [{ find: 'Old', replace: 'New', match: 'all' }])
		const readDocx = await readBytes('docx', patchedDocxBytes, {})
		expect(readDocx.text).toContain('New title')
		expect(readDocx.text).toContain('New heading')
		expect(readDocx.text).toContain('Keep this paragraph')

		const pptx = await buildPresentation({
			title: 'Deck',
			slides: [
				{ title: 'Old one', bullets: ['Keep one'], notes: 'Old note one' },
				{ title: 'Old two', bullets: ['Keep two'], notes: 'Old note two' }
			]
		})
		const patchedPptxBytes = await patchPptx(pptx, [
			{ find: 'Old one', replace: 'New one' },
			{ find: 'Old two', replace: 'New two' }
		])
		const readPptx = await readBytes('pptx', patchedPptxBytes, {})
		expect(readPptx.slides?.[0]?.title).toBe('New one')
		expect(readPptx.slides?.[1]?.title).toBe('New two')
		expect(readPptx.slides?.[0]?.notes).toContain('Old note one')
		expect(readPptx.slides?.[1]?.notes).toContain('Old note two')
	})

	test('rejects edits when required replacement text is missing', async () => {
		expect(() =>
			patchTextDocument(utf8ToBytes('hello'), 'txt', [{ find: 'missing', replace: 'x', match: 'all' }])
		).toThrow()
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

	test('document-read renders requested PDF page images to object storage', async () => {
		const bound = withAuth(documentModule, storageAuth)
		const tool = bound.tools.find((candidate) => candidate.id === 'document-read')
		if (!tool) throw new Error('missing tool')

		const original = globalThis.fetch
		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const request = input instanceof Request ? input : new Request(input, init)
			if (request.method === 'PUT' && decodeURIComponent(request.url).includes('page-1.png')) {
				return new Response(null, { status: 200 })
			}
			return new Response(`unexpected ${request.method} ${request.url}`, { status: 500 })
		}) as typeof globalThis.fetch

		try {
			const result = asRecord(
				await runTool(tool, {
					source: {
						body_base64: bytesToBase64(buildMinimalPdf()),
						filename: 'blank.pdf'
					},
					pdf_page_images: {
						page_numbers: [1],
						output_key_prefix: 'pages/blank',
						scale: 1
					}
				})
			)
			expect(result['page_count']).toBe(1)
			const pages = result['pages']
			expect(Array.isArray(pages)).toBe(true)
			if (Array.isArray(pages) && isPlainObject(pages[0])) {
				const image = pages[0]['image']
				expect(isPlainObject(image)).toBe(true)
				if (isPlainObject(image)) {
					expect(image['key']).toBe('pages/blank/page-1.png')
					expect(image['media_type']).toBe('image/png')
				}
			}
		} finally {
			globalThis.fetch = original
		}
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
