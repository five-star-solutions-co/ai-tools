/**
 * Messaging seam contracts — shared I/O + provider auth union.
 */

import { z } from 'zod'

import { batchResultSchema } from '../../shared/batch'
import { imessageAuthSchema } from '../../vendors/imessage'
import { slackAuthSchema } from '../../vendors/slack'
import { teamsAuthSchema } from '../../vendors/teams'
import { telegramAuthSchema } from '../../vendors/telegram'

export const MAX_MESSAGING_MEDIA_BATCH = 10

export const messagingChatActionSchema = z.enum([
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

/** Host auth: channel credentials + provider discriminator. */
export const telegramMessagingAuthSchema = telegramAuthSchema.extend({
	provider: z.literal('telegram')
})

export const slackMessagingAuthSchema = slackAuthSchema.extend({
	provider: z.literal('slack')
})

export const teamsMessagingAuthSchema = teamsAuthSchema.extend({
	provider: z.literal('teams')
})

export const imessageMessagingAuthSchema = imessageAuthSchema.extend({
	provider: z.literal('imessage')
})

export type TelegramMessagingAuth = z.infer<typeof telegramMessagingAuthSchema>
export type SlackMessagingAuth = z.infer<typeof slackMessagingAuthSchema>
export type TeamsMessagingAuth = z.infer<typeof teamsMessagingAuthSchema>
export type ImessageMessagingAuth = z.infer<typeof imessageMessagingAuthSchema>

export const messagingAuthSchema = z.discriminatedUnion('provider', [
	telegramMessagingAuthSchema,
	slackMessagingAuthSchema,
	teamsMessagingAuthSchema,
	imessageMessagingAuthSchema
])

export type MessagingAuth = z.infer<typeof messagingAuthSchema>

const serviceUrlOptional = z
	.string()
	.min(1)
	.optional()
	.describe('Activity service base URL when the bound channel requires it for this call')

export const messagingSendTextInputSchema = z.object({
	chat_id: z.string().min(1).describe('Channel conversation / chat id'),
	text: z.string().min(1).describe('Message text'),
	reply_to_message_id: z.string().min(1).optional().describe('Optional message id to reply to (thread/reply)'),
	reply_markup: z.unknown().optional().describe('Optional channel-native markup (blocks, attachments, …)'),
	service_url: serviceUrlOptional
})

/** Common send/edit/media result shell for journaling. */
export const messagingMessageOutputSchema = z.object({
	message_id: z.string().describe('Provider message id as string'),
	file_id: z.string().optional().describe('File id when the send created a downloadable attachment'),
	attachment_message_ids: z
		.array(z.string())
		.optional()
		.describe('Additional attachment message ids when a single call produced more than one message')
})

export const messagingEditTextInputSchema = z.object({
	chat_id: z.string().min(1).describe('Channel conversation / chat id'),
	message_id: z.string().min(1).describe('Message id to edit'),
	text: z.string().min(1).describe('Replacement text'),
	reply_markup: z.unknown().optional().describe('Optional channel-native markup'),
	service_url: serviceUrlOptional
})

export const messagingSendChatActionInputSchema = z.object({
	chat_id: z.string().min(1).describe('Channel conversation / chat id'),
	action: messagingChatActionSchema.describe('Chat action (typing, upload_document, …)'),
	reply_to_message_id: z
		.string()
		.min(1)
		.optional()
		.describe('Optional thread or reply anchor when the channel uses thread-scoped status'),
	service_url: serviceUrlOptional
})

export const messagingStopTypingInputSchema = z.object({
	chat_id: z.string().min(1).describe('Channel conversation / chat id'),
	reply_to_message_id: z
		.string()
		.min(1)
		.optional()
		.describe('Optional thread or reply anchor when the channel uses thread-scoped status'),
	service_url: serviceUrlOptional
})

export const messagingSetReactionInputSchema = z.object({
	chat_id: z.string().min(1).describe('Channel conversation / chat id'),
	message_id: z.string().min(1).describe('Message id to react to'),
	emoji: z.string().min(1).max(64).describe('Any emoji the bound channel accepts')
})

/** Reaction result — store message_id when present for clearReaction. */
export const messagingReactionOutputSchema = z.object({
	message_id: z
		.string()
		.optional()
		.describe('Reaction message id when the channel creates a separate reaction message; pass to clearReaction')
})

export const messagingClearReactionInputSchema = z.object({
	chat_id: z.string().min(1).describe('Channel conversation / chat id'),
	message_id: z
		.string()
		.min(1)
		.describe('Message id to clear; use reaction message_id from setReaction when that was returned'),
	emoji: z.string().min(1).max(64).optional().describe('Emoji to clear when the channel requires a reaction name')
})

export const messagingSendMediaInputSchema = z.object({
	chat_id: z.string().min(1).describe('Channel conversation / chat id'),
	kind: z.enum(['photo', 'document']).describe('Media kind'),
	body_base64: z.string().min(1).describe('File body as base64'),
	file_name: z.string().min(1).describe('File name including extension'),
	caption: z.string().optional().describe('Optional caption'),
	reply_to_message_id: z.string().min(1).optional().describe('Optional reply / thread anchor'),
	content_type: z.string().optional().describe('Optional content type'),
	service_url: serviceUrlOptional
})

export const messagingSendMediaBatchItemSchema = messagingSendMediaInputSchema.omit({
	chat_id: true,
	service_url: true,
	reply_to_message_id: true
})

export const messagingSendMediaBatchInputSchema = z.object({
	chat_id: z.string().min(1).describe('Channel conversation / chat id'),
	items: z
		.array(messagingSendMediaBatchItemSchema)
		.min(1)
		.max(MAX_MESSAGING_MEDIA_BATCH)
		.describe(`1–${MAX_MESSAGING_MEDIA_BATCH} media items in send order`),
	reply_to_message_id: z.string().min(1).optional().describe('Optional reply / thread anchor for the batch'),
	service_url: serviceUrlOptional
})

export const messagingSendMediaBatchOutputSchema = z.object({
	message_ids: z.array(z.string()).describe('Successfully sent message ids in order'),
	results: batchResultSchema(messagingMessageOutputSchema).describe('Per-item outcomes (partial failure allowed)')
})

export const messagingDownloadFileInputSchema = z.object({
	file_id: z.string().min(1).describe('Provider file id, content URL, or attachment message id'),
	chat_id: z.string().min(1).optional().describe('Conversation id when the channel requires it for download'),
	file_name: z.string().min(1).optional().describe('Preferred file name'),
	service_url: serviceUrlOptional
})

export const messagingDownloadFileOutputSchema = z.object({
	file_name: z.string(),
	file_size: z.number().optional(),
	body_base64: z.string().describe('Downloaded file body as base64')
})

export const messagingAnswerCallbackInputSchema = z.object({
	callback_query_id: z.string().min(1).describe('Callback / response id from an inbound interaction'),
	text: z.string().max(3000).optional().describe('Optional notification text'),
	show_alert: z.boolean().optional().describe('When supported, show an alert instead of a toast'),
	service_url: serviceUrlOptional
})

export const messagingReadInputSchema = z.object({
	chat_id: z.string().min(1).describe('Channel conversation / chat id'),
	message_id: z.string().min(1).describe('Message id to mark read up to'),
	service_url: serviceUrlOptional
})

export const messagingOkOutputSchema = z.object({
	ok: z.boolean()
})

export type MessagingSendTextInput = z.infer<typeof messagingSendTextInputSchema>
export type MessagingMessageOutput = z.infer<typeof messagingMessageOutputSchema>
export type MessagingEditTextInput = z.infer<typeof messagingEditTextInputSchema>
export type MessagingSendChatActionInput = z.infer<typeof messagingSendChatActionInputSchema>
export type MessagingStopTypingInput = z.infer<typeof messagingStopTypingInputSchema>
export type MessagingSetReactionInput = z.infer<typeof messagingSetReactionInputSchema>
export type MessagingReactionOutput = z.infer<typeof messagingReactionOutputSchema>
export type MessagingClearReactionInput = z.infer<typeof messagingClearReactionInputSchema>
export type MessagingSendMediaInput = z.infer<typeof messagingSendMediaInputSchema>
export type MessagingSendMediaBatchInput = z.infer<typeof messagingSendMediaBatchInputSchema>
export type MessagingSendMediaBatchOutput = z.infer<typeof messagingSendMediaBatchOutputSchema>
export type MessagingDownloadFileInput = z.infer<typeof messagingDownloadFileInputSchema>
export type MessagingDownloadFileOutput = z.infer<typeof messagingDownloadFileOutputSchema>
export type MessagingAnswerCallbackInput = z.infer<typeof messagingAnswerCallbackInputSchema>
export type MessagingReadInput = z.infer<typeof messagingReadInputSchema>

/** Shared seam surface — provider classes implement this. */
export type MessagingOps = {
	sendText: (input: MessagingSendTextInput) => Promise<MessagingMessageOutput>
	editText: (input: MessagingEditTextInput) => Promise<MessagingMessageOutput>
	sendChatAction: (input: MessagingSendChatActionInput) => Promise<void>
	stopTyping: (input: MessagingStopTypingInput) => Promise<void>
	setReaction: (input: MessagingSetReactionInput) => Promise<MessagingReactionOutput>
	clearReaction: (input: MessagingClearReactionInput) => Promise<void>
	sendMedia: (input: MessagingSendMediaInput) => Promise<MessagingMessageOutput>
	sendMediaBatch: (input: MessagingSendMediaBatchInput) => Promise<MessagingSendMediaBatchOutput>
	downloadFile: (input: MessagingDownloadFileInput) => Promise<MessagingDownloadFileOutput>
	answerCallback: (input: MessagingAnswerCallbackInput) => Promise<void>
	read: (input: MessagingReadInput) => Promise<void>
}
