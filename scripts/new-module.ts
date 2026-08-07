/**
 * Scaffold a product module under src/modules/<kebab-key>/.
 *
 * Usage:
 *   bun run new-module <kebab-key> [--title "Title"] [--description "…"] [--auth none|custom]
 *
 * Creates index.ts, module.ts, a starter tool, and a test stub, then runs codegen.
 */
import { access, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runCodegen } from './codegen/main'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/

type AuthMode = 'none' | 'custom'

type CliOptions = {
	key: string
	title: string
	description: string
	auth: AuthMode
}

function printHelp(): void {
	console.log(`Usage: bun run new-module <kebab-key> [options]

Options:
  --title <text>         Module title (default: Title Case from key)
  --description <text>   Module description
  --auth none|custom     Auth mode (default: none)
  -h, --help             Show help

Example:
  bun run new-module weather --title "Weather" --description "Forecast tools."
`)
}

function titleFromKey(key: string): string {
	return key
		.split('-')
		.map((part) => (part.length === 0 ? part : `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`))
		.join(' ')
}

function camelFromKey(key: string): string {
	return key
		.split('-')
		.map((part, index) => {
			if (index === 0) return part
			return `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`
		})
		.join('')
}

function parseArgs(argv: string[]): CliOptions | { help: true } {
	if (argv.length === 0 || argv.includes('-h') || argv.includes('--help')) {
		return { help: true }
	}

	const key = argv[0]
	if (key === undefined || key.startsWith('-')) {
		throw new Error('Missing <kebab-key> argument')
	}
	if (!KEBAB.test(key)) {
		throw new Error(`Module key must be kebab-case matching ${KEBAB}: got ${key}`)
	}

	let title = titleFromKey(key)
	let description = `${title} tools.`
	let auth: AuthMode = 'none'

	for (let i = 1; i < argv.length; i += 1) {
		const flag = argv[i]
		const value = argv[i + 1]
		if (flag === '--title') {
			if (value === undefined || value.startsWith('-')) throw new Error('--title requires a value')
			title = value
			i += 1
			continue
		}
		if (flag === '--description') {
			if (value === undefined || value.startsWith('-')) throw new Error('--description requires a value')
			description = value
			i += 1
			continue
		}
		if (flag === '--auth') {
			if (value !== 'none' && value !== 'custom') {
				throw new Error('--auth must be none or custom')
			}
			auth = value
			i += 1
			continue
		}
		throw new Error(`Unknown argument: ${flag}`)
	}

	return { key, title, description, auth }
}

async function pathExists(target: string): Promise<boolean> {
	try {
		await access(target)
		return true
	} catch {
		return false
	}
}

function renderModuleTs(options: CliOptions): string {
	const camel = camelFromKey(options.key)
	const moduleExport = `${camel}Module`
	const toolId = `${options.key}-ping`
	const toolExport = `${camel}PingTool`
	const authSchemaExport = `${camel}AuthSchema`

	if (options.auth === 'custom') {
		return `import { z } from 'zod'

import { defineModule, defineTool } from '../../core/define'
import { ToolError } from '../../core/errors'
import type { ToolContext } from '../../core/types'

export const ${authSchemaExport} = z.object({
	// Host-facing credentials only. Never put these on model-facing tool inputs.
	apiKey: z.string().min(1).describe('API key for ${options.title}')
})

export type ${titleToType(options.title)}Auth = z.infer<typeof ${authSchemaExport}>

function readAuth(ctx: ToolContext): z.infer<typeof ${authSchemaExport}> {
	const parsed = ${authSchemaExport}.safeParse(ctx.auth)
	if (!parsed.success) {
		throw new ToolError('${options.title} credentials are missing or invalid', { code: 'bad_auth' })
	}
	return parsed.data
}

const ${toolExport} = defineTool({
	id: '${toolId}',
	name: 'ping',
	description: 'Connectivity check for ${options.title}. Returns ok when credentials validate.',
	inputSchema: z.object({}),
	outputSchema: z.object({ ok: z.literal(true) }),
	sideEffect: 'none',
	runtime: 'both',
	execute: async (_input, ctx) => {
		readAuth(ctx)
		return { ok: true as const }
	}
})

export const ${moduleExport} = defineModule({
	id: '${options.key}',
	title: ${JSON.stringify(options.title)},
	description: ${JSON.stringify(options.description)},
	runtime: 'both',
	auth: { type: 'custom', schema: ${authSchemaExport} },
	tools: [${toolExport}]
})

export { ${toolExport} }
`
	}

	return `import { z } from 'zod'

import { defineModule, defineTool } from '../../core/define'

const ${toolExport} = defineTool({
	id: '${toolId}',
	name: 'ping',
	description: 'Connectivity check for ${options.title}. Returns ok.',
	inputSchema: z.object({}),
	outputSchema: z.object({ ok: z.literal(true) }),
	sideEffect: 'none',
	runtime: 'both',
	execute: async () => ({ ok: true as const })
})

export const ${moduleExport} = defineModule({
	id: '${options.key}',
	title: ${JSON.stringify(options.title)},
	description: ${JSON.stringify(options.description)},
	runtime: 'both',
	auth: { type: 'none' },
	tools: [${toolExport}]
})

export { ${toolExport} }
`
}

function titleToType(title: string): string {
	return title
		.split(/[^a-zA-Z0-9]+/)
		.filter((p) => p.length > 0)
		.map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
		.join('')
}

