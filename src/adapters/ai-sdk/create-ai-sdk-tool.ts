import { dynamicTool } from 'ai'
import { keyBy, mapValues } from 'es-toolkit'

import { mergeAdapterToolContext } from '../framework-context'
import { resolveTools } from '../../core/resolve-tools'
import type { ToolContext, ToolDefinition, ToolSource } from '../../core/types'
import { assertUniqueBy } from '../../core/unique'
import { runTool } from '../../core/with-auth'

type AiSdkTool = ReturnType<typeof dynamicTool>

/** Exact execute options supplied by the installed AI SDK. */
export type AiSdkExecuteOptions = Parameters<NonNullable<AiSdkTool['execute']>>[1]

export type AiSdkToolsOptions = {
	context?: ToolContext
	createContext?: (options: AiSdkExecuteOptions) => ToolContext | Promise<ToolContext>
}

export function createAiSdkTool(kernelTool: ToolDefinition, options: AiSdkToolsOptions = {}): AiSdkTool {
	return dynamicTool({
		description: kernelTool.description,
		inputSchema: kernelTool.inputSchema,
		execute: async (input, execOptions) => {
			const ctx = await mergeAdapterToolContext(execOptions, options, 'abortSignal')
			return runTool(kernelTool, input, ctx)
		}
	})
}

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
