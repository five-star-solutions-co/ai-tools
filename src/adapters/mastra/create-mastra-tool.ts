import { createTool } from '@mastra/core/tools'
import type { ToolExecutionContext } from '@mastra/core/tools'
import { keyBy, mapValues } from 'es-toolkit'

import { mergeAdapterToolContext } from '../framework-context'
import { resolveTools } from '../../core/resolve-tools'
import type { ToolContext, ToolDefinition, ToolSource } from '../../core/types'
import { assertUniqueBy } from '../../core/unique'
import { runTool } from '../../core/with-auth'

type MastraTool = ReturnType<typeof createTool>

export type MastraExecuteContext = ToolExecutionContext

export type MastraToolsOptions = {
	context?: ToolContext
	createContext?: (context: MastraExecuteContext) => ToolContext | Promise<ToolContext>
}

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
