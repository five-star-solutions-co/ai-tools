/**
 * Telegram payload shaping + envelope/result parse.
 * No HTTP — client owns transport.
 */

import { isPlainObject, isString } from 'es-toolkit'

import { ToolError } from '../../core/errors'
import { base64ToBytes, bytesToBase64, toArrayBuffer } from '../../shared/bytes'
import type {
	TelegramDownloadFileInput,
	TelegramDownloadFileOutput,
	TelegramGetBotOutput,
	TelegramMessageOutput,
	TelegramSendMediaGroupInput,
	TelegramSendMediaGroupOutput,
	TelegramSendMediaInput
} from './contracts'
import { MAX_MEDIA_BYTES } from './contracts'

export type TelegramFailureKind = 'definite_rejection' | 'outcome_unknown'

export class TelegramClientError extends ToolError {
	readonly failureKind: TelegramFailureKind

	constructor(input: {
		message: string
		failureKind: TelegramFailureKind
		method: string
		status?: number
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
				retry_after_seconds: input.retryAfterSeconds
			}
		})
		this.name = 'TelegramClientError'
		this.failureKind = input.failureKind
	}
}

export function isTelegramDefiniteRejection(error: unknown): boolean {
	return error instanceof TelegramClientError && error.failureKind === 'definite_rejection'
}

export function isTelegramOutcomeUnknown(error: unknown): boolean {
	return error instanceof TelegramClientError && error.failureKind === 'outcome_unknown'
}

/** Network / abort / transport failures before a parseable Telegram envelope. */
export function throwTelegramTransportError(method: string, error: unknown): never {
	if (error instanceof TelegramClientError) throw error
	const message = error instanceof Error ? error.message : `${method} request failed`
	throw new TelegramClientError({
		message,
		failureKind: 'outcome_unknown',
		method,
		cause: error
	})
}

function isDefiniteStatus(status: number): boolean {
	return status === 400 || status === 401 || status === 403 || status === 404
}

/** Map Telegram `{ ok, result | description }` (HTTP may be non-2xx). */
export function parseResult(label: string, status: number, data: unknown): unknown {
	if (!isPlainObject(data) || typeof data['ok'] !== 'boolean') {
		throw new TelegramClientError({
			message: `${label} returned an invalid envelope`,
			failureKind: 'outcome_unknown',
			method: label
		})
	}
	if (status >= 200 && status < 300 && data['ok'] === true && data['result'] !== undefined) {
		return data['result']
	}
	const parameters = data['parameters']
	const retryAfter =
		isPlainObject(parameters) && typeof parameters['retry_after'] === 'number' ? parameters['retry_after'] : undefined
	throw new TelegramClientError({
		message: isString(data['description']) ? data['description'] : `${label} failed`,
		failureKind: isDefiniteStatus(status) ? 'definite_rejection' : 'outcome_unknown',
		method: label,
		status,
		...(retryAfter !== undefined && { retryAfterSeconds: retryAfter })
	})
}

/** Prefer largest photo size; else first of document/audio/video/voice/… with a file_id. */
export function extractTelegramFileId(message: Record<string, unknown>): string | undefined {
	const photo = message['photo']
	if (Array.isArray(photo) && photo.length > 0) {
		let best: string | undefined
		let bestSize = -1
		for (const row of photo) {
			if (!isPlainObject(row) || !isString(row['file_id'])) continue
			const size = typeof row['file_size'] === 'number' ? row['file_size'] : 0
			if (size >= bestSize) {
				bestSize = size
				best = row['file_id']
			}
		}
		if (best) return best
	}
	for (const key of ['document', 'audio', 'video', 'voice', 'video_note', 'animation', 'sticker'] as const) {
		const item = message[key]
		if (isPlainObject(item) && isString(item['file_id']) && item['file_id'].length > 0) {
			return item['file_id']
		}
	}
	return undefined
}

