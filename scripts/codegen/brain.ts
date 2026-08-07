/** Fixed brain packages (not under src/modules). */

import bundlePolicy from './bundle-policy.json' with { type: 'json' }

export type BrainPackage = {
	/** package.json exports key without leading ./ */
	exportKey: string
	/** tsdown entry key (path under dist without extension) */
	entryKey: string
	/** source entry relative to repo root */
	source: string
	/** Runtime compatibility of the public entry */
	runtime: 'node' | 'edge' | 'both'
}

/**
 * Public subpaths stay flat (`@harryy/ai-tools/mastra`).
 * Source lives under `src/adapters/*` for adapters; transport public as `./http`.
 */
export const BRAIN_PACKAGES: readonly BrainPackage[] = [
	{ exportKey: 'core', entryKey: 'core/index', source: 'src/core/index.ts', runtime: 'both' },
	{ exportKey: 'http', entryKey: 'http/index', source: 'src/transport/index.ts', runtime: 'both' },
	{ exportKey: 'mastra', entryKey: 'mastra/index', source: 'src/adapters/mastra/index.ts', runtime: 'node' },
	{ exportKey: 'ai-sdk', entryKey: 'ai-sdk/index', source: 'src/adapters/ai-sdk/index.ts', runtime: 'both' },
	{ exportKey: 'tanstack', entryKey: 'tanstack/index', source: 'src/adapters/tanstack/index.ts', runtime: 'both' },
	{
		exportKey: 'cloudflare',
		entryKey: 'cloudflare/index',
		source: 'src/adapters/cloudflare/index.ts',
		runtime: 'edge'
	},
	{ exportKey: 'mcp', entryKey: 'mcp/index', source: 'src/adapters/mcp/index.ts', runtime: 'both' }
]

/**
 * Bundle policy shared with `tsdown.config.ts` via JSON so the native tsdown
 * config loader does not need extensionless TypeScript imports.
 */
export const NEVER_BUNDLE = bundlePolicy.neverBundle

/**
 * Force-inline into pack dist so consumers (esp. Bun → CJS lambda) never resolve
 * `@office-open/core`'s broken top-level-await zlib path from node_modules.
 * Source is patched via `patchedDependencies` before build.
 * picomatch: bare package names only match exact ids; use slash-star-star subpath globs.
 */
export const ALWAYS_BUNDLE = bundlePolicy.alwaysBundle
