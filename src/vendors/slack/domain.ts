/**
 * Slack payload shaping + envelope/result parse.
 * No HTTP — client owns transport.
 */

import { isPlainObject, isString } from 'es-toolkit'

import { ToolError } from '../../core/errors'
import { base64ToBytes, bytesToBase64, toArrayBuffer } from '../../shared/bytes'
import type {
	SlackDownloadFileInput,
	SlackDownloadFileOutput,
	SlackGetBotOutput,
	SlackListConversationsOutput,
	SlackMessageOutput,
	SlackSendMediaInput
} from './contracts'
import { MAX_MEDIA_BYTES } from './contracts'

export type SlackFailureKind = 'definite_rejection' | 'outcome_unknown'

export class SlackClientError extends ToolError {
	readonly failureKind: SlackFailureKind

	constructor(input: {
		message: string
		failureKind: SlackFailureKind
		method: string
		status?: number
		slackError?: string
		retryAfterSeconds?: number
		cause?: unknown
	}) {
		super(input.message, {
			code: 'upstream',
			retryable: input.failureKind === 'outcome_unknown',
			cause: input.cause,
			details: {
				method: input.method,
				failure_kind: input.failureKind,
				status: input.status,
				slack_error: input.slackError,
				retry_after_seconds: input.retryAfterSeconds
			}
		})
		this.name = 'SlackClientError'
		this.failureKind = input.failureKind
	}
}

export function isSlackDefiniteRejection(error: unknown): boolean {
	return error instanceof SlackClientError && error.failureKind === 'definite_rejection'
}

export function isSlackOutcomeUnknown(error: unknown): boolean {
	return error instanceof SlackClientError && error.failureKind === 'outcome_unknown'
}

/** Network / abort / transport failures before a parseable Slack envelope. */
export function throwSlackTransportError(method: string, error: unknown): never {
	if (error instanceof SlackClientError) throw error
	const message = error instanceof Error ? error.message : `${method} request failed`
	throw new SlackClientError({
		message,
		failureKind: 'outcome_unknown',
		method,
		cause: error
	})
}

/** Client/auth/validation errors that should not be retried as if delivery might have succeeded. */
const DEFINITE_SLACK_ERRORS = new Set([
	'invalid_auth',
	'not_authed',
	'account_inactive',
	'token_revoked',
	'token_expired',
	'invalid_token',
	'missing_scope',
	'not_allowed_token_type',
	'ekm_access_denied',
	'access_denied',
	'org_login_required',
	'team_access_not_granted',
	'channel_not_found',
	'is_archived',
	'not_in_channel',
	'is_inactive',
	'method_not_supported_for_channel_type',
	'msg_too_long',
	'no_text',
	'invalid_arguments',
	'invalid_blocks',
	'invalid_blocks_format',
	'cant_update_message',
	'message_not_found',
	'cant_delete_message',
	'already_reacted',
	'no_reaction',
	'invalid_name',
	'too_many_emoji',
	'file_not_found',
	'file_deleted',
	'cant_find_user',
	'user_not_found',
	'user_not_visible',
	'invalid_channel',
	'name_taken',
	'restricted_action',
	'as_user_not_supported',
	'cannot_reply_to_message',
	'thread_not_found'
])

const RETRYABLE_SLACK_ERRORS = new Set([
	'rate_limited',
	'ratelimited',
	'internal_error',
	'fatal_error',
	'service_unavailable',
	'request_timeout'
])

function isDefiniteStatus(status: number): boolean {
	return status === 400 || status === 401 || status === 403 || status === 404
}

export function classifySlackFailure(status: number, errorCode: string | undefined): SlackFailureKind {
	if (status === 429 || status >= 500) return 'outcome_unknown'
	if (errorCode && RETRYABLE_SLACK_ERRORS.has(errorCode)) return 'outcome_unknown'
	if (errorCode && DEFINITE_SLACK_ERRORS.has(errorCode)) return 'definite_rejection'
	if (isDefiniteStatus(status)) return 'definite_rejection'
	return 'outcome_unknown'
}

