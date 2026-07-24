/**
 * Telegram Bot API vendor client.
 * Host: `new TelegramClient(auth)`. Agent tools: `fromContext(ctx)`.
 */

import { isPlainObject, isString } from 'es-toolkit'

import { ToolError } from '../../core/errors'
import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import { HttpService } from '../../transport/http-service'
import type { HttpServiceOptions } from '../../transport/http-service'
import type {
	TelegramAnswerCallbackInput,
	TelegramAuth,
	TelegramClearReactionInput,
	TelegramDownloadFileInput,
	TelegramDownloadFileOutput,
	TelegramEditTextInput,
	TelegramGetBotOutput,
	TelegramMessageOutput,
	TelegramSendChatActionInput,
	TelegramSendMediaGroupInput,
	TelegramSendMediaGroupOutput,
	TelegramSendMediaInput,
	TelegramSendTextInput,
	TelegramSetReactionInput
} from './contracts'
import { telegramAuthSchema } from './contracts'
import {
	buildMediaForm,
	buildMediaGroupForm,
	isTelegramDefiniteRejection,
	isTelegramOutcomeUnknown,
	parseBot,
	parseDownload,
	parseFile,
	parseMessage,
	parseMessages,
	parseOk,
	parseResult,
	TelegramClientError,
	throwTelegramTransportError
} from './domain'

export type TelegramClientOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'>

export class TelegramClient {
	readonly #token: string
	readonly #http: HttpService

