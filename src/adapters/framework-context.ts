/**
 * Shared adapter helpers: merge framework defaults without type assertions.
 */

import { mergeToolContext } from '../core/context'
import type { ToolContext } from '../core/types'

/** Read AbortSignal from a framework context object without assertions. */
export function readAbortSignal(context: unknown, key: 'abortSignal' | 'signal'): AbortSignal | undefined {
	if (context === null || typeof context !== 'object') return undefined
	const value = Reflect.get(context, key)
	return value instanceof AbortSignal ? value : undefined
}

export function frameworkSignalContext(context: unknown, key: 'abortSignal' | 'signal' = 'abortSignal'): ToolContext {
	const signal = readAbortSignal(context, key)
	return signal ? { signal } : {}
}

/**
 * defaults (framework signal) ← static options.context ← createContext(framework).
 * Factory may override signal explicitly; omitting signal keeps cancellation.
 */
export async function mergeAdapterToolContext(
	frameworkContext: unknown,
	options: {
		context?: ToolContext | undefined
		createContext?: ((frameworkContext: unknown) => ToolContext | Promise<ToolContext>) | undefined
	},
	signalKey: 'abortSignal' | 'signal' = 'abortSignal'
): Promise<ToolContext> {
	let ctx = mergeToolContext(frameworkSignalContext(frameworkContext, signalKey), options.context ?? {})
	if (options.createContext) {
		ctx = mergeToolContext(ctx, await options.createContext(frameworkContext))
	}
	return ctx
}
