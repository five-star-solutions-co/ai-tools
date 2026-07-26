import { describe, expect, test } from 'bun:test'
import { z } from 'zod'

import {
	bindModule,
	defineModule,
	defineTool,
	isToolError,
	runTool,
	toToolCatalogEntry,
	withAuth,
	withHooks
} from '../../src/core'

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
			resolveContext: async (ctx) => ({
				...ctx,
				extras: { ...ctx.extras, resolved: true }
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
		const seen: unknown[] = []
		const bound = bindModule(echoModule, {
			resolveAuth: async () => ({ api_key: 'bound' }),
			hooks: {
				beforeExecute: async ({ ctx }) => {
					seen.push(ctx.auth)
				}
			}
		})
		await runTool(bound.tools[0]!, { message: 'x' })
		expect(seen[0]).toEqual({ api_key: 'bound' })
	})
})