/** Map Slack `{ ok, error?, … }` (HTTP may be non-2xx). Returns the full envelope object when ok. */
export function parseSlackResult(label: string, status: number, data: unknown): Record<string, unknown> {
	if (!isPlainObject(data) || typeof data['ok'] !== 'boolean') {
		throw new SlackClientError({
			message: `${label} returned an invalid envelope`,
			failureKind:
				status === 429 || status >= 500 || status === 0 ? 'outcome_unknown' : classifySlackFailure(status, undefined),
			method: label,
			status
		})
	}
	if (data['ok'] === true) {
		return data
	}
	const errorCode = isString(data['error']) ? data['error'] : undefined
	const retryAfter =
		typeof data['retry_after'] === 'number'
			? data['retry_after']
			: typeof data['Retry-After'] === 'number'
				? data['Retry-After']
				: undefined
	throw new SlackClientError({
		message: errorCode ? `${label} failed: ${errorCode}` : `${label} failed`,
		failureKind: classifySlackFailure(status, errorCode),
		method: label,
		status,
		...(errorCode && { slackError: errorCode }),
		...(retryAfter !== undefined && { retryAfterSeconds: retryAfter })
	})
}

/** Strip surrounding colons from emoji names (`:thumbsup:` → `thumbsup`). */
export function normalizeEmojiName(emoji: string): string {
	return emoji.replace(/^:+/, '').replace(/:+$/, '')
}

export function parseMessageTs(value: Record<string, unknown>): SlackMessageOutput {
	const ts = value['ts']
	if (!isString(ts) || ts.length === 0) {
		throw new ToolError('Slack returned an invalid message ts', { code: 'upstream' })
	}
	return { message_id: ts }
}

export function parseOk(value: Record<string, unknown>): void {
	if (value['ok'] !== true) {
		throw new ToolError('Slack returned unexpected result', { code: 'upstream' })
	}
}

export function parseBot(value: Record<string, unknown>): SlackGetBotOutput {
	const botId = firstString(value['bot_id'], value['user_id'])
	const username = firstString(value['user'], value['team'])
	const displayName = firstString(value['user'], value['team'])
	if (!botId || !username || !displayName) {
		throw new ToolError('Slack auth.test returned invalid bot identity', { code: 'upstream' })
	}
	return {
		bot_id: botId,
		username,
		display_name: displayName
	}
}

export function parseFileInfo(value: Record<string, unknown>): {
	file_id: string
	file_name?: string
	file_size?: number
	url_private_download: string
} {
	const file = value['file']
	if (!isPlainObject(file) || !isString(file['id'])) {
		throw new ToolError('Slack files.info returned invalid payload', { code: 'upstream' })
	}
	const downloadUrl = file['url_private_download']
	if (!isString(downloadUrl) || downloadUrl.length === 0) {
		throw new ToolError('Slack files.info missing url_private_download', { code: 'upstream' })
	}
	return {
		file_id: file['id'],
		url_private_download: downloadUrl,
		...(isString(file['name']) && { file_name: file['name'] }),
		...(typeof file['size'] === 'number' && { file_size: file['size'] })
	}
}

export function parseDownload(
	input: SlackDownloadFileInput,
	file: { file_id: string; file_name?: string; file_size?: number },
	bytes: Uint8Array
): SlackDownloadFileOutput {
	return {
		file_name: input.file_name ?? file.file_name ?? file.file_id,
		...(file.file_size !== undefined && { file_size: file.file_size }),
		body_base64: bytesToBase64(bytes)
	}
}

export function parseUploadUrl(value: Record<string, unknown>): { upload_url: string; file_id: string } {
	const uploadUrl = value['upload_url']
	const fileId = value['file_id']
	if (!isString(uploadUrl) || uploadUrl.length === 0 || !isString(fileId) || fileId.length === 0) {
		throw new ToolError('Slack files.getUploadURLExternal returned invalid payload', { code: 'upstream' })
	}
	return { upload_url: uploadUrl, file_id: fileId }
}

