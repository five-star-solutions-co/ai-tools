/**
 * tsdown build config.
 *
 * Entry map is **not** listed here — it is loaded from
 * `generated/module-manifest.json` (written by `bun run codegen`).
 * Bundle policy lists live in `scripts/codegen/bundle-policy.json` (also re-exported from brain.ts).
 *
 * Hand-edit: format / dts / deps only. Do not paste pack entry paths.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'tsdown'

type ModuleManifest = {
	brain: Array<{ entryKey: string; source: string }>
	modules: Array<{ entryKey: string; entry: string }>
}

type BundlePolicy = {
	neverBundle: string[]
	alwaysBundle: string[]
}

const root = dirname(fileURLToPath(import.meta.url))

function entryFromManifest(): Record<string, string> {
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

function loadBundlePolicy(): BundlePolicy {
	const raw = readFileSync(join(root, 'scripts/codegen/bundle-policy.json'), 'utf8')
	return JSON.parse(raw) as BundlePolicy
}

const bundlePolicy = loadBundlePolicy()

export default defineConfig({
	entry: entryFromManifest(),
	format: ['esm'],
	// package.json is "type": "module" — emit .js / .d.ts (not .mjs / .d.mts)
	fixedExtension: false,
	dts: true,
	sourcemap: true,
	deps: {
		neverBundle: [...bundlePolicy.neverBundle],
		alwaysBundle: [...bundlePolicy.alwaysBundle]
	}
})
