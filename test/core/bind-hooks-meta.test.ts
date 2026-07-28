import { describe, expect, test } from 'bun:test'
import { z } from 'zod'

import {
	bindModule,
	defineModule,
	defineTool,
	exceptTools,
	isToolError,
	onlyTools,
	runTool,
	toToolCatalogEntry,
	withAuth,
	withHooks
} from '../../src/core'
import type { ToolContext } from '../../src/core'

const authSchema = z.object({ api_key: z.string().min(1) })

const echoTool = defineTool({
	id: 'echo-ping',
	name: 'echoPing',
	description: 'Echo a message for host-integration tests.',
	inputSchema: z.object({ message: z.string() }),
	outputSchema: z.object({
		message: z.string(),
		org: z.string().optional(),
		key_prefix: z.string().optional()
	}),
	sideEffect: 'none',
	network: false,
	idempotent: true,
	execute: async (input, ctx) => {
		const auth = ctx.auth as { api_key: string } | undefined
		return {
			message: input.message,
			org: typeof ctx.extras?.['org_id'] === 'string' ? ctx.extras['org_id'] : undefined,
			key_prefix: auth?.api_key.slice(0, 3)
		}
	}
})

const echoModule = defineModule({
	id: 'echo',
	title: 'Echo',
	description: 'Test module for bind and hooks.',
	auth: { type: 'custom', schema: authSchema },
	tools: [echoTool]
})

const echoPongTool = defineTool({
	id: 'echo-pong',
	name: 'echoPong',
	description: 'Second echo tool for filter tests.',
	inputSchema: z.object({ message: z.string() }),
	outputSchema: z.object({ message: z.string() }),
	sideEffect: 'none',
	execute: async (input) => ({ message: input.message })
})

const multiEchoModule = defineModule({
	id: 'echo-multi',
	title: 'Echo multi',
	description: 'Two-tool module for onlyTools / exceptTools tests.',
	auth: { type: 'custom', schema: authSchema },
	tools: [echoTool, echoPongTool]
})

describe('onlyTools / exceptTools', () => {
	test('onlyTools keeps listed ids in module order', () => {
		const scoped = onlyTools(multiEchoModule, ['echo-pong', 'echo-ping'])
		expect(scoped.tools.map((t) => t.id)).toEqual(['echo-ping', 'echo-pong'])
		const one = onlyTools(multiEchoModule, ['echo-pong'])
		expect(one.tools.map((t) => t.id)).toEqual(['echo-pong'])
	})

	test('exceptTools drops listed ids', () => {
		const scoped = exceptTools(multiEchoModule, ['echo-ping'])
		expect(scoped.tools.map((t) => t.id)).toEqual(['echo-pong'])
	})

	test('unknown id throws with structured details', () => {
		try {
			onlyTools(multiEchoModule, ['echo-ping', 'echo-pnog'])
			expect.unreachable()
		} catch (error) {
			expect(isToolError(error)).toBe(true)
			if (isToolError(error)) {
				expect(error.code).toBe('bad_input')
				expect(error.details).toEqual({
					module_id: 'echo-multi',
					unknown_tool_ids: ['echo-pnog'],
					available_tool_ids: ['echo-ping', 'echo-pong']
				})
			}
		}
		expect(() => exceptTools(multiEchoModule, ['nope'])).toThrow()
	})

	test('onlyTools empty or zero remaining throws', () => {
		expect(() => onlyTools(multiEchoModule, [])).toThrow()
		expect(() => exceptTools(multiEchoModule, ['echo-ping', 'echo-pong'])).toThrow()
	})

	test('withAuth and bindModule accept tools filter', async () => {
		const viaAuth = withAuth(multiEchoModule, { api_key: 'secret' }, { tools: { only: ['echo-ping'] } })
		expect(viaAuth.tools.map((t) => t.id)).toEqual(['echo-ping'])

		const viaBind = bindModule(multiEchoModule, {
			resolveAuth: async () => ({ api_key: 'secret' }),
			tools: { except: ['echo-pong'] }
		})
		expect(viaBind.tools.map((t) => t.id)).toEqual(['echo-ping'])
		const out = (await runTool(viaBind.tools[0]!, { message: 'hi' })) as { message: string }
		expect(out.message).toBe('hi')
	})

	test('composes with withAuth and withHooks', async () => {
		const scoped = onlyTools(withAuth(multiEchoModule, { api_key: 'secret' }), ['echo-ping'])
		const hooked = withHooks(scoped, {})
		expect(hooked.tools).toHaveLength(1)
		const out = (await runTool(hooked.tools[0]!, { message: 'z' })) as { message: string }
		expect(out.message).toBe('z')
	})
})

