export { bindModule, bindTool } from './bind'
export type { BindModuleOptions } from './bind'
export { mergeToolContext } from './context'
export { assertContracts, validateModule, validateTool } from './contracts'
export type { ContractIssue, ContractResult } from './contracts'
export { toModuleCatalogEntry, toToolCatalogEntry } from './catalog'
export type { ModuleCatalogEntry, ToolCatalogEntry } from './catalog'
export { asAnyTool, defineModule, defineTool } from './define'
export type { DefineModuleOptions, DefineToolOptions } from './define'
export { isToolError, ToolError } from './errors'
export type { ToolErrorCode, ToolErrorOptions } from './errors'
export { withHooks, withHooksTool, wrapExecuteWithHooks } from './hooks'
export type { ToolHookEvent, ToolHooks, ToolHookToolRef } from './hooks'
export { defineProvider, requireAuth, resolveProvider } from './provider'
export type { ProviderAuthBase, ProviderDefinition } from './provider'
export { filterToolsByRuntime, isToolArray, resolveTools } from './resolve-tools'
export type {
	AuthDefinition,
	FetchLike,
	ModuleDefinition,
	ToolContext,
	ToolDefinition,
	ToolExecute,
	ToolMeta,
	ToolRuntime,
	ToolSideEffect,
	ToolSource
} from './types'
export { assertUniqueBy, duplicatesBy, firstDuplicateBy } from './unique'
export { listTools, runTool, withAuth, withAuthTool } from './with-auth'
