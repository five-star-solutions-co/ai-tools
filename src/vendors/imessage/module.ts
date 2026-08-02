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
		'Send a text message to an iMessage space. chat_id is the Spectrum space id. Returns message_id when available for later edits, reactions, or unsend.',
	inputSchema: imessageSendTextInputSchema,
	outputSchema: imessageMessageOutputSchema,
	sideEffect: 'send',
	runtime: 'both',
	execute: async (input, ctx) => ImessageClient.fromContext(ctx).sendText(input)
})

export const imessageEditTextTool = defineTool({
	id: 'imessage-edit-text',
	name: 'imessageEditText',
	description: 'Edit the text of a previously sent iMessage. Requires the target space and message id.',
	inputSchema: imessageEditTextInputSchema,
	outputSchema: imessageMessageOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => ImessageClient.fromContext(ctx).editText(input)
})

export const imessageSendChatActionTool = defineTool({
	id: 'imessage-send-chat-action',
	name: 'imessageSendChatAction',
	description: 'Show a typing indicator in an iMessage space while a response is being prepared.',
	inputSchema: imessageSendChatActionInputSchema,
	outputSchema: imessageOkOutputSchema,
	sideEffect: 'none',
	runtime: 'both',
	execute: async (input, ctx) => {
		await ImessageClient.fromContext(ctx).sendChatAction(input)
		return { ok: true, space_id: input.chat_id }
	}
})

export const imessageSetReactionTool = defineTool({
	id: 'imessage-set-reaction',
	name: 'imessageSetReaction',
	description:
		'React to an iMessage with an emoji or tapback. Returns the reaction message_id, which is required to clear the reaction later.',
	inputSchema: imessageSetReactionInputSchema,
	outputSchema: imessageMessageOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => ImessageClient.fromContext(ctx).setReaction(input)
})

export const imessageClearReactionTool = defineTool({
	id: 'imessage-clear-reaction',
	name: 'imessageClearReaction',
	description:
		'Clear an iMessage reaction by unsending the reaction message. message_id must be the id returned by setReaction (not the target message).',
	inputSchema: imessageClearReactionInputSchema,
	outputSchema: imessageOkOutputSchema,
	sideEffect: 'delete',
	runtime: 'both',
	execute: async (input, ctx) => {
		await ImessageClient.fromContext(ctx).clearReaction(input)
		return { ok: true, space_id: input.chat_id }
	}
})

export const imessageUnsendTool = defineTool({
	id: 'imessage-unsend',
	name: 'imessageUnsend',
	description: 'Unsend a previously sent iMessage using its space and message ids.',
	inputSchema: imessageUnsendInputSchema,
	outputSchema: imessageOkOutputSchema,
	sideEffect: 'delete',
	runtime: 'both',
	execute: async (input, ctx) => {
		await ImessageClient.fromContext(ctx).unsend(input)
		return { ok: true, space_id: input.chat_id }
	}
})

export const imessageReadTool = defineTool({
	id: 'imessage-read',
	name: 'imessageRead',
	description: 'Mark an iMessage conversation as read through a specific message id.',
	inputSchema: imessageReadInputSchema,
	outputSchema: imessageOkOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => {
		await ImessageClient.fromContext(ctx).read(input)
		return { ok: true, space_id: input.chat_id }
	}
})

export const imessageSendMediaTool = defineTool({
	id: 'imessage-send-media',
	name: 'imessageSendMedia',
	description: 'Send one photo or document attachment to an iMessage space from the supplied media payload.',
	inputSchema: imessageSendMediaInputSchema,
	outputSchema: imessageMessageOutputSchema,
	sideEffect: 'send',
	runtime: 'both',
	execute: async (input, ctx) => ImessageClient.fromContext(ctx).sendMedia(input)
})

export const imessageDownloadFileTool = defineTool({
	id: 'imessage-download-file',
	name: 'imessageDownloadFile',
	description:
		'Download attachment or voice-message bytes for an iMessage in a Spectrum space. Requires chat_id, message_id, and file_id from the source message.',
	inputSchema: imessageDownloadFileInputSchema,
	outputSchema: imessageDownloadFileOutputSchema,
	sideEffect: 'none',
	runtime: 'both',
	execute: async (input, ctx) => ImessageClient.fromContext(ctx).downloadFile(input)
})

export const imessageModule = defineModule({
	id: 'imessage',
	title: 'iMessage',
	description:
		'iMessage tools for sending and editing text or media, typing indicators, reactions, unsend, read state, and attachment download.',
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
