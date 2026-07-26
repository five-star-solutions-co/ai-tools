import { toolDefinition } from '@tanstack/ai'
import { keyBy } from 'es-toolkit'

import { mergeAdapterToolContext } from '../framework-context'
import { resolveTools } from '../../core/resolve-tools'
import type { ToolContext, ToolDefinition, ToolSource } from '../../core/types'
import { assertUniqueBy } from '../../core/unique'
import { runTool } from '../../core/with-auth'

type TanStackServerTool = ReturnType<ReturnType<typeof toolDefinition>['server']>

export type TanStackExecuteContext = Parameters<NonNullable<TanStackServerTool['execute']>>[1]

export type TanStackToolsOptions = {
	context?: ToolContext
	createContext?: (context: TanStackExecuteContext) => ToolContext | Promise<ToolContext>
}

export function createTanStackTool(kernelTool: ToolDefinition, options: TanStackToolsOptions = {}): TanStackServerTool {
	const definition = toolDefinition({
		name: kernelTool.id,
		description: kernelTool.description,
		inputSchema: kernelTool.inputSchema,
		outputSchema: kernelTool.outputSchema
	})

	return definition.server(async (args, context) => {
		const ctx = await mergeAdapterToolContext(context, options, 'abortSignal')
		return runTool(kernelTool, args, ctx)
	})
}

export function createTanStackTools(source: ToolSource, options: TanStackToolsOptions = {}): TanStackServerTool[] {
	const tools = resolveTools(source)
	assertUniqueBy(
		tools,
		(t) => t.id,
		(id) => `Duplicate tool id when building TanStack tools: ${id}`
	)
	return tools.map((tool) => createTanStackTool(tool, options))
}

export function createTanStackToolRecord(
	source: ToolSource,
	options: TanStackToolsOptions = {}
): Record<string, TanStackServerTool> {
	return keyBy(createTanStackTools(source, options), (t) => t.name)
}
