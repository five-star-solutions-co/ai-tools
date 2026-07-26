import type {
	AuthDefinition,
	ModuleDefinition,
	ToolContext,
	ToolDefinition,
	ToolRuntime,
	ToolSideEffect
} from './types'
import { assertUniqueBy } from './unique'

export type DefineToolOptions<TInput, TOutput> = {
	description: string
	id: string
	inputSchema: ToolDefinition<TInput, TOutput>['inputSchema']
	name: string
	outputSchema: ToolDefinition<TInput, TOutput>['outputSchema']
	runtime?: ToolRuntime
	sideEffect?: ToolSideEffect
	tags?: readonly string[]
	/** Host-facing hints (not enforced by the kernel). */
	idempotent?: boolean
	longRunning?: boolean
	requiresConfirmation?: boolean
	supportsCancel?: boolean
	supportsProgress?: boolean
	network?: boolean
	artifacts?: boolean
	execute: (input: TInput, ctx: ToolContext) => Promise<TOutput>
}

export function defineTool<TInput, TOutput>(
	options: DefineToolOptions<TInput, TOutput>
): ToolDefinition<TInput, TOutput> {
	const description = options.description.trim()
	if (!description) {
		throw new Error(`Tool ${options.id} is missing a model-facing description`)
	}
	if (!options.id.trim()) {
		throw new Error('Tool id is required')
	}
	if (!options.name.trim()) {
		throw new Error(`Tool ${options.id} is missing a name`)
	}

	return {
		id: options.id,
		name: options.name,
		description,
		inputSchema: options.inputSchema,
		outputSchema: options.outputSchema,
		meta: {
			runtime: options.runtime ?? 'both',
			sideEffect: options.sideEffect ?? 'read',
			tags: options.tags,
			idempotent: options.idempotent,
			longRunning: options.longRunning,
			requiresConfirmation: options.requiresConfirmation,
			supportsCancel: options.supportsCancel,
			supportsProgress: options.supportsProgress,
			network: options.network,
			artifacts: options.artifacts
		},
		execute: async (input, ctx) => {
			const parsed = options.inputSchema.parse(input)
			return options.execute(parsed, ctx)
		}
	}
}

/** @deprecated Prefer defineTool return value directly; kept for call-site clarity in modules. */
export function asAnyTool<TInput, TOutput>(tool: ToolDefinition<TInput, TOutput>): ToolDefinition {
	return tool
}

export type DefineModuleOptions<TAuth = unknown> = {
	auth?: AuthDefinition<TAuth>
	description: string
	id: string
	runtime?: ToolRuntime
	title: string
	tools: readonly ToolDefinition[]
}

export function defineModule<TAuth = unknown>(options: DefineModuleOptions<TAuth>): ModuleDefinition<TAuth> {
	const description = options.description.trim()
	if (!description) {
		throw new Error(`Module ${options.id} is missing a description`)
	}
	if (!options.id.trim()) {
		throw new Error('Module id is required')
	}
	if (options.tools.length === 0) {
		throw new Error(`Module ${options.id} must declare at least one tool`)
	}

	assertUniqueBy(
		options.tools,
		(tool) => tool.id,
		(id) => `Module ${options.id} has duplicate tool id: ${id}`
	)

	return {
		id: options.id,
		title: options.title,
		description,
		runtime: options.runtime ?? 'both',
		auth: options.auth ?? { type: 'none' },
		tools: options.tools
	}
}
