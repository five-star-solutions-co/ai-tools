/**
 * Telegram provider for the messaging seam. Wraps `TelegramClient`.
 */

import type { HttpServiceOptions } from '../../../transport/http-service'
import { TelegramClient } from '../../../vendors/telegram'
import type {
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
	MessagingStopTypingInput,
	TelegramMessagingAuth
} from '../contracts'
import { sendMediaBatchSequential, warnUnsupportedMessagingOp } from '../domain'

export type TelegramMessagingProviderOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'>

export class TelegramMessagingProvider implements MessagingOps {
	readonly #client: TelegramClient

	constructor(auth: TelegramMessagingAuth, options: TelegramMessagingProviderOptions = {}) {
		const { provider: _p, storage: _s, ...vendorAuth } = auth
		this.#client = new TelegramClient(vendorAuth, options)
	}

	async sendText(input: MessagingSendTextInput): Promise<MessagingMessageOutput> {
		const out = await this.#client.sendText({
			chat_id: input.chat_id,
			text: input.text,
			...(input.reply_to_message_id && { reply_to_message_id: input.reply_to_message_id }),
			...(input.reply_markup !== undefined && { reply_markup: input.reply_markup })
		})
		return { message_id: out.message_id, ...(out.file_id && { file_id: out.file_id }) }
	}

	async editText(input: MessagingEditTextInput): Promise<MessagingMessageOutput> {
		const out = await this.#client.editText({
			chat_id: input.chat_id,
			message_id: input.message_id,
			text: input.text,
			...(input.reply_markup !== undefined && { reply_markup: input.reply_markup })
		})
		return { message_id: out.message_id }
	}

	sendChatAction(input: MessagingSendChatActionInput): Promise<void> {
		return this.#client.sendChatAction({
			chat_id: input.chat_id,
			action: input.action
		})
	}

	/** Telegram typing auto-expires; stop is a successful no-op. */
	async stopTyping(_input: MessagingStopTypingInput): Promise<void> {
		return
	}

	async setReaction(input: MessagingSetReactionInput): Promise<MessagingReactionOutput> {
		await this.#client.setReaction({
			chat_id: input.chat_id,
			message_id: input.message_id,
			emoji: input.emoji
		})
		return {}
	}

	clearReaction(input: MessagingClearReactionInput): Promise<void> {
		return this.#client.clearReaction({
			chat_id: input.chat_id,
			message_id: input.message_id
		})
	}

	async sendMedia(input: MessagingSendMediaResolved): Promise<MessagingMessageOutput> {
		const out = await this.#client.sendMedia({
			chat_id: input.chat_id,
			kind: input.kind,
			body_base64: input.body_base64,
			file_name: input.file_name,
			...(input.caption && { caption: input.caption }),
			...(input.reply_to_message_id && { reply_to_message_id: input.reply_to_message_id }),
			...(input.content_type && { content_type: input.content_type })
		})
		return {
			message_id: out.message_id,
			...(out.file_id && { file_id: out.file_id })
		}
	}

	async sendMediaBatch(input: MessagingSendMediaBatchResolved): Promise<MessagingSendMediaBatchOutput> {
		const kinds = new Set(input.items.map((i) => i.kind))
		const homogeneous = kinds.size === 1
		const kind = input.items[0]?.kind
		if (homogeneous && kind && input.items.length >= 2 && input.items.length <= 10) {
			const group = await this.#client.sendMediaGroup({
				chat_id: input.chat_id,
				items: input.items.map((item) => ({
					kind: item.kind,
					body_base64: item.body_base64,
					file_name: item.file_name,
					...(item.caption && { caption: item.caption }),
					...(item.content_type && { content_type: item.content_type })
				})),
				...(input.reply_to_message_id && { reply_to_message_id: input.reply_to_message_id })
			})
			return {
				message_ids: group.message_ids,
				results: {
					results: group.message_ids.map((message_id, index) => ({
						index,
						ok: true,
						value: { message_id }
					})),
					succeeded: group.message_ids.length,
					failed: 0
				}
			}
		}
		return sendMediaBatchSequential((item) => this.sendMedia(item), input)
	}

	downloadFile(input: MessagingDownloadFileInput): Promise<MessagingChannelDownloadOutput> {
		return this.#client.downloadFile({
			file_id: input.file_id,
			...(input.file_name && { file_name: input.file_name })
		})
	}

	answerCallback(input: MessagingAnswerCallbackInput): Promise<void> {
		return this.#client.answerCallback({
			callback_query_id: input.callback_query_id,
			...(input.text && { text: input.text }),
			...(input.show_alert !== undefined && { show_alert: input.show_alert })
		})
	}

	async read(_input: MessagingReadInput): Promise<void> {
		// No mark-as-read API; intentional lifecycle no-op for multi-channel hosts.
		warnUnsupportedMessagingOp('telegram', 'read')
	}
}
