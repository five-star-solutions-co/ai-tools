import { z } from 'zod'

import { defineModule, defineTool } from '../../core/define'
import { SlackClient } from './client'
import {
	slackAnswerCallbackInputSchema,
	slackAuthSchema,
	slackClearReactionInputSchema,
	slackDownloadFileInputSchema,
	slackDownloadFileOutputSchema,
	slackEditTextInputSchema,
	slackGetBotOutputSchema,
	slackMessageOutputSchema,
	slackOkOutputSchema,
	slackSendChatActionInputSchema,
	slackSendMediaInputSchema,
	slackSendTextInputSchema,
	slackSetReactionInputSchema
} from './contracts'

const emptyInputSchema = z.object({}).describe('No input fields')

export const slackSendTextTool = defineTool({
	id: 'slack-send-text',
	name: 'slackSendText',
	description:
		'Send a text message to a Slack channel or DM. Optional reply_to_message_id anchors a thread reply. Optional reply_markup is a Block Kit blocks array. Returns the new message_id (ts).',
	inputSchema: slackSendTextInputSchema,
	outputSchema: slackMessageOutputSchema,
	sideEffect: 'send',
	runtime: 'both',
	execute: async (input, ctx) => SlackClient.fromContext(ctx).sendText(input)
})

export const slackEditTextTool = defineTool({
	id: 'slack-edit-text',
	name: 'slackEditText',
	description: 'Edit the text of an existing Slack message. Used for progressive live updates and corrections.',
	inputSchema: slackEditTextInputSchema,
	outputSchema: slackMessageOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => SlackClient.fromContext(ctx).editText(input)
})

export const slackSendChatActionTool = defineTool({
	id: 'slack-send-chat-action',
	name: 'slackSendChatAction',
	description:
		'Show busy status on a Slack assistant thread. Pass reply_to_message_id as the thread root ts (thread_ts) to call assistant.threads.setStatus (e.g. “is checking the request…”). Without reply_to_message_id this is a no-op (no channel-level typing API).',
	inputSchema: slackSendChatActionInputSchema,
	outputSchema: slackOkOutputSchema,
	sideEffect: 'none',
	runtime: 'both',
	execute: async (input, ctx) => {
		await SlackClient.fromContext(ctx).sendChatAction(input)
		return { ok: true }
	}
})

export const slackSetReactionTool = defineTool({
	id: 'slack-set-reaction',
	name: 'slackSetReaction',
	description:
		'Add an emoji reaction on a Slack message. Pass the emoji name with or without colons (e.g. thumbsup or :thumbsup:).',
	inputSchema: slackSetReactionInputSchema,
	outputSchema: slackOkOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => {
		await SlackClient.fromContext(ctx).setReaction(input)
		return { ok: true }
	}
})

export const slackClearReactionTool = defineTool({
	id: 'slack-clear-reaction',
	name: 'slackClearReaction',
	description:
		'Remove one emoji reaction the bot added on a Slack message. emoji is required (Slack cannot clear all reactions in one call).',
	inputSchema: slackClearReactionInputSchema,
	outputSchema: slackOkOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => {
		await SlackClient.fromContext(ctx).clearReaction(input)
		return { ok: true }
	}
})

export const slackSendMediaTool = defineTool({
	id: 'slack-send-media',
	name: 'slackSendMedia',
	description:
		'Upload one photo or document to a Slack channel from a base64 body (external upload flow). Optional caption becomes the initial comment.',
	inputSchema: slackSendMediaInputSchema,
	outputSchema: slackMessageOutputSchema,
	sideEffect: 'send',
	runtime: 'both',
	execute: async (input, ctx) => SlackClient.fromContext(ctx).sendMedia(input)
})

export const slackDownloadFileTool = defineTool({
	id: 'slack-download-file',
	name: 'slackDownloadFile',
	description: 'Download a Slack file by file_id and return the body as base64 with optional size and name.',
	inputSchema: slackDownloadFileInputSchema,
	outputSchema: slackDownloadFileOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => SlackClient.fromContext(ctx).downloadFile(input)
})

export const slackAnswerCallbackTool = defineTool({
	id: 'slack-answer-callback',
	name: 'slackAnswerCallback',
	description:
		'Acknowledge a Slack interactive payload. When callback_query_id is a response_url, posts an ephemeral reply. Otherwise succeeds without a network call.',
	inputSchema: slackAnswerCallbackInputSchema,
	outputSchema: slackOkOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => {
		await SlackClient.fromContext(ctx).answerCallback(input)
		return { ok: true }
	}
})

export const slackGetBotTool = defineTool({
	id: 'slack-get-bot',
	name: 'slackGetBot',
	description: 'Return the bound bot identity (bot_id, username, display_name) via auth.test.',
	inputSchema: emptyInputSchema,
	outputSchema: slackGetBotOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (_input, ctx) => SlackClient.fromContext(ctx).getBot()
})

export const slackModule = defineModule({
	id: 'slack',
	title: 'Slack',
	description:
		'Slack Web API vendor pack: text, media upload, chat-action parity, reactions, file download, interactive callbacks, bot identity. Expand with more Web API methods over time. Not a multi-provider messaging seam.',
	runtime: 'both',
	auth: { type: 'custom', schema: slackAuthSchema },
	tools: [
		slackSendTextTool,
		slackEditTextTool,
		slackSendChatActionTool,
		slackSetReactionTool,
		slackClearReactionTool,
		slackSendMediaTool,
		slackDownloadFileTool,
		slackAnswerCallbackTool,
		slackGetBotTool
	]
})
