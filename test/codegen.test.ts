import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { describe, expect, test } from 'bun:test'

import { discoverModules } from '../scripts/codegen/discover'
import { renderPackageExports } from '../scripts/codegen/render'

describe('codegen discover (oxc-parser)', () => {
	test('discovers modules and extracts defineModule id from AST', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'ai-tools-codegen-'))
		try {
			const modDir = path.join(root, 'src/modules/demo-echo')
			await mkdir(modDir, { recursive: true })
			await writeFile(path.join(modDir, 'index.ts'), `export { demoEchoModule } from './module'\n`)
			await writeFile(
				path.join(modDir, 'module.ts'),
				`import { defineModule, defineTool } from '../../core'
import { z } from 'zod'

const tool = defineTool({
  id: 'demo-ping',
  name: 'ping',
  description: 'Ping for codegen discovery tests.',
  inputSchema: z.object({}),
  outputSchema: z.object({ ok: z.boolean() }),
  execute: async () => ({ ok: true }),
})

export const demoEchoModule = defineModule({
  id: 'demo-echo',
  title: 'Demo',
  description: 'Demo module for codegen.',
  runtime: 'both',
  tools: [tool],
})
`
			)

			const modules = await discoverModules(root)
			expect(modules).toHaveLength(1)
			const mod = modules[0]
			if (!mod) throw new Error('expected module')
			expect(mod.key).toBe('demo-echo')
			expect(mod.exportNames).toContain('demoEchoModule')
			expect(mod.moduleId).toBe('demo-echo')
			expect(mod.runtime).toBe('both')
			expect(mod.entryKey).toBe('modules/demo-echo/index')
		} finally {
			await rm(root, { recursive: true, force: true })
		}
	})

	test('rejects module folders that are not kebab-case', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'ai-tools-codegen-bad-'))
		try {
			const modDir = path.join(root, 'src/modules/NotGood')
			await mkdir(modDir, { recursive: true })
			await writeFile(path.join(modDir, 'index.ts'), `export const x = 1\n`)
			expect(discoverModules(root)).rejects.toThrow(/kebab-case/)
		} finally {
			await rm(root, { recursive: true, force: true })
		}
	})

	test('render merges brain exports with modules', () => {
		const exports = renderPackageExports([
			{
				key: 'demo-echo',
				lane: 'modules',
				entryPath: '/x',
				entryRelative: 'src/modules/demo-echo/index.ts',
				entryKey: 'modules/demo-echo/index',
				exportNames: ['demoEchoModule'],
				runtime: 'both'
			}
		])
		expect(exports['./core']).toBeDefined()
		expect(exports['./mcp']).toBeDefined()
		expect(exports['./demo-echo']).toEqual({
			types: './dist/modules/demo-echo/index.d.ts',
			default: './dist/modules/demo-echo/index.js'
		})
	})
})

describe('repo codegen artifacts', () => {
	test('module-manifest exists and lists brain packages', async () => {
		const manifestPath = path.join(import.meta.dir, '../generated/module-manifest.json')
		const raw = await readFile(manifestPath, 'utf8')
		const manifest = JSON.parse(raw) as {
			brain: Array<{ exportKey: string; entryKey: string; source: string; runtime: string; nodeFormats: string[] }>
			modules: Array<{
				key: string
				entry: string
				entryKey: string
				runtime: string
				nodeFormats: string[]
			}>
		}
		expect(manifest.brain.map((b) => b.exportKey)).toContain('core')
		expect(manifest.brain.map((b) => b.exportKey)).toContain('mcp')
		expect(manifest.brain.every((surface) => ['node', 'edge', 'both'].includes(surface.runtime))).toBe(true)
		expect(manifest.modules.every((surface) => ['node', 'edge', 'both'].includes(surface.runtime))).toBe(true)
		expect(manifest.modules.find((surface) => surface.key === 'document-render')?.nodeFormats).toEqual(['esm', 'cjs'])
		expect(manifest.modules.find((surface) => surface.key === 'document-extract')?.nodeFormats).toEqual(['esm', 'cjs'])
		expect(manifest.modules.some((surface) => surface.key === 'gotenberg')).toBe(false)
		expect(manifest.modules.some((surface) => surface.key === 'pdf')).toBe(false)
	})

	test('tsdown entry is derived from module-manifest (not a generated entry dump)', async () => {
		const manifestPath = path.join(import.meta.dir, '../generated/module-manifest.json')
		const configPath = path.join(import.meta.dir, '../tsdown.config.ts')
		const config = await readFile(configPath, 'utf8')
		expect(config).toContain('module-manifest.json')
		expect(config).not.toContain('AUTO-GENERATED')

		const raw = await readFile(manifestPath, 'utf8')
		const manifest = JSON.parse(raw) as {
			brain: Array<{ entryKey: string; source: string }>
			modules: Array<{ entryKey: string; entry: string }>
		}
		expect(manifest.brain.length).toBeGreaterThan(0)
		expect(manifest.modules.some((m) => m.entryKey.includes('slack'))).toBe(true)
		// Build would fail if keys/paths were empty; assert every surface has both sides.
		for (const b of manifest.brain) {
			expect(b.entryKey.length).toBeGreaterThan(0)
			expect(b.source.startsWith('src/')).toBe(true)
		}
		for (const m of manifest.modules) {
			expect(m.entryKey.length).toBeGreaterThan(0)
			expect(m.entry.startsWith('src/')).toBe(true)
		}
	})
})
