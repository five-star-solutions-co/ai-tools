/** Fixed brain packages (not under src/modules). */

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

export const NEVER_BUNDLE = [
	'@mastra/core',
	'@modelcontextprotocol/sdk',
	'@tanstack/ai',
	'ai',
	'aws4fetch',
	'es-toolkit',
	'mime',
	'mimetext',
	'ofetch',
	'p-map',
	'p-retry',
	'postal-mime',
	'zod'
] as const
