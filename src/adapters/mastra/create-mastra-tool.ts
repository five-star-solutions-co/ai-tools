import { createTool } from '@mastra/core/tools'
import { keyBy, mapValues } from 'es-toolkit'

import { mergeAdapterToolContext } from '../framework-context'
import { resolveTools } from '../../core/resolve-tools'
import type { ToolContext, ToolDefinition, ToolSource } from '../../core/types'
import { assertUniqueBy } from '../../core/unique'
import { runTool } from '../../core/with-auth'

type MastraTool = ReturnType<typeof createTool>

/** Host-facing shape for Mastra tool execute context (`createContext`). */
export type MastraExecuteContext = {
	abortSignal?: AbortSignal
	toolCallId?: string
	requestContext?: unknown
	tracingContext?: unknown
} & Record<string, unknown>

export type MastraToolsOptions = {
	context?: ToolContext
	createContext?: (context: MastraExecuteContext) => ToolContext | Promise<ToolContext>
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
			const createContext = options.createContext
			const ctx = await mergeAdapterToolContext(
				context,
				{
					...(options.context && { context: options.context }),
					...(createContext && {
						createContext: (fw: unknown) => createContext(asMastraContext(fw))
					})
				},
				'abortSignal'
			)
			return runTool(tool, input, ctx)
		}
	})
}

function asMastraContext(value: unknown): MastraExecuteContext {
	if (value === null || typeof value !== 'object') return {}
	const out: MastraExecuteContext = {}
	for (const key of Object.keys(value)) {
		out[key] = Reflect.get(value, key)
	}
	return out
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
