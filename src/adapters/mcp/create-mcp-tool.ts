import { isFunction, isPlainObject, isString, keyBy, mapValues } from 'es-toolkit'
import { toJSONSchema } from 'zod'

import { resolveTools } from '../../core/resolve-tools'
import type { ToolContext, ToolDefinition, ToolSideEffect, ToolSource } from '../../core/types'
import { assertUniqueBy } from '../../core/unique'
import { runTool } from '../../core/with-auth'

/**
 * MCP tools/list item shape (JSON Schema input).
 * @see https://modelcontextprotocol.io/specification/2025-03-26/server/tools
 */
export type McpToolListItem = {
	annotations?: McpToolAnnotations
	description: string
	inputSchema: Record<string, unknown>
	name: string
}

export type McpToolAnnotations = {
	destructiveHint?: boolean
	idempotentHint?: boolean
	openWorldHint?: boolean
	readOnlyHint?: boolean
	title?: string
}

/** Subset of MCP CallToolResult used by this projector. */
export type McpCallToolResult = {
	content: Array<{ text: string; type: 'text' }>
	isError?: boolean
	structuredContent?: Record<string, unknown>
}

/**
 * Minimal surface of `@modelcontextprotocol/sdk` `McpServer.registerTool`
 * so hosts can register without this package hard-depending on the SDK types.
 */
export type McpServerLike = {
	registerTool: (
		name: string,
		config: {
			annotations?: McpToolAnnotations
			description?: string
			inputSchema?: unknown
			outputSchema?: unknown
			title?: string
		},
		// MCP passes parsed args + request extras (includes AbortSignal as `signal` in recent SDKs).
		cb: (args: unknown, extra: { signal?: AbortSignal }) => Promise<unknown>
	) => unknown
}

export type McpToolset = {
	/** tools/list payload items */
	list: McpToolListItem[]
	/** tools/call by name */
	call: (name: string, args: unknown, ctx?: ToolContext) => Promise<McpCallToolResult>
	/** raw executors (pre-MCP result wrapping) */
	executors: Record<string, (args: unknown, ctx?: ToolContext) => Promise<unknown>>
}

function annotationsForTool(tool: ToolDefinition): McpToolAnnotations {
	const sideEffect: ToolSideEffect = tool.meta.sideEffect
	const readOnly = sideEffect === 'read' || sideEffect === 'none'
	return {
		readOnlyHint: readOnly,
		destructiveHint: sideEffect === 'delete',
		idempotentHint: tool.meta.idempotent ?? readOnly,
		// Most integrations touch external systems; hosts can override via register options later.
		openWorldHint: tool.meta.network ?? true
	}
}

export function createMcpToolListItem(tool: ToolDefinition): McpToolListItem {
	return {
		name: tool.id,
		description: tool.description,
		inputSchema: toJSONSchema(tool.inputSchema),
		annotations: annotationsForTool(tool)
	}
}

function toCallResult(value: unknown): McpCallToolResult {
	const text = isString(value) ? value : JSON.stringify(value)
	const result: McpCallToolResult = {
		content: [{ type: 'text', text }]
	}
	if (isPlainObject(value)) {
		result.structuredContent = value
	}
	return result
}

/**
 * Project kernel tools into MCP list + call helpers (no SDK required).
 * Hosts implement transport / McpServer themselves.
 */
export function createMcpTools(source: ToolSource): McpToolset {
	const tools = resolveTools(source)
	assertUniqueBy(
		tools,
		(t) => t.id,
		(id) => `Duplicate tool id when building MCP tools: ${id}`
	)
	const executors = mapValues(
		keyBy(tools, (t) => t.id),
		(tool) =>
			(args: unknown, ctx: ToolContext = {}) =>
				runTool(tool, args, ctx)
	)

	return {
		list: tools.map(createMcpToolListItem),
		executors,
		call: async (name, args, ctx = {}) => {
			const run = executors[name]
			if (!run) {
				return {
					isError: true,
					content: [{ type: 'text', text: `Unknown tool: ${name}` }]
				}
			}
			try {
				const value = await run(args, ctx)
				return toCallResult(value)
			} catch (error) {
				const message = error instanceof Error ? error.message : 'Tool execution failed'
				return {
					isError: true,
					content: [{ type: 'text', text: message }]
				}
			}
		}
	}
}

export type RegisterMcpToolsOptions = {
	/**
	 * Static base context merged on every call.
	 * Prefer `withAuth` / `bindModule` before projection when credentials are fixed or dynamic.
	 */
	context?: ToolContext
	/**
	 * Map MCP request extras (e.g. AbortSignal) into ToolContext.
	 * Default merges `extra.signal` when present.
	 */
	createContext?: (extra: { signal?: AbortSignal }) => ToolContext | Promise<ToolContext>
	/** @deprecated Prefer `context` + `createContext`. Still supported as static or factory. */
	contextFactory?: ToolContext | (() => ToolContext | Promise<ToolContext>)
}

/**
 * Register kernel tools on an MCP `McpServer` (or compatible) via `registerTool`.
 * Requires the host to construct the server from `@modelcontextprotocol/sdk`.
 */
export function registerMcpTools(
	server: McpServerLike,
	source: ToolSource,
	options: RegisterMcpToolsOptions = {}
): void {
	const tools = resolveTools(source)
	assertUniqueBy(
		tools,
		(t) => t.id,
		(id) => `Duplicate tool id when registering MCP tools: ${id}`
	)

	for (const tool of tools) {
		server.registerTool(
			tool.id,
			{
				title: tool.name,
				description: tool.description,
				inputSchema: tool.inputSchema,
				outputSchema: tool.outputSchema,
				annotations: annotationsForTool(tool)
			},
			async (args, extra) => {
				const legacy = options.contextFactory
				const legacyBase: ToolContext = isFunction(legacy) ? await legacy() : (legacy ?? {})
				const base: ToolContext = { ...legacyBase, ...options.context }
				const fromFactory = options.createContext
					? await options.createContext(extra)
					: extra.signal
						? { signal: extra.signal }
						: {}
				const ctx: ToolContext = { ...base, ...fromFactory }
				const value = await runTool(tool, args, ctx)
				return toCallResult(value)
			}
		)
	}
}
