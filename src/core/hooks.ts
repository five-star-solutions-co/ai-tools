/**
 * Generic execute hooks for host policy / audit.
 * Package only provides the pipe; host injects behavior.
 */

import { ToolError } from './errors'
import type { ModuleDefinition, ToolContext, ToolDefinition, ToolExecute } from './types'

export type ToolHookToolRef = Pick<ToolDefinition, 'id' | 'name' | 'description' | 'meta'>

export type ToolHookEvent = {
	tool: ToolHookToolRef
	input: unknown
	ctx: ToolContext
}

export type ToolHooks = {
	beforeExecute?: (event: ToolHookEvent) => void | Promise<void>
	/** Called only after successful execute **and** output schema validation. */
	afterExecute?: (event: ToolHookEvent & { output: unknown }) => void | Promise<void>
	/** Called for bind/resolve failures, beforeExecute throws, execute throws, and invalid output. */
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

function validateOutput(tool: ToolDefinition, output: unknown): unknown {
	const parsed = tool.outputSchema.safeParse(output)
	if (!parsed.success) {
		throw new ToolError('Tool returned invalid output', {
			code: 'internal',
			details: { issues: parsed.error.issues.map((issue) => issue.message) }
		})
	}
	return parsed.data
}

/**
 * Run tool.execute with hooks. afterExecute sees validated output only.
 * onError sees before/execute/validation failures.
 */
export async function invokeWithHooks(
	tool: ToolDefinition,
	input: unknown,
	ctx: ToolContext,
	hooks?: ToolHooks
): Promise<unknown> {
	const event: ToolHookEvent = { tool: toolRef(tool), input, ctx }
	try {
		if (hooks?.beforeExecute) await hooks.beforeExecute(event)
		const raw = await tool.execute(input, ctx)
		const output = validateOutput(tool, raw)
		if (hooks?.afterExecute) await hooks.afterExecute({ ...event, output })
		return output
	} catch (error) {
		if (hooks?.onError) await hooks.onError({ ...event, error })
		throw error
	}
}

/** Wrap a single tool execute with optional before / after / onError hooks. */
export function wrapExecuteWithHooks(tool: ToolDefinition, hooks: ToolHooks): ToolExecute {
	return async (input, ctx) => invokeWithHooks(tool, input, ctx, hooks)
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
