import { toolDefinition } from '@tanstack/ai'
import { keyBy } from 'es-toolkit'

import { resolveTools } from '../../core/resolve-tools'
import type { ToolContext, ToolDefinition, ToolSource } from '../../core/types'
import { assertUniqueBy } from '../../core/unique'
import { runTool } from '../../core/with-auth'

type TanStackServerTool = ReturnType<ReturnType<typeof toolDefinition>['server']>

export type TanStackExecuteContext = {
	abortSignal?: AbortSignal
}

export type TanStackToolsOptions = {
	context?: ToolContext
	createContext?: (context: TanStackExecuteContext | undefined) => ToolContext | Promise<ToolContext>
}

async function toolContextFromTanStack(
	context: TanStackExecuteContext | undefined,
	options: TanStackToolsOptions
): Promise<ToolContext> {
	const base = options.context ?? {}
	if (options.createContext) {
		const fromFactory = await options.createContext(context)
		return { ...base, ...fromFactory }
	}
	if (context?.abortSignal) {
		return { ...base, signal: context.abortSignal }
	}
	return { ...base }
}

/**
 * Project one kernel tool into a TanStack AI server tool.
 * Uses tool id as the model-facing name (stable kebab-case).
 */
export function createTanStackTool(kernelTool: ToolDefinition, options: TanStackToolsOptions = {}): TanStackServerTool {
	const definition = toolDefinition({
		name: kernelTool.id,
		description: kernelTool.description,
		inputSchema: kernelTool.inputSchema,
		outputSchema: kernelTool.outputSchema
	})

	return definition.server(async (args, context) => {
		const ctx = await toolContextFromTanStack(context, options)
		return runTool(kernelTool, args, ctx)
	})
}

/** Project tools into a TanStack AI tool array (chat `tools` accepts arrays). */
export function createTanStackTools(source: ToolSource, options: TanStackToolsOptions = {}): TanStackServerTool[] {
	const tools = resolveTools(source)
	assertUniqueBy(
		tools,
		(t) => t.id,
		(id) => `Duplicate tool id when building TanStack tools: ${id}`
	)
	return tools.map((tool) => createTanStackTool(tool, options))
}

/** Same tools as a record keyed by id for hosts that prefer maps. */
export function createTanStackToolRecord(
	source: ToolSource,
	options: TanStackToolsOptions = {}
): Record<string, TanStackServerTool> {
	return keyBy(createTanStackTools(source, options), (t) => t.name)
}
