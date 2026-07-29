import { describe, expect, test } from 'bun:test'
import { z } from 'zod'

import { defineModule, defineTool, validateModule, validateTool } from '../src/core'
import { echoModule, echoTool } from './fixtures/echo-module'

describe('contracts', () => {
	test('accepts well-formed tools', () => {
		expect(validateTool(echoTool).ok).toBe(true)
		expect(validateModule(echoModule).ok).toBe(true)
	})

	test('rejects credential language in model description', () => {
		const bad = defineTool({
			id: 'bad-tool',
			name: 'bad',
			description: 'Call the API using process.env secret key.',
			inputSchema: z.object({
				q: z.string().describe('Query text')
			}),
			outputSchema: z.object({ ok: z.boolean() }),
			execute: async () => ({ ok: true })
		})
		const result = validateTool(bad)
		expect(result.ok).toBe(false)
		expect(result.issues.some((i) => i.code === 'forbidden_model_copy')).toBe(true)
	})

	test('rejects non-kebab tool ids', () => {
		const bad = defineTool({
			id: 'Not_Kebab',
			name: 'x',
			description: 'Does a thing for testing id format.',
			inputSchema: z.object({}),
			outputSchema: z.object({ ok: z.boolean() }),
			execute: async () => ({ ok: true })
		})
		expect(validateTool(bad).issues.some((i) => i.code === 'invalid_tool_id')).toBe(true)
	})

	test('rejects missing field describe', () => {
		const bad = defineTool({
			id: 'no-field-desc',
			name: 'x',
			description: 'Tool without field descriptions for contract testing.',
			inputSchema: z.object({
				q: z.string()
			}),
			outputSchema: z.object({ ok: z.boolean() }),
			execute: async () => ({ ok: true })
		})
		expect(validateTool(bad).issues.some((i) => i.code === 'empty_field_description')).toBe(true)
	})

	test('rejects missing descriptions in nested object and array fields', () => {
		const bad = defineTool({
			id: 'nested-field-desc',
			name: 'nestedFieldDesc',
			description: 'Tool with nested inputs for recursive contract testing.',
			inputSchema: z.object({
				items: z
					.array(
						z.object({
							name: z.string().describe('Item name'),
							value: z.string()
						})
					)
					.describe('Items to process')
			}),
			outputSchema: z.object({ ok: z.boolean() }),
			execute: async () => ({ ok: true })
		})
		const result = validateTool(bad)
		expect(result.ok).toBe(false)
		expect(result.issues.some((i) => i.code === 'empty_field_description' && i.path.includes('value'))).toBe(true)
	})

	test('seam modules reject vendor brand names in model-facing copy', () => {
		const tool = defineTool({
			id: 'messaging-read',
			name: 'messagingRead',
			description: 'Mark read on Telegram and no-op on Slack.',
			inputSchema: z.object({
				chat_id: z.string().describe('Chat id')
			}),
			outputSchema: z.object({ ok: z.boolean() }),
			execute: async () => ({ ok: true })
		})
		const mod = defineModule({
			id: 'messaging',
			title: 'Messaging',
			description: 'Channel messaging tools.',
			auth: { type: 'none' },
			tools: [tool]
		})
		const result = validateModule(mod)
		expect(result.ok).toBe(false)
		expect(result.issues.some((i) => i.code === 'forbidden_model_copy')).toBe(true)
	})

	test('vendor modules may name their product in descriptions', () => {
		const tool = defineTool({
			id: 'telegram-send-text',
			name: 'telegramSendText',
			description: 'Send a text message via Telegram Bot API.',
			inputSchema: z.object({
				chat_id: z.string().describe('Telegram chat id')
			}),
			outputSchema: z.object({ ok: z.boolean() }),
			execute: async () => ({ ok: true })
		})
		expect(validateTool(tool).ok).toBe(true)
	})
})
