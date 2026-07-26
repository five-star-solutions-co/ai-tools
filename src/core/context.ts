/**
 * ToolContext merge helpers for bind + adapters.
 */

import type { ToolContext } from './types'

/**
 * Merge overlay onto base. Overlay fields win; `extras` are shallow-merged.
 * Undefined overlay leaves base values when using spread of partials — callers
 * should only put defined keys on overlay when they intend to replace.
 */
export function mergeToolContext(base: ToolContext, overlay: ToolContext = {}): ToolContext {
	const extras =
		base.extras !== undefined || overlay.extras !== undefined ? { ...base.extras, ...overlay.extras } : undefined
	return {
		...base,
		...overlay,
		extras
	}
}
