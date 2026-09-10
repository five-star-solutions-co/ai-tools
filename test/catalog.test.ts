import { describe, expect, test } from 'bun:test'

import { toModuleCatalogEntry, toToolCatalogEntry } from '../src/core'
import { spsCommerceModule } from '../src/vendors/sps-commerce'
import { telegramModule } from '../src/vendors/telegram'
import { echoModule, echoTool } from './fixtures/echo-module'

describe('catalog', () => {
	test('projects model-facing fields without auth secrets', () => {
		const entry = toToolCatalogEntry(echoTool)
		expect(entry.id).toBe('echo-message')
		expect(entry.inputJsonSchema['type']).toBe('object')
		expect(entry.runtime).toBe('both')

		const moduleEntry = toModuleCatalogEntry(echoModule)
		expect(moduleEntry.authType).toBe('none')
		expect(moduleEntry.tools).toHaveLength(1)
		expect(moduleEntry.categories).toEqual([])
		expect(moduleEntry.tags).toEqual([])
	})

	test('pack modules expose inline logo svg for hosts', () => {
		expect(telegramModule.logo).toBeDefined()
		expect(telegramModule.logo?.includes('<svg')).toBe(true)
		const catalog = toModuleCatalogEntry(telegramModule)
		expect(catalog.logo).toBe(telegramModule.logo)
		expect(catalog.categories.length).toBeGreaterThan(0)
		expect(catalog.classification).toBe('pii')
	})

	test('SPS Commerce exposes its packaged SVG through the module and catalog', async () => {
		const svg = await Bun.file(new URL('../logos/sps-commerce.svg', import.meta.url)).text()
		expect(svg).toContain('width="24" height="24"')
		expect(svg).toContain('viewBox="0 0 53 50"')
		expect(svg).toContain('<title>SPS Commerce</title>')
		expect(svg).not.toMatch(/<(?:script|image|foreignObject)\b|\b(?:href|onload)\s*=/i)
		expect(spsCommerceModule.logo).toBe(svg.trim())
		expect(toModuleCatalogEntry(spsCommerceModule).logo).toBe(spsCommerceModule.logo)
	})
})