/** Prefer message ts from shares; fall back to uploaded file id. */
export function parseUploadComplete(value: Record<string, unknown>): SlackMessageOutput {
	const files = value['files']
	if (Array.isArray(files) && files.length > 0) {
		const first = files[0]
		if (isPlainObject(first)) {
			const fromShares = extractTsFromShares(first['shares'])
			if (fromShares) return { message_id: fromShares }
			if (isString(first['id']) && first['id'].length > 0) {
				return { message_id: first['id'] }
			}
		}
	}
	throw new ToolError('Slack files.completeUploadExternal returned invalid payload', { code: 'upstream' })
}

function extractTsFromShares(shares: unknown): string | undefined {
	if (!isPlainObject(shares)) return undefined
	for (const bucket of Object.values(shares)) {
		if (!isPlainObject(bucket)) continue
		for (const entries of Object.values(bucket)) {
			if (!Array.isArray(entries)) continue
			for (const entry of entries) {
				if (isPlainObject(entry) && isString(entry['ts']) && entry['ts'].length > 0) {
					return entry['ts']
				}
			}
		}
	}
	return undefined
}

export function parseConversationsList(value: Record<string, unknown>): SlackListConversationsOutput {
	const channelsRaw = value['channels']
	if (!Array.isArray(channelsRaw)) {
		throw new ToolError('Slack conversations.list returned invalid payload', { code: 'upstream' })
	}
	const channels: SlackListConversationsOutput['channels'] = []
	for (const row of channelsRaw) {
		if (!isPlainObject(row) || !isString(row['id'])) continue
		channels.push({
			id: row['id'],
			...(isString(row['name']) && { name: row['name'] }),
			...(typeof row['is_channel'] === 'boolean' && { is_channel: row['is_channel'] }),
			...(typeof row['is_im'] === 'boolean' && { is_im: row['is_im'] }),
			...(typeof row['is_mpim'] === 'boolean' && { is_mpim: row['is_mpim'] }),
			...(typeof row['is_private'] === 'boolean' && { is_private: row['is_private'] })
		})
	}
	const metadata = value['response_metadata']
	const nextCursor =
		isPlainObject(metadata) && isString(metadata['next_cursor']) && metadata['next_cursor'].length > 0
			? metadata['next_cursor']
			: undefined
	return {
		channels,
		...(nextCursor && { next_cursor: nextCursor })
	}
}

export function decodeMediaBytes(bodyBase64: string): Uint8Array {
	let bytes: Uint8Array
	try {
		bytes = base64ToBytes(bodyBase64)
	} catch (error) {
		throw new ToolError('Invalid base64 body', { code: 'bad_input', cause: error })
	}
	if (bytes.byteLength === 0) {
		throw new ToolError('Media body must not be empty', { code: 'bad_input' })
	}
	if (bytes.byteLength > MAX_MEDIA_BYTES) {
		throw new ToolError('Media exceeds 100 MiB limit', {
			code: 'too_large',
			details: { max_bytes: MAX_MEDIA_BYTES, content_length: bytes.byteLength }
		})
	}
	return bytes
}

export function mediaArrayBuffer(input: SlackSendMediaInput): { bytes: Uint8Array; body: ArrayBuffer } {
	const bytes = decodeMediaBytes(input.body_base64)
	return { bytes, body: toArrayBuffer(bytes) }
}

export function isHttpsUrl(value: string): boolean {
	return value.startsWith('https://') || value.startsWith('http://')
}

/**
 * Map shared chat-action enum → assistant.threads.setStatus status text.
 * Slack renders as "{App Name} {status}" (do not include the app name).
 */
export function assistantStatusFromChatAction(action: string): string {
	switch (action) {
		case 'upload_photo':
		case 'upload_video':
		case 'upload_voice':
		case 'upload_document':
		case 'upload_video_note':
			return 'is uploading a file…'
		case 'record_video':
		case 'record_voice':
		case 'record_video_note':
			return 'is recording…'
		case 'choose_sticker':
		case 'find_location':
			return 'is working on your request…'
		case 'typing':
		default:
			return 'is checking the request…'
	}
}

function firstString(...values: unknown[]): string | undefined {
	for (const value of values) {
		if (isString(value) && value.length > 0) return value
	}
	return undefined
}
