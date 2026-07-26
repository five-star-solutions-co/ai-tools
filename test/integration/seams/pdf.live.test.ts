import { describe, expect, test } from 'bun:test'
import { PDFDocument } from 'pdf-lib'

import { PdfClient } from '../../../src/modules/pdf'
import { S3Client } from '../../../src/vendors/s3'
import { s3AuthFromEnv, uniqueId } from '../env'

const storage = s3AuthFromEnv()
const run = describe

run('live seam pdf', () => {
	test(
		'inspect merge extract split and rotate object artifacts',
		async () => {
			const prefix = `ai-tools-it/pdf/${uniqueId('pdf')}`
			const sourceKey = `${prefix}/source.pdf`
			const secondKey = `${prefix}/second.pdf`
			const cleanup: string[] = [sourceKey, secondKey]
			const s3 = new S3Client(storage)
			const first = await PDFDocument.create()
			first.addPage([300, 400])
			first.addPage([301, 401])
			const second = await PDFDocument.create()
			second.addPage([200, 200])
			await s3.putBytes(sourceKey, await first.save(), 'application/pdf')
			await s3.putBytes(secondKey, await second.save(), 'application/pdf')
			const client = PdfClient.fromAuth({ storage })
			const source = { store: 'object', key: sourceKey, media_type: 'application/pdf' } as const
			const other = { store: 'object', key: secondKey, media_type: 'application/pdf' } as const

			try {
				expect((await client.inspect({ source })).page_count).toBe(2)
				const merged = await client.merge({ sources: [source, other], output_key: `${prefix}/merged.pdf` })
				cleanup.push(merged.result.key)
				const extracted = await client.extractPages({
					source,
					pages: [2],
					output_key: `${prefix}/extracted.pdf`
				})
				cleanup.push(extracted.result.key)
				const rotated = await client.rotate({ source, degrees: 90, output_key: `${prefix}/rotated.pdf` })
				cleanup.push(rotated.result.key)
				const split = await client.split({ source, output_key_prefix: `${prefix}/pages` })
				cleanup.push(...split.results.map((result) => result.key))
				expect(split.results).toHaveLength(2)
			} finally {
				for (const key of cleanup) await s3.delete({ key }).catch(() => undefined)
			}
		},
		{ timeout: 90_000 }
	)
})
