/**
 * Microsoft Teams / Bot Framework vendor client.
 * Host: `new TeamsClient(auth)`. Agent tools: `fromContext(ctx)`.
 *
 * Connector base is per-conversation (`service_url` on method input).
 * Access tokens are cached on the instance with ~60s skew.
 */

import { ToolError } from '../../core/errors'
import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import { HttpService } from '../../transport/http-service'
import type { HttpServiceOptions } from '../../transport/http-service'
import type {
	TeamsAnswerCallbackInput,
	TeamsAuth,
	TeamsClearReactionInput,
	TeamsDownloadFileInput,
	TeamsDownloadFileOutput,
	TeamsEditTextInput,
	TeamsGetBotOutput,
	TeamsMessageOutput,
	TeamsSendChatActionInput,
	TeamsSendMediaInput,
	TeamsSendTextInput,
	TeamsSetReactionInput
} from './contracts'
import { teamsAuthSchema } from './contracts'
import {
	botframeworkTokenBody,
	botframeworkTokenUrl,
	botIdentityFromAuth,
	buildInvokeResponseBody,
	buildMediaActivity,
	buildMessageActivity,
	buildTypingActivity,
	conversationActivitiesPath,
	conversationActivityPath,
	isAbsoluteHttpUrl,
	isTeamsDefiniteRejection,
	isTeamsOutcomeUnknown,
	parseAccessToken,
	parseActivityId,
	parseDownload,
	TeamsClientError,
	throwForStatus,
	throwTeamsTransportError
} from './domain'

export type TeamsClientOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'>

export class TeamsClient {
	readonly #auth: TeamsAuth
	readonly #http: HttpService
	#accessToken: string | undefined
	#accessTokenExpiresAt = 0

