/**
 * Host execute hooks.
 * before/onError run around execute; afterExecute runs in runTool after output validation.
 */

import type { ModuleDefinition, ToolContext, ToolDefinition } from './types'

export type ToolHookToolRef = Pick<ToolDefinition, 'id' | 'name' | 'description' | 'meta'>

export type ToolHookEvent = {
	tool: ToolHookToolRef
	input: unknown
	ctx: ToolContext
}

export type ToolHooks = {
	beforeExecute?: (event: ToolHookEvent) => void | Promise<void>
	/** After output validation in `runTool`. */
	afterExecute?: (event: ToolHookEvent & { output: unknown }) => void | Promise<void>
	onError?: (event: ToolHookEvent & { error: unknown }) => void | Promise<void>
}

function ref(tool: ToolDefinition): ToolHookToolRef {
	return { id: tool.id, name: tool.name, description: tool.description, meta: tool.meta }
}

/** before → execute; onError on throw. Does not validate output. */
async function run(tool: ToolDefinition, input: unknown, ctx: ToolContext, hooks: ToolHooks): Promise<unknown> {
	const event: ToolHookEvent = { tool: ref(tool), input, ctx }
	try {
		if (hooks.beforeExecute) await hooks.beforeExecute(event)
		return await tool.execute(input, ctx)
	} catch (error) {
		if (hooks.onError) await hooks.onError({ ...event, error })
		throw error
	}
}

export function withHooksTool<TInput, TOutput>(
	tool: ToolDefinition<TInput, TOutput>,
	hooks: ToolHooks
): ToolDefinition<TInput, TOutput> {
	return {
		...tool,
		hooks,
		execute: (input, ctx) => run(tool, input, ctx, hooks)
	}
}

export function withHooks<TAuth>(module: ModuleDefinition<TAuth>, hooks: ToolHooks): ModuleDefinition<TAuth> {
	return { ...module, tools: module.tools.map((t) => withHooksTool(t, hooks)) }
}

/** Shared by bindModule when options.hooks is set. */
export function runWithHooks(
	tool: ToolDefinition,
	input: unknown,
	ctx: ToolContext,
	hooks: ToolHooks
): Promise<unknown> {
	return run(tool, input, ctx, hooks)
}

export function toolRef(tool: ToolHookToolRef): ToolHookToolRef {
	return { id: tool.id, name: tool.name, description: tool.description, meta: tool.meta }
}
