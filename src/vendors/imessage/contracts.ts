import { z } from 'zod'

/**
 * Host auth for Photon Advanced iMessage HTTP middleware
 * (`@photon-ai/advanced-imessage` createHttpClient).
 * @see https://github.com/photon-hq/advanced-imessage-ts
 */
export const imessageAuthSchema = z.object({
	address: z
		.string()
		.min(1)
		.describe(
			'HTTP middleware address: host[:port] or full http(s):// URL (e.g. https://imessage.example.com or http://localhost:8080)'
		),
	token: z.string().min(1).describe('Bearer token for the Advanced iMessage HTTP middleware'),
	server: z
		.string()
		.min(1)
		.optional()
		.describe('Optional dedicated iMessage instance id (x-photon-server). Omit for the shared middleware pool'),
	tls: z
		.boolean()
		.optional()
		.describe('Use HTTPS for bare host addresses (default true). Set false for local http:// development')
})

export type ImessageAuth = z.infer<typeof imessageAuthSchema>

export const imessageChatActionSchema = z.enum([
	'typing',
	'upload_photo',
	'record_video',
	'upload_video',
	'record_voice',
	'upload_voice',
	'upload_document',
	'choose_sticker',
	'find_location',
	'record_video_note',
	'upload_video_note'
])

export const imessageSendTextInputSchema = z.object({
	chat_id: z.string().min(1).describe('iMessage chat guid (e.g. any;-;alice@example.com)'),
	text: z.string().min(1).describe('Message text')
})

export const imessageMessageOutputSchema = z.object({
	message_id: z.string().min(1).describe('Message guid (provider id for journaling)'),
	space_id: z.string().describe('Chat guid (same as chat_id)')
})

export const imessageEditTextInputSchema = z.object({
	chat_id: z.string().min(1).describe('iMessage chat guid'),
	message_id: z.string().min(1).describe('Message guid to edit'),
	text: z.string().min(1).describe('Replacement text')
})

export const imessageSendChatActionInputSchema = z.object({
	chat_id: z.string().min(1).describe('iMessage chat guid'),
	action: imessageChatActionSchema.describe('Chat action; non-typing values map to typing start')
})

export const imessageSetReactionInputSchema = z.object({
	chat_id: z.string().min(1).describe('iMessage chat guid'),
	message_id: z.string().min(1).describe('Message guid to react to'),
	emoji: z
		.string()
		.min(1)
		.max(64)
		.describe(
			'Tapback name (love, like, dislike, laugh, emphasize, question) or an emoji character (maps to kind emoji)'
		)
})

export const imessageUnsendInputSchema = z.object({
	chat_id: z.string().min(1).describe('iMessage chat guid'),
	message_id: z.string().min(1).describe('Message guid to unsend')
})

export const imessageReadInputSchema = z.object({
	chat_id: z.string().min(1).describe('iMessage chat guid'),
	message_id: z
		.string()
		.min(1)
		.optional()
		.describe('Optional; Advanced iMessage markRead marks the whole chat (field kept for seam parity)')
})

export const imessageOkOutputSchema = z.object({
	ok: z.boolean(),
	space_id: z.string().optional()
})

export const MAX_MEDIA_BYTES = 20 * 1024 * 1024

/**
 * Clear a reaction via setReaction(isSet=false).
 * `message_id` is the **target** message guid (not a reaction-message id).
 * `emoji` must match what was set (tapback name or emoji character).
 */
export const imessageClearReactionInputSchema = z.object({
	chat_id: z.string().min(1).describe('iMessage chat guid'),
	message_id: z.string().min(1).describe('Target message guid that was reacted to'),
	emoji: z.string().min(1).max(64).describe('Same tapback name or emoji used when setting the reaction')
})

export const imessageSendMediaInputSchema = z.object({
	chat_id: z.string().min(1).describe('iMessage chat guid'),
	kind: z.enum(['photo', 'document']).describe('Media kind (presentation)'),
	body_base64: z.string().min(1).describe('File body as base64'),
	file_name: z.string().min(1).describe('File name including extension'),
	caption: z.string().optional().describe('Optional caption sent as a follow-up text message'),
	content_type: z.string().optional().describe('Optional MIME type; inferred from file_name when omitted')
})

export const imessageDownloadFileInputSchema = z.object({
	file_id: z.string().min(1).describe('Attachment guid (from inbound payload or upload)'),
	file_name: z.string().min(1).optional().describe('Preferred file name for the download result'),
	chat_id: z.string().min(1).optional().describe('Chat guid (optional for attachment download; kept for seam parity)')
})

export const imessageDownloadFileOutputSchema = z.object({
	file_name: z.string(),
	file_size: z.number().optional(),
	body_base64: z.string().describe('Downloaded file body as base64')
})

export type ImessageSendTextInput = z.infer<typeof imessageSendTextInputSchema>
export type ImessageMessageOutput = z.infer<typeof imessageMessageOutputSchema>
export type ImessageEditTextInput = z.infer<typeof imessageEditTextInputSchema>
export type ImessageSendChatActionInput = z.infer<typeof imessageSendChatActionInputSchema>
export type ImessageSetReactionInput = z.infer<typeof imessageSetReactionInputSchema>
export type ImessageUnsendInput = z.infer<typeof imessageUnsendInputSchema>
export type ImessageReadInput = z.infer<typeof imessageReadInputSchema>
export type ImessageClearReactionInput = z.infer<typeof imessageClearReactionInputSchema>
export type ImessageSendMediaInput = z.infer<typeof imessageSendMediaInputSchema>
export type ImessageDownloadFileInput = z.infer<typeof imessageDownloadFileInputSchema>
export type ImessageDownloadFileOutput = z.infer<typeof imessageDownloadFileOutputSchema>
