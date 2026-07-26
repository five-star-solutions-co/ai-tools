/**
 * Slack provider for the messaging seam. Wraps `SlackClient`.
 */

import { ToolError } from '../../../core/errors'
import type { HttpServiceOptions } from '../../../transport/http-service'
import { SlackClient } from '../../../vendors/slack'
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
	SlackMessagingAuth
} from '../contracts'
import { sendMediaBatchSequential, warnUnsupportedMessagingOp } from '../domain'

export type SlackMessagingProviderOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'>

export class SlackMessagingProvider implements MessagingOps {
	readonly #client: SlackClient

	constructor(auth: SlackMessagingAuth, options: SlackMessagingProviderOptions = {}) {
		const { provider: _p, storage: _s, ...vendorAuth } = auth
		this.#client = new SlackClient(vendorAuth, options)
	}

	sendText(input: MessagingSendTextInput): Promise<MessagingMessageOutput> {
		return this.#client.sendText({
			chat_id: input.chat_id,
			text: input.text,
			...(input.reply_to_message_id && { reply_to_message_id: input.reply_to_message_id }),
			...(input.reply_markup !== undefined && { reply_markup: input.reply_markup })
		})
	}

	editText(input: MessagingEditTextInput): Promise<MessagingMessageOutput> {
		return this.#client.editText({
			chat_id: input.chat_id,
			message_id: input.message_id,
			text: input.text,
			...(input.reply_markup !== undefined && { reply_markup: input.reply_markup })
		})
	}

	sendChatAction(input: MessagingSendChatActionInput): Promise<void> {
		const body: Parameters<SlackClient['sendChatAction']>[0] = {
			chat_id: input.chat_id,
			action: input.action
		}
		if (input.reply_to_message_id) body.reply_to_message_id = input.reply_to_message_id
		return this.#client.sendChatAction(body)
	}

	/** Clear assistant.threads.setStatus when reply_to_message_id (thread_ts) is set. */
	stopTyping(input: MessagingStopTypingInput): Promise<void> {
		const body: Parameters<SlackClient['stopTyping']>[0] = { chat_id: input.chat_id }
		if (input.reply_to_message_id) body.reply_to_message_id = input.reply_to_message_id
		return this.#client.stopTyping(body)
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
		if (!input.emoji) {
			throw new ToolError('Slack clear reaction requires emoji', { code: 'bad_input' })
		}
		return this.#client.clearReaction({
			chat_id: input.chat_id,
			message_id: input.message_id,
			emoji: input.emoji
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

	sendMediaBatch(input: MessagingSendMediaBatchResolved): Promise<MessagingSendMediaBatchOutput> {
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
		warnUnsupportedMessagingOp('slack', 'read')
	}
}
