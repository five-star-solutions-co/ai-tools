/**
 * iMessage vendor client via @photon-ai/advanced-imessage **gRPC** (Node/Bun only).
 * Host: `new ImessageClient(auth)`. Agent tools: `fromContext(ctx)`.
 *
 * Auth (spectrum-ts cloud shape):
 * - Spectrum Cloud: `project_id` + `project_secret` → temporary tokens → managed gRPC hosts
 * - Direct gRPC: `address` + `token` (explicit line, spectrum-ts `clients[]` shape)
 *
 * Requires optional peers: `nice-grpc`, `nice-grpc-common`, `@grpc/grpc-js`.
 * @see https://github.com/photon-hq/spectrum-ts/blob/main/packages/imessage/src/auth.ts
 * @see https://github.com/photon-hq/advanced-imessage-ts
 */

import type { AdvancedIMessage } from '@photon-ai/advanced-imessage/grpc'

import { ToolError } from '../../core/errors'
import { requireAuth } from '../../core/provider'
import type { FetchLike, ToolContext } from '../../core/types'
import type {
	ImessageAuth,
	ImessageClearReactionInput,
	ImessageDownloadFileInput,
	ImessageDownloadFileOutput,
	ImessageEditTextInput,
	ImessageEnsureChatInput,
	ImessageEnsureChatOutput,
	ImessageMessageOutput,
	ImessageReadInput,
	ImessageSendChatActionInput,
	ImessageSendMediaInput,
	ImessageSendTextInput,
	ImessageSetReactionInput,
	ImessageUnsendInput
} from './contracts'
import { imessageAuthSchema, isImessageSpectrumAuth } from './contracts'
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
import { spectrumImessageGrpcAddress, SpectrumImessageTokenSource } from './spectrum-cloud'

/**
 * Spectrum Cloud token HTTP uses injectable `fetch` (tests).
 * gRPC plane uses native Node/Bun channels (not Workers/edge).
 */
export type ImessageClientOptions = {
	fetch?: FetchLike | undefined
	signal?: AbortSignal | undefined
}

export class ImessageClient {
	readonly #auth: ImessageAuth
	readonly #options: ImessageClientOptions
	#im: AdvancedIMessage | undefined
	#ready: Promise<AdvancedIMessage> | undefined
	#spectrum: SpectrumImessageTokenSource | undefined
	#grpcAddress: string | undefined

	constructor(auth: ImessageAuth, options: ImessageClientOptions = {}) {
		const parsed = imessageAuthSchema.safeParse(auth)
		if (!parsed.success) {
			throw new ToolError('Invalid iMessage auth credentials', {
				code: 'bad_auth',
				details: { issues: parsed.error.issues.map((issue) => issue.message) }
			})
		}
		this.#auth = parsed.data
		this.#options = options
	}

	static fromContext(ctx: ToolContext): ImessageClient {
		const auth = requireAuth(ctx, imessageAuthSchema)
		return new ImessageClient(auth, {
			...(ctx.fetch && { fetch: ctx.fetch }),
			...(ctx.signal && { signal: ctx.signal })
		})
	}

