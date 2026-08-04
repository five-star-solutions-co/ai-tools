import { defineModule, defineTool } from '../../core/define'
import { ImessageClient } from './client'
import {
	imessageAuthSchema,
	imessageClearReactionInputSchema,
	imessageDownloadFileInputSchema,
	imessageDownloadFileOutputSchema,
	imessageEditTextInputSchema,
	imessageMessageOutputSchema,
	imessageOkOutputSchema,
	imessageReadInputSchema,
	imessageSendChatActionInputSchema,
	imessageSendMediaInputSchema,
	imessageSendTextInputSchema,
	imessageSetReactionInputSchema,
	imessageUnsendInputSchema
} from './contracts'

export const imessageSendTextTool = defineTool({
	id: 'imessage-send-text',
	name: 'imessageSendText',
	description:
		'Send a text message to an iMessage chat. chat_id is the chat guid (e.g. any;-;+1555…). Returns message_id (guid) for later edits, reactions, or unsend.',
	inputSchema: imessageSendTextInputSchema,
	outputSchema: imessageMessageOutputSchema,
	sideEffect: 'send',
	runtime: 'both',
	network: true,
	execute: async (input, ctx) => ImessageClient.fromContext(ctx).sendText(input)
})

export const imessageEditTextTool = defineTool({
	id: 'imessage-edit-text',
	name: 'imessageEditText',
	description: 'Edit the text of a previously sent iMessage. Requires chat guid and message guid.',
	inputSchema: imessageEditTextInputSchema,
	outputSchema: imessageMessageOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	network: true,
	execute: async (input, ctx) => ImessageClient.fromContext(ctx).editText(input)
})

export const imessageSendChatActionTool = defineTool({
	id: 'imessage-send-chat-action',
	name: 'imessageSendChatAction',
	description: 'Show a typing indicator in an iMessage chat while a response is being prepared.',
	inputSchema: imessageSendChatActionInputSchema,
	outputSchema: imessageOkOutputSchema,
	sideEffect: 'none',
	runtime: 'both',
	network: true,
	execute: async (input, ctx) => {
		await ImessageClient.fromContext(ctx).sendChatAction(input)
		return { ok: true, space_id: input.chat_id }
	}
})

export const imessageSetReactionTool = defineTool({
	id: 'imessage-set-reaction',
	name: 'imessageSetReaction',
	description:
		'React to an iMessage with a tapback (love, like, dislike, laugh, emphasize, question) or free emoji. Returns a message guid for journaling. To clear, call clear-reaction with the same target message_id and emoji.',
	inputSchema: imessageSetReactionInputSchema,
	outputSchema: imessageMessageOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	network: true,
	execute: async (input, ctx) => ImessageClient.fromContext(ctx).setReaction(input)
})

export const imessageClearReactionTool = defineTool({
	id: 'imessage-clear-reaction',
	name: 'imessageClearReaction',
	description:
		'Clear an iMessage reaction. message_id is the target message that was reacted to; emoji must match set-reaction (tapback name or emoji character).',
	inputSchema: imessageClearReactionInputSchema,
	outputSchema: imessageOkOutputSchema,
	sideEffect: 'delete',
	runtime: 'both',
	network: true,
	execute: async (input, ctx) => {
		await ImessageClient.fromContext(ctx).clearReaction(input)
		return { ok: true, space_id: input.chat_id }
	}
})

export const imessageUnsendTool = defineTool({
	id: 'imessage-unsend',
	name: 'imessageUnsend',
	description: 'Unsend a previously sent iMessage using its chat guid and message guid.',
	inputSchema: imessageUnsendInputSchema,
	outputSchema: imessageOkOutputSchema,
	sideEffect: 'delete',
	runtime: 'both',
	network: true,
	execute: async (input, ctx) => {
		await ImessageClient.fromContext(ctx).unsend(input)
		return { ok: true, space_id: input.chat_id }
	}
})

export const imessageReadTool = defineTool({
	id: 'imessage-read',
	name: 'imessageRead',
	description: 'Mark an iMessage conversation as read (whole chat).',
	inputSchema: imessageReadInputSchema,
	outputSchema: imessageOkOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	network: true,
	execute: async (input, ctx) => {
		await ImessageClient.fromContext(ctx).read(input)
		return { ok: true, space_id: input.chat_id }
	}
})

export const imessageSendMediaTool = defineTool({
	id: 'imessage-send-media',
	name: 'imessageSendMedia',
	description:
		'Upload and send one photo or document to an iMessage chat from base64 bytes. Optional caption is sent as a follow-up text message.',
	inputSchema: imessageSendMediaInputSchema,
	outputSchema: imessageMessageOutputSchema,
	sideEffect: 'send',
	runtime: 'both',
	network: true,
	execute: async (input, ctx) => ImessageClient.fromContext(ctx).sendMedia(input)
})

export const imessageDownloadFileTool = defineTool({
	id: 'imessage-download-file',
	name: 'imessageDownloadFile',
	description: 'Download attachment bytes by attachment guid (file_id from inbound or upload).',
	inputSchema: imessageDownloadFileInputSchema,
	outputSchema: imessageDownloadFileOutputSchema,
	sideEffect: 'none',
	runtime: 'both',
	network: true,
	execute: async (input, ctx) => ImessageClient.fromContext(ctx).downloadFile(input)
})

export const imessageModule = defineModule({
	id: 'imessage',
	title: 'iMessage',
	description:
		'iMessage tools for sending and editing text or media, typing indicators, reactions, unsend, read state, and attachment download via Photon Advanced iMessage HTTP.',
	runtime: 'both',
	auth: { type: 'custom', schema: imessageAuthSchema },
	categories: ['messaging', 'chat'],
	classification: 'pii',
	tags: ['imessage', 'photon'],
	tools: [
		imessageSendTextTool,
		imessageEditTextTool,
		imessageSendChatActionTool,
		imessageSetReactionTool,
		imessageClearReactionTool,
		imessageUnsendTool,
		imessageReadTool,
		imessageSendMediaTool,
		imessageDownloadFileTool
	]
})
