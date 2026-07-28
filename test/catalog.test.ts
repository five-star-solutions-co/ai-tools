import { describe, expect, test } from 'bun:test'

import { toModuleCatalogEntry, toToolCatalogEntry } from '../src/core'
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
	})

	test('pack modules expose inline logo svg for hosts', () => {
		expect(telegramModule.logo).toBeDefined()
		expect(telegramModule.logo?.includes('<svg')).toBe(true)
		const catalog = toModuleCatalogEntry(telegramModule)
		expect(catalog.logo).toBe(telegramModule.logo)
	})
})
