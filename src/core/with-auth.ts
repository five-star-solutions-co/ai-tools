import { toolRef } from './hooks'
import { ToolError } from './errors'
import type { AuthDefinition, ModuleDefinition, ToolContext, ToolDefinition, ToolMeta } from './types'

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
	return {
		...tool,
		execute: async (input, ctx) =>
			tool.execute(input, {
				...ctx,
				...(auth !== undefined && { auth })
			})
	}
}

export function withAuth<TAuth>(module: ModuleDefinition<TAuth>, auth?: TAuth): ModuleDefinition<TAuth> {
	if (module.auth.type !== 'none' && auth === undefined) {
		throw new ToolError(`Module ${module.id} requires auth`, { code: 'bad_auth' })
	}
	const bound = assertAuth(module.auth, auth)
	return {
		...module,
		tools: module.tools.map((tool) => withAuthTool(tool, bound))
	}
}

type RunnableTool<TInput, TOutput> = {
	id?: string
	name?: string
	description?: string
	meta?: ToolMeta
	hooks?: ToolDefinition['hooks']
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
	const hooks = tool.hooks
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

	const raw = await tool.execute(parsedIn.data, ctx)

	const parsedOut = tool.outputSchema.safeParse(raw)
	if (!parsedOut.success) {
		const error = new ToolError('Tool returned invalid output', {
			code: 'internal',
			details: { issues: parsedOut.error.issues.map((i) => i.message) }
		})
		if (hooks?.onError) await hooks.onError({ tool: ref, input: parsedIn.data, ctx, error })
		throw error
	}

	if (hooks?.afterExecute) {
		await hooks.afterExecute({ tool: ref, input: parsedIn.data, ctx, output: parsedOut.data })
	}
	return parsedOut.data
}

export function listTools(module: ModuleDefinition): readonly ToolDefinition[] {
	return module.tools
}
