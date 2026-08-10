import { z } from 'zod'

/**
 * Host auth for the hosted photon-rest-proxy (REST → Spectrum gRPC).
 * Credentials are forwarded per request; the proxy stores nothing.
 *
 * Proxy route map (package client → HTTP):
 * - sendText → POST /v1/send
 * - editText → POST /v1/edit
 * - sendChatAction / stopTyping → POST /v1/typing
 * - setReaction → POST /v1/react
 * - clearReaction → POST /v1/clear-reaction (target message_id + emoji; proxy gap if not yet supported)
 * - unsend → POST /v1/unsend
 * - read → POST /v1/read
 * - sendMedia → POST /v1/media
 * - downloadFile → POST /v1/download (chat_id optional; proxy gap if still required)
 * - ensureChat → POST /v1/ensure-chat (host-only; proxy gap until implemented)
 */
export const imessageAuthSchema = z.object({
	base_url: z.url().describe('Origin of the hosted photon-rest-proxy, for example https://photon-proxy.example.com'),
	project_id: z.string().min(1).describe('Spectrum project id (sent as x-spectrum-project-id)'),
	project_secret: z.string().min(1).describe('Spectrum project secret (sent as x-spectrum-project-secret)'),
	phone: z
		.string()
		.min(1)
		.optional()
		.describe('Optional default iMessage line phone when the project has multiple lines')
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
	text: z.string().min(1).describe('Message text'),
	phone: z.string().min(1).optional().describe('Optional line phone override for multi-line projects')
})

export const imessageMessageOutputSchema = z.object({
	message_id: z.string().min(1).describe('Message guid (provider id for journaling)'),
	space_id: z.string().describe('Chat guid (same as chat_id)')
})

export const imessageEditTextInputSchema = z.object({
	chat_id: z.string().min(1).describe('iMessage chat guid'),
	message_id: z.string().min(1).describe('Message guid to edit'),
	text: z.string().min(1).describe('Replacement text'),
	phone: z.string().min(1).optional().describe('Optional line phone override')
})

export const imessageSendChatActionInputSchema = z.object({
	chat_id: z.string().min(1).describe('iMessage chat guid'),
	action: imessageChatActionSchema.describe('Chat action; non-typing values map to typing start'),
	phone: z.string().min(1).optional().describe('Optional line phone override')
})

export const imessageSetReactionInputSchema = z.object({
	chat_id: z.string().min(1).describe('iMessage chat guid'),
	message_id: z.string().min(1).describe('Message guid to react to'),
	emoji: z
		.string()
		.min(1)
		.max(64)
		.describe(
			'Tapback name (love, like, dislike, laugh, emphasize, question) or an emoji character the channel accepts'
		),
	phone: z.string().min(1).optional().describe('Optional line phone override')
})

export const imessageUnsendInputSchema = z.object({
	chat_id: z.string().min(1).describe('iMessage chat guid'),
	message_id: z.string().min(1).describe('Message guid to unsend'),
	phone: z.string().min(1).optional().describe('Optional line phone override')
})

export const imessageReadInputSchema = z.object({
	chat_id: z.string().min(1).describe('iMessage chat guid'),
	message_id: z
		.string()
		.min(1)
		.optional()
		.describe('Optional; mark-read may apply to the whole chat (field kept for seam parity)'),
	phone: z.string().min(1).optional().describe('Optional line phone override')
})

export const imessageOkOutputSchema = z.object({
	ok: z.boolean(),
	space_id: z.string().optional()
})

export const MAX_MEDIA_BYTES = 20 * 1024 * 1024

/**
 * Clear a reaction. `message_id` is the **target** message that was reacted to;
 * `emoji` must match set-reaction. Proxy should clear by target+emoji (not reaction message id).
 */
export const imessageClearReactionInputSchema = z.object({
	chat_id: z.string().min(1).describe('iMessage chat guid'),
	message_id: z.string().min(1).describe('Target message guid that was reacted to'),
	emoji: z.string().min(1).max(64).describe('Same tapback name or emoji used when setting the reaction'),
	phone: z.string().min(1).optional().describe('Optional line phone override')
})

export const imessageSendMediaInputSchema = z.object({
	chat_id: z.string().min(1).describe('iMessage chat guid'),
	kind: z.enum(['photo', 'document']).describe('Media kind (presentation)'),
	body_base64: z.string().min(1).describe('File body as base64'),
	file_name: z.string().min(1).describe('File name including extension'),
	caption: z.string().optional().describe('Optional caption sent as a follow-up text message'),
	content_type: z.string().optional().describe('Optional MIME type; inferred from file_name when omitted'),
	phone: z.string().min(1).optional().describe('Optional line phone override')
})

export const imessageDownloadFileInputSchema = z.object({
	file_id: z.string().min(1).describe('Attachment guid (from inbound payload or upload)'),
	file_name: z.string().min(1).optional().describe('Preferred file name for the download result'),
	chat_id: z.string().min(1).optional().describe('Chat guid (optional when proxy can resolve by file_id alone)'),
	phone: z.string().min(1).optional().describe('Optional line phone override')
})

export const imessageDownloadFileOutputSchema = z.object({
	file_name: z.string(),
	file_size: z.number().optional(),
	body_base64: z.string().describe('Downloaded file body as base64')
})

/**
 * Create (or resolve) a chat via proxy POST /v1/ensure-chat (host-only).
 * One address = 1:1; two or more = group.
 */
export const imessageEnsureChatInputSchema = z.object({
	addresses: z
		.array(z.string().min(1))
		.min(1)
		.describe('Peer phone number(s) or email(s). One address creates a 1:1 chat; two or more create a group'),
	message: z.string().min(1).optional().describe('Optional opening text sent in the same create call'),
	client_message_id: z
		.string()
		.min(1)
		.optional()
		.describe('Optional idempotency key for chat creation and the optional opening send'),
	phone: z.string().min(1).optional().describe('Optional line phone override')
})

export const imessageEnsureChatOutputSchema = z.object({
	chat_id: z.string().min(1).describe('Chat guid for later send, edit, react, or unsend'),
	message_id: z
		.string()
		.min(1)
		.optional()
		.describe('Guid of the opening message when message was provided and the server returned one')
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
export type ImessageEnsureChatInput = z.infer<typeof imessageEnsureChatInputSchema>
export type ImessageEnsureChatOutput = z.infer<typeof imessageEnsureChatOutputSchema>
