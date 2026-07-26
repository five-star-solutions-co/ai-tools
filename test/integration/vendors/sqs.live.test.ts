import { describe, expect, test } from 'bun:test'

import { SqsClient } from '../../../src/vendors/sqs'
import { awsCredentialsFromEnv, env, uniqueId } from '../env'

const aws = awsCredentialsFromEnv({ regionEnv: 'AI_TOOLS_SQS_REGION' })
const queueUrl = env('AI_TOOLS_SQS_QUEUE_URL')
const run = aws && queueUrl ? describe : describe.skip

run('live vendor sqs', () => {
	test(
		'send receive extend visibility and delete',
		async () => {
			const client = new SqsClient({ ...aws!, queue_url: queueUrl! })
			const marker = uniqueId('ai-tools-sqs')
			const sent = await client.enqueue({ body: marker })
			expect(sent.message_id.length).toBeGreaterThan(0)

			let receipt: string | undefined
			for (let attempt = 0; attempt < 4 && !receipt; attempt += 1) {
				const received = await client.receive({ max_messages: 10, wait_seconds: 5, visibility_timeout_seconds: 30 })
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
		{ timeout: 60_000 }
	)
})
