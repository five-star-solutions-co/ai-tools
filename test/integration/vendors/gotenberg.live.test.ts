import { describe, expect, test } from 'bun:test'

import { GotenbergClient } from '../../../src/vendors/gotenberg'
import { S3Client } from '../../../src/vendors/s3'
import { gotenbergAuthHeadersFromEnv, gotenbergBaseUrlFromEnv, objectKey, s3AuthFromEnv } from '../helpers'

const baseUrl = gotenbergBaseUrlFromEnv()
const storage = s3AuthFromEnv()
const run = describe

function auth() {
	return {
		gotenberg_base_url: baseUrl,
		storage,
		...gotenbergAuthHeadersFromEnv()
	}
}

run('live vendor gotenberg', () => {
	test('renderPdf html to storage', async () => {
		const client = new GotenbergClient(auth())
		const out = await client.renderPdf({
			source: { html: '<html><body><h1>ai-tools gotenberg it</h1></body></html>' },
			filename: 'gotenberg-it.pdf'
		})
		expect(out.kind).toBe('pdf')
		expect(out.result.key).toBeTruthy()
	})

	test('renderScreenshot html to storage', async () => {
		const client = new GotenbergClient(auth())
		const out = await client.renderScreenshot({
			source: { html: '<html><body><h1>ai-tools gotenberg shot</h1></body></html>' },
			filename: 'gotenberg-it.png'
		})
		expect(out.kind).toBe('screenshot')
		expect(out.result.key).toBeTruthy()
	})

	test('convert and convertBatch office-to-pdf', async () => {
		const s3 = new S3Client(storage)
		const sourceKey = objectKey('gotenberg-convert-src')
		const rtf = '{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Times New Roman;}}\\f0\\fs24 Hello convert.\\par}'
		await s3.put({
			key: sourceKey,
			body: rtf,
			body_encoding: 'utf8',
			content_type: 'application/rtf'
		})
		try {
			const client = new GotenbergClient(auth())
			const source = {
				store: 'object' as const,
				key: sourceKey,
				filename: 'hello.rtf',
				media_type: 'application/rtf'
			}
			const converted = await client.convert({ source, path: 'office-to-pdf' })
			expect(converted.path).toBe('office-to-pdf')
			expect(converted.result.media_type).toBe('application/pdf')

			const batch = await client.convertBatch({ items: [{ source, path: 'office-to-pdf' }] })
			expect(batch.results.length).toBe(1)
			expect(batch.succeeded + batch.failed).toBe(1)
		} finally {
			await s3.delete({ key: sourceKey }).catch(() => undefined)
		}
	})
})
