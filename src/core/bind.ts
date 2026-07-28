/**
 * Per-invocation auth/context bind for multi-tenant hosts.
 */

import { mergeToolContext } from './context'
import type { ToolSelection } from './filter-tools'
import { filterModuleTools } from './filter-tools'
import type { ToolHooks } from './hooks'
import { ToolError } from './errors'
import type { AuthDefinition, ModuleDefinition, ToolContext, ToolDefinition, ToolExecution } from './types'

function assertAuth<TAuth>(auth: AuthDefinition<TAuth>, value: unknown): TAuth | undefined {
	if (auth.type === 'none') {
		if (value !== undefined) throw new ToolError('This tool does not accept auth', { code: 'bad_auth' })
		return undefined
	}
	const parsed = auth.schema.safeParse(value)
	if (!parsed.success) {
		throw new ToolError('Invalid auth credentials', {
			code: 'bad_auth',
			details: { issues: parsed.error.issues.map((i) => i.message) }
		})
	}
	return parsed.data
}

export type BindModuleOptions<TAuth = unknown> = {
	resolveAuth?: (ctx: ToolContext) => TAuth | Promise<TAuth>
	resolveContext?: (ctx: ToolContext) => ToolContext | Promise<ToolContext>
	hooks?: ToolHooks
	/**
	 * Restrict the tool surface after bind.
	 * Prefer composable `onlyTools` / `exceptTools` when filtering outside bind.
	 */
	tools?: ToolSelection
}

async function resolveBoundContext<TAuth>(
	moduleAuth: AuthDefinition<TAuth>,
	incoming: ToolContext,
	options: BindModuleOptions<TAuth>
): Promise<ToolContext> {
	const base = options.resolveContext
		? mergeToolContext(incoming, await options.resolveContext(incoming))
		: { ...incoming }
	if (moduleAuth.type === 'none') return base
	if (!options.resolveAuth) {
		throw new ToolError('resolveAuth is required for modules that declare auth', { code: 'bad_auth' })
	}
	const auth = assertAuth(moduleAuth, await options.resolveAuth(base))
	return {
		...base,
		...(auth !== undefined && { auth })
	}
}

export function bindTool<TInput, TOutput, TAuth = unknown>(
	tool: ToolDefinition<TInput, TOutput>,
	moduleAuth: AuthDefinition<TAuth>,
	options: BindModuleOptions<TAuth>
): ToolDefinition<TInput, TOutput> {
	const previous = tool.execution ?? { run: tool.execute }
	const bindContext = async (ctx: ToolContext): Promise<ToolContext> => {
		const base = previous.bindContext ? await previous.bindContext(ctx) : ctx
		return resolveBoundContext(moduleAuth, base, options)
	}
	const execution: ToolExecution = {
		...previous,
		bindContext,
		...(options.hooks && { hooks: options.hooks })
	}
	return {
		...tool,
		execution,
		execute: async (input, ctx) => execution.run(input, await bindContext(ctx))
	}
}

export function bindModule<TAuth>(
	module: ModuleDefinition<TAuth>,
	options: BindModuleOptions<TAuth>
): ModuleDefinition<TAuth> {
	if (module.auth.type !== 'none' && !options.resolveAuth) {
		throw new ToolError(`Module ${module.id} requires resolveAuth`, { code: 'bad_auth' })
	}
	const scoped = options.tools !== undefined ? filterModuleTools(module, options.tools) : module
	return {
		...scoped,
		tools: scoped.tools.map((tool) => bindTool(tool, scoped.auth, options))
	}
}
