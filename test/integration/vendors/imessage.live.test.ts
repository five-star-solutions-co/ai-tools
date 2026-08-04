import { describe, expect, test } from 'bun:test'

import { ImessageClient } from '../../../src/vendors/imessage'
import { env } from '../env'

/** Photon Advanced iMessage HTTP middleware origin (or bare host). */
const address = env('AI_TOOLS_IMESSAGE_HTTP_ADDRESS') ?? env('AI_TOOLS_IMESSAGE_PROXY_URL')
const token = env('AI_TOOLS_IMESSAGE_TOKEN') ?? env('AI_TOOLS_IMESSAGE_PROJECT_SECRET')
const chatId = env('AI_TOOLS_IMESSAGE_CHAT_ID')
/** Optional dedicated instance id (x-photon-server). */
const server = env('AI_TOOLS_IMESSAGE_SERVER')
/** Optional: attachment guid for downloadFile. */
const inboundFileId = env('AI_TOOLS_IMESSAGE_FILE_ID')
const run = address && token && chatId ? describe : describe.skip

function client() {
	return new ImessageClient({
		address: address!,
		token: token!,
		tls: address!.startsWith('http://') ? false : undefined,
		...(server ? { server } : {})
	})
}

run('live vendor imessage', () => {
	test(
		'send edit typing react media unsend; markRead',
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
				message_id: sent.message_id,
				text: `[ai-tools it] imessage edited ${Date.now()}`
			})
			expect(edited.space_id).toBeTruthy()

			await c.sendChatAction({ chat_id: chatId!, action: 'typing' })
			await c.stopTyping({ chat_id: chatId! })

			await c.setReaction({
				chat_id: chatId!,
				message_id: sent.message_id,
				emoji: 'love'
			})
			await c.clearReaction({
				chat_id: chatId!,
				message_id: sent.message_id,
				emoji: 'love'
			})

			// Advanced iMessage marks the whole chat read (message_id optional).
			await c.read({ chat_id: chatId! })

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
