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

export const MAX_SLACK_MEDIA_BATCH = 10

/** Host-only: full assistant.threads.setStatus (custom status + loading_messages). */
export const slackSetAssistantStatusInputSchema = z.object({
	chat_id: z.string().min(1).describe('Channel or DM id containing the assistant thread'),
	thread_ts: z.string().min(1).describe('Thread root message ts'),
	status: z.string().describe('Status text Slack shows after the app name (empty string clears)'),
	loading_messages: z.array(z.string().min(1)).max(10).optional().describe('Up to 10 rotating loading messages')
})

export const slackSetSuggestedPromptsInputSchema = z.object({
	chat_id: z.string().min(1).describe('Channel or DM id'),
	thread_ts: z.string().min(1).optional().describe('Thread ts; optional in agent Messages-tab experience'),
	title: z.string().min(1).optional().describe('Title above the prompt list'),
	prompts: z
		.array(
			z.object({
				title: z.string().min(1),
				message: z.string().min(1)
			})
		)
		.min(1)
		.max(4)
		.describe('Up to four suggested prompts')
})

export const slackPublishHomeInputSchema = z.object({
	user_id: z.string().min(1).describe('User id to publish the Home tab view for'),
	view: z.unknown().describe('Slack home view payload (type home + blocks)'),
	hash: z.string().min(1).optional().describe('Optional view hash for race protection')
})

export const slackStartStreamInputSchema = z.object({
	chat_id: z.string().min(1).describe('Channel or DM id'),
	thread_ts: z.string().min(1).describe('Parent message ts (streamed messages are thread replies)'),
	markdown_text: z.string().max(12_000).optional().describe('Optional initial markdown chunk'),
	recipient_user_id: z.string().min(1).optional().describe('Required when streaming into channels'),
	recipient_team_id: z.string().min(1).optional().describe('Required when streaming into channels'),
	task_display_mode: z.enum(['timeline', 'plan', 'dense']).optional()
})

export const slackAppendStreamInputSchema = z.object({
	chat_id: z.string().min(1).describe('Channel or DM id'),
	message_id: z.string().min(1).describe('Streaming message ts from startStream'),
	markdown_text: z.string().min(1).max(12_000).describe('Markdown text to append')
})

export const slackStopStreamInputSchema = z.object({
	chat_id: z.string().min(1).describe('Channel or DM id'),
	message_id: z.string().min(1).describe('Streaming message ts'),
	markdown_text: z.string().max(12_000).optional().describe('Optional final markdown append'),
	blocks: z.unknown().optional().describe('Optional Block Kit blocks on finalize')
})

export const slackAuthRevokeInputSchema = z.object({
	test: z.boolean().optional().describe('When true, tests revoke without revoking (Slack auth.revoke test flag)')
})

export const slackAuthRevokeOutputSchema = z.object({
	revoked: z.boolean()
})

export const slackUsersInfoInputSchema = z.object({
	user_id: z.string().min(1).describe('Slack user id'),
	include_locale: z.boolean().optional()
})

export const slackUsersInfoOutputSchema = z.object({
	user_id: z.string(),
	name: z.string().optional(),
	real_name: z.string().optional(),
	display_name: z.string().optional(),
	is_bot: z.boolean().optional(),
	tz: z.string().optional(),
	profile: z.record(z.string(), z.unknown()).optional()
})

export const slackUsersConversationsInputSchema = z.object({
	user_id: z.string().min(1).optional().describe('User id; omit for the authed user'),
	limit: z.number().int().min(1).max(1000).optional(),
	cursor: z.string().min(1).optional(),
	types: z.string().min(1).optional().describe('e.g. public_channel,private_channel,im,mpim'),
	exclude_archived: z.boolean().optional()
})

export const slackConversationInfoInputSchema = z.object({
	chat_id: z.string().min(1).describe('Channel, group, or DM id'),
	include_locale: z.boolean().optional(),
	include_num_members: z.boolean().optional()
})

