import { dynamicTool } from 'ai'
import { keyBy, mapValues } from 'es-toolkit'

import { mergeAdapterToolContext } from '../framework-context'
import { resolveTools } from '../../core/resolve-tools'
import type { ToolContext, ToolDefinition, ToolSource } from '../../core/types'
import { assertUniqueBy } from '../../core/unique'
import { runTool } from '../../core/with-auth'

type AiSdkTool = ReturnType<typeof dynamicTool>

/** Host-facing shape for AI SDK tool execute options (`createContext`). */
export type AiSdkExecuteOptions = {
	abortSignal?: AbortSignal
	toolCallId?: string
	messages?: unknown
	experimental_context?: unknown
} & Record<string, unknown>

export type AiSdkToolsOptions = {
	context?: ToolContext
	createContext?: (options: AiSdkExecuteOptions) => ToolContext | Promise<ToolContext>
}

/**
 * Project one kernel tool into a Vercel AI SDK dynamic tool.
 * Kernel tools are schema-erased at the boundary; dynamicTool matches that shape.
 */
export function createAiSdkTool(kernelTool: ToolDefinition, options: AiSdkToolsOptions = {}): AiSdkTool {
	return dynamicTool({
		description: kernelTool.description,
		inputSchema: kernelTool.inputSchema,
		execute: async (input, execOptions) => {
			const createContext = options.createContext
			const ctx = await mergeAdapterToolContext(
				execOptions,
				{
					...(options.context && { context: options.context }),
					...(createContext && {
						createContext: (fw: unknown) => createContext(asAiSdkOptions(fw))
					})
				},
				'abortSignal'
			)
			return runTool(kernelTool, input, ctx)
		}
	})
}

function asAiSdkOptions(value: unknown): AiSdkExecuteOptions {
	if (value === null || typeof value !== 'object') return {}
	const out: AiSdkExecuteOptions = {}
	for (const key of Object.keys(value)) {
		out[key] = Reflect.get(value, key)
	}
	return out
}

/** Project tools into an AI SDK tools record keyed by tool id. */
export function createAiSdkTools(source: ToolSource, options: AiSdkToolsOptions = {}): Record<string, AiSdkTool> {
	const tools = resolveTools(source)
	assertUniqueBy(
		tools,
		(t) => t.id,
		(id) => `Duplicate tool id when building AI SDK tools: ${id}`
	)
	return mapValues(
		keyBy(tools, (t) => t.id),
		(tool) => createAiSdkTool(tool, options)
	)
}