	/**
	 * Dedicated instance id after Spectrum mint (undefined for shared / direct gRPC).
	 * Available after the first outbound call (or after `ready()`).
	 */
	get server(): string | undefined {
		if (this.#spectrum) return this.#spectrum.server
		if (!isImessageSpectrumAuth(this.#auth)) return this.#auth.server
		return undefined
	}

	/** Resolved gRPC host:port after `ready()` / first call. */
	get grpcAddress(): string | undefined {
		return this.#grpcAddress ?? this.#spectrum?.grpcAddress
	}

	/** Resolve Spectrum tokens (if needed) and construct the gRPC SDK client. */
	async ready(): Promise<void> {
		await this.#sdk()
	}

	/** Release SDK resources. */
	async close(): Promise<void> {
		if (this.#im) await this.#im.close()
	}

	async #sdk(): Promise<AdvancedIMessage> {
		if (this.#im) return this.#im
		// Clear a failed init so a later call can retry (transient mint/network errors).
		this.#ready ??= this.#createSdk().catch((error: unknown) => {
			this.#ready = undefined
			throw error
		})
		this.#im = await this.#ready
		return this.#im
	}

	async #createSdk(): Promise<AdvancedIMessage> {
		// Dynamic import keeps messaging/edge graphs free of gRPC Node peers until call time.
		const { createGrpcClient } = await import('@photon-ai/advanced-imessage/grpc')
		const auth = this.#auth
		const tls = auth.tls !== false

		if (isImessageSpectrumAuth(auth)) {
			const spectrum = new SpectrumImessageTokenSource({
				auth,
				...(this.#options.fetch && { fetch: this.#options.fetch }),
				...(this.#options.signal && { signal: this.#options.signal })
			})
			this.#spectrum = spectrum
			const session = await spectrum.ensureReady()
			const address = spectrumImessageGrpcAddress(session, {
				sharedAddress: auth.spectrum_imessage_address
			})
			this.#grpcAddress = address
			// Same options spectrum-ts uses for cloud lines.
			return createGrpcClient({
				address,
				token: async () => spectrum.getBearer(),
				tls: true,
				autoIdempotency: true,
				retry: true
			})
		}

		const token = auth.token
		const address = auth.address
		if (!token || !address) {
			throw new ToolError(
				'iMessage direct gRPC auth requires address and token when Spectrum credentials are omitted',
				{
					code: 'bad_auth'
				}
			)
		}
		this.#grpcAddress = address
		return createGrpcClient({
			address,
			token,
			tls,
			autoIdempotency: true,
			retry: true
		})
	}

	/**
	 * Create a chat (1:1 or group) via Photon `chats.create`.
	 * Host-only: call once for contact / proactive delivery, store `chat_id`, then sendText.
	 * Does **not** run automatically before sendText — most threads already exist from inbound user messages.
	 */
	async ensureChat(input: ImessageEnsureChatInput): Promise<ImessageEnsureChatOutput> {
		try {
			const im = await this.#sdk()
			const created = await im.chats.create(input.addresses, {
				...(input.message && { message: input.message }),
				...(input.client_message_id && { clientMessageId: input.client_message_id })
			})
			const out: ImessageEnsureChatOutput = { chat_id: created.chat.guid }
			if (created.initialMessage?.guid) {
				out.message_id = created.initialMessage.guid
			}
			return out
		} catch (error) {
			mapSdkError('iMessage ensureChat', error)
		}
	}

	async sendText(input: ImessageSendTextInput): Promise<ImessageMessageOutput> {
		try {
			const im = await this.#sdk()
			const message = await im.messages.sendText(input.chat_id, input.text)
			return messageToOutput(input.chat_id, message)
		} catch (error) {
			mapSdkError('iMessage sendText', error)
		}
	}

	async editText(input: ImessageEditTextInput): Promise<ImessageMessageOutput> {
		try {
			const im = await this.#sdk()
			const message = await im.messages.edit(input.chat_id, input.message_id, input.text)
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
			const im = await this.#sdk()
			await im.chats.setTyping(input.chat_id, true)
		} catch (error) {
			mapSdkError('iMessage sendChatAction', error)
		}
	}

	async stopTyping(input: { chat_id: string }): Promise<void> {
		try {
			const im = await this.#sdk()
			await im.chats.setTyping(input.chat_id, false)
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
			const im = await this.#sdk()
			const message = await im.messages.setReaction(
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
			const im = await this.#sdk()
			await im.messages.setReaction(input.chat_id, input.message_id, toSettableReaction(input.emoji), false)
		} catch (error) {
			mapSdkError('iMessage clearReaction', error)
		}
	}

	async unsend(input: ImessageUnsendInput): Promise<void> {
		try {
			const im = await this.#sdk()
			await im.messages.unsend(input.chat_id, input.message_id)
		} catch (error) {
			mapSdkError('iMessage unsend', error)
		}
	}

	/** Mark the chat read (Advanced iMessage marks the whole conversation). */
	async read(input: ImessageReadInput): Promise<void> {
		try {
			const im = await this.#sdk()
			await im.chats.markRead(input.chat_id)
		} catch (error) {
			mapSdkError('iMessage read', error)
		}
	}

	/**
	 * Upload bytes then send attachment by GUID. Optional caption as follow-up text.
	 */
	async sendMedia(input: ImessageSendMediaInput): Promise<ImessageMessageOutput> {
		try {
			const im = await this.#sdk()
			const data = decodeMediaBytes(input.body_base64)
			const uploaded = await im.attachments.upload({
				fileName: input.file_name,
				data
			})
			const message = await im.messages.sendAttachment(input.chat_id, uploaded.attachment.guid)
			if (input.caption) {
				await im.messages.sendText(input.chat_id, input.caption)
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
			const im = await this.#sdk()
			const frames: { type: string; data?: Uint8Array; info?: { fileName?: string; totalBytes?: number } }[] = []
			for await (const frame of im.attachments.downloadStream(input.file_id)) {
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
