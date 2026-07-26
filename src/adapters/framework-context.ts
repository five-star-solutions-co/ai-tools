import { mergeToolContext } from '../core/context'
import type { ToolContext } from '../core/types'

export function readAbortSignal(context: unknown, key: 'abortSignal' | 'signal'): AbortSignal | undefined {
	if (context === null || typeof context !== 'object') return undefined
	const value = Reflect.get(context, key)
	return value instanceof AbortSignal ? value : undefined
}

export function frameworkSignalContext(context: unknown, key: 'abortSignal' | 'signal' = 'abortSignal'): ToolContext {
	const signal = readAbortSignal(context, key)
	return signal ? { signal } : {}
}

/** Plain copy of a framework execute bag. */
export function copyFrameworkBag(value: unknown): Record<string, unknown> {
	if (value === null || typeof value !== 'object') return {}
	const out: Record<string, unknown> = {}
	for (const key of Object.keys(value)) out[key] = Reflect.get(value, key)
	return out
}

/**
 * framework signal ← static context ← createContext(bag).
 * `undefined` overlay fields do not erase base values.
 */
export async function mergeAdapterToolContext(
	frameworkContext: unknown,
	options: {
		context?: ToolContext | undefined
		createContext?: ((bag: Record<string, unknown>) => ToolContext | Promise<ToolContext>) | undefined
	} = {},
	signalKey: 'abortSignal' | 'signal' = 'abortSignal'
): Promise<ToolContext> {
	let ctx = mergeToolContext(frameworkSignalContext(frameworkContext, signalKey), options.context ?? {})
	if (options.createContext) {
		ctx = mergeToolContext(ctx, await options.createContext(copyFrameworkBag(frameworkContext)))
	}
	return ctx
}