export const slackConversationInfoOutputSchema = z.object({
	id: z.string(),
	name: z.string().optional(),
	is_channel: z.boolean().optional(),
	is_im: z.boolean().optional(),
	is_mpim: z.boolean().optional(),
	is_private: z.boolean().optional(),
	is_archived: z.boolean().optional(),
	num_members: z.number().optional(),
	raw: z.record(z.string(), z.unknown()).optional()
})

export const slackConversationHistoryInputSchema = z.object({
	chat_id: z.string().min(1),
	limit: z.number().int().min(1).max(1000).optional(),
	cursor: z.string().min(1).optional(),
	oldest: z.string().min(1).optional(),
	latest: z.string().min(1).optional(),
	inclusive: z.boolean().optional()
})

export const slackConversationRepliesInputSchema = z.object({
	chat_id: z.string().min(1),
	message_id: z.string().min(1).describe('Parent message ts'),
	limit: z.number().int().min(1).max(1000).optional(),
	cursor: z.string().min(1).optional(),
	oldest: z.string().min(1).optional(),
	latest: z.string().min(1).optional(),
	inclusive: z.boolean().optional()
})

export const slackConversationMessagesOutputSchema = z.object({
	messages: z.array(z.record(z.string(), z.unknown())),
	next_cursor: z.string().optional(),
	has_more: z.boolean().optional()
})

/** Host batch upload: many files, one completeUploadExternal share. */
export const slackSendMediaBatchItemSchema = z.object({
	file_name: z.string().min(1),
	body_base64: z.string().min(1).optional().describe('File body as base64 (tool/host JSON path)'),
	content_type: z.string().optional(),
	title: z.string().min(1).optional()
})

export const slackSendMediaBatchInputSchema = z.object({
	chat_id: z.string().min(1),
	files: z.array(slackSendMediaBatchItemSchema).min(1).max(MAX_SLACK_MEDIA_BATCH),
	caption: z.string().max(3000).optional(),
	reply_to_message_id: z.string().min(1).optional()
})

export const slackSendMediaBatchOutputSchema = z.object({
	message_id: z.string(),
	file_ids: z.array(z.string().min(1)).min(1)
})

export type SlackSetAssistantStatusInput = z.infer<typeof slackSetAssistantStatusInputSchema>
export type SlackSetSuggestedPromptsInput = z.infer<typeof slackSetSuggestedPromptsInputSchema>
export type SlackPublishHomeInput = z.infer<typeof slackPublishHomeInputSchema>
export type SlackStartStreamInput = z.infer<typeof slackStartStreamInputSchema>
export type SlackAppendStreamInput = z.infer<typeof slackAppendStreamInputSchema>
export type SlackStopStreamInput = z.infer<typeof slackStopStreamInputSchema>
export type SlackAuthRevokeInput = z.infer<typeof slackAuthRevokeInputSchema>
export type SlackAuthRevokeOutput = z.infer<typeof slackAuthRevokeOutputSchema>
export type SlackUsersInfoInput = z.infer<typeof slackUsersInfoInputSchema>
export type SlackUsersInfoOutput = z.infer<typeof slackUsersInfoOutputSchema>
export type SlackUsersConversationsInput = z.infer<typeof slackUsersConversationsInputSchema>
export type SlackConversationInfoInput = z.infer<typeof slackConversationInfoInputSchema>
export type SlackConversationInfoOutput = z.infer<typeof slackConversationInfoOutputSchema>
export type SlackConversationHistoryInput = z.infer<typeof slackConversationHistoryInputSchema>
export type SlackConversationRepliesInput = z.infer<typeof slackConversationRepliesInputSchema>
export type SlackConversationMessagesOutput = z.infer<typeof slackConversationMessagesOutputSchema>
export type SlackSendMediaBatchItem = z.infer<typeof slackSendMediaBatchItemSchema>
export type SlackSendMediaBatchInput = z.infer<typeof slackSendMediaBatchInputSchema>
export type SlackSendMediaBatchOutput = z.infer<typeof slackSendMediaBatchOutputSchema>
