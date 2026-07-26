/**
 * ToolContext merge helpers for bind + adapters.
 */

import type { ToolContext } from './types'

/**
 * Overlay wins for fields that are **present and defined**.
 * `{ signal: undefined }` does not clear base.signal.
 * `extras` are shallow-merged when overlay sets them.
 */
export function mergeToolContext(base: ToolContext, overlay: ToolContext = {}): ToolContext {
	const out: ToolContext = { ...base }
	if (overlay.auth !== undefined) out.auth = overlay.auth
	if (overlay.fetch !== undefined) out.fetch = overlay.fetch
	if (overlay.signal !== undefined) out.signal = overlay.signal
	if (overlay.now !== undefined) out.now = overlay.now
	if (overlay.extras !== undefined) {
		out.extras = { ...base.extras, ...overlay.extras }
	}
	return out
}
