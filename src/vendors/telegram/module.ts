import { z } from 'zod'

import { defineModule, defineTool } from '../../core/define'
import { TelegramClient } from './client'
import {
	telegramAnswerCallbackInputSchema,
	telegramAuthSchema,
	telegramClearReactionInputSchema,
	telegramDownloadFileInputSchema,
	telegramDownloadFileOutputSchema,
	telegramEditTextInputSchema,
	telegramGetBotOutputSchema,
	telegramMessageOutputSchema,
	telegramOkOutputSchema,
	telegramSendChatActionInputSchema,
	telegramSendMediaGroupInputSchema,
	telegramSendMediaGroupOutputSchema,
	telegramSendMediaInputSchema,
	telegramSendTextInputSchema,
	telegramSetReactionInputSchema
} from './contracts'

const emptyInputSchema = z.object({}).describe('No input fields')

export const telegramSendTextTool = defineTool({
	id: 'telegram-send-text',
	name: 'telegramSendText',
	description:
		'Send a text message to a Telegram chat. Optional reply_to_message_id anchors a native reply. Returns the new message_id.',
	inputSchema: telegramSendTextInputSchema,
	outputSchema: telegramMessageOutputSchema,
	sideEffect: 'send',
	runtime: 'both',
	execute: async (input, ctx) => TelegramClient.fromContext(ctx).sendText(input)
})

export const telegramEditTextTool = defineTool({
	id: 'telegram-edit-text',
	name: 'telegramEditText',
	description: 'Edit the text of an existing Telegram message. Used for progressive live updates and corrections.',
	inputSchema: telegramEditTextInputSchema,
	outputSchema: telegramMessageOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => TelegramClient.fromContext(ctx).editText(input)
})

export const telegramSendChatActionTool = defineTool({
	id: 'telegram-send-chat-action',
	name: 'telegramSendChatAction',
	description:
		'Show a chat action to the user (typing, upload_photo, upload_document, and other Telegram actions). Renew while work is in progress.',
	inputSchema: telegramSendChatActionInputSchema,
	outputSchema: telegramOkOutputSchema,
	sideEffect: 'none',
	runtime: 'both',
	execute: async (input, ctx) => {
		await TelegramClient.fromContext(ctx).sendChatAction(input)
		return { ok: true }
	}
})

export const telegramSetReactionTool = defineTool({
	id: 'telegram-set-reaction',
	name: 'telegramSetReaction',
	description:
		'Set an emoji reaction on a Telegram message. Any emoji Telegram accepts for the bot and chat is allowed.',
	inputSchema: telegramSetReactionInputSchema,
	outputSchema: telegramOkOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => {
		await TelegramClient.fromContext(ctx).setReaction(input)
		return { ok: true }
	}
})

export const telegramClearReactionTool = defineTool({
	id: 'telegram-clear-reaction',
	name: 'telegramClearReaction',
	description: 'Clear all bot reactions on a Telegram message.',
	inputSchema: telegramClearReactionInputSchema,
	outputSchema: telegramOkOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => {
		await TelegramClient.fromContext(ctx).clearReaction(input)
		return { ok: true }
	}
})

export const telegramSendMediaTool = defineTool({
	id: 'telegram-send-media',
	name: 'telegramSendMedia',
	description:
		'Send one photo or document to a Telegram chat from a base64 body. For multiple related files use telegram-send-media-group.',
	inputSchema: telegramSendMediaInputSchema,
	outputSchema: telegramMessageOutputSchema,
	sideEffect: 'send',
	runtime: 'both',
	execute: async (input, ctx) => TelegramClient.fromContext(ctx).sendMedia(input)
})

export const telegramSendMediaGroupTool = defineTool({
	id: 'telegram-send-media-group',
	name: 'telegramSendMediaGroup',
	description: 'Send 2-10 photos or 2-10 documents as one Telegram media group. Cannot mix photo and document items.',
	inputSchema: telegramSendMediaGroupInputSchema,
	outputSchema: telegramSendMediaGroupOutputSchema,
	sideEffect: 'send',
	runtime: 'both',
	execute: async (input, ctx) => TelegramClient.fromContext(ctx).sendMediaGroup(input)
})

export const telegramDownloadFileTool = defineTool({
	id: 'telegram-download-file',
	name: 'telegramDownloadFile',
	description: 'Download a Telegram file by file_id and return the body as base64 with optional size and name.',
	inputSchema: telegramDownloadFileInputSchema,
	outputSchema: telegramDownloadFileOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => TelegramClient.fromContext(ctx).downloadFile(input)
})

export const telegramAnswerCallbackTool = defineTool({
	id: 'telegram-answer-callback',
	name: 'telegramAnswerCallback',
	description: 'Acknowledge a Telegram callback query. Optional text shows a toast or alert to the user.',
	inputSchema: telegramAnswerCallbackInputSchema,
	outputSchema: telegramOkOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => {
		await TelegramClient.fromContext(ctx).answerCallback(input)
		return { ok: true }
	}
})

export const telegramGetBotTool = defineTool({
	id: 'telegram-get-bot',
	name: 'telegramGetBot',
	description: 'Return the active Telegram bot identity, including bot_id, username, and display_name.',
	inputSchema: emptyInputSchema,
	outputSchema: telegramGetBotOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (_input, ctx) => TelegramClient.fromContext(ctx).getBot()
})

export const telegramModule = defineModule({
	id: 'telegram',
	title: 'Telegram',
	description:
		'Telegram Bot API tools for text, media, media groups, chat actions, reactions, file download, callbacks, and bot identity.',
	runtime: 'both',
	auth: { type: 'custom', schema: telegramAuthSchema },
	tools: [
		telegramSendTextTool,
		telegramEditTextTool,
		telegramSendChatActionTool,
		telegramSetReactionTool,
		telegramClearReactionTool,
		telegramSendMediaTool,
		telegramSendMediaGroupTool,
		telegramDownloadFileTool,
		telegramAnswerCallbackTool,
		telegramGetBotTool
	]
})
