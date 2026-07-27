import { describe, expect, test } from 'bun:test'

import { validateModule } from '../../src/core'
import { PresentationClient, presentationModule } from '../../src/modules/presentation'
import { buildPresentation, patchPptx, readPresentation } from '../../src/modules/presentation/domain'
import { bytesToBase64 } from '../../src/shared/bytes'

const storageAuth = {
	storage: {
		access_key_id: 'AKIAtest',
		secret_access_key: 'secret',
		region: 'auto',
		bucket: 'artifacts',
		endpoint: 'https://example.r2.cloudflarestorage.com'
	}
} as const

describe('presentation', () => {
	test('module contracts and tool ids', () => {
		expect(validateModule(presentationModule).ok).toBe(true)
		expect(presentationModule.tools.map((tool) => tool.id).sort()).toEqual([
			'presentation-build',
			'presentation-edit',
			'presentation-read'
		])
	})

	test('builds and reads PPTX bytes', async () => {
		const bytes = await buildPresentation({
			title: 'Deck',
			slides: [{ title: 'One', bullets: ['a', 'b'], notes: 'Speaker context' }]
		})
		const read = await readPresentation(bytes)
		expect(read.slides[0]?.title).toBe('One')
		expect(read.slides[0]?.notes).toContain('Speaker context')

		const clientRead = await PresentationClient.fromAuth(storageAuth).read({
			source: { body_base64: bytesToBase64(bytes), filename: 'deck.pptx' }
		})
		expect(clientRead.format).toBe('pptx')
		expect(clientRead.slides[0]?.title).toBe('One')
	})

	test('edits PPTX through the presentation libraries', async () => {
		const bytes = await buildPresentation({
			title: 'Deck',
			slides: [
				{ title: 'Old one', bullets: ['Keep one'], notes: 'Old note one' },
				{ title: 'Old two', bullets: ['Keep two'], notes: 'Old note two' }
			]
		})
		const edited = await patchPptx(bytes, [
			{ find: 'Old one', replace: 'New one' },
			{ find: 'Old two', replace: 'New two' }
		])
		const read = await readPresentation(edited)
		expect(read.slides[0]?.title).toBe('New one')
		expect(read.slides[1]?.title).toBe('New two')
		expect(read.slides[0]?.notes).toContain('Old note one')
		expect(read.slides[1]?.notes).toContain('Old note two')
	})
})
