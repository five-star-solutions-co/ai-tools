import { describe, expect, test } from 'bun:test'
import sharp from 'sharp'

import { ImageClient } from '../../../src/modules/image'
import { S3Client } from '../../../src/vendors/s3'
import { s3AuthFromEnv, uniqueId } from '../env'

const storage = s3AuthFromEnv()
const run = describe

run('live seam image', () => {
	test(
		'metadata resize crop thumbnail and convert object artifacts',
		async () => {
			const prefix = `ai-tools-it/image/${uniqueId('image')}`
			const sourceKey = `${prefix}/source.png`
			const cleanup: string[] = [sourceKey]
			const s3 = new S3Client(storage)
			const bytes = await sharp({
				create: { width: 40, height: 30, channels: 4, background: { r: 20, g: 40, b: 60, alpha: 1 } }
			})
				.png()
				.toBuffer()
			await s3.putBytes(sourceKey, bytes, 'image/png')
			const client = ImageClient.fromAuth({ storage })
			const source = { store: 'object', key: sourceKey, media_type: 'image/png' } as const

			try {
				expect((await client.metadata({ source })).width).toBe(40)
				const resized = await client.resize({ source, width: 20, output_key: `${prefix}/resized.png` })
				cleanup.push(resized.result.key)
				const cropped = await client.crop({
					source,
					left: 0,
					top: 0,
					width: 10,
					height: 10,
					output_key: `${prefix}/cropped.png`
				})
				cleanup.push(cropped.result.key)
				const thumbnail = await client.thumbnail({
					source,
					width: 12,
					height: 12,
					output_key: `${prefix}/thumbnail.png`
				})
				cleanup.push(thumbnail.result.key)
				const converted = await client.convert({
					source,
					format: 'webp',
					output_key: `${prefix}/converted.webp`
				})
				cleanup.push(converted.result.key)
				expect(converted.result.media_type).toBe('image/webp')
			} finally {
				for (const key of cleanup) await s3.delete({ key }).catch(() => undefined)
			}
		},
		{ timeout: 90_000 }
	)
})
