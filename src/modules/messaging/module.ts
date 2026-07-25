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
	messagingStopTypingInputSchema
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
		'Show a chat action on the conversation (typing, upload_photo, upload_document, …). Optional reply_to_message_id anchors a thread when the channel uses thread-scoped status.',
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
		'Stop a typing or busy indicator on the conversation. Optional reply_to_message_id clears thread-scoped status when the channel uses it.',
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
		'Set an emoji reaction on a message. Returns optional message_id when the channel creates a separate reaction message — store it for clearReaction.',
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
		'Clear a reaction on a message. Pass emoji when required. When setReaction returned a message_id, pass that id instead of the target message id.',
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
	description:
		'Send one photo or document on the bound messaging channel. Provide body_base64 for small payloads or source ArtifactRef (object store) for large files.',
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
		'Send 1–10 media items in order (body_base64 or source ArtifactRef per item). May use a native album when all items share the same kind (2–10); otherwise sequential. Partial failures are reported per item.',
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
		'Download a file by file_id (and optional chat_id / file_name). Returns body_base64 by default, or an ArtifactRef when destination_key is set (writes to bound object storage).',
	inputSchema: messagingDownloadFileInputSchema,
	outputSchema: messagingDownloadFileOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => MessagingClient.fromContext(ctx).downloadFile(input)
})

export const messagingAnswerCallbackTool = defineTool({
	id: 'messaging-answer-callback',
	name: 'messagingAnswerCallback',
	description: 'Acknowledge an inbound interactive callback (toast, alert, or response URL).',
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
	description: 'Mark conversation messages as read up to message_id.',
	inputSchema: messagingReadInputSchema,
	outputSchema: messagingOkOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => {
		await MessagingClient.fromContext(ctx).read(input)
		return { ok: true }
	}
})

export const messagingModule = defineModule({
	id: 'messaging',
	title: 'Messaging',
	description:
		'Send and edit text, media (single and batch), chat actions, reactions, file download, callback answers, and read on the bound messaging channel.',
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
		messagingReadTool
	]
})
