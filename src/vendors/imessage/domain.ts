/**
 * Advanced iMessage helpers (no transport).
 * Maps package shapes ↔ Advanced iMessage SDK types.
 *
 * Error classes are matched by name (not `instanceof`) so this module does not
 * statically import `@photon-ai/advanced-imessage/grpc` (Node-only peers).
 */

import type { SettableMessageReaction } from '@photon-ai/advanced-imessage/grpc'

import { isToolError, ToolError } from '../../core/errors'
import { isPlainObject } from 'es-toolkit'
import { base64ToBytes, bytesToBase64 } from '../../shared/bytes'
import type { ImessageDownloadFileInput, ImessageDownloadFileOutput, ImessageMessageOutput } from './contracts'
import { MAX_MEDIA_BYTES } from './contracts'

export type ImessageFailureKind = 'definite_rejection' | 'outcome_unknown'

export class ImessageClientError extends ToolError {
	readonly failureKind: ImessageFailureKind

	constructor(input: {
		message: string
		failureKind: ImessageFailureKind
		code?: ToolError['code']
		cause?: unknown
		details?: Record<string, unknown>
	}) {
		super(input.message, {
			code: input.code ?? 'upstream',
			retryable: input.failureKind === 'outcome_unknown',
			cause: input.cause,
			details: {
				failure_kind: input.failureKind,
				...input.details
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

/**
 * Map free-form emoji / tapback string to Photon SettableMessageReaction.
 * Known tapback names → kind; anything else → { kind: 'emoji', emoji }.
 */
export function toSettableReaction(emoji: string): SettableMessageReaction {
	const trimmed = emoji.trim()
	const lower = trimmed.toLowerCase()
	switch (lower) {
		case 'love':
			return { kind: 'love' }
		case 'like':
			return { kind: 'like' }
		case 'dislike':
			return { kind: 'dislike' }
		case 'laugh':
			return { kind: 'laugh' }
		case 'emphasize':
			return { kind: 'emphasize' }
		case 'question':
			return { kind: 'question' }
		default:
			return { kind: 'emoji', emoji: trimmed }
	}
}

export function messageToOutput(
	chatId: string,
	message: { guid: string; chatGuids?: readonly string[] }
): ImessageMessageOutput {
	const space =
		message.chatGuids && message.chatGuids.length > 0 && message.chatGuids[0] ? message.chatGuids[0] : chatId
	return {
		message_id: message.guid,
		space_id: space
	}
}

/** Decode and size-check media base64 for sendMedia. */
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
		throw new ToolError('Media exceeds 20 MiB limit', {
			code: 'too_large',
			details: { max_bytes: MAX_MEDIA_BYTES, content_length: bytes.byteLength }
		})
	}
	return bytes
}

export function parseDownloadChunks(
	input: ImessageDownloadFileInput,
	chunks: readonly { type: string; data?: Uint8Array; info?: { fileName?: string; totalBytes?: number } }[]
): ImessageDownloadFileOutput {
	const parts: Uint8Array[] = []
	let fileName: string | undefined
	let totalBytes: number | undefined
	for (const frame of chunks) {
		if (frame.type === 'header' && frame.info) {
			if (frame.info.fileName) fileName = frame.info.fileName
			if (typeof frame.info.totalBytes === 'number') totalBytes = frame.info.totalBytes
		}
		if (frame.type === 'primaryChunk' && frame.data) {
			parts.push(frame.data)
		}
	}
	const total = parts.reduce((n, p) => n + p.byteLength, 0)
	const merged = new Uint8Array(total)
	let offset = 0
	for (const p of parts) {
		merged.set(p, offset)
		offset += p.byteLength
	}
	return {
		file_name: input.file_name ?? fileName ?? input.file_id,
		...(totalBytes !== undefined ? { file_size: totalBytes } : total > 0 ? { file_size: total } : {}),
		body_base64: bytesToBase64(merged)
	}
}

function errorName(error: unknown): string | undefined {
	return error instanceof Error ? error.name : undefined
}

function sdkCode(error: unknown): string | undefined {
	if (!isPlainObject(error)) return undefined
	const code = error['code']
	return typeof code === 'string' ? code : undefined
}

function sdkRetryable(error: unknown): boolean | undefined {
	if (!isPlainObject(error)) return undefined
	const retryable = error['retryable']
	return typeof retryable === 'boolean' ? retryable : undefined
}

/** Map Photon SDK errors to ImessageClientError (definite vs unknown). */
export function mapSdkError(label: string, error: unknown): never {
	if (error instanceof ImessageClientError) throw error
	// Preserve Spectrum / auth preflight ToolErrors (do not reclassify as SDK upstream).
	if (isToolError(error)) throw error

	const name = errorName(error)
	if (name === 'AuthenticationError') {
		throw new ImessageClientError({
			message: (error instanceof Error && error.message) || `${label}: authentication failed`,
			failureKind: 'definite_rejection',
			code: 'bad_auth',
			cause: error
		})
	}
	if (name === 'NotFoundError') {
		throw new ImessageClientError({
			message: (error instanceof Error && error.message) || `${label}: not found`,
			failureKind: 'definite_rejection',
			code: 'not_found',
			cause: error
		})
	}
	if (name === 'ValidationError') {
		throw new ImessageClientError({
			message: (error instanceof Error && error.message) || `${label}: invalid request`,
			failureKind: 'definite_rejection',
			code: 'bad_input',
			cause: error
		})
	}
	if (name === 'RateLimitError') {
		throw new ImessageClientError({
			message: (error instanceof Error && error.message) || `${label}: rate limited`,
			failureKind: 'outcome_unknown',
			code: 'rate_limited',
			cause: error
		})
	}
	if (name === 'ConnectionError') {
		throw new ImessageClientError({
			message: (error instanceof Error && error.message) || `${label}: connection failed`,
			failureKind: 'outcome_unknown',
			code: 'upstream',
			cause: error
		})
	}
	if (name === 'IMessageError' || sdkCode(error) !== undefined) {
		const retryable = sdkRetryable(error) === true
		throw new ImessageClientError({
			message: (error instanceof Error && error.message) || `${label} failed`,
			failureKind: retryable ? 'outcome_unknown' : 'definite_rejection',
			code: 'upstream',
			cause: error,
			details: { ...(sdkCode(error) && { sdk_code: sdkCode(error) }) }
		})
	}

	const message = error instanceof Error ? error.message : `${label} request failed`
	throw new ImessageClientError({
		message,
		failureKind: 'outcome_unknown',
		cause: error
	})
}
