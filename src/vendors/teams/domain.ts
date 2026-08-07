/**
 * Microsoft Teams / Bot Framework payload shaping + parse.
 * No HTTP — client owns transport.
 *
 * Reactions: Microsoft Graph setReaction / unsetReaction when host binds tenant_id
 * (app-only Graph token). Without tenant_id the client keeps successful no-ops so
 * seam presentation paths do not hard-fail.
 */

import { isPlainObject, isString, trimEnd } from 'es-toolkit'

import { ToolError } from '../../core/errors'
import { base64ToBytes, bytesToBase64 } from '../../shared/bytes'
import type {
	TeamsDownloadFileInput,
	TeamsDownloadFileOutput,
	TeamsGetBotOutput,
	TeamsMessageOutput,
	TeamsSendMediaInput
} from './contracts'
import { MAX_MEDIA_BYTES } from './contracts'

export type TeamsFailureKind = 'definite_rejection' | 'outcome_unknown'

export class TeamsClientError extends ToolError {
	readonly failureKind: TeamsFailureKind

	constructor(input: {
		message: string
		failureKind: TeamsFailureKind
		method: string
		status?: number
		cause?: unknown
	}) {
		super(input.message, {
			code: 'upstream',
			retryable: input.failureKind === 'outcome_unknown',
			cause: input.cause,
			details: {
				method: input.method,
				failure_kind: input.failureKind,
				status: input.status
			}
		})
		this.name = 'TeamsClientError'
		this.failureKind = input.failureKind
	}
}

export function isTeamsDefiniteRejection(error: unknown): boolean {
	return error instanceof TeamsClientError && error.failureKind === 'definite_rejection'
}

export function isTeamsOutcomeUnknown(error: unknown): boolean {
	return error instanceof TeamsClientError && error.failureKind === 'outcome_unknown'
}

/** Network / abort / transport failures (and non-classified ToolError) before a parseable response. */
export function throwTeamsTransportError(method: string, error: unknown): never {
	if (error instanceof TeamsClientError) throw error
	if (error instanceof ToolError) {
		const status = error.details?.['status']
		if (typeof status === 'number' && isDefiniteStatus(status)) {
			throw new TeamsClientError({
				message: error.message,
				failureKind: 'definite_rejection',
				method,
				status,
				cause: error
			})
		}
	}
	const message = error instanceof Error ? error.message : `${method} request failed`
	throw new TeamsClientError({
		message,
		failureKind: 'outcome_unknown',
		method,
		cause: error
	})
}

export function isDefiniteStatus(status: number): boolean {
	return status === 400 || status === 401 || status === 403 || status === 404
}

export function botframeworkTokenUrl(tenantId: string | undefined): string {
	const tenant = tenantId && tenantId.length > 0 ? tenantId : 'botframework.com'
	return `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`
}

export function botframeworkTokenBody(auth: { app_id: string; app_password: string }): string {
	return new URLSearchParams({
		grant_type: 'client_credentials',
		client_id: auth.app_id,
		client_secret: auth.app_password,
		scope: 'https://api.botframework.com/.default'
	}).toString()
}

/** App-only Graph token (same client credentials; requires a real Azure AD tenant_id). */
export function graphTokenBody(auth: { app_id: string; app_password: string }): string {
	return new URLSearchParams({
		grant_type: 'client_credentials',
		client_id: auth.app_id,
		client_secret: auth.app_password,
		scope: 'https://graph.microsoft.com/.default'
	}).toString()
}

/**
 * Graph reaction URL.
 * Channel path when team_id + channel_id are set; otherwise chat path using chat_id.
 */
export function graphReactionUrl(input: {
	chat_id: string
	message_id: string
	team_id?: string | undefined
	channel_id?: string | undefined
	op: 'setReaction' | 'unsetReaction'
}): string {
	const messageId = encodeURIComponent(input.message_id)
	if (input.team_id && input.channel_id) {
		return (
			`https://graph.microsoft.com/v1.0/teams/${encodeURIComponent(input.team_id)}` +
			`/channels/${encodeURIComponent(input.channel_id)}/messages/${messageId}/${input.op}`
		)
	}
	return `https://graph.microsoft.com/v1.0/chats/${encodeURIComponent(input.chat_id)}/messages/${messageId}/${input.op}`
}

/** Map free-form emoji / short name to a Graph reactionType string (unicode preferred). */
export function toGraphReactionType(emoji: string): string {
	const trimmed = emoji.trim()
	const lower = trimmed.toLowerCase().replace(/^:|:$/g, '')
	switch (lower) {
		case 'like':
		case 'thumbsup':
		case '+1':
			return '👍'
		case 'heart':
		case 'love':
			return '❤️'
		case 'laugh':
		case 'joy':
			return '😂'
		case 'surprised':
		case 'open_mouth':
			return '😲'
		case 'sad':
		case 'cry':
			return '😢'
		case 'angry':
			return '😠'
		default:
			return trimmed
	}
}

export function parseAccessToken(data: unknown): { access_token: string; expires_in: number } {
	if (!isPlainObject(data) || !isString(data['access_token']) || data['access_token'].length === 0) {
		throw new ToolError('Teams token endpoint did not return an access_token', { code: 'bad_auth' })
	}
	const expiresIn =
		typeof data['expires_in'] === 'number' && Number.isFinite(data['expires_in']) && data['expires_in'] > 0
			? data['expires_in']
			: 3600
	return { access_token: data['access_token'], expires_in: expiresIn }
}

