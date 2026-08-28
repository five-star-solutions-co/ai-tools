import { describe, expect, test } from 'bun:test'

import { toModuleCatalogEntry } from '../../src/core'
import { browserModule, mintBrowserCdpConnection } from '../../src/modules/browser'
import { contentTypeModule } from '../../src/modules/content-type'
import { emailModule } from '../../src/modules/email'
import { filesModule } from '../../src/modules/files'
import { amazonSpApiModule } from '../../src/vendors/amazon-sp-api'
import { cloudflareSandboxModule } from '../../src/vendors/cloudflare-sandbox'
import { katanaModule } from '../../src/vendors/katana'
import { woocommerceModule } from '../../src/vendors/woocommerce'
import { moduleKeys } from '../../src/generated/module-keys'

/** Dynamic import of each public pack module for catalog honesty checks. */
async function loadPackModule(key: string): Promise<{ id: string; categories: readonly string[] } | undefined> {
	const isVendor = [
		'amazon-sp-api',
		'bedrock-agentcore-browser',
		'bedrock-agentcore-code-interpreter',
		'cloudflare-browser',
		'cloudflare-email',
		'cloudflare-sandbox',
		'eventbridge-scheduler',
		'imessage',
		'katana',
		'mastra-vector',
		'pinecone',
		'qdrant',
		'resend',
		's3',
		'shipstation',
		'slack',
		'sqs',
		'supabase-vector',
		'teams',
		'telegram',
		'textract',
		'woocommerce'
	].includes(key)
	const root = isVendor ? 'vendors' : 'modules'
	const mod = await import(`../../src/${root}/${key}/module.ts`)
	const exportName = Object.keys(mod).find((k) => k.endsWith('Module'))
	if (!exportName) return undefined
	const value = mod[exportName] as { id: string; categories: readonly string[] }
	return value
}

describe('pack catalog metadata (on each defineModule)', () => {
	test('every shipped pack declares non-empty categories on its module', async () => {
		for (const key of moduleKeys) {
			const pack = await loadPackModule(key)
			expect(pack, key).toBeDefined()
			expect(pack!.id).toBe(key)
			expect(pack!.categories.length, key).toBeGreaterThan(0)
		}
	})

	test('representative packs carry classification and tags', () => {
		expect(browserModule.categories).toEqual(['browser', 'automation'])
		expect(browserModule.classification).toBe('standard')
		expect(emailModule.classification).toBe('pii')
		expect(filesModule.classification).toBe('pii')
		expect(contentTypeModule.classification).toBe('standard')
		expect(katanaModule.categories).toContain('commerce')
		expect(woocommerceModule.classification).toBe('pii')
		expect(amazonSpApiModule.classification).toBe('pii')
		expect(cloudflareSandboxModule.categories).toContain('sandbox')
	})

	test('catalog projector surfaces module categories', () => {
		const entry = toModuleCatalogEntry(browserModule)
		expect(entry.categories).toEqual(browserModule.categories)
		expect(entry.classification).toBe('standard')
		expect(entry.tags.length).toBeGreaterThan(0)
	})

	test('browser tools carry path tags', () => {
		const click = browserModule.tools.find((t) => t.id === 'browser-click')
		expect(click?.meta.tags).toContain('session-agent')
		const shot = browserModule.tools.find((t) => t.id === 'browser-screenshot')
		expect(shot?.meta.tags).toContain('one-shot')
	})

	test('mintBrowserCdpConnection requires automation stream', () => {
		expect(() => mintBrowserCdpConnection({ session_id: 's1' })).toThrow()
		const cdp = mintBrowserCdpConnection({
			session_id: 's1',
			status: 'active',
			streams: {
				automation_stream_endpoint: 'wss://example.test/cdp',
				live_view_stream_endpoint: 'https://example.test/view'
			}
		})
		expect(cdp.websocket_url).toBe('wss://example.test/cdp')
		expect(cdp.live_view_url).toBe('https://example.test/view')
		expect(cdp.session_id).toBe('s1')
	})
})
