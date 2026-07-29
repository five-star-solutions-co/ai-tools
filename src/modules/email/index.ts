/**
 * Public email seam surface.
 * Internals (providers/*) stay private.
 */

export { EmailClient } from './client'
export type { EmailClientOptions } from './client'
export { emailAuthSchema, emailModule, emailSendBatchTool, emailSendTool } from './module'
export type { EmailAuth } from './module'
export type {
	CloudflareEmailSeamAuth,
	EmailSendBatchInput,
	EmailSendBatchOutput,
	EmailSendInput,
	EmailSendOutput,
	NamedAddress,
	ResendEmailAuth
} from './contracts'
export {
	attachmentSchema,
	cloudflareEmailSeamAuthSchema,
	emailSendBatchInputSchema,
	emailSendBatchOutputSchema,
	emailSendInputSchema,
	emailSendOutputSchema,
	emailSenderSchema,
	MAX_BATCH_EMAILS,
	MAX_EMAIL_BYTES,
	namedAddressSchema,
	resendEmailAuthSchema
} from './contracts'
