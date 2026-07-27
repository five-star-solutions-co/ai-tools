import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'

import { isNil, isPlainObject, isString } from 'es-toolkit'
import { isArray } from 'es-toolkit/compat'
import { parseSync } from 'oxc-parser'

export type SurfaceLane = 'modules' | 'vendors'
export type SurfaceRuntime = 'node' | 'edge' | 'both'

export type DiscoveredModule = {
	/** Package export key (folder name); unique across all lanes */
	key: string
	/** Lane folder under src/ */
	lane: SurfaceLane
	/** Absolute path to public entry (index.ts) */
	entryPath: string
	/** Relative from repo root */
	entryRelative: string
	/** Relative source for tsdown: modules|vendors/<key>/index */
	entryKey: string
	/** Named export bindings found on index.ts */
	exportNames: string[]
	/** Runtime compatibility declared by the public module */
	runtime: SurfaceRuntime
	/**
	 * Kernel module id extracted via AST from defineModule if present
	 * in index.ts or module.ts.
	 */
	moduleId?: string
	/** Source file where moduleId was found */
	moduleIdSource?: string
}

const DEFINE_CALLEES = new Set(['defineModule'])

const SURFACE_LANES: readonly SurfaceLane[] = ['modules', 'vendors']

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
	return isPlainObject(value)
}

function nodeType(node: unknown): string | undefined {
	if (!isRecord(node)) return undefined
	const t = node['type']
	return isString(t) ? t : undefined
}

function identifierName(node: unknown): string | undefined {
	if (!isRecord(node) || nodeType(node) !== 'Identifier') return undefined
	const name = node['name']
	return isString(name) ? name : undefined
}

function literalString(node: unknown): string | undefined {
	if (!isRecord(node) || nodeType(node) !== 'Literal') return undefined
	const value = node['value']
	return isString(value) ? value : undefined
}

function collectExportNames(programBody: unknown[]): string[] {
	const names = new Set<string>()

	for (const stmt of programBody) {
		const t = nodeType(stmt)
		if (!isRecord(stmt)) continue

		if (t === 'ExportNamedDeclaration') {
			const declaration = stmt['declaration']
			if (isRecord(declaration) && nodeType(declaration) === 'VariableDeclaration') {
				const decls = declaration['declarations']
				if (isArray(decls)) {
					for (const d of decls) {
						if (!isRecord(d)) continue
						const name = identifierName(d['id'])
						if (!isNil(name)) names.add(name)
					}
				}
			}
			const specifiers = stmt['specifiers']
			if (isArray(specifiers)) {
				for (const spec of specifiers) {
					if (!isRecord(spec)) continue
					const name = identifierName(spec['exported'])
					if (!isNil(name)) names.add(name)
				}
			}
		}

		if (t === 'ExportAllDeclaration') {
			names.add('*')
		}

		if (t === 'ExportDefaultDeclaration') {
			names.add('default')
		}
	}

	return [...names].sort()
}

function extractStringProp(objectExpr: UnknownRecord, propName: string): string | undefined {
	const properties = objectExpr['properties']
	if (!isArray(properties)) return undefined
	for (const prop of properties) {
		if (!isRecord(prop) || nodeType(prop) !== 'Property') continue
		const key = prop['key']
		const keyName = identifierName(key) ?? literalString(key)
		if (keyName !== propName) continue
		return literalString(prop['value'])
	}
	return undefined
}

type DefineModuleMetadata = {
	id?: string
	runtime: SurfaceRuntime
}

function isSurfaceRuntime(value: string | undefined): value is SurfaceRuntime {
	return value === 'node' || value === 'edge' || value === 'both'
}

function findDefineModuleMetadata(programBody: unknown[]): DefineModuleMetadata | undefined {
	for (const stmt of programBody) {
		if (!isRecord(stmt)) continue
		const t = nodeType(stmt)

		if (t === 'ExportNamedDeclaration' || t === 'VariableDeclaration') {
			const declaration = t === 'ExportNamedDeclaration' ? stmt['declaration'] : stmt
			if (!isRecord(declaration) || nodeType(declaration) !== 'VariableDeclaration') continue
			const decls = declaration['declarations']
			if (!isArray(decls)) continue
			for (const d of decls) {
				if (!isRecord(d)) continue
				const metadata = extractMetadataFromDefineCall(d['init'])
				if (!isNil(metadata)) return metadata
			}
		}

		if (t === 'VariableDeclaration') {
			const decls = stmt['declarations']
			if (!isArray(decls)) continue
			for (const d of decls) {
				if (!isRecord(d)) continue
				const metadata = extractMetadataFromDefineCall(d['init'])
				if (!isNil(metadata)) return metadata
			}
		}
	}
	return undefined
}

