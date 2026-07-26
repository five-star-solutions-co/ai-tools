/**
 * Generic execute hooks for host policy / audit.
 * Package only provides the pipe; host injects behavior.
 */

import type { ModuleDefinition, ToolContext, ToolDefinition, ToolExecute } from './types'

export type ToolHookToolRef = Pick<ToolDefinition, 'id' | 'name' | 'description' | 'meta'>

export type ToolHookEvent = {
	tool: ToolHookToolRef
	input: unknown
	ctx: ToolContext
}

export type ToolHooks = {
	beforeExecute?: (event: ToolHookEvent) => void | Promise<void>
	afterExecute?: (event: ToolHookEvent & { output: unknown }) => void | Promise<void>
	onError?: (event: ToolHookEvent & { error: unknown }) => void | Promise<void>
}

function toolRef(tool: ToolDefinition): ToolHookToolRef {
	return {
		id: tool.id,
		name: tool.name,
		description: tool.description,
		meta: tool.meta
	}
}

/** Wrap a single tool execute with optional before / after / onError hooks. */
export function wrapExecuteWithHooks(tool: ToolDefinition, hooks: ToolHooks): ToolExecute {
	return async (input, ctx) => {
		const event: ToolHookEvent = { tool: toolRef(tool), input, ctx }
		if (hooks.beforeExecute) await hooks.beforeExecute(event)
		try {
			const output = await tool.execute(input, ctx)
			if (hooks.afterExecute) await hooks.afterExecute({ ...event, output })
			return output
		} catch (error) {
			if (hooks.onError) await hooks.onError({ ...event, error })
			throw error
		}
	}
}

/** Attach hooks to one tool (returns a new ToolDefinition). */
export function withHooksTool<TInput, TOutput>(
	tool: ToolDefinition<TInput, TOutput>,
	hooks: ToolHooks
): ToolDefinition<TInput, TOutput> {
	return {
		...tool,
		execute: wrapExecuteWithHooks(tool, hooks)
	}
}

/** Attach the same hooks to every tool in a module. */
export function withHooks<TAuth>(module: ModuleDefinition<TAuth>, hooks: ToolHooks): ModuleDefinition<TAuth> {
	return {
		...module,
		tools: module.tools.map((tool) => withHooksTool(tool, hooks))
	}
}
