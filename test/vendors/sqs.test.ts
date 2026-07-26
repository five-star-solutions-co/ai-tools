import { describe, expect, test } from 'bun:test'
import { isPlainObject } from 'es-toolkit'

import { validateModule } from '../../src/core'
import { SqsClient, sqsModule } from '../../src/vendors/sqs'

const auth = {
	access_key_id: 'AKIAtest',
	secret_access_key: 'secret',
	region: 'us-east-1',
	queue_url: 'https://sqs.us-east-1.amazonaws.com/123/jobs'
} as const

function record(value: unknown): Record<string, unknown> {
	if (!isPlainObject(value)) throw new Error('expected object')
	return value
}

describe('sqs', () => {
	test('module contracts and tool ids', () => {
		expect(validateModule(sqsModule).ok).toBe(true)
		expect(sqsModule.tools.map((tool) => tool.id).sort()).toEqual([
			'sqs-change-visibility',
			'sqs-delete',
			'sqs-receive',
			'sqs-send'
		])
	})

	test('send, receive, delete, and change visibility use the AWS JSON API', async () => {
		const actions: string[] = []
		const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
			const request = input instanceof Request ? input : new Request(input, init)
			const target = request.headers.get('x-amz-target') ?? ''
			actions.push(target)
			const body = record(JSON.parse(await request.text()))
			expect(body['QueueUrl']).toBe(auth.queue_url)
			if (target.endsWith('SendMessage')) {
				expect(body['MessageBody']).toBe('work')
				return Response.json({ MessageId: 'm1', MD5OfMessageBody: 'abc' })
			}
			if (target.endsWith('ReceiveMessage')) {
				expect(body['WaitTimeSeconds']).toBe(5)
				return Response.json({
					Messages: [
						{
							MessageId: 'm1',
							ReceiptHandle: 'r1',
							Body: 'work',
							MD5OfBody: 'abc',
							Attributes: { ApproximateReceiveCount: '1' }
						}
					]
				})
			}
			if (target.endsWith('DeleteMessage')) {
				expect(body['ReceiptHandle']).toBe('r1')
				return Response.json({})
			}
			if (target.endsWith('ChangeMessageVisibility')) {
				expect(body['VisibilityTimeout']).toBe(120)
				return Response.json({})
			}
			return new Response('unexpected target', { status: 500 })
		}
		const client = new SqsClient(auth, { fetch })

		expect(await client.enqueue({ body: 'work' })).toEqual({ message_id: 'm1', body_md5: 'abc' })
		expect(await client.receive({ wait_seconds: 5 })).toEqual({
			messages: [
				{
					message_id: 'm1',
					receipt_handle: 'r1',
					body: 'work',
					body_md5: 'abc',
					attributes: { ApproximateReceiveCount: '1' }
				}
			]
		})
		expect(await client.acknowledge({ receipt_handle: 'r1' })).toEqual({ acknowledged: true })
		expect(await client.extendVisibility({ receipt_handle: 'r1', visibility_timeout_seconds: 120 })).toEqual({
			extended: true,
			visibility_timeout_seconds: 120
		})
		expect(actions).toEqual([
			'AmazonSQS.SendMessage',
			'AmazonSQS.ReceiveMessage',
			'AmazonSQS.DeleteMessage',
			'AmazonSQS.ChangeMessageVisibility'
		])
	})
})
