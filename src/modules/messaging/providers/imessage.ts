/**
 * iMessage provider for the messaging seam.
 * Wraps `ImessageClient` (Photon Spectrum Cloud + Advanced iMessage gRPC).
 *
 * Vendor client is loaded via dynamic import so edge/browser packaging of the
 * messaging seam does not pull Node-only gRPC peers until iMessage is used.
 */

import { ToolError } from '../../../core/errors'
import type { HttpServiceOptions } from '../../../transport/http-service'
import type { ImessageClient } from '../../../vendors/imessage'
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
	readonly #auth: ImessageMessagingAuth
	readonly #options: ImessageMessagingProviderOptions
	#client: ImessageClient | undefined
	#ready: Promise<ImessageClient> | undefined

	constructor(auth: ImessageMessagingAuth, options: ImessageMessagingProviderOptions = {}) {
		this.#auth = auth
		this.#options = options
	}

	async #sdk(): Promise<ImessageClient> {
		if (this.#client) return this.#client
		this.#ready ??= (async () => {
			const { ImessageClient } = await import('../../../vendors/imessage/client')
			const { provider: _p, storage: _s, ...vendorAuth } = this.#auth
			const client = new ImessageClient(vendorAuth, this.#options)
			this.#client = client
			return client
		})()
		return this.#ready
	}

	async sendText(input: MessagingSendTextInput): Promise<MessagingMessageOutput> {
		const result = await (
			await this.#sdk()
		).sendText({
			chat_id: input.chat_id,
			text: input.text
		})
		return { message_id: result.message_id }
	}

	async editText(input: MessagingEditTextInput): Promise<MessagingMessageOutput> {
		const result = await (
			await this.#sdk()
		).editText({
			chat_id: input.chat_id,
			message_id: input.message_id,
			text: input.text
		})
		return {
			message_id: result.message_id ?? input.message_id
		}
	}

	async sendChatAction(input: MessagingSendChatActionInput): Promise<void> {
		await (
			await this.#sdk()
		).sendChatAction({
			chat_id: input.chat_id,
			action: input.action
		})
	}

	async stopTyping(input: MessagingStopTypingInput): Promise<void> {
		await (await this.#sdk()).stopTyping({ chat_id: input.chat_id })
	}

	async setReaction(input: MessagingSetReactionInput): Promise<MessagingReactionOutput> {
		const result = await (
			await this.#sdk()
		).setReaction({
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
	async clearReaction(input: MessagingClearReactionInput): Promise<void> {
		if (!input.emoji) {
			throw new ToolError('iMessage clearReaction requires emoji (same tapback/emoji used when setting)', {
				code: 'bad_input'
			})
		}
		await (
			await this.#sdk()
		).clearReaction({
			chat_id: input.chat_id,
			message_id: input.message_id,
			emoji: input.emoji
		})
	}

	async sendMedia(input: MessagingSendMediaResolved): Promise<MessagingMessageOutput> {
		const result = await (
			await this.#sdk()
		).sendMedia({
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
		return (await this.#sdk()).downloadFile({
			file_id: fileId,
			...(input.chat_id && { chat_id: input.chat_id }),
			...(input.file_name && { file_name: input.file_name })
		})
	}

	async answerCallback(_input: MessagingAnswerCallbackInput): Promise<void> {
		await (await this.#sdk()).answerCallback({})
	}

	async read(input: MessagingReadInput): Promise<void> {
		await (
			await this.#sdk()
		).read({
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
