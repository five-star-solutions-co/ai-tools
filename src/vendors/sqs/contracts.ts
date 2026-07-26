import { z } from 'zod'

export const MAX_SQS_MESSAGE_CHARS = 1_048_576

export const sqsAuthSchema = z.object({
	access_key_id: z.string().min(1).describe('AWS access key id'),
	secret_access_key: z.string().min(1).describe('AWS secret access key'),
	region: z.string().min(1).describe('AWS region for SQS'),
	session_token: z.string().min(1).optional().describe('Optional session token'),
	queue_url: z.url().describe('Default SQS queue URL')
})

export const queueEnqueueInputSchema = z.object({
	body: z.string().min(1).max(MAX_SQS_MESSAGE_CHARS).describe('Message body'),
	delay_seconds: z.int().min(0).max(900).optional().describe('Delivery delay in seconds'),
	message_group_id: z.string().min(1).max(128).optional().describe('FIFO message group id'),
	deduplication_id: z.string().min(1).max(128).optional().describe('FIFO deduplication id')
})

export const queueEnqueueOutputSchema = z.object({
	message_id: z.string(),
	body_md5: z.string().optional(),
	sequence_number: z.string().optional()
})

export const queueReceiveInputSchema = z.object({
	max_messages: z.int().min(1).max(10).optional().describe('Maximum messages to receive; defaults to 1'),
	wait_seconds: z.int().min(0).max(20).optional().describe('Long-poll wait in seconds'),
	visibility_timeout_seconds: z
		.int()
		.min(0)
		.max(43_200)
		.optional()
		.describe('Temporary message invisibility duration in seconds')
})

export const queueMessageSchema = z.object({
	message_id: z.string(),
	receipt_handle: z.string().describe('Opaque handle used to acknowledge or extend this delivery'),
	body: z.string(),
	body_md5: z.string().optional(),
	attributes: z.record(z.string(), z.string()).optional().describe('Provider-supplied message attributes')
})

export const queueReceiveOutputSchema = z.object({
	messages: z.array(queueMessageSchema)
})

export const queueReceiptInputSchema = z.object({
	receipt_handle: z.string().min(1).describe('Receipt handle returned by receive')
})

export const queueAcknowledgeOutputSchema = z.object({
	acknowledged: z.literal(true)
})

export const queueExtendVisibilityInputSchema = queueReceiptInputSchema.extend({
	visibility_timeout_seconds: z.int().min(0).max(43_200).describe('New invisibility duration in seconds')
})

export const queueExtendVisibilityOutputSchema = z.object({
	extended: z.literal(true),
	visibility_timeout_seconds: z.int().min(0).max(43_200)
})

export type SqsAuth = z.infer<typeof sqsAuthSchema>
export type QueueEnqueueInput = z.infer<typeof queueEnqueueInputSchema>
export type QueueEnqueueOutput = z.infer<typeof queueEnqueueOutputSchema>
export type QueueReceiveInput = z.infer<typeof queueReceiveInputSchema>
export type QueueReceiveOutput = z.infer<typeof queueReceiveOutputSchema>
export type QueueMessage = z.infer<typeof queueMessageSchema>
export type QueueReceiptInput = z.infer<typeof queueReceiptInputSchema>
export type QueueAcknowledgeOutput = z.infer<typeof queueAcknowledgeOutputSchema>
export type QueueExtendVisibilityInput = z.infer<typeof queueExtendVisibilityInputSchema>
export type QueueExtendVisibilityOutput = z.infer<typeof queueExtendVisibilityOutputSchema>

export type QueueOps = {
	enqueue(input: QueueEnqueueInput): Promise<QueueEnqueueOutput>
	receive(input?: QueueReceiveInput): Promise<QueueReceiveOutput>
	acknowledge(input: QueueReceiptInput): Promise<QueueAcknowledgeOutput>
	extendVisibility(input: QueueExtendVisibilityInput): Promise<QueueExtendVisibilityOutput>
}
