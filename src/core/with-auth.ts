import { attachToolPipe, getToolPipe, toolRef } from './hooks'
import { ToolError } from './errors'
import type { AuthDefinition, ModuleDefinition, ToolContext, ToolDefinition, ToolMeta } from './types'

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

/** Bind auth into a single tool's execute (same ToolDefinition shape). */
export function withAuthTool<TInput, TOutput>(
	tool: ToolDefinition<TInput, TOutput>,
	auth: unknown
): ToolDefinition<TInput, TOutput> {
	const prev = getToolPipe(tool)
	return attachToolPipe(tool, {
		run: prev?.run ?? tool.execute,
		bindCtx: (ctx) => withBoundAuth(ctx, auth),
		...(prev?.hooks && { hooks: prev.hooks })
	})
}

/**
 * Bind validated credentials into a module's tools.
 * Model-facing schemas never include auth; hosts call this before agent projection.
 */
export function withAuth<TAuth>(module: ModuleDefinition<TAuth>, auth?: TAuth): ModuleDefinition<TAuth> {
	if (module.auth.type !== 'none' && auth === undefined) {
		throw new ToolError(`Module ${module.id} requires auth`, { code: 'bad_auth' })
	}

	const boundAuth = assertAuth(module.auth, auth)

	return {
		...module,
		tools: module.tools.map((tool) => withAuthTool(tool, boundAuth))
	}
}

type RunnableTool<TInput, TOutput> = {
	id?: string
	name?: string
	description?: string
	meta?: ToolMeta
	inputSchema: {
		safeParse: (
			value: unknown
		) => { success: true; data: TInput } | { success: false; error: { issues: ReadonlyArray<{ message: string }> } }
	}
	outputSchema: {
		safeParse: (
			value: unknown
		) => { success: true; data: TOutput } | { success: false; error: { issues: ReadonlyArray<{ message: string }> } }
	}
	execute: (input: unknown, ctx: ToolContext) => Promise<unknown>
}

const defaultMeta: ToolMeta = { runtime: 'both', sideEffect: 'read' }

/**
 * Canonical invocation: bindCtx → validate input → before → leaf execute → validate output → after.
 * Output schema runs once.
 */
export async function runTool<TInput, TOutput>(
	tool: RunnableTool<TInput, TOutput>,
	input: TInput,
	ctx: ToolContext = {}
): Promise<TOutput> {
	const pipe = getToolPipe(tool)
	const hooks = pipe?.hooks
	const ref = toolRef({
		id: tool.id ?? 'tool',
		name: tool.name ?? 'tool',
		description: tool.description ?? '',
		meta: tool.meta ?? defaultMeta
	})

	const parsedInput = tool.inputSchema.safeParse(input)
	if (!parsedInput.success) {
		const error = new ToolError('Invalid tool input', {
			code: 'bad_input',
			details: { issues: parsedInput.error.issues.map((issue) => issue.message) }
		})
		if (hooks?.onError) await hooks.onError({ tool: ref, input, ctx, error })
		throw error
	}

	let boundCtx = ctx
	if (pipe?.bindCtx) {
		try {
			boundCtx = await pipe.bindCtx(ctx)
		} catch (error) {
			if (hooks?.onError) await hooks.onError({ tool: ref, input: parsedInput.data, ctx, error })
			throw error
		}
	}

	const event = { tool: ref, input: parsedInput.data, ctx: boundCtx }
	const run = pipe?.run ?? tool.execute
	try {
		if (hooks?.beforeExecute) await hooks.beforeExecute(event)
		const raw = await run(parsedInput.data, boundCtx)
		const parsedOutput = tool.outputSchema.safeParse(raw)
		if (!parsedOutput.success) {
			throw new ToolError('Tool returned invalid output', {
				code: 'internal',
				details: { issues: parsedOutput.error.issues.map((issue) => issue.message) }
			})
		}
		if (hooks?.afterExecute) await hooks.afterExecute({ ...event, output: parsedOutput.data })
		return parsedOutput.data
	} catch (error) {
		if (hooks?.onError) await hooks.onError({ ...event, error })
		throw error
	}
}

export function listTools(module: ModuleDefinition): readonly ToolDefinition[] {
	return module.tools
}