describe('ToolMeta (H-04)', () => {
	test('defineTool stores host-facing meta hints', () => {
		expect(echoTool.meta.idempotent).toBe(true)
		expect(echoTool.meta.network).toBe(false)
		const entry = toToolCatalogEntry(echoTool)
		expect(entry.idempotent).toBe(true)
		expect(entry.network).toBe(false)
	})
})

describe('withHooks (H-03)', () => {
	test('runs before, after, and onError', async () => {
		const events: string[] = []
		const bound = withAuth(echoModule, { api_key: 'secret' })
		const hooked = withHooks(bound, {
			beforeExecute: async ({ tool }) => {
				events.push(`before:${tool.id}`)
			},
			afterExecute: async ({ output }) => {
				events.push(`after:${JSON.stringify(output)}`)
			},
			onError: async () => {
				events.push('error')
			}
		})
		const tool = hooked.tools[0]!
		const out = (await runTool(tool, { message: 'hi' })) as {
			message: string
			org?: string
			key_prefix?: string
		}
		expect(out.message).toBe('hi')
		expect(events[0]).toBe('before:echo-ping')
		expect(events[1]?.startsWith('after:')).toBe(true)

		const boom = defineTool({
			id: 'echo-boom',
			name: 'echoBoom',
			description: 'Always fails for hook tests.',
			inputSchema: z.object({}),
			outputSchema: z.object({ ok: z.boolean() }),
			execute: async () => {
				throw new Error('nope')
			}
		})
		const boomMod = defineModule({
			id: 'boom',
			title: 'Boom',
			description: 'Fails.',
			auth: { type: 'none' },
			tools: [boom]
		})
		const boomHooked = withHooks(boomMod, {
			onError: async () => {
				events.push('boom-error')
			}
		})
		try {
			await runTool(boomHooked.tools[0]!, {})
			expect(true).toBe(false)
		} catch {
			expect(events).toContain('boom-error')
		}
	})

	test('onError sees invalid output; afterExecute does not run', async () => {
		const events: string[] = []
		const bad = defineTool({
			id: 'echo-bad-out',
			name: 'echoBadOut',
			description: 'Returns invalid output for hook tests.',
			inputSchema: z.object({}),
			outputSchema: z.object({ ok: z.literal(true) }),
			execute: async () => ({ ok: false })
		})
		const mod = defineModule({
			id: 'bad-out',
			title: 'Bad',
			description: 'Invalid output.',
			auth: { type: 'none' },
			tools: [bad]
		})
		const hooked = withHooks(mod, {
			afterExecute: async () => {
				events.push('after')
			},
			onError: async ({ error }) => {
				events.push(isToolError(error) ? error.code : 'err')
			}
		})
		try {
			await runTool(hooked.tools[0]!, {})
			expect(true).toBe(false)
		} catch (error) {
			expect(isToolError(error)).toBe(true)
			if (isToolError(error)) expect(error.code).toBe('internal')
		}
		expect(events).toEqual(['internal'])
	})

	test('output schema transform applies once (hooks + runTool)', async () => {
		let afterSeen: unknown
		const transforming = defineTool({
			id: 'echo-transform',
			name: 'echoTransform',
			description: 'Output transform once.',
			inputSchema: z.object({ message: z.string() }),
			outputSchema: z.string().transform((value) => `${value}!`),
			execute: async (input) => input.message
		})
		const mod = defineModule({
			id: 'transform',
			title: 'Transform',
			description: 'Single validation.',
			auth: { type: 'none' },
			tools: [transforming]
		})
		const hooked = withHooks(mod, {
			afterExecute: async ({ output }) => {
				afterSeen = output
			}
		})
		const out = await runTool(hooked.tools[0]!, { message: 'x' })
		expect(afterSeen).toBe('x!')
		expect(out).toBe('x!')

		// bindModule without hooks also validates once.
		const bound = bindModule(mod, {})
		const boundOut = await runTool(bound.tools[0]!, { message: 'x' })
		expect(boundOut).toBe('x!')
	})

	test('static auth is bound before every hook phase', async () => {
		const seen: unknown[] = []
		const hooked = withHooks(withAuth(echoModule, { api_key: 'secret' }), {
			beforeExecute: ({ ctx }) => {
				seen.push(ctx.auth)
			},
			afterExecute: ({ ctx }) => {
				seen.push(ctx.auth)
			}
		})

		await runTool(hooked.tools[0]!, { message: 'x' })
		expect(seen).toEqual([{ api_key: 'secret' }, { api_key: 'secret' }])
	})

	test('afterExecute failures reach onError with the same bound context', async () => {
		const seen: unknown[] = []
		const hooked = withHooks(withAuth(echoModule, { api_key: 'secret' }), {
			afterExecute: ({ ctx }) => {
				seen.push(ctx.auth)
				throw new Error('audit failed')
			},
			onError: ({ ctx }) => {
				seen.push(ctx.auth)
			}
		})

		expect(runTool(hooked.tools[0]!, { message: 'x' })).rejects.toThrow('audit failed')
		expect(seen).toEqual([{ api_key: 'secret' }, { api_key: 'secret' }])
	})

	test('direct execute applies binding but not runTool hooks', async () => {
		const events: string[] = []
		const hooked = withHooks(withAuth(echoModule, { api_key: 'secret' }), {
			beforeExecute: () => {
				events.push('before')
			}
		})

		const output = await hooked.tools[0]!.execute({ message: 'x' }, {})
		expect(output).toEqual({ message: 'x', key_prefix: 'sec' })
		expect(events).toEqual([])
	})
})

