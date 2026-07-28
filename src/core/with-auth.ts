import type { ToolSelection } from './filter-tools'
import { filterModuleTools } from './filter-tools'
import { toolRef } from './hooks'
import { ToolError } from './errors'
import type { AuthDefinition, ModuleDefinition, ToolContext, ToolDefinition, ToolExecution, ToolMeta } from './types'

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

export function withAuthTool<TInput, TOutput>(
	tool: ToolDefinition<TInput, TOutput>,
	auth: unknown
): ToolDefinition<TInput, TOutput> {
	const previous = tool.execution ?? { run: tool.execute }
	const bindContext = async (ctx: ToolContext): Promise<ToolContext> => {
		const base = previous.bindContext ? await previous.bindContext(ctx) : ctx
		return {
			...base,
			...(auth !== undefined && { auth })
		}
	}
	const execution: ToolExecution = {
		...previous,
		bindContext
	}
	return {
		...tool,
		execution,
		execute: async (input, ctx) => execution.run(input, await bindContext(ctx))
	}
}

export type WithAuthOptions = {
	/**
	 * Restrict the tool surface after bind.
	 * Prefer composable `onlyTools` / `exceptTools` when filtering outside withAuth.
	 */
	tools?: ToolSelection
}

export function withAuth<TAuth>(
	module: ModuleDefinition<TAuth>,
	auth?: TAuth,
	options: WithAuthOptions = {}
): ModuleDefinition<TAuth> {
	if (module.auth.type !== 'none' && auth === undefined) {
		throw new ToolError(`Module ${module.id} requires auth`, { code: 'bad_auth' })
	}
	const bound = assertAuth(module.auth, auth)
	const scoped = options.tools !== undefined ? filterModuleTools(module, options.tools) : module
	return {
		...scoped,
		tools: scoped.tools.map((tool) => withAuthTool(tool, bound))
	}
}

type RunnableTool<TInput, TOutput> = {
	id?: string
	name?: string
	description?: string
	meta?: ToolMeta
	execution?: ToolExecution | undefined
	inputSchema: ToolDefinition<TInput, TOutput>['inputSchema']
	outputSchema: ToolDefinition<TInput, TOutput>['outputSchema']
	execute: (input: unknown, ctx: ToolContext) => Promise<unknown>
}

/** Validate in → execute → validate out once → afterExecute. */
export async function runTool<TInput, TOutput>(
	tool: RunnableTool<TInput, TOutput>,
	input: TInput,
	ctx: ToolContext = {}
): Promise<TOutput> {
	const execution = tool.execution
	const hooks = execution?.hooks
	const ref = toolRef({
		id: tool.id ?? 'tool',
		name: tool.name ?? 'tool',
		description: tool.description ?? '',
		meta: tool.meta ?? { runtime: 'both', sideEffect: 'read' }
	})

	const parsedIn = tool.inputSchema.safeParse(input)
	if (!parsedIn.success) {
		const error = new ToolError('Invalid tool input', {
			code: 'bad_input',
			details: { issues: parsedIn.error.issues.map((i) => i.message) }
		})
		if (hooks?.onError) await hooks.onError({ tool: ref, input, ctx, error })
		throw error
	}

	let boundCtx = ctx
	try {
		if (execution?.bindContext) boundCtx = await execution.bindContext(ctx)
		const event = { tool: ref, input: parsedIn.data, ctx: boundCtx }
		if (hooks?.beforeExecute) await hooks.beforeExecute(event)

		const raw = await (execution?.run ?? tool.execute)(parsedIn.data, boundCtx)
		const parsedOut = tool.outputSchema.safeParse(raw)
		if (!parsedOut.success) {
			throw new ToolError('Tool returned invalid output', {
				code: 'internal',
				details: { issues: parsedOut.error.issues.map((i) => i.message) }
			})
		}

		if (hooks?.afterExecute) await hooks.afterExecute({ ...event, output: parsedOut.data })
		return parsedOut.data
	} catch (error) {
		if (hooks?.onError) {
			await hooks.onError({ tool: ref, input: parsedIn.data, ctx: boundCtx, error })
		}
		throw error
	}
}

export function listTools(module: ModuleDefinition): readonly ToolDefinition[] {
	return module.tools
}
