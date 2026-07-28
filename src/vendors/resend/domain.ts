/**
 * Resend payload shaping + response parse.
 * Vertical helpers: `vendors/_email`.
 */

import { isPlainObject, isString, pick } from 'es-toolkit'

import { ToolError } from '../../core/errors'
import { addressList, addressToString, assertEmailSize, assertRecipientLimit } from '../_email'
import type { ResendSendInput, ResendSendOutput } from './contracts'

export function buildSendPayload(input: ResendSendInput): Record<string, unknown> {
	return {
		...pick(input, ['subject', 'html', 'text', 'headers']),
		from: addressToString(input.from),
		to: addressList(input.to),
		cc: addressList(input.cc),
		bcc: addressList(input.bcc),
		...(input.reply_to && { reply_to: addressToString(input.reply_to) }),
		...(input.attachments && {
			attachments: input.attachments.map((att) => ({
				filename: att.filename,
				content: att.content,
				content_type: att.type,
				...(att.disposition && { content_disposition: att.disposition }),
				// Resend REST uses content_id for CID inline images.
				...(att.content_id && { content_id: att.content_id })
			}))
		})
	}
}

export function preflightSend(input: ResendSendInput): Record<string, unknown> {
	assertRecipientLimit(input)
	const payload = buildSendPayload(input)
	assertEmailSize(
		payload,
		input.attachments?.map((a) => a.content)
	)
	return payload
}

/** Map Resend `{ id }` success body to tool output. */
export function parseSendResult(data: unknown): ResendSendOutput {
	if (!isPlainObject(data)) {
		throw new ToolError('Resend returned an unexpected payload', { code: 'upstream' })
	}
	const id = data['id']
	return {
		success: true,
		...(isString(id) && id.length > 0 && { id })
	}
}
