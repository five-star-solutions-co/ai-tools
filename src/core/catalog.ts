import { toJSONSchema } from 'zod'

import type { AuthDefinition, ModuleDefinition, ToolDefinition } from './types'

export type ToolCatalogEntry = {
	description: string
	id: string
	inputJsonSchema: Record<string, unknown>
	name: string
	outputJsonSchema: Record<string, unknown>
	runtime: ToolDefinition['meta']['runtime']
	sideEffect: ToolDefinition['meta']['sideEffect']
	tags: readonly string[]
	idempotent?: boolean | undefined
	longRunning?: boolean | undefined
	requiresConfirmation?: boolean | undefined
	supportsCancel?: boolean | undefined
	supportsProgress?: boolean | undefined
	network?: boolean | undefined
	artifacts?: boolean | undefined
}

export type ModuleCatalogEntry = {
	authType: AuthDefinition<unknown>['type']
	description: string
	id: string
	runtime: ModuleDefinition['runtime']
	title: string
	tools: ToolCatalogEntry[]
	/** Inline SVG when the pack has a logo. */
	logo?: string | undefined
	categories: readonly string[]
	classification?: ModuleDefinition['classification']
	tags: readonly string[]
}

export function toToolCatalogEntry(tool: ToolDefinition): ToolCatalogEntry {
	return {
		id: tool.id,
		name: tool.name,
		description: tool.description,
		runtime: tool.meta.runtime,
		sideEffect: tool.meta.sideEffect,
		tags: tool.meta.tags ?? [],
		idempotent: tool.meta.idempotent,
		longRunning: tool.meta.longRunning,
		requiresConfirmation: tool.meta.requiresConfirmation,
		supportsCancel: tool.meta.supportsCancel,
		supportsProgress: tool.meta.supportsProgress,
		network: tool.meta.network,
		artifacts: tool.meta.artifacts,
		inputJsonSchema: toJSONSchema(tool.inputSchema),
		outputJsonSchema: toJSONSchema(tool.outputSchema)
	}
}

export function toModuleCatalogEntry(module: ModuleDefinition): ModuleCatalogEntry {
	return {
		id: module.id,
		title: module.title,
		description: module.description,
		runtime: module.runtime,
		authType: module.auth.type,
		tools: module.tools.map(toToolCatalogEntry),
		categories: module.categories,
		tags: module.tags ?? [],
		...(module.classification !== undefined && { classification: module.classification }),
		...(module.logo !== undefined && { logo: module.logo })
	}
}
