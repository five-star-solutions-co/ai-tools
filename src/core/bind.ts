/**
 * Dynamic per-invocation bind (auth + context) for multi-tenant hosts.
 * Prefer `withAuth` when credentials are fixed for the process/request lifetime.
 */

import { mergeToolContext } from './context'
import type { ToolHooks } from './hooks'
import { invokeWithHooks } from './hooks'
import { ToolError } from './errors'
import type { AuthDefinition, ModuleDefinition, ToolContext, ToolDefinition } from './types'

function assertAuth<TAuth>(auth: AuthDefinition<TAuth>, value: unknown): TAuth | undefined {
	if (auth.type === 'none') {
		if (value !== undefined) {
			throw new ToolError('This tool does not accept auth', { code: 'bad_auth' })
		}
		return undefined
	}

	const parsed = auth.schema.safeParse(value)
	if (!parsed.success) {
		throw new ToolError('Invalid auth credentials', {
			code: 'bad_auth',
			details: { issues: parsed.error.issues.map((issue) => issue.message) }
		})
	}

	return parsed.data
}

function withBoundAuth(ctx: ToolContext, auth: unknown): ToolContext {
	if (auth === undefined) return { ...ctx }
	return { ...ctx, auth }
}

export type BindModuleOptions<TAuth = unknown> = {
	/**
	 * Resolve host credentials for this invocation (org/session/vault).
	 * Required when `module.auth.type !== 'none'`.
	 */
	resolveAuth?: (ctx: ToolContext) => TAuth | Promise<TAuth>
	/**
	 * Overlay host runtime fields onto the incoming context (merged, not replaced).
	 * Returning `{ extras: { org_id } }` keeps signal/fetch from the adapter.
	 */
	resolveContext?: (ctx: ToolContext) => ToolContext | Promise<ToolContext>
	/** Optional execute hooks (same semantics as `withHooks`). */
	hooks?: ToolHooks
}

async function resolveBoundContext<TAuth>(
	moduleAuth: AuthDefinition<TAuth>,
	incoming: ToolContext,
	options: BindModuleOptions<TAuth>
): Promise<ToolContext> {
	const base = options.resolveContext
		? mergeToolContext(incoming, await options.resolveContext(incoming))
		: { ...incoming }
	if (moduleAuth.type === 'none') {
		return base
	}
	if (!options.resolveAuth) {
		throw new ToolError('resolveAuth is required for modules that declare auth', {
			code: 'bad_auth'
		})
	}
	const raw = await options.resolveAuth(base)
	const boundAuth = assertAuth(moduleAuth, raw)
	return withBoundAuth(base, boundAuth)
}

/** Bind one tool with per-invocation auth/context resolvers (+ optional hooks). */
export function bindTool<TInput, TOutput, TAuth = unknown>(
	tool: ToolDefinition<TInput, TOutput>,
	moduleAuth: AuthDefinition<TAuth>,
	options: BindModuleOptions<TAuth>
): ToolDefinition<TInput, TOutput> {
	const hooks = options.hooks
	return {
		...tool,
		execute: async (input, ctx) => {
			let boundCtx = ctx
			try {
				boundCtx = await resolveBoundContext(moduleAuth, ctx, options)
			} catch (error) {
				if (hooks?.onError) {
					await hooks.onError({
						tool: {
							id: tool.id,
							name: tool.name,
							description: tool.description,
							meta: tool.meta
						},
						input,
						ctx,
						error
					})
				}
				throw error
			}
			return invokeWithHooks(tool, input, boundCtx, hooks)
		}
	}
}

/**
 * Bind a module so each tool resolves auth (and optional context) **per invocation**.
 * Model-facing schemas stay free of secrets; hosts supply `resolveAuth` from vault/session.
 */
export function bindModule<TAuth>(
	module: ModuleDefinition<TAuth>,
	options: BindModuleOptions<TAuth>
): ModuleDefinition<TAuth> {
	if (module.auth.type !== 'none' && options.resolveAuth === undefined) {
		throw new ToolError(`Module ${module.id} requires resolveAuth`, { code: 'bad_auth' })
	}

	return {
		...module,
		tools: module.tools.map((tool) => bindTool(tool, module.auth, options))
	}
}
