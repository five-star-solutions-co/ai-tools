/**
 * iMessage provider for the messaging seam. Wraps `ImessageClient` (proxy REST).
 */

import { ToolError } from '../../../core/errors'
import type { HttpServiceOptions } from '../../../transport/http-service'
import { ImessageClient } from '../../../vendors/imessage'
import type {
	ImessageMessagingAuth,
	MessagingAnswerCallbackInput,
	MessagingClearReactionInput,
	MessagingDownloadFileInput,
	MessagingDownloadFileOutput,
	MessagingEditTextInput,
	MessagingMessageOutput,
	MessagingOps,
	MessagingReactionOutput,
	MessagingReadInput,
	MessagingSendChatActionInput,
	MessagingSendMediaBatchInput,
	MessagingSendMediaBatchOutput,
	MessagingSendMediaInput,
	MessagingSendTextInput,
	MessagingSetReactionInput,
	MessagingStopTypingInput
} from '../contracts'
import { sendMediaBatchSequential } from '../domain'

export type ImessageMessagingProviderOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'>

export class ImessageMessagingProvider implements MessagingOps {
	readonly #client: ImessageClient

	constructor(auth: ImessageMessagingAuth, options: ImessageMessagingProviderOptions = {}) {
		const { provider: _p, ...vendorAuth } = auth
		this.#client = new ImessageClient(
			{
				base_url: vendorAuth.base_url,
				project_id: vendorAuth.project_id,
				project_secret: vendorAuth.project_secret,
				...(vendorAuth.phone && { phone: vendorAuth.phone })
			},
			options
		)
	}

	async sendText(input: MessagingSendTextInput): Promise<MessagingMessageOutput> {
		const result = await this.#client.sendText({
			chat_id: input.chat_id,
			text: input.text
		})
		return { message_id: result.message_id }
	}

	async editText(input: MessagingEditTextInput): Promise<MessagingMessageOutput> {
		const result = await this.#client.editText({
			chat_id: input.chat_id,
			message_id: input.message_id,
			text: input.text
		})
		return {
			message_id: result.message_id ?? input.message_id
		}
	}

	sendChatAction(input: MessagingSendChatActionInput): Promise<void> {
		return this.#client.sendChatAction({
			chat_id: input.chat_id,
			action: input.action
		})
	}

	stopTyping(input: MessagingStopTypingInput): Promise<void> {
		return this.#client.stopTyping({ chat_id: input.chat_id })
	}

	async setReaction(input: MessagingSetReactionInput): Promise<MessagingReactionOutput> {
		const result = await this.#client.setReaction({
			chat_id: input.chat_id,
			message_id: input.message_id,
			emoji: input.emoji
		})
		return { message_id: result.message_id }
	}

	/**
	 * Spectrum clears reactions by unsending the reaction Message.
	 * Pass the reaction message_id returned by setReaction.
	 */
	clearReaction(input: MessagingClearReactionInput): Promise<void> {
		return this.#client.clearReaction({ chat_id: input.chat_id, message_id: input.message_id })
	}

	async sendMedia(input: MessagingSendMediaInput): Promise<MessagingMessageOutput> {
		const result = await this.#client.sendMedia({
			chat_id: input.chat_id,
			kind: input.kind,
			body_base64: input.body_base64,
			file_name: input.file_name,
			...(input.caption && { caption: input.caption }),
			...(input.content_type && { content_type: input.content_type })
		})
		return { message_id: result.message_id }
	}

	sendMediaBatch(input: MessagingSendMediaBatchInput): Promise<MessagingSendMediaBatchOutput> {
		return sendMediaBatchSequential((item) => this.sendMedia(item), input)
	}

	async downloadFile(input: MessagingDownloadFileInput): Promise<MessagingDownloadFileOutput> {
		const chatId = input.chat_id ?? splitImessageFileRef(input.file_id).chat_id
		const fileId = input.chat_id ? input.file_id : (splitImessageFileRef(input.file_id).file_id ?? input.file_id)
		if (!chatId) {
			throw new ToolError('iMessage downloadFile requires chat_id (space id), or file_id as space_id::message_id', {
				code: 'bad_input'
			})
		}
		return this.#client.downloadFile({
			file_id: fileId,
			chat_id: chatId,
			...(input.file_name && { file_name: input.file_name })
		})
	}

	answerCallback(_input: MessagingAnswerCallbackInput): Promise<void> {
		return this.#client.answerCallback({})
	}

	read(input: MessagingReadInput): Promise<void> {
		return this.#client.read({
			chat_id: input.chat_id,
			message_id: input.message_id
		})
	}
}

/** Legacy composite: `space_id::message_id` when chat_id is omitted. */
function splitImessageFileRef(fileId: string): { chat_id?: string; file_id: string } {
	const sep = '::'
	const idx = fileId.indexOf(sep)
	if (idx <= 0) {
		return { file_id: fileId }
	}
	const chat_id = fileId.slice(0, idx)
	const rest = fileId.slice(idx + sep.length)
	if (chat_id.length === 0 || rest.length === 0) {
		return { file_id: fileId }
	}
	return { chat_id, file_id: rest }
}
