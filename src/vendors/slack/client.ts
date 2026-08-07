/**
 * Slack Web API vendor client.
 * Host: `new SlackClient(auth)`. Agent tools: `fromContext(ctx)`.
 */

import { ToolError } from '../../core/errors'
import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import { HttpService } from '../../transport/http-service'
import type { HttpServiceOptions } from '../../transport/http-service'
import type {
	SlackAnswerCallbackInput,
	SlackAppendStreamInput,
	SlackAuth,
	SlackAuthRevokeInput,
	SlackAuthRevokeOutput,
	SlackClearReactionInput,
	SlackConversationHistoryInput,
	SlackConversationInfoInput,
	SlackConversationInfoOutput,
	SlackConversationMessagesOutput,
	SlackConversationRepliesInput,
	SlackDownloadFileInput,
	SlackDownloadFileOutput,
	SlackEditTextInput,
	SlackGetBotOutput,
	SlackListConversationsInput,
	SlackListConversationsOutput,
	SlackMessageOutput,
	SlackPostEphemeralInput,
	SlackPublishHomeInput,
	SlackSendChatActionInput,
	SlackSendMediaBatchInput,
	SlackSendMediaBatchOutput,
	SlackSendMediaInput,
	SlackSendTextInput,
	SlackSetAssistantStatusInput,
	SlackSetReactionInput,
	SlackSetSuggestedPromptsInput,
	SlackStartStreamInput,
	SlackStopStreamInput,
	SlackStopTypingInput,
	SlackUsersConversationsInput,
	SlackUsersInfoInput,
	SlackUsersInfoOutput
} from './contracts'
import { slackAuthSchema } from './contracts'
import {
	assistantStatusFromChatAction,
	isHttpsUrl,
	isSlackDefiniteRejection,
	isSlackOutcomeUnknown,
	normalizeEmojiName,
	parseAuthRevoke,
	parseBot,
	parseConversationInfo,
	parseConversationMessages,
	parseConversationsList,
	parseDownload,
	parseFileInfo,
	parseMessageTs,
	parseOk,
	parseSlackResult,
	parseStreamTs,
	parseUploadBatchComplete,
	parseUploadComplete,
	parseUploadUrl,
	parseUsersInfo,
	resolveMediaBytes,
	SlackClientError,
	throwSlackTransportError
} from './domain'

export type SlackClientOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'>

export class SlackClient {
	readonly #token: string
	/** Authenticated Slack Web API (`https://slack.com/api`). */
	readonly #http: HttpService
	/** Bare HTTP for pre-signed upload URLs and interactive response_url (no bot Authorization). */
	readonly #external: HttpService

