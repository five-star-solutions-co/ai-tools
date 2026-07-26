import { createTool } from '@mastra/core/tools'
import { keyBy, mapValues } from 'es-toolkit'

import { mergeAdapterToolContext } from '../framework-context'
import { resolveTools } from '../../core/resolve-tools'
import type { ToolContext, ToolDefinition, ToolSource } from '../../core/types'
import { assertUniqueBy } from '../../core/unique'
import { runTool } from '../../core/with-auth'

type MastraTool = ReturnType<typeof createTool>

/**
 * Mastra execute context shape hosts can narrow inside createContext.
 * Framework may pass additional fields (toolCallId, requestContext, …).
 */
export type MastraExecuteContext = {
	abortSignal?: AbortSignal
} & Record<string, unknown>

export type MastraToolsOptions = {
	context?: ToolContext
	/** Receives full framework execute context; merge defaults keep abortSignal unless overridden. */
	createContext?: (context: unknown) => ToolContext | Promise<ToolContext>
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
			const ctx = await mergeAdapterToolContext(context, options, 'abortSignal')
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
