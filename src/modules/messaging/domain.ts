/**
 * Messaging seam helpers (no HTTP).
 */

import { runBatchItems } from '../../shared/batch'
import { isImessageDefiniteRejection, isImessageOutcomeUnknown } from '../../vendors/imessage'
import { isSlackDefiniteRejection, isSlackOutcomeUnknown } from '../../vendors/slack'
import { isTeamsDefiniteRejection, isTeamsOutcomeUnknown } from '../../vendors/teams'
import { isTelegramDefiniteRejection, isTelegramOutcomeUnknown } from '../../vendors/telegram'
import type {
	MessagingMessageOutput,
	MessagingSendMediaBatchInput,
	MessagingSendMediaBatchOutput,
	MessagingSendMediaInput
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

/** Sequential sendMedia for channels without a native multi-file API. */
export async function sendMediaBatchSequential(
	sendOne: (item: MessagingSendMediaInput) => Promise<MessagingMessageOutput>,
	input: MessagingSendMediaBatchInput
): Promise<MessagingSendMediaBatchOutput> {
	const batch = await runBatchItems(
		input.items,
		(item) =>
			sendOne({
				chat_id: input.chat_id,
				kind: item.kind,
				body_base64: item.body_base64,
				file_name: item.file_name,
				...(item.caption && { caption: item.caption }),
				...(item.content_type && { content_type: item.content_type }),
				...(input.reply_to_message_id && { reply_to_message_id: input.reply_to_message_id }),
				...(input.service_url && { service_url: input.service_url })
			}),
		{ concurrency: 1 }
	)
	const message_ids: string[] = []
	for (const row of batch.results) {
		if (row.ok && row.value?.message_id) message_ids.push(row.value.message_id)
	}
	return { message_ids, results: batch }
}
