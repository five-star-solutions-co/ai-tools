import { defineModule, defineTool } from '../../core/define'
import { SqsClient } from './client'
import {
	queueAcknowledgeOutputSchema,
	queueEnqueueInputSchema,
	queueEnqueueOutputSchema,
	queueExtendVisibilityInputSchema,
	queueExtendVisibilityOutputSchema,
	queueReceiptInputSchema,
	queueReceiveInputSchema,
	queueReceiveOutputSchema,
	sqsAuthSchema
} from './contracts'

export const sqsSendTool = defineTool({
	id: 'sqs-send',
	name: 'sqsSend',
	description: 'Send one message to the configured SQS queue, with optional delay and FIFO controls.',
	inputSchema: queueEnqueueInputSchema,
	outputSchema: queueEnqueueOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	network: true,
	execute: async (input, ctx) => SqsClient.fromContext(ctx).enqueue(input)
})

export const sqsReceiveTool = defineTool({
	id: 'sqs-receive',
	name: 'sqsReceive',
	description:
		'Receive up to 10 messages from the configured SQS queue, with optional long polling and visibility timeout.',
	inputSchema: queueReceiveInputSchema,
	outputSchema: queueReceiveOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	network: true,
	execute: async (input, ctx) => SqsClient.fromContext(ctx).receive(input)
})

export const sqsDeleteTool = defineTool({
	id: 'sqs-delete',
	name: 'sqsDelete',
	description: 'Delete a received SQS message using its receipt handle after processing succeeds.',
	inputSchema: queueReceiptInputSchema,
	outputSchema: queueAcknowledgeOutputSchema,
	sideEffect: 'delete',
	runtime: 'both',
	network: true,
	execute: async (input, ctx) => SqsClient.fromContext(ctx).acknowledge(input)
})

export const sqsChangeVisibilityTool = defineTool({
	id: 'sqs-change-visibility',
	name: 'sqsChangeVisibility',
	description: 'Change the visibility timeout for a received SQS message using its receipt handle.',
	inputSchema: queueExtendVisibilityInputSchema,
	outputSchema: queueExtendVisibilityOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	network: true,
	execute: async (input, ctx) => SqsClient.fromContext(ctx).extendVisibility(input)
})

export const sqsModule = defineModule({
	id: 'sqs',
	title: 'SQS',
	description: 'Send, receive, delete, and extend message visibility in Amazon SQS.',
	runtime: 'both',
	auth: { type: 'custom', schema: sqsAuthSchema },
	categories: ['queue', 'aws'],
	classification: 'standard',
	tags: ['sqs'],
	tools: [sqsSendTool, sqsReceiveTool, sqsDeleteTool, sqsChangeVisibilityTool]
})
