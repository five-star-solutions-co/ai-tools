/**
 * Host execute hooks + per-tool runtime pipe (auth bind, leaf execute).
 * Hooks and bindCtx are applied by `runTool` so output validates once.
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
	/** After successful execute and output schema validation (`runTool` only). */
	afterExecute?: (event: ToolHookEvent & { output: unknown }) => void | Promise<void>
	/** bind/resolve, beforeExecute, execute, or invalid output. */
	onError?: (event: ToolHookEvent & { error: unknown }) => void | Promise<void>
}

/** Internal: one bag per tool identity (not a public API). */
type ToolPipe = {
	hooks?: ToolHooks
	/** Resolve auth/context once before hooks + leaf execute. */
	bindCtx?: (ctx: ToolContext) => ToolContext | Promise<ToolContext>
	/** Leaf execute — never re-binds. */
	run: ToolExecute
}

const pipes = new WeakMap<object, ToolPipe>()

function pipeOf(tool: object, fallbackExecute?: ToolExecute): ToolPipe {
	const existing = pipes.get(tool)
	if (existing) return existing
	return { run: fallbackExecute ?? (async () => undefined) }
}

/** Build a tool whose `execute` binds then runs the leaf (direct calls). `runTool` uses the pipe. */
export function attachToolPipe<TInput, TOutput>(
	tool: ToolDefinition<TInput, TOutput>,
	patch: {
		hooks?: ToolHooks
		bindCtx?: (ctx: ToolContext) => ToolContext | Promise<ToolContext>
		run?: ToolExecute
	}
): ToolDefinition<TInput, TOutput> {
	const prev = pipeOf(tool, tool.execute)
	const nextPipe: ToolPipe = { run: patch.run ?? prev.run }
	const hooks = patch.hooks ?? prev.hooks
	if (hooks) nextPipe.hooks = hooks
	const bindCtx = patch.bindCtx ?? prev.bindCtx
	if (bindCtx) nextPipe.bindCtx = bindCtx

	const next: ToolDefinition<TInput, TOutput> = {
		...tool,
		execute: async (input, ctx) => {
			const bound = nextPipe.bindCtx ? await nextPipe.bindCtx(ctx) : ctx
			return nextPipe.run(input, bound)
		}
	}
	pipes.set(next, nextPipe)
	return next
}

export function getToolPipe(tool: object): ToolPipe | undefined {
	return pipes.get(tool)
}

export function toolRef(tool: ToolHookToolRef): ToolHookToolRef {
	return {
		id: tool.id,
		name: tool.name,
		description: tool.description,
		meta: tool.meta
	}
}

/** Attach hooks (returns a new tool; hooks run in `runTool`). */
export function withHooksTool<TInput, TOutput>(
	tool: ToolDefinition<TInput, TOutput>,
	hooks: ToolHooks
): ToolDefinition<TInput, TOutput> {
	return attachToolPipe(tool, { hooks, run: pipeOf(tool, tool.execute).run })
}

/** Attach the same hooks to every tool in a module. */
export function withHooks<TAuth>(module: ModuleDefinition<TAuth>, hooks: ToolHooks): ModuleDefinition<TAuth> {
	return {
		...module,
		tools: module.tools.map((tool) => withHooksTool(tool, hooks))
	}
}
