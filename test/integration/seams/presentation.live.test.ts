import { describe, expect, test } from 'bun:test'

import { PresentationClient } from '../../../src/modules/presentation'
import { S3Client } from '../../../src/vendors/s3'
import { objectKey, s3AuthFromEnv } from '../helpers'

const storage = s3AuthFromEnv()

async function cleanup(keys: string[]) {
	const s3 = new S3Client(storage)
	for (const key of keys) await s3.delete({ key }).catch(() => undefined)
}

describe('live seam presentation', () => {
	test('build edit read slides', async () => {
		const client = PresentationClient.fromAuth({ storage })
		const key = objectKey('presentation-pptx')
		const editKey = objectKey('presentation-pptx-edit')
		const keys = [key, editKey]

		try {
			const built = await client.build({
				title: 'Deck',
				slides: [{ title: 'Hello slide', bullets: ['one', 'two'], notes: 'Speaker notes' }],
				output_key: key,
				filename: 'it.pptx'
			})
			expect(built.result.key).toBe(key)

			const read = await client.read({
				source: { artifact: { store: 'object', key, filename: 'it.pptx' } }
			})
			expect(read.slides[0]?.title).toContain('Hello')
			expect(read.slides[0]?.notes).toContain('Speaker')

			const edited = await client.edit({
				source: { artifact: { store: 'object', key, filename: 'it.pptx' } },
				replacements: [{ find: 'Hello', replace: 'Updated' }],
				output_key: editKey,
				filename: 'it-edited.pptx'
			})
			expect(edited.result.key).toBe(editKey)

			const readEdited = await client.read({
				source: { artifact: { store: 'object', key: editKey, filename: 'it-edited.pptx' } }
			})
			expect(readEdited.slides[0]?.title).toContain('Updated')
		} finally {
			await cleanup(keys)
		}
	})
})
