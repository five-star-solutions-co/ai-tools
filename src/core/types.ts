import type { z } from 'zod'

import type { ArtifactRef } from '../shared/artifact'

export type ToolRuntime = 'both' | 'edge' | 'node'

export type ToolSideEffect = 'delete' | 'none' | 'read' | 'send' | 'write'

/**
 * Host data-sensitivity hint for catalog / policy (not enforced by the kernel).
 * Hosts map this to product rules (e.g. fail-closed PHI routing).
 */
export type ModuleClassification = 'standard' | 'pii' | 'phi'

/** Injectable fetch (tests, custom runtimes). Passed into HttpService / AwsService. */
export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

/**
 * Per-invocation host context.
 * Auth is host-bound (`withAuth` / `bindModule` / client constructor), never tool inputs.
 * `fetch` / `signal` feed product clients → transport.
 */
export type ToolContext<TAuth = unknown> = {
	auth?: TAuth | undefined
	/** Host bag for non-auth injectables (org ids, progress, sinks, …). */
	extras?: Record<string, unknown> | undefined
	fetch?: FetchLike | undefined
	now?: (() => Date) | undefined
	signal?: AbortSignal | undefined
}

/**
 * Public execute boundary takes unknown input so tools can be collected without
 * type assertions. `defineTool` validates via inputSchema first.
 */
export type ToolExecute = (input: unknown, ctx: ToolContext) => Promise<unknown>

export type ToolHookToolRef = Pick<ToolDefinition, 'id' | 'name' | 'description' | 'meta'>

export type ToolHookEvent = {
	tool: ToolHookToolRef
	input: unknown
	ctx: ToolContext
}

export type ArtifactHookEvent = ToolHookEvent & {
	artifact: ArtifactRef
	output: unknown
}

export type ToolHooks = {
	beforeExecute?: (event: ToolHookEvent) => void | Promise<void>
	/** Runs once per unique ArtifactRef found in a successfully validated output. */
	onArtifact?: (event: ArtifactHookEvent) => void | Promise<void>
	/** Runs after successful output validation. */
	afterExecute?: (event: ToolHookEvent & { output: unknown }) => void | Promise<void>
	onError?: (event: ToolHookEvent & { error: unknown }) => void | Promise<void>
}

/**
 * Internal execution plan carried through auth/context/hook wrappers.
 * `runTool` is the only consumer; direct `.execute` still applies bound context.
 */
export type ToolExecution = {
	bindContext?: (ctx: ToolContext) => ToolContext | Promise<ToolContext>
	hooks?: ToolHooks
	run: ToolExecute
}

/**
 * Tool metadata: runtime/sideEffect for contracts; optional host-facing **hints**
 * (package does not enforce confirmation, cancel, or audit — host does).
 */
export type ToolMeta = {
	runtime: ToolRuntime
	sideEffect: ToolSideEffect
	tags?: readonly string[] | undefined
	/** Hint: safe to retry with same args (host policy). */
	idempotent?: boolean | undefined
	/** Hint: may run longer than a typical tool call. */
	longRunning?: boolean | undefined
	/** Hint: host may want user confirmation before execute. */
	requiresConfirmation?: boolean | undefined
	/** Hint: cancel via AbortSignal is meaningful. */
	supportsCancel?: boolean | undefined
	/** Hint: host may surface progress callbacks. */
	supportsProgress?: boolean | undefined
	/** Hint: touches network / upstream APIs. */
	network?: boolean | undefined
	/** Hint: I/O uses ArtifactRef or large object storage. */
	artifacts?: boolean | undefined
}

export type ToolDefinition<TInput = unknown, TOutput = unknown> = {
	description: string
	/** Stable kebab-case id (`weather-get`). */
	id: string
	inputSchema: z.ZodType<TInput>
	meta: ToolMeta
	name: string
	outputSchema: z.ZodType<TOutput>
	execute: ToolExecute
	/** @internal Host execution plan composed by core helpers. */
	execution?: ToolExecution | undefined
}

/**
 * Module auth: none, or a Zod schema (always `custom` — protocol is the client's job).
 * Bearer/API-key/etc. are headers or AwsService credentials, not kernel kinds.
 */
export type AuthDefinition<TAuth> = { type: 'none' } | { type: 'custom'; schema: z.ZodType<TAuth> }

export type ModuleDefinition<TAuth = unknown> = {
	auth: AuthDefinition<TAuth>
	description: string
	id: string
	runtime: ToolRuntime
	title: string
	tools: readonly ToolDefinition[]
	/**
	 * Inline SVG markup for this pack (catalog / UI).
	 * Filled by `defineModule` from the shared logo map — hosts use `module.logo` as-is.
	 */
	logo?: string | undefined
	/**
	 * Catalog grouping for UI filters, MCP discovery, skill capability buckets.
	 * Free strings (e.g. `email`, `browser`, `commerce`).
	 */
	categories: readonly string[]
	/**
	 * Host sensitivity hint. Omitted when unknown — host may default to standard.
	 */
	classification?: ModuleClassification | undefined
	/** Module-level search / badge labels (distinct from per-tool tags). */
	tags?: readonly string[] | undefined
}

/** Module, or a flat tool list (adapters). */
export type ToolSource = ModuleDefinition | readonly ToolDefinition[]