	constructor(auth: TeamsAuth, options: TeamsClientOptions = {}) {
		const parsed = teamsAuthSchema.safeParse(auth)
		if (!parsed.success) {
			throw new ToolError('Invalid Teams auth credentials', {
				code: 'bad_auth',
				details: { issues: parsed.error.issues.map((issue) => issue.message) }
			})
		}
		this.#auth = parsed.data
		this.#http = new HttpService({
			...options,
			label: 'Teams'
		})
	}

	static fromContext(ctx: ToolContext): TeamsClient {
		const auth = requireAuth(ctx, teamsAuthSchema)
		return new TeamsClient(auth, {
			...(ctx.fetch && { fetch: ctx.fetch }),
			...(ctx.signal && { signal: ctx.signal })
		})
	}

	async #ensureAccessToken(): Promise<string> {
		const now = Date.now()
		if (this.#accessToken && now < this.#accessTokenExpiresAt - 60_000) {
			return this.#accessToken
		}
		try {
			const { data } = await this.#http.post(
				botframeworkTokenUrl(this.#auth.tenant_id),
				botframeworkTokenBody(this.#auth),
				{
					label: 'Teams token',
					headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
				}
			)
			const token = parseAccessToken(data)
			this.#accessToken = token.access_token
			this.#accessTokenExpiresAt = now + token.expires_in * 1000
			return token.access_token
		} catch (error) {
			throwTeamsTransportError('Teams token', error)
		}
	}

	async #postActivity(
		label: string,
		url: string,
		body: Record<string, unknown>,
		headers: Record<string, string>
	): Promise<Awaited<ReturnType<HttpService['post']>>> {
		try {
			return await this.#http.post(url, body, { label, headers, noThrow: true })
		} catch (error) {
			throwTeamsTransportError(label, error)
		}
	}

	async #putActivity(
		label: string,
		url: string,
		body: Record<string, unknown>,
		headers: Record<string, string>
	): Promise<Awaited<ReturnType<HttpService['put']>>> {
		try {
			return await this.#http.put(url, body, { label, headers, noThrow: true })
		} catch (error) {
			throwTeamsTransportError(label, error)
		}
	}

	async #authHeaders(): Promise<Record<string, string>> {
		const token = await this.#ensureAccessToken()
		return {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		}
	}

	/** POST {service_url}/v3/conversations/{chat_id}/activities — type message */
	async sendText(input: TeamsSendTextInput): Promise<TeamsMessageOutput> {
		const headers = await this.#authHeaders()
		const url = conversationActivitiesPath(input.service_url, input.chat_id)
		const body = buildMessageActivity({
			text: input.text,
			...(input.reply_to_message_id && { reply_to_message_id: input.reply_to_message_id }),
			...(input.reply_markup !== undefined && { reply_markup: input.reply_markup })
		})
		const res = await this.#postActivity('Teams sendText', url, body, headers)
		if (!res.ok) throwForStatus('Teams sendText', res.status, res.data)
		return parseActivityId(res.data)
	}

	/** PUT {service_url}/v3/conversations/{chat_id}/activities/{message_id} */
	async editText(input: TeamsEditTextInput): Promise<TeamsMessageOutput> {
		const headers = await this.#authHeaders()
		const url = conversationActivityPath(input.service_url, input.chat_id, input.message_id)
		const body = buildMessageActivity({
			text: input.text,
			...(input.reply_markup !== undefined && { reply_markup: input.reply_markup })
		})
		const res = await this.#putActivity('Teams editText', url, body, headers)
		if (!res.ok) throwForStatus('Teams editText', res.status, res.data)
		// Update may return empty body; preserve the edited activity id.
		if (res.data === undefined || res.data === null || res.data === '') {
			return { message_id: input.message_id }
		}
		try {
			return parseActivityId(res.data)
		} catch {
			return { message_id: input.message_id }
		}
	}

	/** POST typing activity (all ChannelTransport actions map to typing). */
	async sendChatAction(input: TeamsSendChatActionInput): Promise<void> {
		const headers = await this.#authHeaders()
		const url = conversationActivitiesPath(input.service_url, input.chat_id)
		const res = await this.#postActivity('Teams sendChatAction', url, buildTypingActivity(), headers)
		if (!res.ok) throwForStatus('Teams sendChatAction', res.status, res.data)
	}

	/**
	 * Presentation no-op. Teams Bot Framework has limited bot reaction support;
	 * ChannelTransport still exposes setReaction so live seams stay uniform.
	 */
	async setReaction(_input: TeamsSetReactionInput): Promise<void> {
		return
	}

	/**
	 * Presentation no-op. See setReaction.
	 */
	async clearReaction(_input: TeamsClearReactionInput): Promise<void> {
		return
	}

	/** POST message with data-URI attachment (small files). */
	async sendMedia(input: TeamsSendMediaInput): Promise<TeamsMessageOutput> {
		const headers = await this.#authHeaders()
		const url = conversationActivitiesPath(input.service_url, input.chat_id)
		const body = buildMediaActivity(input)
		const res = await this.#postActivity('Teams sendMedia', url, body, headers)
		if (!res.ok) throwForStatus('Teams sendMedia', res.status, res.data)
		return parseActivityId(res.data)
	}

	/** GET content URL (file_id) with bearer token; return body_base64. */
	async downloadFile(input: TeamsDownloadFileInput): Promise<TeamsDownloadFileOutput> {
		const token = await this.#ensureAccessToken()
		let res: Awaited<ReturnType<HttpService['bytes']>>
		try {
			res = await this.#http.bytes('GET', input.file_id, {
				label: 'Teams downloadFile',
				headers: { Authorization: `Bearer ${token}` },
				noThrow: true
			})
		} catch (error) {
			throwTeamsTransportError('Teams downloadFile', error)
		}
		if (!res.ok) {
			throw new TeamsClientError({
				message: `Teams downloadFile failed with HTTP ${res.status}`,
				failureKind:
					res.status === 400 || res.status === 401 || res.status === 403 || res.status === 404
						? 'definite_rejection'
						: 'outcome_unknown',
				method: 'Teams downloadFile',
				status: res.status
			})
		}
		return parseDownload(input, res.bytes)
	}

	/**
	 * Answer an invoke callback. When `callback_query_id` is an absolute HTTP(S)
	 * reply path, POST an invokeResponse there. Otherwise succeed as a no-op
	 * (host may have already completed the HTTP invoke response).
	 */
	async answerCallback(input: TeamsAnswerCallbackInput): Promise<void> {
		if (!isAbsoluteHttpUrl(input.callback_query_id)) {
			return
		}
		const headers = await this.#authHeaders()
		const body = buildInvokeResponseBody({
			...(input.text && { text: input.text }),
			...(input.show_alert !== undefined && { show_alert: input.show_alert })
		})
		const res = await this.#postActivity('Teams answerCallback', input.callback_query_id, body, headers)
		if (!res.ok) throwForStatus('Teams answerCallback', res.status, res.data)
	}

	/** Identity from bound auth (no connector call). */
	async getBot(): Promise<TeamsGetBotOutput> {
		return botIdentityFromAuth(this.#auth.app_id)
	}
}

export { isTeamsDefiniteRejection, isTeamsOutcomeUnknown, TeamsClientError }
