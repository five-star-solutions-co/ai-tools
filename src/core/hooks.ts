/** Host hooks attach metadata; `runTool` owns the complete lifecycle. */

import type { ModuleDefinition, ToolDefinition, ToolHooks, ToolHookToolRef } from './types'

export type { ArtifactHookEvent, ToolHookEvent, ToolHooks, ToolHookToolRef } from './types'

export function withHooksTool<TInput, TOutput>(
	tool: ToolDefinition<TInput, TOutput>,
	hooks: ToolHooks
): ToolDefinition<TInput, TOutput> {
	const execution = tool.execution ?? { run: tool.execute }
	return {
		...tool,
		execution: { ...execution, hooks }
	}
}

export function withHooks<TAuth>(module: ModuleDefinition<TAuth>, hooks: ToolHooks): ModuleDefinition<TAuth> {
	return { ...module, tools: module.tools.map((t) => withHooksTool(t, hooks)) }
}

export function toolRef(tool: ToolHookToolRef): ToolHookToolRef {
	return { id: tool.id, name: tool.name, description: tool.description, meta: tool.meta }
}
