import { keyBy, mapValues } from 'es-toolkit'
import { toJSONSchema } from 'zod'

import { resolveTools } from '../../core/resolve-tools'
import type { ToolContext, ToolDefinition, ToolSource } from '../../core/types'
import { assertUniqueBy } from '../../core/unique'
import { runTool } from '../../core/with-auth'

/**
 * Traditional Workers AI / OpenAI-style tool definition (parameters JSON Schema).
 * @see https://developers.cloudflare.com/workers-ai/features/function-calling/
 */
export type CloudflareAiToolDefinition = {
	description: string
	name: string
	parameters: Record<string, unknown>
}

export type CloudflareAiToolsOptions = {
	/** Static base context merged into every execute (after call-site ctx). */
	context?: ToolContext
	/** Build ToolContext per call (host ids, signal, …). Receives optional call-site ctx. */
	createContext?: (ctx: ToolContext | undefined) => ToolContext | Promise<ToolContext>
}

export type CloudflareAiToolset = {
	/** Pass to `env.AI.run(..., { tools })`. */
	definitions: CloudflareAiToolDefinition[]
	/**
	 * Run a model-selected tool by name with raw arguments.
	 * Host wires this after reading `response.tool_calls`.
	 */
	execute: (name: string, args: unknown, ctx?: ToolContext) => Promise<unknown>
	/** Direct map of name → execute for custom loops. */
	executors: Record<string, (args: unknown, ctx?: ToolContext) => Promise<unknown>>
}

export function createCloudflareAiToolDefinition(tool: ToolDefinition): CloudflareAiToolDefinition {
	return {
		name: tool.id,
		description: tool.description,
		parameters: toJSONSchema(tool.inputSchema)
	}
}

/**
 * Project kernel tools into Cloudflare Workers AI traditional function-calling shape
 * plus host-side executors. No Cloudflare package dependency required.
 */
export function createCloudflareAiTools(
	source: ToolSource,
	options: CloudflareAiToolsOptions = {}
): CloudflareAiToolset {
	const tools = resolveTools(source)
	assertUniqueBy(
		tools,
		(t) => t.id,
		(id) => `Duplicate tool id when building Cloudflare tools: ${id}`
	)

	const resolveCtx = async (ctx: ToolContext | undefined): Promise<ToolContext> => {
		const base: ToolContext = { ...options.context, ...ctx }
		if (options.createContext) {
			const fromFactory = await options.createContext(ctx)
			return { ...base, ...fromFactory }
		}
		return base
	}

	const executors = mapValues(
		keyBy(tools, (t) => t.id),
		(tool) =>
			async (args: unknown, ctx: ToolContext = {}) => {
				const next = await resolveCtx(ctx)
				return runTool(tool, args, next)
			}
	)

	return {
		definitions: tools.map(createCloudflareAiToolDefinition),
		executors,
		execute: async (name, args, ctx = {}) => {
			const run = executors[name]
			if (!run) {
				throw new Error(`Unknown Cloudflare tool: ${name}`)
			}
			return run(args, ctx)
		}
	}
}