function extractMetadataFromDefineCall(init: unknown): DefineModuleMetadata | undefined {
	if (!isRecord(init) || nodeType(init) !== 'CallExpression') return undefined
	const calleeName = identifierName(init['callee'])
	if (isNil(calleeName) || !DEFINE_CALLEES.has(calleeName)) return undefined
	const args = init['arguments']
	if (!isArray(args) || args.length === 0) return undefined
	const first = args[0]
	if (!isRecord(first) || nodeType(first) !== 'ObjectExpression') return undefined
	const id = extractStringProp(first, 'id')
	const runtime = extractStringProp(first, 'runtime')
	if (!isSurfaceRuntime(runtime)) {
		throw new Error(`defineModule${id ? ` "${id}"` : ''} must declare runtime as node, edge, or both`)
	}
	return { ...(id && { id }), runtime }
}

function parseTs(filePath: string, source: string): { body: unknown[]; errors: unknown[] } {
	const result = parseSync(filePath, source, {
		sourceType: 'module',
		lang: 'ts'
	})
	const body = result.program.body
	return {
		body: isArray(body) ? body : [],
		errors: isArray(result.errors) ? result.errors : []
	}
}

const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/

async function discoverLane(repoRoot: string, lane: SurfaceLane): Promise<DiscoveredModule[]> {
	const laneRoot = path.join(repoRoot, 'src', lane)
	let entries: string[]
	try {
		entries = await readdir(laneRoot)
	} catch {
		return []
	}

	const discovered: DiscoveredModule[] = []

	for (const key of entries.sort()) {
		// Dotfiles and `_vertical` kits (e.g. vendors/_email) are not published surfaces.
		if (key.startsWith('.') || key.startsWith('_')) continue
		const dir = path.join(laneRoot, key)
		const st = await stat(dir)
		if (!st.isDirectory()) continue

		if (!KEBAB.test(key)) {
			throw new Error(`Surface folder must be kebab-case: src/${lane}/${key}`)
		}

		const entryPath = path.join(dir, 'index.ts')
		let entrySource: string
		try {
			entrySource = await readFile(entryPath, 'utf8')
		} catch {
			throw new Error(`Surface src/${lane}/${key} must have index.ts`)
		}

		const parsed = parseTs(entryPath, entrySource)
		if (parsed.errors.length > 0) {
			const msg = parsed.errors
				.map((e) => {
					if (isRecord(e) && isString(e['message'])) return e['message']
					return String(e)
				})
				.join('; ')
			throw new Error(`oxc-parser failed on src/${lane}/${key}/index.ts: ${msg}`)
		}

		const exportNames = collectExportNames(parsed.body)
		if (exportNames.length === 0) {
			throw new Error(`src/${lane}/${key}/index.ts must export at least one binding`)
		}

		let metadata = findDefineModuleMetadata(parsed.body)
		let moduleIdSource: string | undefined = metadata?.id ? entryPath : undefined

		if (!metadata) {
			const modulePath = path.join(dir, 'module.ts')
			try {
				const moduleSource = await readFile(modulePath, 'utf8')
				const moduleParsed = parseTs(modulePath, moduleSource)
				if (moduleParsed.errors.length === 0) {
					metadata = findDefineModuleMetadata(moduleParsed.body)
					if (metadata?.id) moduleIdSource = modulePath
				}
			} catch {
				// module.ts optional
			}
		}
		if (!metadata) {
			throw new Error(`Surface src/${lane}/${key} must export a defineModule with an explicit runtime`)
		}

		discovered.push({
			key,
			lane,
			entryPath,
			entryRelative: path.relative(repoRoot, entryPath).split(path.sep).join('/'),
			entryKey: `${lane}/${key}/index`,
			exportNames,
			runtime: metadata.runtime,
			...(metadata.id && { moduleId: metadata.id }),
			...(isNil(moduleIdSource)
				? {}
				: { moduleIdSource: path.relative(repoRoot, moduleIdSource).split(path.sep).join('/') })
		})
	}

	return discovered
}

/**
 * Discover product surfaces under src/{modules,vendors}/<key>/index.ts.
 * Export keys must be unique across all lanes (flat public imports).
 */
export async function discoverModules(repoRoot: string): Promise<DiscoveredModule[]> {
	const discovered: DiscoveredModule[] = []
	const seen = new Map<string, SurfaceLane>()

	for (const lane of SURFACE_LANES) {
		const laneModules = await discoverLane(repoRoot, lane)
		for (const mod of laneModules) {
			const prior = seen.get(mod.key)
			if (prior !== undefined) {
				throw new Error(
					`Duplicate surface export key "${mod.key}" in src/${prior}/${mod.key} and src/${lane}/${mod.key}`
				)
			}
			seen.set(mod.key, lane)
			discovered.push(mod)
		}
	}

	return discovered.sort((a, b) => a.key.localeCompare(b.key))
}