/** Absolute connector path under a conversation service URL. */
export function connectorPath(serviceUrl: string, path: string): string {
	const base = trimEnd(serviceUrl, '/')
	const suffix = path.startsWith('/') ? path : `/${path}`
	return `${base}${suffix}`
}

export function conversationActivitiesPath(serviceUrl: string, chatId: string): string {
	return connectorPath(serviceUrl, `/v3/conversations/${encodeURIComponent(chatId)}/activities`)
}

export function conversationActivityPath(serviceUrl: string, chatId: string, messageId: string): string {
	return connectorPath(
		serviceUrl,
		`/v3/conversations/${encodeURIComponent(chatId)}/activities/${encodeURIComponent(messageId)}`
	)
}

/** Map non-2xx connector responses into TeamsClientError. */
export function throwForStatus(label: string, status: number, data: unknown): never {
	let message = `${label} failed with HTTP ${status}`
	if (isPlainObject(data)) {
		const error = data['error']
		if (isPlainObject(error) && isString(error['message']) && error['message'].length > 0) {
			message = error['message']
		} else if (isString(data['message']) && data['message'].length > 0) {
			message = data['message']
		}
	}
	throw new TeamsClientError({
		message,
		failureKind: isDefiniteStatus(status) ? 'definite_rejection' : 'outcome_unknown',
		method: label,
		status
	})
}

export function parseActivityId(value: unknown): TeamsMessageOutput {
	if (isPlainObject(value) && isString(value['id']) && value['id'].length > 0) {
		return { message_id: value['id'] }
	}
	// Some hosts return the id as a bare string body.
	if (isString(value) && value.length > 0) {
		return { message_id: value }
	}
	throw new ToolError('Teams connector returned an invalid activity id', { code: 'upstream' })
}

export function attachmentsFromReplyMarkup(replyMarkup: unknown): unknown[] | undefined {
	if (Array.isArray(replyMarkup)) return replyMarkup
	return undefined
}

export function buildMessageActivity(input: {
	text?: string
	reply_to_message_id?: string
	reply_markup?: unknown
	attachments?: unknown[]
}): Record<string, unknown> {
	const fromMarkup = attachmentsFromReplyMarkup(input.reply_markup)
	const attachments = input.attachments ?? fromMarkup
	return {
		type: 'message',
		...(input.text && { text: input.text }),
		...(input.reply_to_message_id && { replyToId: input.reply_to_message_id }),
		...(attachments && attachments.length > 0 && { attachments })
	}
}

export function buildTypingActivity(): Record<string, unknown> {
	return { type: 'typing' }
}

export function buildMediaActivity(input: TeamsSendMediaInput): Record<string, unknown> {
	const contentType = input.content_type ?? 'application/octet-stream'
	let bytes: Uint8Array
	try {
		bytes = base64ToBytes(input.body_base64)
	} catch (error) {
		throw new ToolError('Invalid base64 body', { code: 'bad_input', cause: error })
	}
	if (bytes.byteLength === 0) {
		throw new ToolError('Media body must not be empty', { code: 'bad_input' })
	}
	if (bytes.byteLength > MAX_MEDIA_BYTES) {
		throw new ToolError('Media exceeds 4 MiB data-URI limit', {
			code: 'too_large',
			details: { max_bytes: MAX_MEDIA_BYTES, content_length: bytes.byteLength }
		})
	}
	return {
		type: 'message',
		...(input.caption && { text: input.caption }),
		...(input.reply_to_message_id && { replyToId: input.reply_to_message_id }),
		attachments: [
			{
				contentType,
				contentUrl: `data:${contentType};base64,${input.body_base64}`,
				name: input.file_name
			}
		]
	}
}

export function parseDownload(input: TeamsDownloadFileInput, bytes: Uint8Array): TeamsDownloadFileOutput {
	const fromUrl = (() => {
		try {
			const url = new URL(input.file_id)
			const last = url.pathname.split('/').filter(Boolean).pop()
			return last && last.length > 0 ? decodeURIComponent(last) : undefined
		} catch {
			return undefined
		}
	})()
	return {
		file_name: input.file_name ?? fromUrl ?? 'download',
		file_size: bytes.byteLength,
		body_base64: bytesToBase64(bytes)
	}
}

export function botIdentityFromAuth(appId: string): TeamsGetBotOutput {
	return {
		bot_id: appId,
		username: 'teams-bot',
		display_name: 'Teams Bot'
	}
}

export function isAbsoluteHttpUrl(value: string): boolean {
	try {
		const url = new URL(value)
		return url.protocol === 'http:' || url.protocol === 'https:'
	} catch {
		return false
	}
}

/** Optional invoke-response body when answering via a reply path. */
export function buildInvokeResponseBody(input: { text?: string; show_alert?: boolean }): Record<string, unknown> {
	return {
		type: 'invokeResponse',
		value: {
			status: 200,
			body: {
				...(input.text && { text: input.text }),
				...(input.show_alert !== undefined && { showAlert: input.show_alert })
			}
		}
	}
}
