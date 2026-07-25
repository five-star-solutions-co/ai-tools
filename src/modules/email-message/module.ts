import { isNil, isPlainObject, isString } from 'es-toolkit'
import { castArray, has, isArray } from 'es-toolkit/compat'
import { createMimeMessage } from 'mimetext'
import PostalMime from 'postal-mime'
import { z } from 'zod'

import { defineModule, defineTool } from '../../core/define'
import { ToolError } from '../../core/errors'
import { base64ToBytes, bytesToBase64, utf8ToBytes } from '../../shared/bytes'

const addressSchema = z.object({
	address: z.email().describe('Email address'),
	name: z.string().optional().describe('Display name')
})

const attachmentOutSchema = z.object({
	filename: z.string().optional(),
	mime_type: z.string().optional().describe('Attachment MIME type when known'),
	size: z.number().optional(),
	disposition: z.enum(['attachment', 'inline']).optional(),
	content_id: z.string().optional(),
	content_base64: z.string().optional().describe('Attachment bytes as base64 when available')
})

const parseInput = z.object({
	raw: z.string().min(1).describe('Raw RFC 822 / MIME message as utf8 text or base64'),
	encoding: z.enum(['utf8', 'base64']).optional().describe('How to decode raw. Defaults to utf8')
})

const parseOutput = z.object({
	subject: z.string().optional(),
	from: addressSchema.optional(),
	to: z.array(addressSchema).optional(),
	cc: z.array(addressSchema).optional(),
	bcc: z.array(addressSchema).optional(),
	reply_to: z.array(addressSchema).optional(),
	message_id: z.string().optional(),
	in_reply_to: z.string().optional(),
	references: z.string().optional(),
	date: z.string().optional(),
	text: z.string().optional(),
	html: z.string().optional(),
	headers: z
		.array(
			z.object({
				key: z.string().describe('Lowercase header name'),
				value: z.string()
			})
		)
		.optional()
		.describe('Parsed header key/value pairs'),
	attachments: z.array(attachmentOutSchema)
})

const buildAttachmentSchema = z.object({
	filename: z.string().min(1).max(255).describe('Attachment file name'),
	content_base64: z.string().min(1).describe('Attachment bytes as base64 (no data: URL prefix)'),
	content_type: z.string().min(1).optional().describe('MIME type. Defaults to application/octet-stream'),
	inline: z.boolean().optional().describe('When true, attach as inline content'),
	content_id: z.string().optional().describe('Content-ID for inline references')
})

const buildInput = z
	.object({
		from: z.union([z.email(), addressSchema]).describe('Sender address or { address, name }'),
		to: z
			.union([z.email(), addressSchema, z.array(z.union([z.email(), addressSchema])).min(1)])
			.describe('Recipient address, named address, or list'),
		subject: z.string().min(1).describe('Subject line'),
		text: z.string().optional().describe('Plain text body'),
		html: z.string().optional().describe('HTML body'),
		cc: z
			.union([z.email(), addressSchema, z.array(z.union([z.email(), addressSchema]))])
			.optional()
			.describe('CC recipients'),
		bcc: z
			.union([z.email(), addressSchema, z.array(z.union([z.email(), addressSchema]))])
			.optional()
			.describe('BCC recipients'),
		reply_to: z.union([z.email(), addressSchema]).optional().describe('Reply-To address'),
		headers: z.record(z.string(), z.string()).optional().describe('Additional headers as a string map'),
		attachments: z
			.array(buildAttachmentSchema)
			.max(32)
			.optional()
			.describe('Up to 32 base64 attachments to include in the message')
	})
	.refine((v) => Boolean(v.text?.trim() || v.html?.trim()), {
		message: 'Provide text and/or html body'
	})

const buildOutput = z.object({
	raw: z.string().describe('Serialized email message')
})

function contentToBase64(content: unknown): { base64?: string; size?: number } {
	if (isNil(content)) return {}
	if (isString(content)) {
		const bytes = utf8ToBytes(content)
		return { base64: bytesToBase64(bytes), size: bytes.byteLength }
	}
	if (content instanceof ArrayBuffer) {
		const bytes = new Uint8Array(content)
		return { base64: bytesToBase64(bytes), size: bytes.byteLength }
	}
	if (content instanceof Uint8Array) {
		return { base64: bytesToBase64(content), size: content.byteLength }
	}
	return {}
}

function mapAddr(a: unknown): { address: string; name?: string } | undefined {
	if (!isPlainObject(a) || !has(a, 'address')) return undefined
	const address = a['address']
	if (!isString(address) || address.length === 0) return undefined
	const name = has(a, 'name') && isString(a['name']) ? a['name'] : undefined
	return isNil(name) || name.length === 0 ? { address } : { address, name }
}

function mapAddrList(list: unknown): Array<{ address: string; name?: string }> {
	if (!isArray(list)) return []
	return castArray(list)
		.map(mapAddr)
		.filter((a): a is { address: string; name?: string } => !isNil(a))
}

function formatMailbox(value: unknown): string {
	if (isString(value)) return value
	const mapped = mapAddr(value)
	if (!mapped) {
		throw new ToolError('Invalid mailbox address', { code: 'bad_input' })
	}
	if (isNil(mapped.name) || mapped.name.length === 0) return mapped.address
	return `${mapped.name} <${mapped.address}>`
}

