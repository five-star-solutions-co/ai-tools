/**
 * Cloudflare Email Sending payload + envelope parse.
 * Vertical helpers: `vendors/_email`.
 */

import { isNumber, isPlainObject, isString, pick } from 'es-toolkit'
import { isArray } from 'es-toolkit/compat'

import { ToolError } from '../../core/errors'
import { addressObject, addressObjectList, assertEmailSize, assertRecipientLimit } from '../_email'
import type { CloudflareEmailSendInput, CloudflareEmailSendOutput } from './contracts'

export function buildSendPayload(input: CloudflareEmailSendInput): Record<string, unknown> {
	return {
		...pick(input, ['subject', 'html', 'text', 'headers']),
		to: addressObjectList(input.to),
		from: addressObject(input.from),
		cc: addressObjectList(input.cc),
		bcc: addressObjectList(input.bcc),
		...(input.reply_to && { replyTo: addressObject(input.reply_to) }),
		...(input.attachments && {
			attachments: input.attachments.map((att) => ({
				content: att.content,
				filename: att.filename,
				type: att.type,
				...(att.disposition && { disposition: att.disposition }),
				// Cloudflare Email Sending uses camelCase wire fields (same as replyTo).
				...(att.content_id && { contentId: att.content_id })
			}))
		})
	}
}

export function preflightSend(input: CloudflareEmailSendInput): Record<string, unknown> {
	assertRecipientLimit(input)
	const payload = buildSendPayload(input)
	assertEmailSize(
		payload,
		input.attachments?.map((a) => a.content)
	)
	return payload
}

function stringArray(value: unknown): string[] {
	return isArray(value) ? value.filter(isString) : []
}

function firstError(errors: unknown): { message?: string; code?: number } {
	if (!isArray(errors) || errors.length === 0) return {}
	const first = errors[0]
	if (!isPlainObject(first)) return {}
	const message = first['message']
	const code = first['code']
	return {
		...(isString(message) && message.length > 0 && { message }),
		...(isNumber(code) && Number.isFinite(code) && { code })
	}
}

/** Map Cloudflare `{ success, result | errors }` to tool output or ToolError. */
export function parseSendResult(data: unknown): CloudflareEmailSendOutput {
	if (!isPlainObject(data)) {
		throw new ToolError('Cloudflare Email returned an unexpected payload', { code: 'upstream' })
	}

	if (data['success'] === false) {
		const { message, code: cfCode } = firstError(data['errors'])
		const text = message ?? 'Email API rejected the send'
		const lower = text.toLowerCase()
		const code =
			lower.includes('unauthorized') || lower.includes('authentication') || cfCode === 10000
				? 'bad_auth'
				: lower.includes('forbidden') || lower.includes('permission')
					? 'forbidden'
					: lower.includes('rate') || lower.includes('too many')
						? 'rate_limited'
						: lower.includes('too large') || lower.includes('size')
							? 'too_large'
							: 'upstream'
		throw new ToolError(text, {
			code,
			retryable: code === 'rate_limited',
			details: {
				success: false,
				cloudflare_error_code: cfCode
			}
		})
	}

	const result = data['result']
	if (!isPlainObject(result)) {
		throw new ToolError('Cloudflare Email returned no result object', { code: 'upstream' })
	}

	const delivered = stringArray(result['delivered'])
	const queued = stringArray(result['queued'])
	const rejected = stringArray(result['permanent_bounces'])
	const accepted = [...delivered, ...queued]

	return {
		success: data['success'] === true,
		...(accepted.length > 0 && { accepted }),
		...(rejected.length > 0 && { rejected })
	}
}
