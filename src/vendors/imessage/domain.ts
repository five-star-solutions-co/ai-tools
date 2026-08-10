/**
 * photon-rest-proxy response parse + failure helpers (no HTTP).
 */

import { isPlainObject, isString } from 'es-toolkit'

import { ToolError } from '../../core/errors'
import { base64ToBytes } from '../../shared/bytes'
import type {
	ImessageDownloadFileInput,
	ImessageDownloadFileOutput,
	ImessageEnsureChatOutput,
	ImessageMessageOutput,
	ImessageSendMediaInput
} from './contracts'
import { MAX_MEDIA_BYTES } from './contracts'

export type ImessageFailureKind = 'definite_rejection' | 'outcome_unknown'

export class ImessageClientError extends ToolError {
	readonly failureKind: ImessageFailureKind

	constructor(input: {
		message: string
		failureKind: ImessageFailureKind
		status?: number
		code?: string
		cause?: unknown
	}) {
		super(input.message, {
			code: mapStatusToToolCode(input.status, input.code),
			retryable: input.failureKind === 'outcome_unknown',
			cause: input.cause,
			details: {
				failure_kind: input.failureKind,
				status: input.status,
				proxy_error: input.code
			}
		})
		this.name = 'ImessageClientError'
		this.failureKind = input.failureKind
	}
}

export function isImessageDefiniteRejection(error: unknown): boolean {
	return error instanceof ImessageClientError && error.failureKind === 'definite_rejection'
}

export function isImessageOutcomeUnknown(error: unknown): boolean {
	return error instanceof ImessageClientError && error.failureKind === 'outcome_unknown'
}

function mapStatusToToolCode(status: number | undefined, proxyCode: string | undefined): ToolError['code'] {
	if (status === 401) return 'bad_auth'
	if (status === 403) return 'forbidden'
	if (status === 404) return 'not_found'
	if (status === 400) return 'bad_input'
	if (status === 429) return 'rate_limited'
	if (proxyCode === 'unauthorized') return 'bad_auth'
	if (proxyCode === 'message_not_found' || proxyCode === 'not_found') return 'not_found'
	if (proxyCode === 'unsupported' || proxyCode === 'not_implemented') return 'unsupported'
	return 'upstream'
}

function isDefiniteStatus(status: number): boolean {
	return status === 400 || status === 401 || status === 403 || status === 404
}

/** Parse photon-rest-proxy JSON error body or throw on non-2xx. */
export function assertProxyOk(label: string, status: number, data: unknown): void {
	if (status >= 200 && status < 300) return

	let message = `${label} failed with HTTP ${status}`
	let code: string | undefined
	if (isPlainObject(data)) {
		const err = data['error']
		const detail = data['detail']
		if (isString(err) && err.length > 0) {
			code = err
			message = isString(detail) && detail.length > 0 ? `${err}: ${detail}` : err
		} else if (isString(detail) && detail.length > 0) {
			message = detail
		}
	}

	throw new ImessageClientError({
		message,
		failureKind: isDefiniteStatus(status) ? 'definite_rejection' : 'outcome_unknown',
		status,
		...(code && { code })
	})
}

function requireString(data: Record<string, unknown>, key: string, label: string): string {
	const value = data[key]
	if (!isString(value) || value.length === 0) {
		throw new ToolError(`iMessage proxy ${label} missing ${key}`, { code: 'upstream' })
	}
	return value
}

/** Prefer space_id; accept chat_id alias from newer proxy shapes. */
function spaceOrChatId(data: Record<string, unknown>, label: string): string {
	const spaceId = data['space_id']
	if (isString(spaceId) && spaceId.length > 0) return spaceId
	const chatId = data['chat_id']
	if (isString(chatId) && chatId.length > 0) return chatId
	throw new ToolError(`iMessage proxy ${label} missing space_id`, { code: 'upstream' })
}

export function parseMessageResult(data: unknown, label = 'send'): ImessageMessageOutput {
	if (!isPlainObject(data) || data['ok'] !== true) {
		throw new ToolError(`iMessage proxy returned an unexpected ${label} payload`, { code: 'upstream' })
	}
	return {
		space_id: spaceOrChatId(data, label),
		message_id: requireString(data, 'message_id', label)
	}
}

export function parseOkResult(data: unknown): { ok: true; space_id?: string } {
	if (!isPlainObject(data) || data['ok'] !== true) {
		throw new ToolError('iMessage proxy returned an unexpected ok payload', { code: 'upstream' })
	}
	const spaceId = data['space_id']
	const chatId = data['chat_id']
	const id =
		isString(spaceId) && spaceId.length > 0 ? spaceId : isString(chatId) && chatId.length > 0 ? chatId : undefined
	return {
		ok: true,
		...(id && { space_id: id })
	}
}

export function parseEnsureChatResult(data: unknown): ImessageEnsureChatOutput {
	if (!isPlainObject(data) || data['ok'] !== true) {
		throw new ToolError('iMessage proxy returned an unexpected ensure-chat payload', { code: 'upstream' })
	}
	const chatId = spaceOrChatId(data, 'ensure-chat')
	const messageId = data['message_id']
	return {
		chat_id: chatId,
		...(isString(messageId) && messageId.length > 0 && { message_id: messageId })
	}
}

/** Map messaging-style chat_id to proxy space_id body fields. */
export function spaceBody(
	chatId: string | undefined,
	phone: string | undefined,
	extra: Record<string, unknown> = {}
): Record<string, unknown> {
	return {
		platform: 'imessage',
		...extra,
		...(chatId && { space_id: chatId }),
		...(phone && { phone })
	}
}

/** Decode and size-check media base64 for sendMedia. */
export function decodeMediaBody(bodyBase64: string): void {
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
		throw new ToolError('Media exceeds 20 MiB limit', {
			code: 'too_large',
			details: { max_bytes: MAX_MEDIA_BYTES, content_length: bytes.byteLength }
		})
	}
}

/** Build POST /v1/media JSON body (base64 already validated). */
export function mediaBody(input: ImessageSendMediaInput, phone: string | undefined): Record<string, unknown> {
	decodeMediaBody(input.body_base64)
	return spaceBody(input.chat_id, phone, {
		body_base64: input.body_base64,
		file_name: input.file_name,
		...(input.content_type && { mime_type: input.content_type }),
		...(input.caption && { caption: input.caption })
	})
}

export function parseDownloadResult(input: ImessageDownloadFileInput, data: unknown): ImessageDownloadFileOutput {
	if (!isPlainObject(data) || data['ok'] !== true) {
		throw new ToolError('iMessage proxy returned an unexpected download payload', { code: 'upstream' })
	}
	const bodyBase64 = data['body_base64']
	if (!isString(bodyBase64) || bodyBase64.length === 0) {
		throw new ToolError('iMessage proxy download missing body_base64', { code: 'upstream' })
	}
	const name = data['file_name']
	const size = data['file_size']
	return {
		file_name: input.file_name ?? (isString(name) && name.length > 0 ? name : input.file_id),
		...(typeof size === 'number' && Number.isFinite(size) && { file_size: size }),
		body_base64: bodyBase64
	}
}