function formatMailboxList(value: unknown): string[] {
	if (isNil(value)) return []
	return castArray(value).map((item) => formatMailbox(item))
}

function mapDisposition(value: unknown): 'attachment' | 'inline' | undefined {
	return value === 'attachment' || value === 'inline' ? value : undefined
}

export const parseEmailMessageTool = defineTool({
	id: 'email-message-parse',
	name: 'parseEmailMessage',
	description:
		'Parse a raw RFC 822 / MIME email into structured headers, text/html bodies, identifiers, and attachment metadata. Use when you need to inspect message content without sending mail.',
	inputSchema: parseInput,
	outputSchema: parseOutput,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input) => {
		const bytes = input.encoding === 'base64' ? base64ToBytes(input.raw) : utf8ToBytes(input.raw)
		try {
			const parser = new PostalMime()
			const message = await parser.parse(bytes)
			const from = mapAddr(message.from)
			const html = isString(message.html) && message.html.length > 0 ? message.html : undefined
			const headers: Array<{ key: string; value: string }> = []
			if (isArray(message.headers)) {
				for (const h of message.headers) {
					if (!isPlainObject(h)) continue
					const key = h['key']
					const value = h['value']
					if (isString(key) && isString(value)) headers.push({ key, value })
				}
			}
			return parseOutput.parse({
				subject: message.subject,
				from,
				to: mapAddrList(message.to),
				cc: mapAddrList(message.cc),
				bcc: mapAddrList(message.bcc),
				reply_to: mapAddrList(message.replyTo),
				message_id: message.messageId,
				in_reply_to: message.inReplyTo,
				references: message.references,
				date: message.date,
				text: message.text,
				html,
				...(headers.length > 0 ? { headers } : {}),
				attachments: (message.attachments ?? []).map((att) => {
					const encoded = contentToBase64(att.content)
					const disposition = mapDisposition(att.disposition)
					const filename = isString(att.filename) && att.filename.length > 0 ? att.filename : undefined
					const contentId = isString(att.contentId) && att.contentId.length > 0 ? att.contentId : undefined
					return {
						filename,
						mime_type: att.mimeType,
						size: encoded.size,
						disposition,
						content_id: contentId,
						content_base64: encoded.base64
					}
				})
			})
		} catch (error) {
			if (error instanceof ToolError) throw error
			throw new ToolError('Failed to parse email message', {
				code: 'bad_input',
				cause: error
			})
		}
	}
})

export const buildEmailMessageTool = defineTool({
	id: 'email-message-build',
	name: 'buildEmailMessage',
	description:
		'Build a raw RFC 822 / MIME email from structured sender, recipients, subject, text/html bodies, optional headers, and base64 attachments. Use when you need a serialized message for SMTP or archival. Provide text and/or html.',
	inputSchema: buildInput,
	outputSchema: buildOutput,
	sideEffect: 'none',
	runtime: 'both',
	execute: async (input) => {
		try {
			const msg = createMimeMessage()
			msg.setSender(formatMailbox(input.from))
			msg.setRecipients(formatMailboxList(input.to))
			const cc = formatMailboxList(input.cc)
			if (cc.length > 0) msg.setCc(cc)
			const bcc = formatMailboxList(input.bcc)
			if (bcc.length > 0) msg.setBcc(bcc)
			if (input.reply_to) {
				msg.setHeader('Reply-To', formatMailbox(input.reply_to))
			}
			if (input.headers) {
				for (const [name, value] of Object.entries(input.headers)) {
					if (name.trim().length === 0) {
						throw new ToolError('Header names must be non-empty', { code: 'bad_input' })
					}
					msg.setHeader(name, value)
				}
			}
			msg.setSubject(input.subject)
			if (input.text) {
				msg.addMessage({ contentType: 'text/plain', data: input.text })
			}
			if (input.html) {
				msg.addMessage({ contentType: 'text/html', data: input.html })
			}
			if (input.attachments) {
				for (const att of input.attachments) {
					// Validate base64 early for a stable error code.
					try {
						base64ToBytes(att.content_base64)
					} catch (error) {
						throw new ToolError('Attachment content_base64 is not valid base64', {
							code: 'bad_input',
							cause: error
						})
					}
					const headers: Record<string, string> = {}
					if (att.content_id) headers['Content-ID'] = att.content_id
					msg.addAttachment({
						filename: att.filename,
						contentType: att.content_type ?? 'application/octet-stream',
						data: att.content_base64,
						encoding: 'base64',
						inline: att.inline === true,
						headers
					})
				}
			}
			return buildOutput.parse({ raw: msg.asRaw() })
		} catch (error) {
			if (error instanceof ToolError) throw error
			throw new ToolError('Failed to build email message', {
				code: 'bad_input',
				cause: error
			})
		}
	}
})

export const emailMessageModule = defineModule({
	id: 'email-message',
	title: 'Email Message',
	description: 'Parse and build RFC 822 email messages without sending them.',
	runtime: 'both',
	auth: { type: 'none' },
	tools: [parseEmailMessageTool, buildEmailMessageTool]
})
