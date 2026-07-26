import { z } from 'zod'

import {
	queueAcknowledgeOutputSchema,
	queueEnqueueInputSchema,
	queueEnqueueOutputSchema,
	queueExtendVisibilityInputSchema,
	queueExtendVisibilityOutputSchema,
	queueMessageSchema,
	queueReceiptInputSchema,
	queueReceiveInputSchema,
	queueReceiveOutputSchema,
	sqsAuthSchema
} from '../../vendors/sqs'
import type { QueueOps } from '../../vendors/sqs'

export {
	queueAcknowledgeOutputSchema,
	queueEnqueueInputSchema,
	queueEnqueueOutputSchema,
	queueExtendVisibilityInputSchema,
	queueExtendVisibilityOutputSchema,
	queueMessageSchema,
	queueReceiptInputSchema,
	queueReceiveInputSchema,
	queueReceiveOutputSchema
}
export type {
	QueueAcknowledgeOutput,
	QueueEnqueueInput,
	QueueEnqueueOutput,
	QueueExtendVisibilityInput,
	QueueExtendVisibilityOutput,
	QueueMessage,
	QueueOps,
	QueueReceiptInput,
	QueueReceiveInput,
	QueueReceiveOutput
} from '../../vendors/sqs'

export const sqsQueueAuthSchema = sqsAuthSchema.extend({
	provider: z.literal('sqs')
})

export const queueAuthSchema = sqsQueueAuthSchema

export type SqsQueueAuth = z.infer<typeof sqsQueueAuthSchema>
export type QueueAuth = z.infer<typeof queueAuthSchema>

export type QueueSeamOps = QueueOps
