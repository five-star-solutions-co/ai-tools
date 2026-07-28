/**
 * Host-side tool surface filtering — keep or drop tools by stable kebab id.
 * Composable with withAuth / bindModule / withHooks (order free; filter anytime).
 */

import { ToolError } from './errors'
import type { ModuleDefinition, ToolDefinition } from './types'

/**
 * Exactly one of `only` or `except`.
 * Host wrappers can accept this same contract without redefining it.
 */
export type ToolSelection = { only: readonly string[]; except?: never } | { except: readonly string[]; only?: never }

/** @deprecated Use {@link ToolSelection}. */
export type ToolIdFilter = ToolSelection

/** @deprecated Use {@link ToolSelection} with `{ only }`. */
export type OnlyToolsFilter = Extract<ToolSelection, { only: readonly string[] }>

/** @deprecated Use {@link ToolSelection} with `{ except }`. */
export type ExceptToolsFilter = Extract<ToolSelection, { except: readonly string[] }>

/** Tool ids present on a module (string union when tool `id` is a string literal). */
export type ModuleToolId<M extends ModuleDefinition> = M['tools'][number]['id']

function availableToolIds(module: ModuleDefinition): string[] {
	return module.tools.map((t) => t.id)
}

function assertKnownIds(module: ModuleDefinition, ids: readonly string[], label: string): void {
	const have = new Set(module.tools.map((t) => t.id))
	const unknown = ids.filter((id) => !have.has(id))
	if (unknown.length > 0) {
		const available = availableToolIds(module)
		throw new ToolError(`${label}: unknown tool id(s) on module "${module.id}": ${unknown.join(', ')}`, {
			code: 'bad_input',
			details: {
				module_id: module.id,
				unknown_tool_ids: unknown,
				available_tool_ids: available
			}
		})
	}
}

function withTools<TAuth>(module: ModuleDefinition<TAuth>, tools: readonly ToolDefinition[]): ModuleDefinition<TAuth> {
	if (tools.length === 0) {
		throw new ToolError(`Module "${module.id}" would have zero tools after filter`, {
			code: 'bad_input',
			details: {
				module_id: module.id,
				available_tool_ids: availableToolIds(module)
			}
		})
	}
	return { ...module, tools }
}

/**
 * Keep only the listed tool ids. Unknown ids throw. Empty `ids` throws.
 * Order follows the original module tool list (not the `ids` array order).
 */
export function onlyTools<TAuth, const TId extends string = string>(
	module: ModuleDefinition<TAuth>,
	ids: readonly TId[]
): ModuleDefinition<TAuth> {
	if (ids.length === 0) {
		throw new ToolError('onlyTools requires at least one tool id', {
			code: 'bad_input',
			details: {
				module_id: module.id,
				available_tool_ids: availableToolIds(module)
			}
		})
	}
	assertKnownIds(module, ids, 'onlyTools')
	const want = new Set<string>(ids)
	return withTools(
		module,
		module.tools.filter((tool) => want.has(tool.id))
	)
}

/**
 * Drop the listed tool ids. Unknown ids throw. Empty `ids` returns the module unchanged.
 * Order follows the original module tool list.
 */
export function exceptTools<TAuth, const TId extends string = string>(
	module: ModuleDefinition<TAuth>,
	ids: readonly TId[]
): ModuleDefinition<TAuth> {
	if (ids.length === 0) return module
	assertKnownIds(module, ids, 'exceptTools')
	const drop = new Set<string>(ids)
	return withTools(
		module,
		module.tools.filter((tool) => !drop.has(tool.id))
	)
}

/** Apply an `only` or `except` selection. */
export function filterModuleTools<TAuth>(
	module: ModuleDefinition<TAuth>,
	selection: ToolSelection
): ModuleDefinition<TAuth> {
	const hasOnly = selection.only !== undefined
	const hasExcept = selection.except !== undefined
	if (hasOnly === hasExcept) {
		throw new ToolError('Tool selection requires exactly one of "only" or "except"', {
			code: 'bad_input',
			details: { module_id: module.id }
		})
	}
	if (selection.only !== undefined) return onlyTools(module, selection.only)
	return exceptTools(module, selection.except)
}
