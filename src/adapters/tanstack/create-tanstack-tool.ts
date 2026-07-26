import { toolDefinition } from '@tanstack/ai'
import { keyBy } from 'es-toolkit'

import { mergeAdapterToolContext } from '../framework-context'
import { resolveTools } from '../../core/resolve-tools'
import type { ToolContext, ToolDefinition, ToolSource } from '../../core/types'
import { assertUniqueBy } from '../../core/unique'
import { runTool } from '../../core/with-auth'

type TanStackServerTool = ReturnType<ReturnType<typeof toolDefinition>['server']>

/** Host-facing shape for TanStack server-tool context (`createContext`). */
export type TanStackExecuteContext = {
	abortSignal?: AbortSignal
	requestId?: string
} & Record<string, unknown>

export type TanStackToolsOptions = {
	context?: ToolContext
	createContext?: (context: TanStackExecuteContext) => ToolContext | Promise<ToolContext>
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
		const createContext = options.createContext
		const ctx = await mergeAdapterToolContext(
			context,
			{
				...(options.context && { context: options.context }),
				...(createContext && {
					createContext: (fw: unknown) => createContext(asTanStackContext(fw))
				})
			},
			'abortSignal'
		)
		return runTool(kernelTool, args, ctx)
	})
}

function asTanStackContext(value: unknown): TanStackExecuteContext {
	if (value === null || typeof value !== 'object') return {}
	const out: TanStackExecuteContext = {}
	for (const key of Object.keys(value)) {
		out[key] = Reflect.get(value, key)
	}
	return out
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
