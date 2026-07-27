import { afterAll, describe, expect, test } from 'bun:test'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

type SurfaceRuntime = 'node' | 'edge' | 'both'
type NodeFormat = 'esm' | 'cjs'

type ManifestSurface = {
	exportKey?: string
	key?: string
	source?: string
	entry?: string
	runtime: SurfaceRuntime
	nodeFormats: NodeFormat[]
}

type ModuleManifest = {
	brain: ManifestSurface[]
	modules: ManifestSurface[]
}

const repoRoot = path.join(import.meta.dir, '..')
const tempRoot = await mkdtemp(path.join(repoRoot, '.package-compatibility-'))

afterAll(async () => {
	await rm(tempRoot, { recursive: true, force: true })
})

function surfaceKey(surface: ManifestSurface): string {
	const key = surface.exportKey ?? surface.key
	if (!key) throw new Error('Generated package manifest surface is missing an export key')
	return key
}

function surfaceEntry(surface: ManifestSurface): string {
	const entry = surface.source ?? surface.entry
	if (!entry) throw new Error(`Generated package manifest surface "${surfaceKey(surface)}" is missing an entry`)
	return path.join(repoRoot, entry)
}

async function consumerEntry(surface: ManifestSurface): Promise<string> {
	const key = surfaceKey(surface)
	const fixtureDir = path.join(tempRoot, 'fixtures')
	await mkdir(fixtureDir, { recursive: true })
	const fixture = path.join(fixtureDir, `${key}.ts`)
	const relativeEntry = path.relative(fixtureDir, surfaceEntry(surface)).split(path.sep).join('/')
	const specifier = relativeEntry.startsWith('.') ? relativeEntry : `./${relativeEntry}`
	await writeFile(
		fixture,
		`import * as surface from ${JSON.stringify(specifier)}\nexport const surfaceKeys = Object.keys(surface)\n`
	)
	return fixture
}

async function buildConsumer(
	surface: ManifestSurface,
	target: 'node' | 'browser',
	format: NodeFormat,
	packages: 'bundle' | 'external',
	metafile = false
): Promise<{ output: string; metafile?: Bun.BuildMetafile }> {
	const key = surfaceKey(surface)
	const label = `${target}-${format}`
	const outputDir = path.join(tempRoot, key, label)
	const output = path.join(outputDir, `index.${format === 'cjs' ? 'cjs' : 'mjs'}`)
	const metafilePath = path.join(outputDir, 'metafile.json')
	await mkdir(outputDir, { recursive: true })
	const fixture = await consumerEntry(surface)
	const command = [
		process.execPath,
		'--no-env-file',
		'build',
		fixture,
		`--target=${target}`,
		`--format=${format}`,
		`--packages=${packages}`,
		`--root=${repoRoot}`,
		`--outdir=${outputDir}`,
		`--entry-naming=${path.basename(output)}`,
		...(metafile ? [`--metafile=${metafilePath}`] : [])
	]
	const build = Bun.spawn({
		cmd: command,
		cwd: repoRoot,
		stdout: 'pipe',
		stderr: 'pipe'
	})
	const [exitCode, stdout, stderr] = await Promise.all([
		build.exited,
		new Response(build.stdout).text(),
		new Response(build.stderr).text()
	])
	if (exitCode !== 0) {
		throw new Error(`${key} failed ${label} packaging:\n${stderr || stdout}`)
	}
	return {
		output,
		...(metafile && {
			metafile: JSON.parse(await readFile(metafilePath, 'utf8')) as Bun.BuildMetafile
		})
	}
}

async function assertNodeLoad(paths: string[], format: NodeFormat): Promise<void> {
	if (paths.length === 0) return
	const script =
		format === 'cjs'
			? 'for (const file of JSON.parse(process.argv[1])) require(file)'
			: "const { pathToFileURL } = await import('node:url'); for (const file of JSON.parse(process.argv[1])) await import(pathToFileURL(file).href)"
	const process = Bun.spawn({
		cmd: ['node', ...(format === 'esm' ? ['--input-type=module'] : []), '-e', script, JSON.stringify(paths)],
		stdout: 'pipe',
		stderr: 'pipe'
	})
	const [exitCode, stderr] = await Promise.all([process.exited, new Response(process.stderr).text()])
	if (exitCode !== 0) {
		throw new Error(`Node ${format.toUpperCase()} load failed:\n${stderr}`)
	}
}

describe('public package compatibility matrix', () => {
	test('bundles and loads every public entry for its declared runtimes', async () => {
		const manifest = JSON.parse(
			await readFile(path.join(repoRoot, 'generated/module-manifest.json'), 'utf8')
		) as ModuleManifest
		const surfaces = [...manifest.brain, ...manifest.modules]
		const nodeCjsEntries: string[] = []
		const nodeEsmEntries: string[] = []
		let documentMetafile: Bun.BuildMetafile | undefined

		for (const surface of surfaces) {
			if (surface.runtime === 'edge' || surface.runtime === 'both') {
				await buildConsumer(surface, 'browser', 'esm', 'bundle')
			}

			for (const format of surface.nodeFormats) {
				const build = await buildConsumer(
					surface,
					'node',
					format,
					format === 'cjs' ? 'bundle' : 'external',
					surfaceKey(surface) === 'document'
				)
				if (format === 'cjs') nodeCjsEntries.push(build.output)
				else nodeEsmEntries.push(build.output)
				if (surfaceKey(surface) === 'document') documentMetafile = build.metafile
			}
		}

		await assertNodeLoad(nodeCjsEntries, 'cjs')
		await assertNodeLoad(nodeEsmEntries, 'esm')

		expect(nodeCjsEntries.length).toBeGreaterThan(0)
		expect(documentMetafile).toBeDefined()
		const documentInputs = Object.keys(documentMetafile?.inputs ?? {})
		expect(documentInputs.some((input) => input.includes('@office-open/pptx'))).toBe(false)
		expect(documentInputs.some((input) => input.includes('@office-open/core'))).toBe(false)
	}, 60_000)
})
