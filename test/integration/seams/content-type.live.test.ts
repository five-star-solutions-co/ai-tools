import { describe, expect, test } from 'bun:test'

import { allExtensionsFromMediaType, extensionFromMediaType, mediaTypeFromPath } from '../../../src/shared/content-type'
import { runTool, withAuth } from '../../../src/core'
import { contentTypeModule } from '../../../src/modules/content-type'

/** Pure seam — always runs (no external service). */
describe('live seam content-type', () => {
	test('helpers + all three tools', async () => {
		expect(mediaTypeFromPath('a.pdf')).toBe('application/pdf')
		expect(extensionFromMediaType('image/png')).toBe('png')
		expect(allExtensionsFromMediaType('image/jpeg').length).toBeGreaterThan(0)

		const bound = withAuth(contentTypeModule)
		const get = bound.tools.find((t) => t.id === 'content-type-get')
		const ext = bound.tools.find((t) => t.id === 'content-type-extension')
		const all = bound.tools.find((t) => t.id === 'content-type-extensions')
		if (!get || !ext || !all) throw new Error('missing content-type tools')

		const got = (await runTool(get, { path: 'report.docx' })) as { media_type: string | null }
		expect(got.media_type).toContain('wordprocessingml')

		const preferred = (await runTool(ext, { media_type: 'image/png' })) as { extension: string | null }
		expect(preferred.extension).toBe('png')

		const list = (await runTool(all, { media_type: 'image/jpeg' })) as { extensions: string[] }
		expect(list.extensions.length).toBeGreaterThan(0)
	})
})
