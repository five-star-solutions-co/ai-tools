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
 * Channel gap that stays callable: log once per call, then succeed as a no-op.
 * Prefer this over throwing `unsupported` for optional presentation/lifecycle verbs
 * so multi-channel hosts can call one surface without branching.
 */
export function warnUnsupportedMessagingOp(provider: string, op: string): void {
	console.warn(`[messaging] ${provider} does not support ${op}; treating as no-op`)
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
