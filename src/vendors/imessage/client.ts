/**
 * iMessage vendor client via hosted photon-rest-proxy (REST → Spectrum gRPC).
 * Host: `new ImessageClient(auth)`. Agent tools: `fromContext(ctx)`.
 *
 * Workers-safe: only HTTP to the proxy. No Photon SDK / gRPC in this package.
 */

import { isPlainObject, isString } from 'es-toolkit'

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
import { imessageAuthSchema } from './contracts'
import {
	assertProxyOk,
	isImessageDefiniteRejection,
	isImessageOutcomeUnknown,
	ImessageClientError,
	mediaBody,
	parseDownloadResult,
	parseEnsureChatResult,
	parseMessageResult,
	parseOkResult,
	spaceBody
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
		const res = await this.#http.post(path, body, { label, noThrow: true })
		assertProxyOk(label, res.status, res.data)
		return res.data
	}

	/**
	 * Create a chat (1:1 or group). Host-only; not an agent tool.
	 * Proxy: POST /v1/ensure-chat (fill on proxy if not yet shipped).
	 */
	async ensureChat(input: ImessageEnsureChatInput): Promise<ImessageEnsureChatOutput> {
		const data = await this.#post(
			'/v1/ensure-chat',
			spaceBody(undefined, this.#phone(input.phone), {
				addresses: input.addresses,
				...(input.message && { message: input.message }),
				...(input.client_message_id && { client_message_id: input.client_message_id })
			}),
			'iMessage ensureChat'
		)
		return parseEnsureChatResult(data)
	}

	/** POST /v1/send */
	async sendText(input: ImessageSendTextInput): Promise<ImessageMessageOutput> {
		const data = await this.#post(
			'/v1/send',
			spaceBody(input.chat_id, this.#phone(input.phone), { text: input.text }),
			'iMessage send'
		)
		return parseMessageResult(data, 'send')
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
		// Prefer full message payload; fall back to ok + input message_id when proxy only returns ok.
		if (isPlainObject(data) && data['ok'] === true && isString(data['message_id']) && data['message_id'].length > 0) {
			return parseMessageResult(data, 'edit')
		}
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
		await this.#post(
			'/v1/typing',
			spaceBody(input.chat_id, this.#phone(input.phone), { action: 'start' }),
			'iMessage typing'
		)
	}

	/** Stop typing indicator. */
	async stopTyping(input: { chat_id: string; phone?: string }): Promise<void> {
		await this.#post(
			'/v1/typing',
			spaceBody(input.chat_id, this.#phone(input.phone), { action: 'stop' }),
			'iMessage typing stop'
		)
	}

	/** POST /v1/react — returns reaction/message guid for journaling. */
	async setReaction(input: ImessageSetReactionInput): Promise<ImessageMessageOutput> {
		const data = await this.#post(
			'/v1/react',
			spaceBody(input.chat_id, this.#phone(input.phone), {
				message_id: input.message_id,
				emoji: input.emoji
			}),
			'iMessage react'
		)
		return parseMessageResult(data, 'react')
	}

	/**
	 * POST /v1/clear-reaction.
	 * Package contract: target message_id + emoji (same as setReaction).
	 * Proxy should clear by target+emoji; older proxies that only accept reaction message ids need a gap fill.
	 */
	async clearReaction(input: ImessageClearReactionInput): Promise<void> {
		await this.#post(
			'/v1/clear-reaction',
			spaceBody(input.chat_id, this.#phone(input.phone), {
				message_id: input.message_id,
				emoji: input.emoji
			}),
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
			spaceBody(input.chat_id, this.#phone(input.phone), {
				...(input.message_id && { message_id: input.message_id })
			}),
			'iMessage read'
		)
	}

	/** POST /v1/media */
	async sendMedia(input: ImessageSendMediaInput): Promise<ImessageMessageOutput> {
		const data = await this.#post('/v1/media', mediaBody(input, this.#phone(input.phone)), 'iMessage sendMedia')
		return parseMessageResult(data, 'media')
	}

	/**
	 * POST /v1/download.
	 * Prefer attachment guid alone; pass chat_id when the proxy still requires a space.
	 */
	async downloadFile(input: ImessageDownloadFileInput): Promise<ImessageDownloadFileOutput> {
		const data = await this.#post(
			'/v1/download',
			spaceBody(input.chat_id, this.#phone(input.phone), { file_id: input.file_id }),
			'iMessage downloadFile'
		)
		return parseDownloadResult(input, data)
	}

	async answerCallback(_input: unknown): Promise<void> {
		// No interactive callbacks on iMessage.
	}
}

export { isImessageDefiniteRejection, isImessageOutcomeUnknown, ImessageClientError }
