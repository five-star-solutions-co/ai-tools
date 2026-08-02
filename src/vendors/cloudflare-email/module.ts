import { defineModule, defineTool } from '../../core/define'
import { CloudflareEmailClient } from './client'
import {
	cloudflareEmailAuthSchema,
	cloudflareEmailSendBatchInputSchema,
	cloudflareEmailSendBatchOutputSchema,
	cloudflareEmailSendInputSchema,
	cloudflareEmailSendOutputSchema
} from './contracts'

/** Single-email send tool. Host binds auth via withAuth. */
export const cloudflareEmailSendTool = defineTool({
	id: 'cloudflare-email-send',
	name: 'cloudflareEmailSend',
	description:
		'Send one email via Cloudflare Email Sending. Subject plus html and/or text. Optional cc, bcc, reply_to, headers, base64 attachments. Total under 5 MiB.',
	inputSchema: cloudflareEmailSendInputSchema,
	outputSchema: cloudflareEmailSendOutputSchema,
	sideEffect: 'send',
	runtime: 'both',
	execute: async (input, ctx) => CloudflareEmailClient.fromContext(ctx).send(input)
})

/** Batch send (max 20). Per-message success/error; does not abort the batch. */
export const cloudflareEmailSendBatchTool = defineTool({
	id: 'cloudflare-email-send-batch',
	name: 'cloudflareEmailSendBatch',
	description:
		'Send up to 20 emails via Cloudflare Email Sending. Per-message success or error without aborting the batch.',
	inputSchema: cloudflareEmailSendBatchInputSchema,
	outputSchema: cloudflareEmailSendBatchOutputSchema,
	sideEffect: 'send',
	runtime: 'both',
	execute: async (input, ctx) => CloudflareEmailClient.fromContext(ctx).sendBatch(input)
})

export const cloudflareEmailModule = defineModule({
	id: 'cloudflare-email',
	title: 'Cloudflare Email',
	description:
		'Cloudflare Email Sending vendor pack: send one email or a batch (max 20). Not a multi-provider email seam.',
	runtime: 'both',
	auth: { type: 'custom', schema: cloudflareEmailAuthSchema },
	categories: ['email', 'cloudflare'],
	classification: 'pii',
	tags: ['send'],
	tools: [cloudflareEmailSendTool, cloudflareEmailSendBatchTool]
})