	constructor(auth: TelegramAuth, options: TelegramClientOptions = {}) {
		const parsed = telegramAuthSchema.safeParse(auth)
		if (!parsed.success) {
			throw new ToolError('Invalid Telegram auth credentials', {
				code: 'bad_auth',
				details: { issues: parsed.error.issues.map((issue) => issue.message) }
			})
		}
		this.#token = parsed.data.bot_token
		this.#http = new HttpService({
			...options,
			baseURL: 'https://api.telegram.org',
			label: 'Telegram'
		})
	}

	static fromContext(ctx: ToolContext): TelegramClient {
		const auth = requireAuth(ctx, telegramAuthSchema)
		return new TelegramClient(auth, {
			...(ctx.fetch && { fetch: ctx.fetch }),
			...(ctx.signal && { signal: ctx.signal })
		})
	}

	async #post(path: string, body: FormData | Record<string, unknown>, label: string): Promise<unknown> {
		try {
			const res = await this.#http.post(path, body, { label, noThrow: true })
			return parseResult(label, res.status, res.data)
		} catch (error) {
			throwTelegramTransportError(label, error)
		}
	}

	/** POST /bot{token}/sendMessage */
	async sendText(input: TelegramSendTextInput): Promise<TelegramMessageOutput> {
		const body: Record<string, unknown> = {
			chat_id: input.chat_id,
			text: input.text,
			...(input.reply_markup !== undefined && { reply_markup: input.reply_markup }),
			...(input.reply_to_message_id && {
				reply_parameters: { message_id: Number.parseInt(input.reply_to_message_id, 10) }
			})
		}
		return parseMessage(await this.#post(`/bot${this.#token}/sendMessage`, body, 'Telegram sendMessage'))
	}

	/** POST /bot{token}/editMessageText */
	async editText(input: TelegramEditTextInput): Promise<TelegramMessageOutput> {
		const body: Record<string, unknown> = {
			chat_id: input.chat_id,
			message_id: Number.parseInt(input.message_id, 10),
			text: input.text,
			...(input.reply_markup !== undefined && { reply_markup: input.reply_markup })
		}
		return parseMessage(await this.#post(`/bot${this.#token}/editMessageText`, body, 'Telegram editMessageText'))
	}

	/** POST /bot{token}/sendChatAction */
	async sendChatAction(input: TelegramSendChatActionInput): Promise<void> {
		parseOk(
			await this.#post(
				`/bot${this.#token}/sendChatAction`,
				{ chat_id: input.chat_id, action: input.action },
				'Telegram sendChatAction'
			)
		)
	}

	/** POST /bot{token}/setMessageReaction */
	async setReaction(input: TelegramSetReactionInput): Promise<void> {
		parseOk(
			await this.#post(
				`/bot${this.#token}/setMessageReaction`,
				{
					chat_id: input.chat_id,
					message_id: Number.parseInt(input.message_id, 10),
					reaction: [{ type: 'emoji', emoji: input.emoji }]
				},
				'Telegram setMessageReaction'
			)
		)
	}

	/** POST /bot{token}/setMessageReaction (empty reaction) */
	async clearReaction(input: TelegramClearReactionInput): Promise<void> {
		parseOk(
			await this.#post(
				`/bot${this.#token}/setMessageReaction`,
				{
					chat_id: input.chat_id,
					message_id: Number.parseInt(input.message_id, 10),
					reaction: []
				},
				'Telegram setMessageReaction'
			)
		)
	}

	/** POST /bot{token}/sendPhoto | sendDocument */
	async sendMedia(input: TelegramSendMediaInput): Promise<TelegramMessageOutput> {
		const path = input.kind === 'photo' ? `/bot${this.#token}/sendPhoto` : `/bot${this.#token}/sendDocument`
		const label = input.kind === 'photo' ? 'Telegram sendPhoto' : 'Telegram sendDocument'
		return parseMessage(await this.#post(path, buildMediaForm(input), label))
	}

	/** POST /bot{token}/sendMediaGroup */
	async sendMediaGroup(input: TelegramSendMediaGroupInput): Promise<TelegramSendMediaGroupOutput> {
		return parseMessages(
			await this.#post(`/bot${this.#token}/sendMediaGroup`, buildMediaGroupForm(input), 'Telegram sendMediaGroup')
		)
	}

	/** POST getFile + GET /file/bot{token}/{file_path} */
	async downloadFile(input: TelegramDownloadFileInput): Promise<TelegramDownloadFileOutput> {
		const file = parseFile(
			await this.#post(`/bot${this.#token}/getFile`, { file_id: input.file_id }, 'Telegram getFile')
		)
		const filePath = file.file_path.replace(/^\/+/, '')
		let res: Awaited<ReturnType<HttpService['bytes']>>
		try {
			res = await this.#http.bytes('GET', `/file/bot${this.#token}/${filePath}`, {
				label: 'Telegram downloadFile',
				noThrow: true
			})
		} catch (error) {
			throwTelegramTransportError('Telegram downloadFile', error)
		}
		if (!res.ok) {
			throw new TelegramClientError({
				message: `Telegram downloadFile failed with HTTP ${res.status}`,
				failureKind:
					res.status === 400 || res.status === 401 || res.status === 403 || res.status === 404
						? 'definite_rejection'
						: 'outcome_unknown',
				method: 'Telegram downloadFile',
				status: res.status
			})
		}
		return parseDownload(input, file, res.bytes)
	}

	/** POST /bot{token}/answerCallbackQuery */
	async answerCallback(input: TelegramAnswerCallbackInput): Promise<void> {
		const body: Record<string, unknown> = {
			callback_query_id: input.callback_query_id,
			...(input.text && { text: input.text }),
			...(input.show_alert !== undefined && { show_alert: input.show_alert })
		}
		parseOk(await this.#post(`/bot${this.#token}/answerCallbackQuery`, body, 'Telegram answerCallbackQuery'))
	}

	/** POST /bot{token}/getMe */
	async getBot(): Promise<TelegramGetBotOutput> {
		return parseBot(await this.#post(`/bot${this.#token}/getMe`, {}, 'Telegram getMe'))
	}

	/** POST /bot{token}/getWebhookInfo */
	async getWebhookInfo(): Promise<{
		url: string
		pending_update_count: number
		last_error_at_unix?: number
		last_error_message?: string
	}> {
		const value = await this.#post(`/bot${this.#token}/getWebhookInfo`, {}, 'Telegram getWebhookInfo')
		if (!isPlainObject(value) || !isString(value['url']) || typeof value['pending_update_count'] !== 'number') {
			throw new ToolError('Telegram getWebhookInfo returned invalid payload', { code: 'upstream' })
		}
		return {
			url: value['url'],
			pending_update_count: value['pending_update_count'],
			...(typeof value['last_error_date'] === 'number' && { last_error_at_unix: value['last_error_date'] }),
			...(isString(value['last_error_message']) && { last_error_message: value['last_error_message'] })
		}
	}

	/** POST /bot{token}/setWebhook */
	async setWebhook(input: { url: string; secret_token: string; allowed_updates?: string[] }): Promise<void> {
		parseOk(
			await this.#post(
				`/bot${this.#token}/setWebhook`,
				{
					url: input.url,
					secret_token: input.secret_token,
					allowed_updates: input.allowed_updates ?? ['message', 'callback_query']
				},
				'Telegram setWebhook'
			)
		)
	}

	/** POST /bot{token}/deleteWebhook */
	async deleteWebhook(input?: { drop_pending_updates?: boolean }): Promise<void> {
		parseOk(
			await this.#post(
				`/bot${this.#token}/deleteWebhook`,
				{ drop_pending_updates: input?.drop_pending_updates ?? false },
				'Telegram deleteWebhook'
			)
		)
	}
}

export { isTelegramDefiniteRejection, isTelegramOutcomeUnknown, TelegramClientError }
