/**
 * tsdown build config.
 *
 * Entry map is **not** listed here — it is loaded from
 * `generated/module-manifest.json` (written by `bun run codegen`).
 * Bundle policy lists live in `scripts/codegen/brain.ts` (shared with docs of intent).
 *
 * Hand-edit: format / dts / deps only. Do not paste pack entry paths.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'tsdown'

import { ALWAYS_BUNDLE, NEVER_BUNDLE } from './scripts/codegen/brain'

type ModuleManifest = {
	brain: Array<{ entryKey: string; source: string }>
	modules: Array<{ entryKey: string; entry: string }>
}

function entryFromManifest(): Record<string, string> {
	const root = dirname(fileURLToPath(import.meta.url))
	const raw = readFileSync(join(root, 'generated/module-manifest.json'), 'utf8')
	const manifest = JSON.parse(raw) as ModuleManifest
	const entry: Record<string, string> = {}
	for (const brain of manifest.brain) {
		entry[brain.entryKey] = brain.source
	}
	for (const mod of manifest.modules) {
		entry[mod.entryKey] = mod.entry
	}
	return entry
}

export default defineConfig({
	entry: entryFromManifest(),
	format: ['esm'],
	// package.json is "type": "module" — emit .js / .d.ts (not .mjs / .d.mts)
	fixedExtension: false,
	dts: true,
	sourcemap: true,
	deps: {
		neverBundle: [...NEVER_BUNDLE],
		alwaysBundle: [...ALWAYS_BUNDLE]
	}
})
