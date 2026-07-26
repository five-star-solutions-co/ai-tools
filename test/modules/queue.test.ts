import { describe, expect, test } from 'bun:test'

import { runTool, validateModule } from '../../src/core'
import {
	queueAcknowledgeTool,
	queueEnqueueTool,
	queueExtendVisibilityTool,
	queueModule,
	queueReceiveTool
} from '../../src/modules/queue'

const auth = {
	provider: 'sqs',
	access_key_id: 'AKIAtest',
	secret_access_key: 'secret',
	region: 'us-east-1',
	queue_url: 'https://sqs.us-east-1.amazonaws.com/123/jobs'
} as const

describe('queue', () => {
	test('module contracts and capability tool ids', () => {
		expect(validateModule(queueModule).ok).toBe(true)
		expect(queueModule.tools.map((tool) => tool.id).sort()).toEqual([
			'queue-acknowledge',
			'queue-enqueue',
			'queue-extend-visibility',
			'queue-receive'
		])
	})

	test('bound provider serves every queue tool', async () => {
		const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
			const request = input instanceof Request ? input : new Request(input, init)
			const target = request.headers.get('x-amz-target') ?? ''
			if (target.endsWith('SendMessage')) return Response.json({ MessageId: 'm1' })
			if (target.endsWith('ReceiveMessage')) {
				return Response.json({ Messages: [{ MessageId: 'm1', ReceiptHandle: 'r1', Body: 'work' }] })
			}
			return Response.json({})
		}
		const ctx = { auth, fetch }

		expect((await runTool(queueEnqueueTool, { body: 'work' }, ctx)).message_id).toBe('m1')
		expect((await runTool(queueReceiveTool, {}, ctx)).messages[0]?.receipt_handle).toBe('r1')
		expect(await runTool(queueAcknowledgeTool, { receipt_handle: 'r1' }, ctx)).toEqual({
			acknowledged: true
		})
		expect(
			await runTool(queueExtendVisibilityTool, { receipt_handle: 'r1', visibility_timeout_seconds: 60 }, ctx)
		).toEqual({ extended: true, visibility_timeout_seconds: 60 })
	})
})
