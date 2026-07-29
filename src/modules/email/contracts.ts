/**
 * Email seam contracts — vendor I/O + provider auth union.
 */

import { z } from 'zod'

import { batchResultSchema } from '../../shared/batch'
import { cloudflareEmailAuthSchema as cloudflareEmailVendorAuthSchema } from '../../vendors/cloudflare-email'
import {
	attachmentSchema,
	MAX_BATCH_EMAILS,
	MAX_EMAIL_BYTES,
	namedAddressSchema,
	resendAuthSchema,
	resendSendInputSchema
} from '../../vendors/resend'
import type { NamedAddress, ResendSendInput } from '../../vendors/resend'

export { attachmentSchema, MAX_BATCH_EMAILS, MAX_EMAIL_BYTES, namedAddressSchema }
export type { NamedAddress }

export const emailSenderSchema = namedAddressSchema.describe(
	'Verified sender locked to this provider binding. Model inputs cannot override it'
)

/** Host auth: vendor credentials, provider discriminator, and locked sender. */
export const resendEmailAuthSchema = resendAuthSchema.extend({
	provider: z.literal('resend'),
	sender: emailSenderSchema
})

export const cloudflareEmailSeamAuthSchema = cloudflareEmailVendorAuthSchema.extend({
	provider: z.literal('cloudflare'),
	sender: emailSenderSchema
})

export type ResendEmailAuth = z.infer<typeof resendEmailAuthSchema>
export type CloudflareEmailSeamAuth = z.infer<typeof cloudflareEmailSeamAuthSchema>

export const emailAuthSchema = z.discriminatedUnion('provider', [resendEmailAuthSchema, cloudflareEmailSeamAuthSchema])

export type EmailAuth = z.infer<typeof emailAuthSchema>

const { from: _from, headers: _headers, ...emailSendInputShape } = resendSendInputSchema.shape

/** Provider-neutral model input. Sender and raw headers remain host/vendor-only. */
export const emailSendInputSchema = z
	.object(emailSendInputShape)
	.refine((input) => Boolean(input.html?.trim() || input.text?.trim()), {
		message: 'Provide html and/or text body'
	})
export type EmailSendInput = z.infer<typeof emailSendInputSchema>
export type EmailProviderSendInput = ResendSendInput

/**
 * Unified result; each provider fills what it has.
 * Resend → id; Cloudflare → accepted/rejected.
 */
export const emailSendOutputSchema = z.object({
	success: z.boolean().describe('Whether the provider accepted the request'),
	id: z.string().optional().describe('Provider message id when available'),
	accepted: z.array(z.string()).optional().describe('Addresses delivered and/or queued when known'),
	rejected: z.array(z.string()).optional().describe('Addresses permanently rejected when known')
})

export const emailSendBatchInputSchema = z.object({
	messages: z.array(emailSendInputSchema).min(1).max(MAX_BATCH_EMAILS).describe('Messages to send (max 20)')
})

export const emailSendBatchOutputSchema = batchResultSchema(emailSendOutputSchema)

export type EmailSendOutput = z.infer<typeof emailSendOutputSchema>
export type EmailSendBatchInput = z.infer<typeof emailSendBatchInputSchema>
export type EmailSendBatchOutput = z.infer<typeof emailSendBatchOutputSchema>

/** Shared seam surface — provider classes implement this. */
export type EmailOps = {
	send: (input: EmailSendInput) => Promise<EmailSendOutput>
	sendBatch: (input: EmailSendBatchInput) => Promise<EmailSendBatchOutput>
}

/** Internal seam provider surface after EmailClient injects the locked sender. */
export type EmailProviderOps = {
	send: (input: EmailProviderSendInput) => Promise<EmailSendOutput>
}