describe('mergeToolContext (undefined overlay)', () => {
	test('explicit undefined does not erase base signal', async () => {
		const { mergeToolContext } = await import('../../src/core/context')
		const ac = new AbortController()
		const merged = mergeToolContext(
			{ signal: ac.signal, extras: { keep: 1 } },
			{ signal: undefined, fetch: undefined, extras: { org_id: 'x' } }
		)
		expect(merged.signal).toBe(ac.signal)
		expect(merged.extras).toEqual({ keep: 1, org_id: 'x' })
	})
})

describe('bindModule (H-01)', () => {
	test('resolves auth and context per invocation', async () => {
		let authCalls = 0
		const bound = bindModule(echoModule, {
			resolveAuth: async (ctx) => {
				authCalls += 1
				const org = ctx.extras?.['org_id']
				return { api_key: org === 'acme' ? 'acm-key' : 'oth-key' }
			},
			resolveContext: async () => ({
				extras: { resolved: true }
			})
		})
		const tool = bound.tools[0]!
		const a = (await runTool(tool, { message: 'a' }, { extras: { org_id: 'acme' } })) as {
			message: string
			org?: string
			key_prefix?: string
		}
		const b = (await runTool(tool, { message: 'b' }, { extras: { org_id: 'other' } })) as {
			message: string
			org?: string
			key_prefix?: string
		}
		expect(a.key_prefix).toBe('acm')
		expect(b.key_prefix).toBe('oth')
		expect(a.org).toBe('acme')
		expect(authCalls).toBe(2)
	})

	test('resolveContext merges over incoming signal and extras', async () => {
		const ac = new AbortController()
		const seen: ToolContext[] = []
		const client = bindModule(echoModule, {
			resolveAuth: async () => ({ api_key: 'xyz' }),
			resolveContext: async () => ({ extras: { org_id: 'from-resolve' } }),
			hooks: {
				beforeExecute: async ({ ctx }) => {
					seen.push(ctx)
				}
			}
		})
		await runTool(client.tools[0]!, { message: 'm' }, { signal: ac.signal, extras: { keep: 1 } })
		expect(seen[0]?.signal).toBe(ac.signal)
		expect(seen[0]?.extras).toEqual({ keep: 1, org_id: 'from-resolve' })
	})

	test('onError sees resolveAuth failures', async () => {
		const events: string[] = []
		const bound = bindModule(echoModule, {
			resolveAuth: async () => {
				throw new Error('vault down')
			},
			hooks: {
				onError: async () => {
					events.push('auth-fail')
				}
			}
		})
		try {
			await runTool(bound.tools[0]!, { message: 'x' })
			expect(true).toBe(false)
		} catch {
			expect(events).toEqual(['auth-fail'])
		}
	})

	test('requires resolveAuth when module has auth', () => {
		try {
			bindModule(echoModule, {})
			expect(true).toBe(false)
		} catch (error) {
			expect(isToolError(error)).toBe(true)
			if (isToolError(error)) expect(error.code).toBe('bad_auth')
		}
	})

	test('hooks see bound auth context', async () => {
		const seen: ToolContext[] = []
		const bound = bindModule(echoModule, {
			resolveAuth: async () => ({ api_key: 'bound' }),
			resolveContext: async () => ({ extras: { org_id: 'tenant' } }),
			hooks: {
				beforeExecute: async ({ ctx }) => {
					seen.push(ctx)
				},
				afterExecute: async ({ ctx }) => {
					seen.push(ctx)
				}
			}
		})
		await runTool(bound.tools[0]!, { message: 'x' })
		expect(seen).toHaveLength(2)
		for (const ctx of seen) {
			expect(ctx.auth).toEqual({ api_key: 'bound' })
			expect(ctx.extras).toEqual({ org_id: 'tenant' })
		}
	})
})
