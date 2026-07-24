/**
 * iMessage vendor client via hosted photon-rest-proxy (REST → Spectrum gRPC).
 * Host: `new ImessageClient(auth)`. Agent tools: `fromContext(ctx)`.
 *
 * Workers-safe: only HTTP to the proxy. No Photon SDK / gRPC in this package.
 */

import { ToolError } from '../../core/errors'
import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import { HttpService } from '../../transport/http-service'
import type { HttpServiceOptions } from '../../transport/http-service'
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
	assertProxyOk,
	isImessageDefiniteRejection,
	isImessageOutcomeUnknown,
	ImessageClientError,
	mediaBody,
	parseDownloadResult,
	parseMessageResult,
	parseOkResult,
	spaceBody,
	throwImessageTransportError
} from './domain'

export type ImessageClientOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'>

export class ImessageClient {
	readonly #http: HttpService
	readonly #defaultPhone: string | undefined

	constructor(auth: ImessageAuth, options: ImessageClientOptions = {}) {
		const parsed = imessageAuthSchema.safeParse(auth)
		if (!parsed.success) {
			throw new ToolError('Invalid iMessage auth credentials', {
				code: 'bad_auth',
				details: { issues: parsed.error.issues.map((issue) => issue.message) }
			})
		}
		const { base_url, project_id, project_secret, phone } = parsed.data
		this.#defaultPhone = phone
		this.#http = new HttpService({
			...options,
			baseURL: base_url,
			headers: {
				'Content-Type': 'application/json',
				'x-spectrum-project-id': project_id,
				'x-spectrum-project-secret': project_secret
			},
			label: 'iMessage'
		})
	}

	static fromContext(ctx: ToolContext): ImessageClient {
		const auth = requireAuth(ctx, imessageAuthSchema)
		return new ImessageClient(auth, {
			...(ctx.fetch && { fetch: ctx.fetch }),
			...(ctx.signal && { signal: ctx.signal })
		})
	}

	#phone(override: string | undefined): string | undefined {
		return override ?? this.#defaultPhone
	}

	async #post(path: string, body: Record<string, unknown>, label: string): Promise<unknown> {
		try {
			const res = await this.#http.post(path, body, { label, noThrow: true })
			assertProxyOk(label, res.status, res.data)
			return res.data
		} catch (error) {
			throwImessageTransportError(label, error)
		}
	}

	/** POST /v1/send */
	async sendText(input: ImessageSendTextInput): Promise<ImessageMessageOutput> {
		const data = await this.#post(
			'/v1/send',
			spaceBody(input.chat_id, this.#phone(input.phone), { text: input.text }),
			'iMessage send'
		)
		return parseMessageResult(data)
	}

	/** POST /v1/edit */
	async editText(input: ImessageEditTextInput): Promise<ImessageMessageOutput> {
		const data = await this.#post(
			'/v1/edit',
			spaceBody(input.chat_id, this.#phone(input.phone), {
				message_id: input.message_id,
				text: input.text
			}),
			'iMessage edit'
		)
		const ok = parseOkResult(data)
		return {
			space_id: ok.space_id ?? input.chat_id,
			message_id: input.message_id
		}
	}

	/**
	 * POST /v1/typing.
	 * Non-typing chat actions map to typing start (presentation parity with other channels).
	 */
	async sendChatAction(input: ImessageSendChatActionInput): Promise<void> {
		const action = input.action === 'typing' ? 'start' : 'start'
		await this.#post('/v1/typing', spaceBody(input.chat_id, this.#phone(input.phone), { action }), 'iMessage typing')
	}

	/** Stop typing indicator. */
	async stopTyping(input: { chat_id: string; phone?: string }): Promise<void> {
		await this.#post(
			'/v1/typing',
			spaceBody(input.chat_id, this.#phone(input.phone), { action: 'stop' }),
			'iMessage typing stop'
		)
	}

	/**
	 * POST /v1/react.
	 * Returns the reaction message_id — store it for clearReaction (Spectrum unsends the reaction Message).
	 */
	async setReaction(input: ImessageSetReactionInput): Promise<ImessageMessageOutput> {
		const data = await this.#post(
			'/v1/react',
			spaceBody(input.chat_id, this.#phone(input.phone), {
				message_id: input.message_id,
				emoji: input.emoji
			}),
			'iMessage react'
		)
		return parseMessageResult(data)
	}

	/**
	 * POST /v1/clear-reaction.
	 * `message_id` must be the reaction message id from setReaction / /v1/react (not the target message).
	 */
	async clearReaction(input: ImessageClearReactionInput): Promise<void> {
		await this.#post(
			'/v1/clear-reaction',
			spaceBody(input.chat_id, this.#phone(input.phone), { message_id: input.message_id }),
			'iMessage clearReaction'
		)
	}

	/** POST /v1/unsend */
	async unsend(input: ImessageUnsendInput): Promise<void> {
		await this.#post(
			'/v1/unsend',
			spaceBody(input.chat_id, this.#phone(input.phone), { message_id: input.message_id }),
			'iMessage unsend'
		)
	}

	/** POST /v1/read */
	async read(input: ImessageReadInput): Promise<void> {
		await this.#post(
			'/v1/read',
			spaceBody(input.chat_id, this.#phone(input.phone), { message_id: input.message_id }),
			'iMessage read'
		)
	}

	/** POST /v1/media — Spectrum attachment(Buffer, { name, mimeType }). */
	async sendMedia(input: ImessageSendMediaInput): Promise<ImessageMessageOutput> {
		const data = await this.#post('/v1/media', mediaBody(input, this.#phone(input.phone)), 'iMessage sendMedia')
		return parseMessageResult(data)
	}

	/**
	 * POST /v1/download.
	 * Requires `chat_id` (Spectrum space) plus `file_id` (attachment/voice message id from inbound).
	 */
	async downloadFile(input: ImessageDownloadFileInput): Promise<ImessageDownloadFileOutput> {
		const chatId = input.chat_id
		if (!chatId) {
			throw new ToolError('iMessage downloadFile requires chat_id (Spectrum space id)', {
				code: 'bad_input'
			})
		}
		const data = await this.#post(
			'/v1/download',
			spaceBody(chatId, this.#phone(input.phone), { file_id: input.file_id }),
			'iMessage downloadFile'
		)
		return parseDownloadResult(input, data)
	}

	async answerCallback(_input: unknown): Promise<void> {
		// No interactive callbacks on iMessage proxy path.
	}
}

export { isImessageDefiniteRejection, isImessageOutcomeUnknown, ImessageClientError }