function renderIndexTs(options: CliOptions): string {
	const camel = camelFromKey(options.key)
	const moduleExport = `${camel}Module`
	const toolExport = `${camel}PingTool`
	const authSchemaExport = `${camel}AuthSchema`
	const authType = `${titleToType(options.title)}Auth`

	if (options.auth === 'custom') {
		return `export { ${authSchemaExport}, ${moduleExport}, ${toolExport} } from './module'
export type { ${authType} } from './module'
`
	}

	return `export { ${moduleExport}, ${toolExport} } from './module'
`
}

function renderTestTs(options: CliOptions): string {
	const camel = camelFromKey(options.key)
	const moduleExport = `${camel}Module`
	const toolExport = `${camel}PingTool`

	if (options.auth === 'custom') {
		return `import { describe, expect, test } from 'bun:test'

import { runTool, validateModule, withAuth } from '../../src/core'
import { ${moduleExport}, ${toolExport} } from '../../src/modules/${options.key}'

describe('${options.key}', () => {
	test('passes contracts', () => {
		expect(validateModule(${moduleExport}).ok).toBe(true)
	})

	test('ping requires auth', async () => {
		const bound = withAuth(${moduleExport}, { apiKey: 'test-key' })
		const tool = bound.tools.find((t) => t.id === ${toolExport}.id)
		if (!tool) throw new Error('expected ping tool')
		const result = await runTool(tool, {})
		expect(result).toEqual({ ok: true })
	})
})
`
	}

	return `import { describe, expect, test } from 'bun:test'

import { runTool, validateModule } from '../../src/core'
import { ${moduleExport}, ${toolExport} } from '../../src/modules/${options.key}'

describe('${options.key}', () => {
	test('passes contracts', () => {
		expect(validateModule(${moduleExport}).ok).toBe(true)
	})

	test('ping', async () => {
		const result = await runTool(${toolExport}, {})
		expect(result).toEqual({ ok: true })
	})
})
`
}

function renderDocsMd(options: CliOptions): string {
	const toolId = `${options.key}-ping`
	const authLine =
		options.auth === 'custom'
			? 'Custom — host supplies credentials via `withAuth` (see auth schema in `module.ts`).'
			: '**none** — project the module without `withAuth`.'

	return `# ${options.title}

| | |
| --- | --- |
| **Import** | \`@5ss/ai-tools/${options.key}\` |
| **Module id** | \`${options.key}\` |
| **Runtime** | \`both\` |
| **Auth** | ${authLine} |

${options.description}

## Tools

### \`${toolId}\` (\`ping\`)

Connectivity check scaffold. Replace with real tools and update this page.

## Host usage

\`\`\`ts
import { ${camelFromKey(options.key)}Module } from '@5ss/ai-tools/${options.key}'
// withAuth if auth is custom; then project via an adapter or runTool
\`\`\`

## Related

- [Authoring modules](../guides/authoring-modules.md)
- [Wiki home](../README.md)

> After scaffolding: flesh out tools, then update this page and the module table in \`docs/README.md\`.
`
}

async function main(): Promise<void> {
	const parsed = parseArgs(process.argv.slice(2))
	if ('help' in parsed) {
		printHelp()
		return
	}

	const dir = path.join(repoRoot, 'src/modules', parsed.key)
	if (await pathExists(dir)) {
		throw new Error(`Module already exists: src/modules/${parsed.key}`)
	}

	const testPath = path.join(repoRoot, 'test/modules', `${parsed.key}.test.ts`)
	if (await pathExists(testPath)) {
		throw new Error(`Test already exists: test/modules/${parsed.key}.test.ts`)
	}

	const docsPath = path.join(repoRoot, 'docs/modules', `${parsed.key}.md`)
	if (await pathExists(docsPath)) {
		throw new Error(`Docs already exist: docs/modules/${parsed.key}.md`)
	}

	await mkdir(dir, { recursive: true })
	await mkdir(path.dirname(testPath), { recursive: true })
	await mkdir(path.dirname(docsPath), { recursive: true })

	const modulePath = path.join(dir, 'module.ts')
	const indexPath = path.join(dir, 'index.ts')
	await writeFile(modulePath, renderModuleTs(parsed), 'utf8')
	await writeFile(indexPath, renderIndexTs(parsed), 'utf8')
	await writeFile(testPath, renderTestTs(parsed), 'utf8')
	await writeFile(docsPath, renderDocsMd(parsed), 'utf8')

	const formatTargets = [
		path.relative(repoRoot, modulePath),
		path.relative(repoRoot, indexPath),
		path.relative(repoRoot, testPath)
	]
	const fmt = Bun.spawn(['bun', 'x', 'oxfmt', '--write', ...formatTargets], {
		cwd: repoRoot,
		stdout: 'inherit',
		stderr: 'inherit'
	})
	const fmtCode = await fmt.exited
	if (fmtCode !== 0) {
		throw new Error(`oxfmt failed while scaffolding ${parsed.key}`)
	}

	const codegen = await runCodegen()
	console.log(
		`Scaffolded module "${parsed.key}" (${codegen.moduleCount} modules in package). Export: @5ss/ai-tools/${parsed.key}`
	)
	console.log(`  src/modules/${parsed.key}/index.ts`)
	console.log(`  src/modules/${parsed.key}/module.ts`)
	console.log(`  test/modules/${parsed.key}.test.ts`)
	console.log(`  docs/modules/${parsed.key}.md`)
	console.log(`  Remember to add a row in docs/README.md product modules table.`)
}

main().catch((error: unknown) => {
	const message = error instanceof Error ? error.message : String(error)
	console.error(message)
	process.exitCode = 1
})
