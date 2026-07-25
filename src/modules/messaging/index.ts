/**
 * Public messaging seam surface.
 * Internals (providers/*) stay private.
 */

export { MessagingClient } from './client'
export { isMessagingDefiniteRejection, isMessagingOutcomeUnknown } from './domain'
export {
	messagingAnswerCallbackTool,
	messagingAuthSchema,
	messagingClearReactionTool,
	messagingDownloadFileTool,
	messagingEditTextTool,
	messagingModule,
	messagingReadTool,
	messagingSendChatActionTool,
	messagingSendMediaBatchTool,
	messagingSendMediaTool,
	messagingSendTextTool,
	messagingSetReactionTool,
	messagingStopTypingTool
} from './module'
export type { MessagingAuth } from './module'
export type {
	MessagingAnswerCallbackInput,
	MessagingClearReactionInput,
	MessagingDownloadFileInput,
	MessagingDownloadFileOutput,
	MessagingEditTextInput,
	MessagingMessageOutput,
	MessagingReactionOutput,
	MessagingReadInput,
	MessagingSendChatActionInput,
	MessagingSendMediaBatchInput,
	MessagingSendMediaBatchOutput,
	MessagingSendMediaInput,
	MessagingSendTextInput,
	MessagingSetReactionInput,
	MessagingStopTypingInput,
	ImessageMessagingAuth,
	SlackMessagingAuth,
	TeamsMessagingAuth,
	TelegramMessagingAuth
} from './contracts'
export {
	MAX_MESSAGING_MEDIA_BATCH,
	messagingAnswerCallbackInputSchema,
	messagingChatActionSchema,
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
	messagingSendMediaBatchItemSchema,
	messagingSendMediaBatchOutputSchema,
	messagingSendMediaInputSchema,
	messagingSendTextInputSchema,
	messagingSetReactionInputSchema,
	messagingStopTypingInputSchema
} from './contracts'
export { createLiveMessage, createTypingPulse } from '../../vendors/_messaging'
export type { LiveMessage, LiveMessageDeps, TypingPulse, TypingPulseDeps } from '../../vendors/_messaging'
