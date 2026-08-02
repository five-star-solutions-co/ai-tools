import { z } from 'zod'

import { defineModule, defineTool } from '../../core/define'
import { TeamsClient } from './client'
import {
	teamsAnswerCallbackInputSchema,
	teamsAuthSchema,
	teamsClearReactionInputSchema,
	teamsDownloadFileInputSchema,
	teamsDownloadFileOutputSchema,
	teamsEditTextInputSchema,
	teamsGetBotOutputSchema,
	teamsMessageOutputSchema,
	teamsOkOutputSchema,
	teamsSendChatActionInputSchema,
	teamsSendMediaInputSchema,
	teamsSendTextInputSchema,
	teamsSetReactionInputSchema
} from './contracts'

const emptyInputSchema = z.object({}).describe('No input fields')

export const teamsSendTextTool = defineTool({
	id: 'teams-send-text',
	name: 'teamsSendText',
	description:
		'Send a text message to a Microsoft Teams conversation via Bot Framework. Requires service_url from the inbound activity. Returns the new activity message_id.',
	inputSchema: teamsSendTextInputSchema,
	outputSchema: teamsMessageOutputSchema,
	sideEffect: 'send',
	runtime: 'both',
	execute: async (input, ctx) => TeamsClient.fromContext(ctx).sendText(input)
})

export const teamsEditTextTool = defineTool({
	id: 'teams-edit-text',
	name: 'teamsEditText',
	description:
		'Edit the text of an existing Teams activity. Used for progressive live updates and corrections. Requires service_url.',
	inputSchema: teamsEditTextInputSchema,
	outputSchema: teamsMessageOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => TeamsClient.fromContext(ctx).editText(input)
})

export const teamsSendChatActionTool = defineTool({
	id: 'teams-send-chat-action',
	name: 'teamsSendChatAction',
	description:
		'Show a typing indicator in a Teams conversation (Bot Framework typing activity). All action values map to typing. Requires service_url.',
	inputSchema: teamsSendChatActionInputSchema,
	outputSchema: teamsOkOutputSchema,
	sideEffect: 'none',
	runtime: 'both',
	execute: async (input, ctx) => {
		await TeamsClient.fromContext(ctx).sendChatAction(input)
		return { ok: true }
	}
})

export const teamsSetReactionTool = defineTool({
	id: 'teams-set-reaction',
	name: 'teamsSetReaction',
	description:
		'Set a reaction on a Teams message. Bot Framework reaction support is limited; this call succeeds as a presentation no-op so channel seams stay uniform.',
	inputSchema: teamsSetReactionInputSchema,
	outputSchema: teamsOkOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => {
		await TeamsClient.fromContext(ctx).setReaction(input)
		return { ok: true }
	}
})

export const teamsClearReactionTool = defineTool({
	id: 'teams-clear-reaction',
	name: 'teamsClearReaction',
	description:
		'Clear reactions on a Teams message. Bot Framework reaction support is limited; this call succeeds as a presentation no-op.',
	inputSchema: teamsClearReactionInputSchema,
	outputSchema: teamsOkOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => {
		await TeamsClient.fromContext(ctx).clearReaction(input)
		return { ok: true }
	}
})

export const teamsSendMediaTool = defineTool({
	id: 'teams-send-media',
	name: 'teamsSendMedia',
	description:
		'Send one photo or document to a Teams conversation as a Bot Framework data-URI attachment (small files). Requires service_url.',
	inputSchema: teamsSendMediaInputSchema,
	outputSchema: teamsMessageOutputSchema,
	sideEffect: 'send',
	runtime: 'both',
	execute: async (input, ctx) => TeamsClient.fromContext(ctx).sendMedia(input)
})

export const teamsDownloadFileTool = defineTool({
	id: 'teams-download-file',
	name: 'teamsDownloadFile',
	description:
		'Download a Teams/Bot Framework file by content URL (file_id) and return the body as base64 with optional size and name.',
	inputSchema: teamsDownloadFileInputSchema,
	outputSchema: teamsDownloadFileOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => TeamsClient.fromContext(ctx).downloadFile(input)
})

export const teamsAnswerCallbackTool = defineTool({
	id: 'teams-answer-callback',
	name: 'teamsAnswerCallback',
	description:
		'Acknowledge a Teams invoke. When callback_query_id is an absolute reply URL, POSTs an invokeResponse; otherwise succeeds as a no-op.',
	inputSchema: teamsAnswerCallbackInputSchema,
	outputSchema: teamsOkOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => {
		await TeamsClient.fromContext(ctx).answerCallback(input)
		return { ok: true }
	}
})

export const teamsGetBotTool = defineTool({
	id: 'teams-get-bot',
	name: 'teamsGetBot',
	description: 'Return the current Microsoft Teams bot identity, including bot_id, username, and display_name.',
	inputSchema: emptyInputSchema,
	outputSchema: teamsGetBotOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (_input, ctx) => TeamsClient.fromContext(ctx).getBot()
})

export const teamsModule = defineModule({
	id: 'teams',
	title: 'Microsoft Teams',
	description:
		'Microsoft Teams tools for text, media, typing, file download, invoke callbacks, and bot identity. Conversation actions require service_url from the active conversation; reaction actions report unsupported behavior.',
	runtime: 'both',
	auth: { type: 'custom', schema: teamsAuthSchema },
	categories: ['messaging', 'chat'],
	classification: 'pii',
	tags: ['teams', 'bot-framework'],
	tools: [
		teamsSendTextTool,
		teamsEditTextTool,
		teamsSendChatActionTool,
		teamsSetReactionTool,
		teamsClearReactionTool,
		teamsSendMediaTool,
		teamsDownloadFileTool,
		teamsAnswerCallbackTool,
		teamsGetBotTool
	]
})
