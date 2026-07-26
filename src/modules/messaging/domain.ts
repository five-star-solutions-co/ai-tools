/**
 * Messaging seam helpers (no HTTP).
 */

import { isError } from 'es-toolkit'

import { ToolError } from '../../core/errors'
import type { BatchItemError, BatchResult } from '../../shared/batch'
import { runBatchItems } from '../../shared/batch'
import { base64ToBytes, bytesToBase64 } from '../../shared/bytes'
import {
	isImessageDefiniteRejection,
	isImessageOutcomeUnknown,
	MAX_MEDIA_BYTES as IMESSAGE_MAX
} from '../../vendors/imessage'
import type { S3Client } from '../../vendors/s3'
import { isSlackDefiniteRejection, isSlackOutcomeUnknown, MAX_MEDIA_BYTES as SLACK_MAX } from '../../vendors/slack'
import { isTeamsDefiniteRejection, isTeamsOutcomeUnknown, MAX_MEDIA_BYTES as TEAMS_MAX } from '../../vendors/teams'
import {
	isTelegramDefiniteRejection,
	isTelegramOutcomeUnknown,
	MAX_MEDIA_BYTES as TELEGRAM_MAX
} from '../../vendors/telegram'
import type {
	MessagingChannelDownloadOutput,
	MessagingDownloadFileOutput,
	MessagingMessageOutput,
	MessagingObjectArtifactRef,
	MessagingSendMediaBatchInput,
	MessagingSendMediaBatchOutput,
	MessagingSendMediaBatchResolved,
	MessagingSendMediaInput,
	MessagingSendMediaResolved
} from './contracts'

/**
 * Intentional lifecycle no-op (e.g. read when the channel has no mark-as-read API).
 * Succeeds so multi-channel hosts can call one surface without branching.
 * Destructive gaps (unsend) must not live on the seam — use the vendor pack.
 */
export function warnUnsupportedMessagingOp(provider: string, op: string): void {
	console.warn(`[messaging] ${provider}: ${op} is a successful no-op (not needed / not applicable on this channel)`)
}

/** Provider-neutral definite rejection (do not treat as possible delivery). */
export function isMessagingDefiniteRejection(error: unknown): boolean {
	return (
		isTelegramDefiniteRejection(error) ||
		isSlackDefiniteRejection(error) ||
		isTeamsDefiniteRejection(error) ||
		isImessageDefiniteRejection(error)
	)
}

/**
 * Provider-neutral outcome-unknown (retry may duplicate).
 * Includes transport network/abort failures rethrown as vendor client errors.
 */
export function isMessagingOutcomeUnknown(error: unknown): boolean {
	return (
		isTelegramOutcomeUnknown(error) ||
		isSlackOutcomeUnknown(error) ||
		isTeamsOutcomeUnknown(error) ||
		isImessageOutcomeUnknown(error)
	)
}

/** Media byte ceiling for the bound channel (align object reads before channel decode). */
export function mediaMaxBytesForProvider(provider: string): number {
	switch (provider) {
		case 'teams':
			return TEAMS_MAX
		case 'slack':
			return SLACK_MAX
		case 'telegram':
			return TELEGRAM_MAX
		case 'imessage':
			return IMESSAGE_MAX
		default:
			return TELEGRAM_MAX
	}
}

function toBatchError(error: unknown): BatchItemError {
	if (error instanceof ToolError) {
		return {
			code: error.code,
			message: error.message,
			retryable: error.retryable
		}
	}
	return {
		code: 'internal',
		message: isError(error) ? error.message : 'Batch item failed'
	}
}

async function bodyFromSource(
	source: MessagingObjectArtifactRef,
	storage: S3Client | undefined,
	maxBytes: number
): Promise<{ body_base64: string; file_name?: string | undefined; content_type?: string | undefined }> {
	if (!storage) {
		throw new ToolError('ArtifactRef media requires storage credentials on messaging auth', {
			code: 'bad_auth'
		})
	}
	const bytes = await storage.getBytes(source.key, { maxBytes })
	return {
		body_base64: bytesToBase64(bytes),
		file_name: source.filename,
		content_type: source.media_type
	}
}

async function resolveMediaBody(
	input: Pick<MessagingSendMediaInput, 'body_base64' | 'source' | 'file_name' | 'content_type' | 'kind'>,
	storage: S3Client | undefined,
	maxBytes: number
): Promise<{ body_base64: string; file_name: string; content_type?: string | undefined }> {
	if (input.body_base64 !== undefined) {
		if (!input.file_name) {
			throw new ToolError('file_name is required when body_base64 is set', { code: 'bad_input' })
		}
		const raw = base64ToBytes(input.body_base64)
		if (raw.byteLength > maxBytes) {
			throw new ToolError('Media body exceeds channel size limit', {
				code: 'too_large',
				details: { max_bytes: maxBytes, content_length: raw.byteLength }
			})
		}
		return {
			body_base64: input.body_base64,
			file_name: input.file_name,
			content_type: input.content_type
		}
	}
	if (!input.source) {
		throw new ToolError('Provide exactly one of body_base64 or source', { code: 'bad_input' })
	}
	const fromStore = await bodyFromSource(input.source, storage, maxBytes)
	const file_name = input.file_name ?? fromStore.file_name
	if (!file_name) {
		throw new ToolError('file_name or source.filename is required when source is set', { code: 'bad_input' })
	}
	return {
		body_base64: fromStore.body_base64,
		file_name,
		content_type: input.content_type ?? fromStore.content_type
	}
}

