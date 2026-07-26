import { z } from 'zod'

export const MAX_MEDIA_BYTES = 100 * 1024 * 1024

export const slackChatActionSchema = z.enum([
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

export const slackAuthSchema = z.object({
	bot_token: z.string().min(1).describe('Slack bot token (xoxb-…)')
})

export type SlackAuth = z.infer<typeof slackAuthSchema>

export const slackSendTextInputSchema = z.object({
	chat_id: z.string().min(1).describe('Slack channel or conversation id'),
	text: z.string().min(1).max(40_000).describe('Message text (max 40000 characters)'),
	reply_to_message_id: z.string().min(1).optional().describe('Optional thread_ts to reply in a thread'),
	reply_markup: z.unknown().optional().describe('Optional Slack blocks array (Block Kit)')
})

export const slackMessageOutputSchema = z.object({
	message_id: z.string().describe('Slack message timestamp (ts) as string'),
	file_id: z.string().min(1).optional().describe('Slack file id when the message carries an uploaded file (sendMedia)')
})

export const slackEditTextInputSchema = z.object({
	chat_id: z.string().min(1).describe('Slack channel or conversation id'),
	message_id: z.string().min(1).describe('Message ts to edit'),
	text: z.string().min(1).max(40_000).describe('Replacement text (max 40000 characters)'),
	reply_markup: z.unknown().optional().describe('Optional Slack blocks array (Block Kit)')
})

export const slackSendChatActionInputSchema = z.object({
	chat_id: z.string().min(1).describe('Slack channel or conversation id'),
	action: slackChatActionSchema.describe(
		'Chat action. With reply_to_message_id (thread_ts), maps to assistant.threads.setStatus loading text.'
	),
	reply_to_message_id: z
		.string()
		.min(1)
		.optional()
		.describe(
			'Thread root ts (thread_ts). Required for assistant status; without it sendChatAction is a no-op on Slack.'
		)
})

/** Clear assistant thread status (empty status). Needs the same thread_ts as set. */
export const slackStopTypingInputSchema = z.object({
	chat_id: z.string().min(1).describe('Slack channel or conversation id'),
	reply_to_message_id: z
		.string()
		.min(1)
		.optional()
		.describe('Thread root ts (thread_ts). Required to clear assistant status; without it stop is a no-op.')
})

export const slackSetReactionInputSchema = z.object({
	chat_id: z.string().min(1).describe('Slack channel or conversation id'),
	message_id: z.string().min(1).describe('Message ts to react to'),
	emoji: z.string().min(1).max(64).describe('Emoji name (with or without colons), e.g. thumbsup or :thumbsup:')
})

export const slackClearReactionInputSchema = z.object({
	chat_id: z.string().min(1).describe('Slack channel or conversation id'),
	message_id: z.string().min(1).describe('Message ts to clear a reaction on'),
	emoji: z.string().min(1).max(64).describe('Emoji name to remove (with or without colons); required on Slack')
})

export const slackSendMediaInputSchema = z.object({
	chat_id: z.string().min(1).describe('Slack channel or conversation id'),
	kind: z.enum(['photo', 'document']).describe('Media kind'),
	body_base64: z.string().min(1).describe('File body as base64'),
	file_name: z.string().min(1).describe('File name including extension'),
	caption: z.string().max(3000).optional().describe('Optional initial comment / caption'),
	reply_to_message_id: z.string().min(1).optional().describe('Optional thread_ts for the upload'),
	content_type: z.string().optional().describe('Optional content type for the upload')
})

export const slackDownloadFileInputSchema = z.object({
	file_id: z.string().min(1).describe('Slack file id from an inbound attachment'),
	file_name: z.string().min(1).optional().describe('Preferred file name for the download result')
})

export const slackDownloadFileOutputSchema = z.object({
	file_name: z.string(),
	file_size: z.number().optional(),
	body_base64: z.string().describe('Downloaded file body as base64')
})

export const slackAnswerCallbackInputSchema = z.object({
	callback_query_id: z
		.string()
		.min(1)
		.describe('Slack response_url from an interactive payload, or opaque callback id'),
	text: z.string().max(3000).optional().describe('Optional ephemeral response text'),
	show_alert: z.boolean().optional().describe('Ignored on Slack; reserved for channel seam parity')
})

export const slackGetBotOutputSchema = z.object({
	bot_id: z.string(),
	username: z.string(),
	display_name: z.string()
})

export const slackOkOutputSchema = z.object({
	ok: z.boolean()
})

export const slackPostEphemeralInputSchema = z.object({
	chat_id: z.string().min(1).describe('Slack channel id'),
	user_id: z.string().min(1).describe('User id who should see the ephemeral message'),
	text: z.string().min(1).max(40_000).describe('Ephemeral message text'),
	reply_markup: z.unknown().optional().describe('Optional Slack blocks array (Block Kit)')
})

export const slackListConversationsInputSchema = z.object({
	limit: z.number().int().min(1).max(1000).optional().describe('Page size (default Slack limit)'),
	cursor: z.string().min(1).optional().describe('Pagination cursor from a previous page'),
	types: z
		.string()
		.min(1)
		.optional()
		.describe('Comma-separated conversation types, e.g. public_channel,private_channel,im,mpim')
})

export const slackListConversationsOutputSchema = z.object({
	channels: z.array(
		z.object({
			id: z.string(),
			name: z.string().optional(),
			is_channel: z.boolean().optional(),
			is_im: z.boolean().optional(),
			is_mpim: z.boolean().optional(),
			is_private: z.boolean().optional()
		})
	),
	next_cursor: z.string().optional()
})

export type SlackSendTextInput = z.infer<typeof slackSendTextInputSchema>
export type SlackMessageOutput = z.infer<typeof slackMessageOutputSchema>
export type SlackEditTextInput = z.infer<typeof slackEditTextInputSchema>
export type SlackSendChatActionInput = z.infer<typeof slackSendChatActionInputSchema>
export type SlackStopTypingInput = z.infer<typeof slackStopTypingInputSchema>
export type SlackSetReactionInput = z.infer<typeof slackSetReactionInputSchema>
export type SlackClearReactionInput = z.infer<typeof slackClearReactionInputSchema>
export type SlackSendMediaInput = z.infer<typeof slackSendMediaInputSchema>
export type SlackDownloadFileInput = z.infer<typeof slackDownloadFileInputSchema>
export type SlackDownloadFileOutput = z.infer<typeof slackDownloadFileOutputSchema>
export type SlackAnswerCallbackInput = z.infer<typeof slackAnswerCallbackInputSchema>
export type SlackGetBotOutput = z.infer<typeof slackGetBotOutputSchema>
export type SlackPostEphemeralInput = z.infer<typeof slackPostEphemeralInputSchema>
export type SlackListConversationsInput = z.infer<typeof slackListConversationsInputSchema>
export type SlackListConversationsOutput = z.infer<typeof slackListConversationsOutputSchema>
