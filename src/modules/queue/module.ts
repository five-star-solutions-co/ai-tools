import { defineModule, defineTool } from '../../core/define'
import { QueueClient } from './client'
import {
	queueAcknowledgeOutputSchema,
	queueAuthSchema,
	queueEnqueueInputSchema,
	queueEnqueueOutputSchema,
	queueExtendVisibilityInputSchema,
	queueExtendVisibilityOutputSchema,
	queueReceiptInputSchema,
	queueReceiveInputSchema,
	queueReceiveOutputSchema
} from './contracts'

export const queueEnqueueTool = defineTool({
	id: 'queue-enqueue',
	name: 'enqueueMessage',
	description:
		'Enqueue one message on the bound queue, with optional delivery delay and ordering controls when supported.',
	inputSchema: queueEnqueueInputSchema,
	outputSchema: queueEnqueueOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	network: true,
	execute: async (input, ctx) => QueueClient.fromContext(ctx).enqueue(input)
})

export const queueReceiveTool = defineTool({
	id: 'queue-receive',
	name: 'receiveMessages',
	description: 'Receive a bounded batch of messages from the bound queue for processing.',
	inputSchema: queueReceiveInputSchema,
	outputSchema: queueReceiveOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	network: true,
	execute: async (input, ctx) => QueueClient.fromContext(ctx).receive(input)
})

export const queueAcknowledgeTool = defineTool({
	id: 'queue-acknowledge',
	name: 'acknowledgeMessage',
	description: 'Acknowledge a received message after processing succeeds so it can be removed from the bound queue.',
	inputSchema: queueReceiptInputSchema,
	outputSchema: queueAcknowledgeOutputSchema,
	sideEffect: 'delete',
	runtime: 'both',
	network: true,
	execute: async (input, ctx) => QueueClient.fromContext(ctx).acknowledge(input)
})

export const queueExtendVisibilityTool = defineTool({
	id: 'queue-extend-visibility',
	name: 'extendMessageVisibility',
	description: 'Change how long a received message remains unavailable to other consumers while work continues.',
	inputSchema: queueExtendVisibilityInputSchema,
	outputSchema: queueExtendVisibilityOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	network: true,
	execute: async (input, ctx) => QueueClient.fromContext(ctx).extendVisibility(input)
})

export const queueModule = defineModule({
	id: 'queue',
	title: 'Queue',
	description: 'Enqueue, receive, acknowledge, and extend visibility for messages through the bound queue provider.',
	runtime: 'both',
	auth: { type: 'custom', schema: queueAuthSchema },
	tools: [queueEnqueueTool, queueReceiveTool, queueAcknowledgeTool, queueExtendVisibilityTool]
})
