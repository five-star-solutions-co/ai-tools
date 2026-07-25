import { defineModule, defineTool } from '../../core/define'
import { MessagingClient } from './client'
import {
	messagingAnswerCallbackInputSchema,
	messagingAuthSchema,
	messagingClearReactionInputSchema,
	messagingDownloadFileInputSchema,
	messagingDownloadFileOutputSchema,
	messagingEditTextInputSchema,
	messagingMessageOutputSchema,
	messagingOkOutputSchema,
	messagingReactionOutputSchema,
	messagingReadInputSchema,
	messagingSendChatActionInputSchema,
	messagingSendMediaBatchInputSchema,
	messagingSendMediaBatchOutputSchema,
	messagingSendMediaInputSchema,
	messagingSendTextInputSchema,
	messagingSetReactionInputSchema,
	messagingStopTypingInputSchema,
	messagingUnsendInputSchema
} from './contracts'

export type { MessagingAuth } from './contracts'
export { messagingAuthSchema }

export const messagingSendTextTool = defineTool({
	id: 'messaging-send-text',
	name: 'messagingSendText',
	description:
		'Send a text message on the bound messaging channel. Optional reply_to_message_id anchors a reply or thread. Returns message_id.',
	inputSchema: messagingSendTextInputSchema,
	outputSchema: messagingMessageOutputSchema,
	sideEffect: 'send',
	runtime: 'both',
	execute: async (input, ctx) => MessagingClient.fromContext(ctx).sendText(input)
})

export const messagingEditTextTool = defineTool({
	id: 'messaging-edit-text',
	name: 'messagingEditText',
	description: 'Edit the text of an existing message on the bound messaging channel.',
	inputSchema: messagingEditTextInputSchema,
	outputSchema: messagingMessageOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => MessagingClient.fromContext(ctx).editText(input)
})

export const messagingSendChatActionTool = defineTool({
	id: 'messaging-send-chat-action',
	name: 'messagingSendChatAction',
	description:
		'Show a chat action (typing, upload, …) on the bound channel when supported. Slack: pass reply_to_message_id as thread root ts for assistant.threads.setStatus; without it this is a no-op. Telegram/Teams/iMessage use native typing indicators.',
	inputSchema: messagingSendChatActionInputSchema,
	outputSchema: messagingOkOutputSchema,
	sideEffect: 'none',
	runtime: 'both',
	execute: async (input, ctx) => {
		await MessagingClient.fromContext(ctx).sendChatAction(input)
		return { ok: true }
	}
})

export const messagingStopTypingTool = defineTool({
	id: 'messaging-stop-typing',
	name: 'messagingStopTyping',
	description:
		'Stop a typing / busy indicator when supported. iMessage: native stop. Slack: pass reply_to_message_id (thread_ts) to clear assistant status; without it no-op. Telegram/Teams: successful no-op.',
	inputSchema: messagingStopTypingInputSchema,
	outputSchema: messagingOkOutputSchema,
	sideEffect: 'none',
	runtime: 'both',
	execute: async (input, ctx) => {
		await MessagingClient.fromContext(ctx).stopTyping(input)
		return { ok: true }
	}
})

export const messagingSetReactionTool = defineTool({
	id: 'messaging-set-reaction',
	name: 'messagingSetReaction',
	description:
		'Set an emoji reaction on a message when the bound channel supports reactions. Returns optional message_id for channels that create a separate reaction message (iMessage); store it for clearReaction.',
	inputSchema: messagingSetReactionInputSchema,
	outputSchema: messagingReactionOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => MessagingClient.fromContext(ctx).setReaction(input)
})

export const messagingClearReactionTool = defineTool({
	id: 'messaging-clear-reaction',
	name: 'messagingClearReaction',
	description:
		'Clear a reaction. Slack requires emoji. iMessage expects the reaction message_id from setReaction (not the target message).',
	inputSchema: messagingClearReactionInputSchema,
	outputSchema: messagingOkOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => {
		await MessagingClient.fromContext(ctx).clearReaction(input)
		return { ok: true }
	}
})

export const messagingSendMediaTool = defineTool({
	id: 'messaging-send-media',
	name: 'messagingSendMedia',
	description: 'Send one photo or document on the bound messaging channel from a base64 body.',
	inputSchema: messagingSendMediaInputSchema,
	outputSchema: messagingMessageOutputSchema,
	sideEffect: 'send',
	runtime: 'both',
	execute: async (input, ctx) => MessagingClient.fromContext(ctx).sendMedia(input)
})

export const messagingSendMediaBatchTool = defineTool({
	id: 'messaging-send-media-batch',
	name: 'messagingSendMediaBatch',
	description:
		'Send 1–10 media items in order. Telegram uses a native media group when all items share the same kind (2–10); otherwise each channel sends sequentially. Partial failures are reported per item.',
	inputSchema: messagingSendMediaBatchInputSchema,
	outputSchema: messagingSendMediaBatchOutputSchema,
	sideEffect: 'send',
	runtime: 'both',
	execute: async (input, ctx) => MessagingClient.fromContext(ctx).sendMediaBatch(input)
})

export const messagingDownloadFileTool = defineTool({
	id: 'messaging-download-file',
	name: 'messagingDownloadFile',
	description:
		'Download a file by provider file id or content URL and return the body as base64. iMessage prefers chat_id plus attachment message id (legacy space_id::message_id still accepted).',
	inputSchema: messagingDownloadFileInputSchema,
	outputSchema: messagingDownloadFileOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => MessagingClient.fromContext(ctx).downloadFile(input)
})

export const messagingAnswerCallbackTool = defineTool({
	id: 'messaging-answer-callback',
	name: 'messagingAnswerCallback',
	description:
		'Acknowledge an inbound interactive callback when the bound channel supports it (toast, alert, or response URL).',
	inputSchema: messagingAnswerCallbackInputSchema,
	outputSchema: messagingOkOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => {
		await MessagingClient.fromContext(ctx).answerCallback(input)
		return { ok: true }
	}
})

export const messagingReadTool = defineTool({
	id: 'messaging-read',
	name: 'messagingRead',
	description:
		'Mark messages as read up to message_id when the bound channel supports it (iMessage inbound only). Other providers log a warning and no-op.',
	inputSchema: messagingReadInputSchema,
	outputSchema: messagingOkOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => {
		await MessagingClient.fromContext(ctx).read(input)
		return { ok: true }
	}
})

export const messagingUnsendTool = defineTool({
	id: 'messaging-unsend',
	name: 'messagingUnsend',
	description:
		'Unsend or delete a message when the bound channel supports it (iMessage). Other providers log a warning and no-op.',
	inputSchema: messagingUnsendInputSchema,
	outputSchema: messagingOkOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => {
		await MessagingClient.fromContext(ctx).unsend(input)
		return { ok: true }
	}
})

export const messagingModule = defineModule({
	id: 'messaging',
	title: 'Messaging',
	description:
		'Multi-channel messaging seam: send and edit text, media (single and batch), chat actions, stop typing, reactions, file download, callback answers, read, and unsend via the host-bound channel provider (telegram, slack, teams, or imessage).',
	runtime: 'both',
	auth: { type: 'custom', schema: messagingAuthSchema },
	tools: [
		messagingSendTextTool,
		messagingEditTextTool,
		messagingSendChatActionTool,
		messagingStopTypingTool,
		messagingSetReactionTool,
		messagingClearReactionTool,
		messagingSendMediaTool,
		messagingSendMediaBatchTool,
		messagingDownloadFileTool,
		messagingAnswerCallbackTool,
		messagingReadTool,
		messagingUnsendTool
	]
})
