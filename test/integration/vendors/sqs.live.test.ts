import { describe, expect, test } from 'bun:test'

import { SqsClient } from '../../../src/vendors/sqs'
import { awsCredentialsFromEnv, sqsQueueUrlFromEnv, uniqueId } from '../env'

const aws = awsCredentialsFromEnv()
const queueUrl = aws ? sqsQueueUrlFromEnv(aws) : undefined
const run = aws && queueUrl ? describe : describe.skip

run('live vendor sqs', () => {
	test(
		'send receive extend visibility and delete',
		async () => {
			const client = new SqsClient({ ...aws!, queue_url: queueUrl! })
			const marker = uniqueId('ai-tools-sqs')
			const sent = await client.enqueue({ body: marker })
			expect(sent.message_id.length).toBeGreaterThan(0)

			// Short visibility while polling so parallel IT on the same queue cannot hide our marker for long.
			let receipt: string | undefined
			for (let attempt = 0; attempt < 12 && !receipt; attempt += 1) {
				const received = await client.receive({
					max_messages: 10,
					wait_seconds: 2,
					visibility_timeout_seconds: 5
				})
				receipt = received.messages.find((message) => message.body === marker)?.receipt_handle
			}
			expect(receipt).toBeDefined()
			if (!receipt) return

			expect(await client.extendVisibility({ receipt_handle: receipt, visibility_timeout_seconds: 60 })).toEqual({
				extended: true,
				visibility_timeout_seconds: 60
			})
			expect(await client.acknowledge({ receipt_handle: receipt })).toEqual({ acknowledged: true })
		},
		{ timeout: 90_000 }
	)
})
