import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { discoverModules } from './discover'
import {
	renderGeneratedModulesTs,
	renderModuleManifest,
	renderPackageExports,
	renderPackLogosTs,
	renderTsdownConfig
} from './render'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

export type CodegenResult = {
	moduleCount: number
	wrote: string[]
	dirty: string[]
}

async function formatPaths(relativePaths: string[]): Promise<void> {
	if (relativePaths.length === 0) return
	const proc = Bun.spawn(['bun', 'x', 'oxfmt', '--write', ...relativePaths], {
		cwd: repoRoot,
		stdout: 'pipe',
		stderr: 'pipe'
	})
	const code = await proc.exited
	if (code !== 0) {
		const err = await new Response(proc.stderr).text()
		throw new Error(`oxfmt failed on generated files:\n${err}`)
	}
}

function manifestIdentity(text: string): string {
	const data = JSON.parse(text) as { brain: unknown; modules: unknown; generator: unknown }
	return JSON.stringify({
		generator: data.generator,
		brain: data.brain,
		modules: data.modules
	})
}

export async function runCodegen(options: { checkOnly?: boolean } = {}): Promise<CodegenResult> {
	const checkOnly = options.checkOnly === true
	const modules = await discoverModules(repoRoot)

	const packagePath = path.join(repoRoot, 'package.json')
	const packageJson = JSON.parse(await readFile(packagePath, 'utf8')) as Record<string, unknown>
	packageJson['exports'] = renderPackageExports(modules)
	const packageText = `${JSON.stringify(packageJson, null, '\t')}\n`

	const targets: Array<{ relative: string; content: string }> = [
		{ relative: 'package.json', content: packageText },
		{ relative: 'tsdown.config.ts', content: renderTsdownConfig(modules) },
		{
			relative: 'generated/module-manifest.json',
			content: `${JSON.stringify(renderModuleManifest(modules, { repoRoot }), null, '\t')}\n`
		},
		{ relative: 'src/generated/module-keys.ts', content: renderGeneratedModulesTs(modules) },
		{ relative: 'src/generated/pack-logos.ts', content: renderPackLogosTs(repoRoot, modules) }
	]

	if (checkOnly) {
		const dirty: string[] = []
		const tmpRoot = path.join(repoRoot, '.codegen-check-tmp')
		await rm(tmpRoot, { recursive: true, force: true })
		await mkdir(tmpRoot, { recursive: true })

		try {
			for (const target of targets) {
				const tmpPath = path.join(tmpRoot, target.relative)
				await mkdir(path.dirname(tmpPath), { recursive: true })
				await writeFile(tmpPath, target.content, 'utf8')
			}
			await formatPaths(targets.map((t) => path.join('.codegen-check-tmp', t.relative)))

			for (const target of targets) {
				const expected = await readFile(path.join(tmpRoot, target.relative), 'utf8')
				let actual: string | undefined
				try {
					actual = await readFile(path.join(repoRoot, target.relative), 'utf8')
				} catch {
					actual = undefined
				}

				if (target.relative === 'generated/module-manifest.json') {
					if (actual === undefined || manifestIdentity(expected) !== manifestIdentity(actual)) {
						dirty.push(target.relative)
					}
					continue
				}

				if (actual !== expected) dirty.push(target.relative)
			}
		} finally {
			await rm(tmpRoot, { recursive: true, force: true })
		}

		return { moduleCount: modules.length, wrote: [], dirty }
	}

	const wrote: string[] = []
	for (const target of targets) {
		const abs = path.join(repoRoot, target.relative)
		let previous: string | undefined
		try {
			previous = await readFile(abs, 'utf8')
		} catch {
			previous = undefined
		}
		if (previous === target.content) continue
		await mkdir(path.dirname(abs), { recursive: true })
		await writeFile(abs, target.content, 'utf8')
		wrote.push(target.relative)
	}

	await formatPaths(targets.map((t) => t.relative))

	return { moduleCount: modules.length, wrote, dirty: [] }
}

async function main(): Promise<void> {
	const checkOnly = process.argv.includes('--check')
	const result = await runCodegen({ checkOnly })

	if (checkOnly) {
		if (result.dirty.length > 0) {
			console.error(
				`codegen --check failed; run \`bun run codegen\`. Dirty:\n${result.dirty.map((f) => `  - ${f}`).join('\n')}`
			)
			process.exit(1)
		}
		console.log(`codegen --check ok (${result.moduleCount} modules)`)
		return
	}

	if (result.wrote.length === 0) {
		console.log(`codegen: up to date (${result.moduleCount} modules)`)
		return
	}

	console.log(`codegen: updated ${result.wrote.join(', ')} (${result.moduleCount} modules)`)
}

if (import.meta.main) {
	await main()
}
