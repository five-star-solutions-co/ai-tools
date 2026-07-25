import { defineModule, defineTool } from '../../core/define'
import { ResendClient } from './client'
import {
	resendAuthSchema,
	resendSendBatchInputSchema,
	resendSendBatchOutputSchema,
	resendSendInputSchema,
	resendSendOutputSchema
} from './contracts'

/** Single-email send tool. Host binds auth via withAuth. */
export const resendSendTool = defineTool({
	id: 'resend-send',
	name: 'resendSend',
	description:
		'Send one email via Resend. Subject plus html and/or text. Optional cc, bcc, reply_to, headers, base64 attachments. Total under 5 MiB.',
	inputSchema: resendSendInputSchema,
	outputSchema: resendSendOutputSchema,
	sideEffect: 'send',
	runtime: 'both',
	execute: async (input, ctx) => ResendClient.fromContext(ctx).send(input)
})

/** Batch send (max 20). Per-message success/error; does not abort the batch. */
export const resendSendBatchTool = defineTool({
	id: 'resend-send-batch',
	name: 'resendSendBatch',
	description: 'Send up to 20 emails via Resend. Per-message success or error without aborting the batch.',
	inputSchema: resendSendBatchInputSchema,
	outputSchema: resendSendBatchOutputSchema,
	sideEffect: 'send',
	runtime: 'both',
	execute: async (input, ctx) => ResendClient.fromContext(ctx).sendBatch(input)
})

export const resendModule = defineModule({
	id: 'resend',
	title: 'Resend',
	description: 'Resend vendor pack: send one email or a batch (max 20). Not a multi-provider email seam.',
	runtime: 'both',
	auth: { type: 'custom', schema: resendAuthSchema },
	tools: [resendSendTool, resendSendBatchTool]
})
