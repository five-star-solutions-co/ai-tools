import { describe, expect, test } from 'bun:test'

import { QueueClient } from '../../../src/modules/queue'
import { awsCredentialsFromEnv, sqsQueueUrlFromEnv, uniqueId } from '../env'

const aws = awsCredentialsFromEnv()
const queueUrl = aws ? sqsQueueUrlFromEnv(aws) : undefined
const run = aws && queueUrl ? describe : describe.skip

run('live seam queue', () => {
	test(
		'enqueue receive extend visibility and acknowledge through bound provider',
		async () => {
			const client = QueueClient.fromAuth({ provider: 'sqs', ...aws!, queue_url: queueUrl! })
			const marker = uniqueId('ai-tools-queue')
			const sent = await client.enqueue({ body: marker })
			expect(sent.message_id.length).toBeGreaterThan(0)

			// Short visibility while polling so parallel vendor/seam SQS IT cannot hide our marker for long.
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

			await client.extendVisibility({ receipt_handle: receipt, visibility_timeout_seconds: 60 })
			expect(await client.acknowledge({ receipt_handle: receipt })).toEqual({ acknowledged: true })
		},
		{ timeout: 90_000 }
	)
})
