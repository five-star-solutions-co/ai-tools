import { defineModule, defineTool } from '../../core/define'
import { EmailClient } from './client'
import {
	emailAuthSchema,
	emailSendBatchInputSchema,
	emailSendBatchOutputSchema,
	emailSendInputSchema,
	emailSendOutputSchema
} from './contracts'

export type { EmailAuth } from './contracts'
export { emailAuthSchema }

export const emailSendTool = defineTool({
	id: 'email-send',
	name: 'sendEmail',
	description:
		'Send one email via the bound email provider. Subject plus html and/or text. Optional cc, bcc, reply_to, headers, base64 attachments. Total under 5 MiB.',
	inputSchema: emailSendInputSchema,
	outputSchema: emailSendOutputSchema,
	sideEffect: 'send',
	runtime: 'both',
	execute: async (input, ctx) => EmailClient.fromContext(ctx).send(input)
})

export const emailSendBatchTool = defineTool({
	id: 'email-send-batch',
	name: 'sendEmailBatch',
	description:
		'Send up to 20 emails via the bound email provider. Per-message success or error without aborting the batch.',
	inputSchema: emailSendBatchInputSchema,
	outputSchema: emailSendBatchOutputSchema,
	sideEffect: 'send',
	runtime: 'both',
	execute: async (input, ctx) => EmailClient.fromContext(ctx).sendBatch(input)
})

export const emailModule = defineModule({
	id: 'email',
	title: 'Email',
	description:
		'Send transactional email from the configured sender. The model supplies recipients and content, never the sender identity.',
	runtime: 'both',
	auth: { type: 'custom', schema: emailAuthSchema },
	categories: ['email', 'messaging'],
	classification: 'pii',
	tags: ['send'],
	tools: [emailSendTool, emailSendBatchTool]
})