export function parseMessage(value: unknown): TelegramMessageOutput {
	if (!isPlainObject(value) || typeof value['message_id'] !== 'number') {
		throw new ToolError('Telegram returned an invalid message', { code: 'upstream' })
	}
	const fileId = extractTelegramFileId(value)
	return {
		message_id: String(value['message_id']),
		...(fileId && { file_id: fileId })
	}
}

export function parseMessages(value: unknown): TelegramSendMediaGroupOutput {
	if (!Array.isArray(value)) {
		throw new ToolError('Telegram returned an invalid message list', { code: 'upstream' })
	}
	return { message_ids: value.map((row) => parseMessage(row).message_id) }
}

export function parseOk(value: unknown): void {
	if (value !== true) {
		throw new ToolError('Telegram returned unexpected result', { code: 'upstream' })
	}
}

export function parseBot(value: unknown): TelegramGetBotOutput {
	if (
		!isPlainObject(value) ||
		typeof value['id'] !== 'number' ||
		!isString(value['username']) ||
		!isString(value['first_name'])
	) {
		throw new ToolError('Telegram getMe returned invalid bot identity', { code: 'upstream' })
	}
	return {
		bot_id: String(value['id']),
		username: value['username'],
		display_name: value['first_name']
	}
}

export function parseFile(value: unknown): { file_path: string; file_size?: number } {
	if (!isPlainObject(value) || !isString(value['file_path'])) {
		throw new ToolError('Telegram getFile returned invalid payload', { code: 'upstream' })
	}
	return {
		file_path: value['file_path'],
		...(typeof value['file_size'] === 'number' && { file_size: value['file_size'] })
	}
}

export function parseDownload(
	input: TelegramDownloadFileInput,
	file: { file_path: string; file_size?: number },
	bytes: Uint8Array
): TelegramDownloadFileOutput {
	return {
		file_name: input.file_name ?? file.file_path.split('/').pop() ?? input.file_id,
		...(file.file_size !== undefined && { file_size: file.file_size }),
		body_base64: bytesToBase64(bytes)
	}
}

function decodeMedia(bodyBase64: string): Uint8Array {
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
	return bytes
}

function blob(bytes: Uint8Array, contentType: string | undefined): Blob {
	return contentType ? new Blob([toArrayBuffer(bytes)], { type: contentType }) : new Blob([toArrayBuffer(bytes)])
}

/** Multipart body for sendPhoto / sendDocument. */
export function buildMediaForm(input: TelegramSendMediaInput): FormData {
	const bytes = decodeMedia(input.body_base64)
	const form = new FormData()
	form.set('chat_id', input.chat_id)
	form.set(input.kind === 'photo' ? 'photo' : 'document', blob(bytes, input.content_type), input.file_name)
	if (input.caption) form.set('caption', input.caption)
	if (input.reply_to_message_id) {
		form.set('reply_parameters', JSON.stringify({ message_id: Number.parseInt(input.reply_to_message_id, 10) }))
	}
	return form
}

/** Multipart body for sendMediaGroup. */
export function buildMediaGroupForm(input: TelegramSendMediaGroupInput): FormData {
	if (input.items.length < 2 || input.items.length > 10) {
		throw new ToolError('Media groups require between 2 and 10 items', { code: 'bad_input' })
	}
	const hasDoc = input.items.some((item) => item.kind === 'document')
	const hasPhoto = input.items.some((item) => item.kind === 'photo')
	if (hasDoc && hasPhoto) {
		throw new ToolError('Media groups cannot mix photo and document items', { code: 'bad_input' })
	}

	const form = new FormData()
	form.set('chat_id', input.chat_id)
	if (input.reply_to_message_id) {
		form.set('reply_parameters', JSON.stringify({ message_id: Number.parseInt(input.reply_to_message_id, 10) }))
	}
	const media = input.items.map((item, index) => {
		const bytes = decodeMedia(item.body_base64)
		form.set(`file${index}`, blob(bytes, item.content_type), item.file_name)
		return {
			type: item.kind,
			media: `attach://file${index}`,
			...(item.caption && { caption: item.caption })
		}
	})
	form.set('media', JSON.stringify(media))
	return form
}
