/**
 * iMessage provider for the messaging seam.
 * Wraps `ImessageClient` (Photon Advanced iMessage HTTP SDK).
 */

import { ToolError } from '../../../core/errors'
import type { HttpServiceOptions } from '../../../transport/http-service'
import { ImessageClient } from '../../../vendors/imessage'
import type {
	ImessageMessagingAuth,
	MessagingAnswerCallbackInput,
	MessagingClearReactionInput,
	MessagingChannelDownloadOutput,
	MessagingDownloadFileInput,
	MessagingEditTextInput,
	MessagingMessageOutput,
	MessagingOps,
	MessagingReactionOutput,
	MessagingReadInput,
	MessagingSendChatActionInput,
	MessagingSendMediaBatchOutput,
	MessagingSendMediaBatchResolved,
	MessagingSendMediaResolved,
	MessagingSendTextInput,
	MessagingSetReactionInput,
	MessagingStopTypingInput
} from '../contracts'
import { sendMediaBatchSequential } from '../domain'

export type ImessageMessagingProviderOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'>

export class ImessageMessagingProvider implements MessagingOps {
	readonly #client: ImessageClient

	constructor(auth: ImessageMessagingAuth, options: ImessageMessagingProviderOptions = {}) {
		const { provider: _p, storage: _s, ...vendorAuth } = auth
		this.#client = new ImessageClient(
			{
				address: vendorAuth.address,
				token: vendorAuth.token,
				...(vendorAuth.server && { server: vendorAuth.server }),
				...(vendorAuth.tls !== undefined && { tls: vendorAuth.tls })
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
	 * Clears via setReaction(isSet=false). Requires emoji matching setReaction.
	 * `message_id` is the **target** message guid.
	 */
	clearReaction(input: MessagingClearReactionInput): Promise<void> {
		if (!input.emoji) {
			throw new ToolError('iMessage clearReaction requires emoji (same tapback/emoji used when setting)', {
				code: 'bad_input'
			})
		}
		return this.#client.clearReaction({
			chat_id: input.chat_id,
			message_id: input.message_id,
			emoji: input.emoji
		})
	}

	async sendMedia(input: MessagingSendMediaResolved): Promise<MessagingMessageOutput> {
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

	sendMediaBatch(input: MessagingSendMediaBatchResolved): Promise<MessagingSendMediaBatchOutput> {
		return sendMediaBatchSequential((item) => this.sendMedia(item), input)
	}

	async downloadFile(input: MessagingDownloadFileInput): Promise<MessagingChannelDownloadOutput> {
		// file_id is attachment guid; optional chat_id for journaling only
		const fileId = input.chat_id ? input.file_id : (splitImessageFileRef(input.file_id).file_id ?? input.file_id)
		return this.#client.downloadFile({
			file_id: fileId,
			...(input.chat_id && { chat_id: input.chat_id }),
			...(input.file_name && { file_name: input.file_name })
		})
	}

	answerCallback(_input: MessagingAnswerCallbackInput): Promise<void> {
		return this.#client.answerCallback({})
	}

	read(input: MessagingReadInput): Promise<void> {
		return this.#client.read({
			chat_id: input.chat_id,
			...(input.message_id && { message_id: input.message_id })
		})
	}
}

/** Legacy composite: `space_id::message_id` when chat_id is omitted (message_id is attachment guid). */
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