	constructor(auth: SlackAuth, options: SlackClientOptions = {}) {
		const parsed = slackAuthSchema.safeParse(auth)
		if (!parsed.success) {
			throw new ToolError('Invalid Slack auth credentials', {
				code: 'bad_auth',
				details: { issues: parsed.error.issues.map((issue) => issue.message) }
			})
		}
		this.#token = parsed.data.bot_token
		this.#http = new HttpService({
			...options,
			baseURL: 'https://slack.com/api',
			headers: {
				Authorization: `Bearer ${parsed.data.bot_token}`,
				'Content-Type': 'application/json'
			},
			label: 'Slack'
		})
		this.#external = new HttpService({
			...options,
			label: 'Slack'
		})
	}

	static fromContext(ctx: ToolContext): SlackClient {
		const auth = requireAuth(ctx, slackAuthSchema)
		return new SlackClient(auth, {
			...(ctx.fetch && { fetch: ctx.fetch }),
			...(ctx.signal && { signal: ctx.signal })
		})
	}

	async #api(method: string, body: Record<string, unknown>, label: string): Promise<Record<string, unknown>> {
		try {
			const res = await this.#http.post(`/${method}`, body, { label, noThrow: true })
			return parseSlackResult(label, res.status, res.data)
		} catch (error) {
			throwSlackTransportError(label, error)
		}
	}

	/** Form-urlencoded Web API call (used where Slack documents form as primary, e.g. getUploadURLExternal). */
	async #apiForm(method: string, body: URLSearchParams, label: string): Promise<Record<string, unknown>> {
		try {
			const res = await this.#http.post(`/${method}`, body, {
				label,
				noThrow: true,
				headers: {
					Authorization: `Bearer ${this.#token}`,
					'Content-Type': 'application/x-www-form-urlencoded'
				}
			})
			return parseSlackResult(label, res.status, res.data)
		} catch (error) {
			throwSlackTransportError(label, error)
		}
	}

	/** POST chat.postMessage */
	async sendText(input: SlackSendTextInput): Promise<SlackMessageOutput> {
		const body: Record<string, unknown> = {
			channel: input.chat_id,
			text: input.text,
			...(input.reply_to_message_id && { thread_ts: input.reply_to_message_id }),
			...(input.reply_markup !== undefined && { blocks: input.reply_markup })
		}
		return parseMessageTs(await this.#api('chat.postMessage', body, 'Slack chat.postMessage'))
	}

	/** POST chat.update */
	async editText(input: SlackEditTextInput): Promise<SlackMessageOutput> {
		const body: Record<string, unknown> = {
			channel: input.chat_id,
			ts: input.message_id,
			text: input.text,
			...(input.reply_markup !== undefined && { blocks: input.reply_markup })
		}
		return parseMessageTs(await this.#api('chat.update', body, 'Slack chat.update'))
	}

	/**
	 * Chat action (typing / upload_*).
	 * With `reply_to_message_id` (thread_ts): `assistant.threads.setStatus` loading line.
	 * Without thread_ts: no-op (Slack has no channel-level typing API).
	 * @see https://docs.slack.dev/reference/methods/assistant.threads.setStatus
	 */
	async sendChatAction(input: SlackSendChatActionInput): Promise<void> {
		const threadTs = input.reply_to_message_id
		if (!threadTs) return
		parseOk(
			await this.#api(
				'assistant.threads.setStatus',
				{
					channel_id: input.chat_id,
					thread_ts: threadTs,
					status: assistantStatusFromChatAction(input.action)
				},
				'Slack assistant.threads.setStatus'
			)
		)
	}

	/**
	 * Clear assistant thread status (`status: ""`).
	 * Requires `reply_to_message_id` (thread_ts); otherwise no-op.
	 */
	async stopTyping(input: SlackStopTypingInput): Promise<void> {
		const threadTs = input.reply_to_message_id
		if (!threadTs) return
		parseOk(
			await this.#api(
				'assistant.threads.setStatus',
				{
					channel_id: input.chat_id,
					thread_ts: threadTs,
					status: ''
				},
				'Slack assistant.threads.setStatus clear'
			)
		)
	}

	/** POST reactions.add */
	async setReaction(input: SlackSetReactionInput): Promise<void> {
		parseOk(
			await this.#api(
				'reactions.add',
				{
					channel: input.chat_id,
					timestamp: input.message_id,
					name: normalizeEmojiName(input.emoji)
				},
				'Slack reactions.add'
			)
		)
	}

	/** POST reactions.remove — emoji required on Slack. */
	async clearReaction(input: SlackClearReactionInput): Promise<void> {
		parseOk(
			await this.#api(
				'reactions.remove',
				{
					channel: input.chat_id,
					timestamp: input.message_id,
					name: normalizeEmojiName(input.emoji)
				},
				'Slack reactions.remove'
			)
		)
	}

	/**
	 * External upload flow:
	 * files.getUploadURLExternal → POST bytes to upload_url → files.completeUploadExternal
	 * @see https://docs.slack.dev/reference/methods/files.getUploadURLExternal
	 */
	async sendMedia(input: SlackSendMediaInput & { body?: Uint8Array }): Promise<SlackMessageOutput> {
		const { bytes, body } = resolveMediaBytes(input)
		// Slack accepts JSON, but form-urlencoded is the documented primary content type for this
		// method and avoids edge cases with numeric `length` on some gateways.
		const form = new URLSearchParams()
		form.set('filename', input.file_name)
		form.set('length', String(bytes.byteLength))
		const upload = parseUploadUrl(
			await this.#apiForm('files.getUploadURLExternal', form, 'Slack files.getUploadURLExternal')
		)

		// Slack expects POST of raw bytes (or multipart) to the upload URL — not JSON API.
		const putHeaders: Record<string, string> = {
			'Content-Type': input.content_type ?? 'application/octet-stream'
		}
		let put: Awaited<ReturnType<HttpService['post']>>
		try {
			put = await this.#external.post(upload.upload_url, body, {
				label: 'Slack file upload POST',
				noThrow: true,
				headers: putHeaders
			})
		} catch (error) {
			throwSlackTransportError('Slack file upload POST', error)
		}
		if (!put.ok) {
			throw new SlackClientError({
				message: `Slack file upload POST failed with HTTP ${put.status}`,
				failureKind:
					put.status === 400 || put.status === 401 || put.status === 403 || put.status === 404
						? 'definite_rejection'
						: 'outcome_unknown',
				method: 'Slack file upload POST',
				status: put.status
			})
		}

		return parseUploadComplete(
			await this.#api(
				'files.completeUploadExternal',
				{
					files: [{ id: upload.file_id, title: input.file_name }],
					channel_id: input.chat_id,
					...(input.reply_to_message_id && { thread_ts: input.reply_to_message_id }),
					...(input.caption && { initial_comment: input.caption })
				},
				'Slack files.completeUploadExternal'
			),
			upload.file_id
		)
	}

	/** POST files.info + GET url_private_download (Bearer). */
	async downloadFile(input: SlackDownloadFileInput): Promise<SlackDownloadFileOutput> {
		const file = parseFileInfo(await this.#api('files.info', { file: input.file_id }, 'Slack files.info'))
		let res: Awaited<ReturnType<HttpService['bytes']>>
		try {
			res = await this.#http.bytes('GET', file.url_private_download, {
				label: 'Slack downloadFile',
				noThrow: true,
				headers: {
					Authorization: `Bearer ${this.#token}`
				}
			})
		} catch (error) {
			throwSlackTransportError('Slack downloadFile', error)
		}
		if (!res.ok) {
			throw new SlackClientError({
				message: `Slack downloadFile failed with HTTP ${res.status}`,
				failureKind:
					res.status === 400 || res.status === 401 || res.status === 403 || res.status === 404
						? 'definite_rejection'
						: 'outcome_unknown',
				method: 'Slack downloadFile',
				status: res.status
			})
		}
		return parseDownload(input, file, res.bytes)
	}

	/**
	 * Answer an interactive payload.
	 * When callback_query_id is an http(s) response_url, POST ephemeral JSON to it.
	 * Otherwise no-op success (Slack has no Telegram-style answerCallbackQuery id).
	 */
	async answerCallback(input: SlackAnswerCallbackInput): Promise<void> {
		if (!isHttpsUrl(input.callback_query_id)) {
			return
		}
		const body: Record<string, unknown> = {
			replace_original: false,
			response_type: 'ephemeral',
			...(input.text && { text: input.text })
		}
		let res: Awaited<ReturnType<HttpService['post']>>
		try {
			res = await this.#external.post(input.callback_query_id, body, {
				label: 'Slack response_url',
				noThrow: true,
				headers: { 'Content-Type': 'application/json' }
			})
		} catch (error) {
			throwSlackTransportError('Slack response_url', error)
		}
		if (!res.ok) {
			throw new SlackClientError({
				message: `Slack response_url failed with HTTP ${res.status}`,
				failureKind:
					res.status === 400 || res.status === 401 || res.status === 403 || res.status === 404
						? 'definite_rejection'
						: 'outcome_unknown',
				method: 'Slack response_url',
				status: res.status
			})
		}
	}

	/** POST auth.test */
	async getBot(): Promise<SlackGetBotOutput> {
		return parseBot(await this.#api('auth.test', {}, 'Slack auth.test'))
	}

	/** POST chat.postEphemeral */
	async postEphemeral(input: SlackPostEphemeralInput): Promise<SlackMessageOutput> {
		const body: Record<string, unknown> = {
			channel: input.chat_id,
			user: input.user_id,
			text: input.text,
			...(input.reply_markup !== undefined && { blocks: input.reply_markup })
		}
		const result = await this.#api('chat.postEphemeral', body, 'Slack chat.postEphemeral')
		const messageTs = result['message_ts']
		if (typeof messageTs === 'string' && messageTs.length > 0) {
			return { message_id: messageTs }
		}
		// Some workspaces only return ok without message_ts.
		return { message_id: 'ephemeral' }
	}

	/** POST conversations.list */
	async listConversations(input: SlackListConversationsInput = {}): Promise<SlackListConversationsOutput> {
		const body: Record<string, unknown> = {
			...(input.limit !== undefined && { limit: input.limit }),
			...(input.cursor && { cursor: input.cursor }),
			...(input.types && { types: input.types })
		}
		return parseConversationsList(await this.#api('conversations.list', body, 'Slack conversations.list'))
	}

	/**
	 * Full assistant.threads.setStatus (custom status + optional loading_messages).
	 * Prefer this over sendChatAction when the host already has status copy.
	 * @see https://docs.slack.dev/reference/methods/assistant.threads.setStatus
	 */
	async setAssistantStatus(input: SlackSetAssistantStatusInput): Promise<void> {
		parseOk(
			await this.#api(
				'assistant.threads.setStatus',
				{
					channel_id: input.chat_id,
					thread_ts: input.thread_ts,
					status: input.status,
					...(input.loading_messages &&
						input.loading_messages.length > 0 && { loading_messages: input.loading_messages })
				},
				'Slack assistant.threads.setStatus'
			)
		)
	}

	/** POST assistant.threads.setSuggestedPrompts (max 4). */
	async setSuggestedPrompts(input: SlackSetSuggestedPromptsInput): Promise<void> {
		parseOk(
			await this.#api(
				'assistant.threads.setSuggestedPrompts',
				{
					channel_id: input.chat_id,
					prompts: input.prompts,
					...(input.thread_ts && { thread_ts: input.thread_ts }),
					...(input.title && { title: input.title })
				},
				'Slack assistant.threads.setSuggestedPrompts'
			)
		)
	}

	/** POST views.publish — App Home for a user. */
	async publishHome(input: SlackPublishHomeInput): Promise<void> {
		parseOk(
			await this.#api(
				'views.publish',
				{
					user_id: input.user_id,
					view: input.view,
					...(input.hash && { hash: input.hash })
				},
				'Slack views.publish'
			)
		)
	}

	/** POST chat.startStream — begins a streaming thread reply. */
	async startStream(input: SlackStartStreamInput): Promise<SlackMessageOutput> {
		const body: Record<string, unknown> = {
			channel: input.chat_id,
			thread_ts: input.thread_ts,
			...(input.markdown_text && { markdown_text: input.markdown_text }),
			...(input.recipient_user_id && { recipient_user_id: input.recipient_user_id }),
			...(input.recipient_team_id && { recipient_team_id: input.recipient_team_id }),
			...(input.task_display_mode && { task_display_mode: input.task_display_mode })
		}
		return parseStreamTs(await this.#api('chat.startStream', body, 'Slack chat.startStream'))
	}

	/** POST chat.appendStream */
	async appendStream(input: SlackAppendStreamInput): Promise<SlackMessageOutput> {
		return parseStreamTs(
			await this.#api(
				'chat.appendStream',
				{
					channel: input.chat_id,
					ts: input.message_id,
					markdown_text: input.markdown_text
				},
				'Slack chat.appendStream'
			)
		)
	}

	/** POST chat.stopStream */
	async stopStream(input: SlackStopStreamInput): Promise<SlackMessageOutput> {
		const body: Record<string, unknown> = {
			channel: input.chat_id,
			ts: input.message_id,
			...(input.markdown_text && { markdown_text: input.markdown_text }),
			...(input.blocks !== undefined && { blocks: input.blocks })
		}
		return parseStreamTs(await this.#api('chat.stopStream', body, 'Slack chat.stopStream'))
	}

	/** POST auth.revoke — disconnect installation (host-only). */
	async authRevoke(input: SlackAuthRevokeInput = {}): Promise<SlackAuthRevokeOutput> {
		const body: Record<string, unknown> = {
			...(input.test !== undefined && { test: input.test })
		}
		return parseAuthRevoke(await this.#api('auth.revoke', body, 'Slack auth.revoke'))
	}

	/** POST users.info */
	async usersInfo(input: SlackUsersInfoInput): Promise<SlackUsersInfoOutput> {
		return parseUsersInfo(
			await this.#api(
				'users.info',
				{
					user: input.user_id,
					...(input.include_locale !== undefined && { include_locale: input.include_locale })
				},
				'Slack users.info'
			)
		)
	}

	/** POST users.conversations */
	async usersConversations(input: SlackUsersConversationsInput = {}): Promise<SlackListConversationsOutput> {
		const body: Record<string, unknown> = {
			...(input.user_id && { user: input.user_id }),
			...(input.limit !== undefined && { limit: input.limit }),
			...(input.cursor && { cursor: input.cursor }),
			...(input.types && { types: input.types }),
			...(input.exclude_archived !== undefined && { exclude_archived: input.exclude_archived })
		}
		return parseConversationsList(await this.#api('users.conversations', body, 'Slack users.conversations'))
	}

	/** POST conversations.info */
	async conversationsInfo(input: SlackConversationInfoInput): Promise<SlackConversationInfoOutput> {
		return parseConversationInfo(
			await this.#api(
				'conversations.info',
				{
					channel: input.chat_id,
					...(input.include_locale !== undefined && { include_locale: input.include_locale }),
					...(input.include_num_members !== undefined && {
						include_num_members: input.include_num_members
					})
				},
				'Slack conversations.info'
			)
		)
	}

	/** POST conversations.history */
	async conversationsHistory(input: SlackConversationHistoryInput): Promise<SlackConversationMessagesOutput> {
		const body: Record<string, unknown> = {
			channel: input.chat_id,
			...(input.limit !== undefined && { limit: input.limit }),
			...(input.cursor && { cursor: input.cursor }),
			...(input.oldest && { oldest: input.oldest }),
			...(input.latest && { latest: input.latest }),
			...(input.inclusive !== undefined && { inclusive: input.inclusive })
		}
		return parseConversationMessages(await this.#api('conversations.history', body, 'Slack conversations.history'))
	}

	/** POST conversations.replies */
	async conversationsReplies(input: SlackConversationRepliesInput): Promise<SlackConversationMessagesOutput> {
		const body: Record<string, unknown> = {
			channel: input.chat_id,
			ts: input.message_id,
			...(input.limit !== undefined && { limit: input.limit }),
			...(input.cursor && { cursor: input.cursor }),
			...(input.oldest && { oldest: input.oldest }),
			...(input.latest && { latest: input.latest }),
			...(input.inclusive !== undefined && { inclusive: input.inclusive })
		}
		return parseConversationMessages(await this.#api('conversations.replies', body, 'Slack conversations.replies'))
	}

	/**
	 * Multi-file external upload: get URL + PUT each file, then one completeUploadExternal.
	 * Host may pass `body` (Uint8Array) on each item instead of body_base64.
	 */
	async sendMediaBatch(
		input: SlackSendMediaBatchInput & {
			files: Array<SlackSendMediaBatchInput['files'][number] & { body?: Uint8Array }>
		}
	): Promise<SlackSendMediaBatchOutput> {
		const completed: { id: string; title?: string }[] = []
		for (const file of input.files) {
			const { bytes, body } = resolveMediaBytes(file)
			const form = new URLSearchParams()
			form.set('filename', file.file_name)
			form.set('length', String(bytes.byteLength))
			const upload = parseUploadUrl(
				await this.#apiForm('files.getUploadURLExternal', form, 'Slack files.getUploadURLExternal')
			)
			let put: Awaited<ReturnType<HttpService['post']>>
			try {
				put = await this.#external.post(upload.upload_url, body, {
					label: 'Slack file upload POST',
					noThrow: true,
					headers: {
						'Content-Type': file.content_type ?? 'application/octet-stream'
					}
				})
			} catch (error) {
				throwSlackTransportError('Slack file upload POST', error)
			}
			if (!put.ok) {
				throw new SlackClientError({
					message: `Slack file upload POST failed with HTTP ${put.status}`,
					failureKind:
						put.status === 400 || put.status === 401 || put.status === 403 || put.status === 404
							? 'definite_rejection'
							: 'outcome_unknown',
					method: 'Slack file upload POST',
					status: put.status
				})
			}
			completed.push({
				id: upload.file_id,
				...(file.title || file.file_name ? { title: file.title ?? file.file_name } : {})
			})
		}
		return parseUploadBatchComplete(
			await this.#api(
				'files.completeUploadExternal',
				{
					files: completed,
					channel_id: input.chat_id,
					...(input.reply_to_message_id && { thread_ts: input.reply_to_message_id }),
					...(input.caption && { initial_comment: input.caption })
				},
				'Slack files.completeUploadExternal'
			),
			completed.map((f) => f.id)
		)
	}

	/**
	 * Download file bytes for host (no base64). Tool path still uses downloadFile → body_base64.
	 */
	async downloadFileBytes(
		input: SlackDownloadFileInput
	): Promise<{ file_name: string; file_size?: number; body: Uint8Array }> {
		const file = parseFileInfo(await this.#api('files.info', { file: input.file_id }, 'Slack files.info'))
		let res: Awaited<ReturnType<HttpService['bytes']>>
		try {
			res = await this.#http.bytes('GET', file.url_private_download, {
				label: 'Slack downloadFileBytes',
				noThrow: true,
				headers: {
					Authorization: `Bearer ${this.#token}`
				}
			})
		} catch (error) {
			throwSlackTransportError('Slack downloadFileBytes', error)
		}
		if (!res.ok) {
			throw new SlackClientError({
				message: `Slack downloadFileBytes failed with HTTP ${res.status}`,
				failureKind:
					res.status === 400 || res.status === 401 || res.status === 403 || res.status === 404
						? 'definite_rejection'
						: 'outcome_unknown',
				method: 'Slack downloadFileBytes',
				status: res.status
			})
		}
		const out: { file_name: string; file_size?: number; body: Uint8Array } = {
			file_name: input.file_name ?? file.file_name ?? file.file_id,
			body: res.bytes
		}
		if (file.file_size !== undefined) out.file_size = file.file_size
		return out
	}
}

export { isSlackDefiniteRejection, isSlackOutcomeUnknown, SlackClientError }
