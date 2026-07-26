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

/**
 * framework signal ← static context ← createContext(bag).
 * `undefined` overlay fields do not erase base values.
 */
export async function mergeAdapterToolContext<TFrameworkContext>(
	frameworkContext: TFrameworkContext,
	options: {
		context?: ToolContext | undefined
		createContext?: ((context: TFrameworkContext) => ToolContext | Promise<ToolContext>) | undefined
	} = {},
	signalKey: 'abortSignal' | 'signal' = 'abortSignal'
): Promise<ToolContext> {
	let ctx = mergeToolContext(frameworkSignalContext(frameworkContext, signalKey), options.context ?? {})
	if (options.createContext) {
		ctx = mergeToolContext(ctx, await options.createContext(frameworkContext))
	}
	return ctx
}