/** Resolve public send-media input to channel-facing body_base64 payload. */
export async function resolveSendMediaInput(
	input: MessagingSendMediaInput,
	storage: S3Client | undefined,
	maxBytes: number
): Promise<MessagingSendMediaResolved> {
	const body = await resolveMediaBody(input, storage, maxBytes)
	return {
		chat_id: input.chat_id,
		kind: input.kind,
		body_base64: body.body_base64,
		file_name: body.file_name,
		content_type: body.content_type,
		caption: input.caption,
		reply_to_message_id: input.reply_to_message_id,
		service_url: input.service_url
	}
}

/**
 * Resolve each batch item independently, send only successes, merge failures by original index.
 * Preserves partial-failure contract when ArtifactRef resolution fails mid-batch.
 */
export async function resolveAndSendMediaBatch(
	input: MessagingSendMediaBatchInput,
	storage: S3Client | undefined,
	maxBytes: number,
	sendBatch: (resolved: MessagingSendMediaBatchResolved) => Promise<MessagingSendMediaBatchOutput>
): Promise<MessagingSendMediaBatchOutput> {
	type Slot =
		| { index: number; ok: true; item: MessagingSendMediaBatchResolved['items'][number] }
		| { index: number; ok: false; error: BatchItemError }

	const slots: Slot[] = []
	for (let index = 0; index < input.items.length; index++) {
		const item = input.items[index]
		if (!item) continue
		try {
			const body = await resolveMediaBody(item, storage, maxBytes)
			slots.push({
				index,
				ok: true,
				item: {
					kind: item.kind,
					body_base64: body.body_base64,
					file_name: body.file_name,
					content_type: body.content_type,
					caption: item.caption
				}
			})
		} catch (error) {
			slots.push({ index, ok: false, error: toBatchError(error) })
		}
	}

	const successes = slots.filter((s): s is Extract<Slot, { ok: true }> => s.ok)
	const results: BatchResult<MessagingMessageOutput>['results'] = []
	const message_ids: string[] = []

	if (successes.length === 0) {
		for (const slot of slots) {
			if (!slot.ok) results.push({ index: slot.index, ok: false, error: slot.error })
		}
		return {
			message_ids,
			results: { results, succeeded: 0, failed: results.length }
		}
	}

	const providerOut = await sendBatch({
		chat_id: input.chat_id,
		items: successes.map((s) => s.item),
		reply_to_message_id: input.reply_to_message_id,
		service_url: input.service_url
	})

	const providerByLocal = new Map(providerOut.results.results.map((row) => [row.index, row]))
	let successCursor = 0
	for (const slot of slots) {
		if (!slot.ok) {
			results.push({ index: slot.index, ok: false, error: slot.error })
			continue
		}
		const pr = providerByLocal.get(successCursor)
		successCursor += 1
		if (!pr) {
			results.push({
				index: slot.index,
				ok: false,
				error: { code: 'internal', message: 'Missing provider batch result' }
			})
			continue
		}
		if (pr.ok && pr.value) {
			results.push({ index: slot.index, ok: true, value: pr.value })
			if (pr.value.message_id) message_ids.push(pr.value.message_id)
		} else {
			results.push({
				index: slot.index,
				ok: false,
				error: pr.error ?? { code: 'internal', message: 'Provider batch item failed' }
			})
		}
	}

	const succeeded = results.filter((r) => r.ok).length
	return {
		message_ids,
		results: { results, succeeded, failed: results.length - succeeded }
	}
}

/** After channel download, optionally land bytes in object storage. */
export async function finalizeDownloadOutput(
	got: MessagingChannelDownloadOutput,
	destination_key: string | undefined,
	storage: S3Client | undefined
): Promise<MessagingDownloadFileOutput> {
	if (!destination_key) {
		return {
			file_name: got.file_name,
			file_size: got.file_size,
			body_base64: got.body_base64
		}
	}
	if (!storage) {
		throw new ToolError('destination_key requires storage credentials on messaging auth', {
			code: 'bad_auth'
		})
	}
	const bytes = base64ToBytes(got.body_base64)
	await storage.putBytes(destination_key, bytes)
	const file_size = got.file_size ?? bytes.byteLength
	return {
		file_name: got.file_name,
		file_size,
		artifact: {
			store: 'object',
			key: destination_key,
			filename: got.file_name,
			byte_length: file_size
		}
	}
}

/** Sequential sendMedia for channels without a native multi-file API. */
export async function sendMediaBatchSequential(
	sendOne: (item: MessagingSendMediaResolved) => Promise<MessagingMessageOutput>,
	input: MessagingSendMediaBatchResolved
): Promise<MessagingSendMediaBatchOutput> {
	const batch = await runBatchItems(
		input.items,
		(item) =>
			sendOne({
				chat_id: input.chat_id,
				kind: item.kind,
				body_base64: item.body_base64,
				file_name: item.file_name,
				caption: item.caption,
				content_type: item.content_type,
				reply_to_message_id: input.reply_to_message_id,
				service_url: input.service_url
			}),
		{ concurrency: 1 }
	)
	const message_ids: string[] = []
	for (const row of batch.results) {
		if (row.ok && row.value?.message_id) message_ids.push(row.value.message_id)
	}
	return { message_ids, results: batch }
}
