import { describe, expect, test } from 'bun:test'
import { PDFDocument } from 'pdf-lib'

import { validateModule } from '../../src/core'
import { PdfClient, pdfModule } from '../../src/modules/pdf'
import { toArrayBuffer } from '../../src/shared/bytes'

const auth = {
	storage: {
		access_key_id: 'AKIAtest',
		secret_access_key: 'secret',
		region: 'us-east-1',
		bucket: 'files'
	}
} as const

async function samplePdf(pageCount = 2): Promise<Uint8Array> {
	const pdf = await PDFDocument.create()
	pdf.setTitle('Sample')
	for (let index = 0; index < pageCount; index += 1) pdf.addPage([300 + index, 400 + index])
	return pdf.save()
}

function objectStore(initial: Record<string, Uint8Array>) {
	const objects = new Map(Object.entries(initial))
	const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
		const request = input instanceof Request ? input : new Request(input, init)
		const key = decodeURIComponent(new URL(request.url).pathname.replace(/^\//, ''))
		if (request.method === 'HEAD') {
			const value = objects.get(key)
			return value
				? new Response(null, {
						status: 200,
						headers: { 'content-length': String(value.byteLength), 'content-type': 'application/pdf' }
					})
				: new Response(null, { status: 404 })
		}
		if (request.method === 'GET') {
			const value = objects.get(key)
			return value ? new Response(toArrayBuffer(value)) : new Response(null, { status: 404 })
		}
		if (request.method === 'PUT') {
			objects.set(key, new Uint8Array(await request.arrayBuffer()))
			return new Response(null, { status: 200 })
		}
		return new Response(`unexpected ${request.method}`, { status: 500 })
	}
	return { objects, fetch }
}

function source(key: string) {
	return { store: 'object', key, media_type: 'application/pdf' } as const
}

describe('pdf', () => {
	test('module contracts and tool ids', () => {
		expect(validateModule(pdfModule).ok).toBe(true)
		expect(pdfModule.tools.map((tool) => tool.id).sort()).toEqual([
			'pdf-extract-pages',
			'pdf-inspect',
			'pdf-merge',
			'pdf-rotate',
			'pdf-split'
		])
	})

	test('inspect, merge, extract, split, and rotate real PDF bytes', async () => {
		const first = await samplePdf(2)
		const second = await samplePdf(1)
		const store = objectStore({ 'first.pdf': first, 'second.pdf': second })
		const client = PdfClient.fromAuth(auth, { fetch: store.fetch })

		const inspected = await client.inspect({ source: source('first.pdf') })
		expect(inspected.page_count).toBe(2)
		expect(inspected.metadata.title).toBe('Sample')
		expect(inspected.pages[0]?.width).toBe(300)

		const merged = await client.merge({
			sources: [source('first.pdf'), source('second.pdf')],
			output_key: 'merged.pdf'
		})
		expect((await PDFDocument.load(store.objects.get(merged.result.key)!)).getPageCount()).toBe(3)

		const extracted = await client.extractPages({
			source: source('first.pdf'),
			pages: [2],
			output_key: 'extracted.pdf'
		})
		const extractedPdf = await PDFDocument.load(store.objects.get(extracted.result.key)!)
		expect(extractedPdf.getPageCount()).toBe(1)
		expect(extractedPdf.getPage(0).getWidth()).toBe(301)

		const split = await client.split({ source: source('first.pdf'), output_key_prefix: 'pages' })
		expect(split.results.map((result) => result.key)).toEqual(['pages/page-1.pdf', 'pages/page-2.pdf'])

		const rotated = await client.rotate({
			source: source('first.pdf'),
			degrees: 90,
			pages: [2],
			output_key: 'rotated.pdf'
		})
		const rotatedPdf = await PDFDocument.load(store.objects.get(rotated.result.key)!)
		expect(rotatedPdf.getPage(0).getRotation().angle).toBe(0)
		expect(rotatedPdf.getPage(1).getRotation().angle).toBe(90)
	})

	test('rejects an out-of-range page request', async () => {
		const store = objectStore({ 'one.pdf': await samplePdf(1) })
		const client = PdfClient.fromAuth(auth, { fetch: store.fetch })
		expect(client.extractPages({ source: source('one.pdf'), pages: [2], output_key: 'bad.pdf' })).rejects.toMatchObject(
			{ code: 'bad_input' }
		)
	})
})
