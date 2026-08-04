/**
 * iMessage vendor client via @photon-ai/advanced-imessage HTTP transport.
 * Host: `new ImessageClient(auth)`. Agent tools: `fromContext(ctx)`.
 *
 * Workers-safe: HTTP `fetch` only (no gRPC). Inbound events stay host webhooks.
 * @see https://github.com/photon-hq/advanced-imessage-ts
 */

import { createHttpClient } from '@photon-ai/advanced-imessage/http'
import type { AdvancedIMessage } from '@photon-ai/advanced-imessage/http'

import { ToolError } from '../../core/errors'
import { requireAuth } from '../../core/provider'
import type { FetchLike, ToolContext } from '../../core/types'
import type {
	ImessageAuth,
	ImessageClearReactionInput,
	ImessageDownloadFileInput,
	ImessageDownloadFileOutput,
	ImessageEditTextInput,
	ImessageMessageOutput,
	ImessageReadInput,
	ImessageSendChatActionInput,
	ImessageSendMediaInput,
	ImessageSendTextInput,
	ImessageSetReactionInput,
	ImessageUnsendInput
} from './contracts'
import { imessageAuthSchema } from './contracts'
import {
	decodeMediaBytes,
	isImessageDefiniteRejection,
	isImessageOutcomeUnknown,
	ImessageClientError,
	mapSdkError,
	messageToOutput,
	parseDownloadChunks,
	toSettableReaction
} from './domain'

/**
 * Photon SDK uses `globalThis.fetch` (mock in tests). No HttpService / photon-rest-proxy.
 */
export type ImessageClientOptions = {
	fetch?: FetchLike | undefined
	signal?: AbortSignal | undefined
}

export class ImessageClient {
	readonly #im: AdvancedIMessage

	constructor(auth: ImessageAuth, _options: ImessageClientOptions = {}) {
		const parsed = imessageAuthSchema.safeParse(auth)
		if (!parsed.success) {
			throw new ToolError('Invalid iMessage auth credentials', {
				code: 'bad_auth',
				details: { issues: parsed.error.issues.map((issue) => issue.message) }
			})
		}
		const { address, token, server, tls } = parsed.data
		this.#im = createHttpClient({
			address,
			token,
			...(server && { server }),
			...(tls !== undefined && { tls })
		})
	}

	static fromContext(ctx: ToolContext): ImessageClient {
		const auth = requireAuth(ctx, imessageAuthSchema)
		return new ImessageClient(auth, {
			...(ctx.fetch && { fetch: ctx.fetch }),
			...(ctx.signal && { signal: ctx.signal })
		})
	}

	/** Release SDK resources. */
	async close(): Promise<void> {
		await this.#im.close()
	}

	async sendText(input: ImessageSendTextInput): Promise<ImessageMessageOutput> {
		try {
			const message = await this.#im.messages.sendText(input.chat_id, input.text)
			return messageToOutput(input.chat_id, message)
		} catch (error) {
			mapSdkError('iMessage sendText', error)
		}
	}

	async editText(input: ImessageEditTextInput): Promise<ImessageMessageOutput> {
		try {
			const message = await this.#im.messages.edit(input.chat_id, input.message_id, input.text)
			return messageToOutput(input.chat_id, message)
		} catch (error) {
			mapSdkError('iMessage editText', error)
		}
	}

	/**
	 * Non-typing chat actions map to typing start (presentation parity with other channels).
	 */
	async sendChatAction(input: ImessageSendChatActionInput): Promise<void> {
		try {
			await this.#im.chats.setTyping(input.chat_id, true)
		} catch (error) {
			mapSdkError('iMessage sendChatAction', error)
		}
	}

	async stopTyping(input: { chat_id: string }): Promise<void> {
		try {
			await this.#im.chats.setTyping(input.chat_id, false)
		} catch (error) {
			mapSdkError('iMessage stopTyping', error)
		}
	}

	/**
	 * Add a tapback/emoji reaction. Returns the resulting message guid (store for journaling).
	 * Clear with clearReaction using the **same target message_id + emoji** (setReaction isSet=false).
	 */
	async setReaction(input: ImessageSetReactionInput): Promise<ImessageMessageOutput> {
		try {
			const message = await this.#im.messages.setReaction(
				input.chat_id,
				input.message_id,
				toSettableReaction(input.emoji),
				true
			)
			return messageToOutput(input.chat_id, message)
		} catch (error) {
			mapSdkError('iMessage setReaction', error)
		}
	}

	/**
	 * Remove a reaction. `message_id` is the **target** message; `emoji` must match setReaction.
	 */
	async clearReaction(input: ImessageClearReactionInput): Promise<void> {
		try {
			await this.#im.messages.setReaction(input.chat_id, input.message_id, toSettableReaction(input.emoji), false)
		} catch (error) {
			mapSdkError('iMessage clearReaction', error)
		}
	}

	async unsend(input: ImessageUnsendInput): Promise<void> {
		try {
			await this.#im.messages.unsend(input.chat_id, input.message_id)
		} catch (error) {
			mapSdkError('iMessage unsend', error)
		}
	}

	/** Mark the chat read (Advanced iMessage marks the whole conversation). */
	async read(input: ImessageReadInput): Promise<void> {
		try {
			await this.#im.chats.markRead(input.chat_id)
		} catch (error) {
			mapSdkError('iMessage read', error)
		}
	}

	/**
	 * Upload bytes then send attachment by GUID. Optional caption as follow-up text.
	 */
	async sendMedia(input: ImessageSendMediaInput): Promise<ImessageMessageOutput> {
		try {
			const data = decodeMediaBytes(input.body_base64)
			const uploaded = await this.#im.attachments.upload({
				fileName: input.file_name,
				data
			})
			const message = await this.#im.messages.sendAttachment(input.chat_id, uploaded.attachment.guid)
			if (input.caption) {
				await this.#im.messages.sendText(input.chat_id, input.caption)
			}
			return messageToOutput(input.chat_id, message)
		} catch (error) {
			mapSdkError('iMessage sendMedia', error)
		}
	}

	/**
	 * Download attachment bytes by attachment guid (`file_id`).
	 */
	async downloadFile(input: ImessageDownloadFileInput): Promise<ImessageDownloadFileOutput> {
		try {
			const frames: { type: string; data?: Uint8Array; info?: { fileName?: string; totalBytes?: number } }[] = []
			for await (const frame of this.#im.attachments.downloadStream(input.file_id)) {
				if (frame.type === 'header') {
					frames.push({
						type: 'header',
						info: {
							...(frame.info.fileName && { fileName: frame.info.fileName }),
							...(typeof frame.info.totalBytes === 'number' && { totalBytes: frame.info.totalBytes })
						}
					})
				} else if (frame.type === 'primaryChunk') {
					frames.push({ type: 'primaryChunk', data: frame.data })
				}
			}
			return parseDownloadChunks(input, frames)
		} catch (error) {
			mapSdkError('iMessage downloadFile', error)
		}
	}

	async answerCallback(_input: unknown): Promise<void> {
		// No interactive callbacks on iMessage.
	}
}

export { isImessageDefiniteRejection, isImessageOutcomeUnknown, ImessageClientError }
