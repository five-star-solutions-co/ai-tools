import { createTool } from '@mastra/core/tools'
import { keyBy, mapValues } from 'es-toolkit'

import { resolveTools } from '../../core/resolve-tools'
import type { ToolContext, ToolDefinition, ToolSource } from '../../core/types'
import { assertUniqueBy } from '../../core/unique'
import { runTool } from '../../core/with-auth'

type MastraTool = ReturnType<typeof createTool>

/** Mastra execute second-arg subset used by this projector. */
export type MastraExecuteContext = {
	abortSignal?: AbortSignal
}

export type MastraToolsOptions = {
	/** Static base context merged on every call. */
	context?: ToolContext
	/** Map Mastra execute context into ToolContext (signal, extras, …). */
	createContext?: (context: MastraExecuteContext | undefined) => ToolContext | Promise<ToolContext>
}

async function toolContextFromMastra(
	context: MastraExecuteContext | undefined,
	options: MastraToolsOptions
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
 * Project one kernel tool into a Mastra tool.
 *
 * Stream `toolName` comes from the object key on `agent.tools`, not from `id`.
 * `createMastraTools` keys by `id` so toolName matches id by default.
 */
export function createMastraTool(tool: ToolDefinition, options: MastraToolsOptions = {}): MastraTool {
	return createTool({
		id: tool.id,
		description: tool.description,
		inputSchema: tool.inputSchema,
		outputSchema: tool.outputSchema,
		execute: async (input, context) => {
			const ctx = await toolContextFromMastra(context, options)
			return runTool(tool, input, ctx)
		}
	})
}

/** Project tools into a Mastra tools record keyed by tool id. */
export function createMastraTools(source: ToolSource, options: MastraToolsOptions = {}): Record<string, MastraTool> {
	const tools = resolveTools(source)
	assertUniqueBy(
		tools,
		(t) => t.id,
		(id) => `Duplicate tool id when building Mastra tools: ${id}`
	)
	return mapValues(
		keyBy(tools, (t) => t.id),
		(tool) => createMastraTool(tool, options)
	)
}
