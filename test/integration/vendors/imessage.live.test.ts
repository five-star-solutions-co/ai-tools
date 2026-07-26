import { describe, expect, test } from 'bun:test'

import { ImessageClient, ImessageClientError } from '../../../src/vendors/imessage'
import { env } from '../env'

const baseUrl = env('AI_TOOLS_IMESSAGE_PROXY_URL')
const projectId = env('AI_TOOLS_IMESSAGE_PROJECT_ID')
const projectSecret = env('AI_TOOLS_IMESSAGE_PROJECT_SECRET')
const chatId = env('AI_TOOLS_IMESSAGE_CHAT_ID')
/** User-sent message in the same space — required for a successful /v1/read. */
const inboundMessageId = env('AI_TOOLS_IMESSAGE_INBOUND_MESSAGE_ID')
/** Optional: Spectrum attachment/voice message id from an inbound message for downloadFile. */
const inboundFileId = env('AI_TOOLS_IMESSAGE_FILE_ID')
const run = baseUrl && projectId && projectSecret && chatId ? describe : describe.skip

function client() {
	return new ImessageClient({
		base_url: baseUrl!,
		project_id: projectId!,
		project_secret: projectSecret!,
		...(env('AI_TOOLS_IMESSAGE_PHONE') ? { phone: env('AI_TOOLS_IMESSAGE_PHONE') } : {})
	})
}

run('live vendor imessage', () => {
	test(
		'send edit typing react media unsend; read contract',
		async () => {
			const c = client()
			const sent = await c.sendText({
				chat_id: chatId!,
				text: `[ai-tools it] imessage ${Date.now()}`
			})
			expect(sent.space_id).toBeTruthy()
			expect(sent.message_id).toBeTruthy()

			const edited = await c.editText({
				chat_id: chatId!,
				message_id: sent.message_id!,
				text: `[ai-tools it] imessage edited ${Date.now()}`
			})
			expect(edited.space_id).toBeTruthy()

			await c.sendChatAction({ chat_id: chatId!, action: 'typing' })
			await c.stopTyping({ chat_id: chatId! })

			const reaction = await c.setReaction({
				chat_id: chatId!,
				message_id: sent.message_id!,
				emoji: '❤️'
			})
			if (reaction.message_id) {
				await c.clearReaction({
					chat_id: chatId!,
					message_id: reaction.message_id
				})
			}

			// Spectrum only marks *inbound* messages as read. Outbound must 400, not 502.
			let outboundReadError: unknown
			try {
				await c.read({ chat_id: chatId!, message_id: sent.message_id! })
			} catch (error) {
				outboundReadError = error
			}
			expect(outboundReadError).toBeInstanceOf(ImessageClientError)
			if (!(outboundReadError instanceof ImessageClientError)) {
				throw new Error('expected ImessageClientError for outbound read')
			}
			expect(outboundReadError.details?.['status']).toBe(400)

			// Successful read requires a user-sent message id in the same space.
			if (!inboundMessageId) {
				throw new Error(
					'AI_TOOLS_IMESSAGE_INBOUND_MESSAGE_ID is required for successful /v1/read (user-sent message id in the same chat)'
				)
			}
			await c.read({ chat_id: chatId!, message_id: inboundMessageId })

			const media = await c.sendMedia({
				chat_id: chatId!,
				kind: 'document',
				file_name: 'ai-tools-it.txt',
				body_base64: Buffer.from('imessage media it').toString('base64'),
				content_type: 'text/plain'
			})
			expect(media.space_id).toBeTruthy()

			if (inboundFileId) {
				const downloaded = await c.downloadFile({
					chat_id: chatId!,
					file_id: inboundFileId,
					file_name: 'imessage-dl.bin'
				})
				expect(downloaded.body_base64.length).toBeGreaterThan(0)
			}

			if (media.message_id) {
				await c.unsend({ chat_id: chatId!, message_id: media.message_id })
			}

			await c.answerCallback({})
		},
		{ timeout: 90_000 }
	)
})
