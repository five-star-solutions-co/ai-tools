/**
 * Email category schemas — used by any email vendor pack (resend, cloudflare-email, …).
 * Not a published surface (folder `_email` is skipped by codegen).
 */

import { z } from 'zod'

export const MAX_EMAIL_BYTES = 5 * 1024 * 1024
export const MAX_BATCH_EMAILS = 20

const emailAddressSchema = z.email().describe('Email address')

export const namedAddressSchema = z.union([
	emailAddressSchema,
	z.object({
		email: emailAddressSchema,
		name: z.string().max(200).optional().describe('Display name')
	})
])

export type NamedAddress = z.infer<typeof namedAddressSchema>

export const attachmentSchema = z.object({
	content: z.string().min(1).describe('Base64-encoded file bytes (no data: URL prefix)'),
	filename: z.string().min(1).max(255).describe('Attachment file name'),
	type: z.string().min(1).describe('MIME type, for example application/pdf'),
	disposition: z.enum(['attachment', 'inline']).optional().describe('Content disposition. Defaults to attachment'),
	content_id: z
		.string()
		.min(1)
		.max(128)
		.optional()
		.describe('Content-ID for inline CID images (HTML src="cid:…"); omit angle brackets')
})

export type EmailAttachment = z.infer<typeof attachmentSchema>
