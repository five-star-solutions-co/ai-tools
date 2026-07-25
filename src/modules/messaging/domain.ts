/**
 * Messaging seam helpers (no HTTP).
 */

import { ToolError } from '../../core/errors'
import type { ArtifactRef } from '../../shared/artifact'
import { runBatchItems } from '../../shared/batch'
import { base64ToBytes, bytesToBase64 } from '../../shared/bytes'
import { isImessageDefiniteRejection, isImessageOutcomeUnknown } from '../../vendors/imessage'
import type { S3Client } from '../../vendors/s3'
import { isSlackDefiniteRejection, isSlackOutcomeUnknown } from '../../vendors/slack'
import { isTeamsDefiniteRejection, isTeamsOutcomeUnknown } from '../../vendors/teams'
import { isTelegramDefiniteRejection, isTelegramOutcomeUnknown } from '../../vendors/telegram'
import type {
	MessagingChannelDownloadOutput,
	MessagingDownloadFileOutput,
	MessagingMessageOutput,
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

async function bodyFromSource(
	source: ArtifactRef,
	storage: S3Client | undefined
): Promise<{ body_base64: string; file_name?: string | undefined; content_type?: string | undefined }> {
	if (source.store !== 'object') {
		throw new ToolError('Messaging media source.store must be object (host store is not resolved by this pack)', {
			code: 'unsupported'
		})
	}
	if (!storage) {
		throw new ToolError('ArtifactRef media requires storage credentials on messaging auth', {
			code: 'bad_auth'
		})
	}
	const bytes = await storage.getBytes(source.key)
	return {
		body_base64: bytesToBase64(bytes),
		file_name: source.filename,
		content_type: source.media_type
	}
}

async function resolveMediaBody(
	input: Pick<MessagingSendMediaInput, 'body_base64' | 'source' | 'file_name' | 'content_type' | 'kind'>,
	storage: S3Client | undefined
): Promise<{ body_base64: string; file_name: string; content_type?: string | undefined }> {
	if (input.body_base64 !== undefined) {
		if (!input.file_name) {
			throw new ToolError('file_name is required when body_base64 is set', { code: 'bad_input' })
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
	const fromStore = await bodyFromSource(input.source, storage)
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
	storage: S3Client | undefined
): Promise<MessagingSendMediaResolved> {
	const body = await resolveMediaBody(input, storage)
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

export async function resolveSendMediaBatchInput(
	input: MessagingSendMediaBatchInput,
	storage: S3Client | undefined
): Promise<MessagingSendMediaBatchResolved> {
	const items: MessagingSendMediaBatchResolved['items'] = []
	for (const item of input.items) {
		const body = await resolveMediaBody(item, storage)
		items.push({
			kind: item.kind,
			body_base64: body.body_base64,
			file_name: body.file_name,
			content_type: body.content_type,
			caption: item.caption
		})
	}
	return {
		chat_id: input.chat_id,
		items,
		reply_to_message_id: input.reply_to_message_id,
		service_url: input.service_url
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
