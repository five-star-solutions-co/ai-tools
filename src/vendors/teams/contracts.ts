import { z } from 'zod'

/** Practical upper bound for data-URI attachments (small files only). */
export const MAX_MEDIA_BYTES = 4 * 1024 * 1024

export const teamsChatActionSchema = z.enum([
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

export const teamsAuthSchema = z.object({
	app_id: z.string().min(1).describe('Microsoft Bot Framework application (client) id'),
	app_password: z.string().min(1).describe('Microsoft Bot Framework application credential'),
	tenant_id: z
		.string()
		.min(1)
		.optional()
		.describe('Azure AD tenant id; omit for multi-tenant botframework.com token endpoint')
})

export type TeamsAuth = z.infer<typeof teamsAuthSchema>

const serviceUrlField = z
	.string()
	.min(1)
	.describe('Bot Framework service URL for this conversation (from inbound activity.serviceUrl)')

export const teamsSendTextInputSchema = z.object({
	chat_id: z.string().min(1).describe('Teams conversation id'),
	text: z.string().min(1).max(28_000).describe('Message text'),
	reply_to_message_id: z.string().min(1).optional().describe('Optional activity id to reply to'),
	service_url: serviceUrlField,
	reply_markup: z.unknown().optional().describe('Optional Bot Framework attachments array or channel-native markup')
})

export const teamsMessageOutputSchema = z.object({
	message_id: z.string().describe('Bot Framework activity id as string')
})

export const teamsEditTextInputSchema = z.object({
	chat_id: z.string().min(1).describe('Teams conversation id'),
	message_id: z.string().min(1).describe('Activity id to edit'),
	text: z.string().min(1).max(28_000).describe('Replacement text'),
	service_url: serviceUrlField,
	reply_markup: z.unknown().optional().describe('Optional Bot Framework attachments array or channel-native markup')
})

export const teamsSendChatActionInputSchema = z.object({
	chat_id: z.string().min(1).describe('Teams conversation id'),
	action: teamsChatActionSchema.describe('Chat action; Teams maps all values to a typing activity'),
	service_url: serviceUrlField
})

export const teamsSetReactionInputSchema = z.object({
	chat_id: z.string().min(1).describe('Teams chat or conversation id (Graph chat id when using Graph reactions)'),
	message_id: z.string().min(1).describe('Message / activity id'),
	emoji: z
		.string()
		.min(1)
		.max(32)
		.describe('Emoji or short name (like, heart, …); Graph setReaction when tenant_id is bound'),
	team_id: z.string().min(1).optional().describe('Team id for channel-message Graph path'),
	channel_id: z.string().min(1).optional().describe('Channel id for channel-message Graph path')
})

export const teamsClearReactionInputSchema = z.object({
	chat_id: z.string().min(1).describe('Teams chat or conversation id'),
	message_id: z.string().min(1).describe('Message / activity id'),
	emoji: z
		.string()
		.min(1)
		.max(32)
		.optional()
		.describe('Same emoji/short name as setReaction; required for Graph unsetReaction'),
	team_id: z.string().min(1).optional().describe('Team id for channel-message Graph path'),
	channel_id: z.string().min(1).optional().describe('Channel id for channel-message Graph path')
})

export const teamsSendMediaInputSchema = z.object({
	chat_id: z.string().min(1).describe('Teams conversation id'),
	kind: z.enum(['photo', 'document']).describe('Media kind'),
	body_base64: z.string().min(1).describe('File body as base64'),
	file_name: z.string().min(1).describe('File name including extension'),
	caption: z.string().max(4000).optional().describe('Optional caption text'),
	content_type: z.string().optional().describe('Optional content type for the attachment'),
	service_url: serviceUrlField,
	reply_to_message_id: z.string().min(1).optional().describe('Optional activity id to reply to')
})

export const teamsDownloadFileInputSchema = z.object({
	file_id: z.string().min(1).describe('Content URL of the file to download'),
	file_name: z.string().min(1).optional().describe('Preferred file name for the download result'),
	service_url: z
		.string()
		.min(1)
		.optional()
		.describe('Optional service URL (unused when file_id is an absolute content URL)')
})

export const teamsDownloadFileOutputSchema = z.object({
	file_name: z.string(),
	file_size: z.number().optional(),
	body_base64: z.string().describe('Downloaded file body as base64')
})

export const teamsAnswerCallbackInputSchema = z.object({
	callback_query_id: z
		.string()
		.min(1)
		.describe('Invoke reply path (absolute URL) or invoke activity id; non-URL values no-op'),
	text: z.string().max(200).optional().describe('Optional notification text'),
	show_alert: z.boolean().optional().describe('When true, prefer an alert-style presentation when supported'),
	service_url: z.string().min(1).optional().describe('Optional service URL when replying via connector path')
})

export const teamsGetBotOutputSchema = z.object({
	bot_id: z.string(),
	username: z.string(),
	display_name: z.string()
})

export const teamsOkOutputSchema = z.object({
	ok: z.boolean()
})

export type TeamsSendTextInput = z.infer<typeof teamsSendTextInputSchema>
export type TeamsMessageOutput = z.infer<typeof teamsMessageOutputSchema>
export type TeamsEditTextInput = z.infer<typeof teamsEditTextInputSchema>
export type TeamsSendChatActionInput = z.infer<typeof teamsSendChatActionInputSchema>
export type TeamsSetReactionInput = z.infer<typeof teamsSetReactionInputSchema>
export type TeamsClearReactionInput = z.infer<typeof teamsClearReactionInputSchema>
export type TeamsSendMediaInput = z.infer<typeof teamsSendMediaInputSchema>
export type TeamsDownloadFileInput = z.infer<typeof teamsDownloadFileInputSchema>
export type TeamsDownloadFileOutput = z.infer<typeof teamsDownloadFileOutputSchema>
export type TeamsAnswerCallbackInput = z.infer<typeof teamsAnswerCallbackInputSchema>
export type TeamsGetBotOutput = z.infer<typeof teamsGetBotOutputSchema>
