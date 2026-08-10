import { describe, expect, test } from 'bun:test'

import { ImessageClient } from '../../../src/vendors/imessage'
import type { ImessageAuth } from '../../../src/vendors/imessage'
import { env } from '../env'

/** photon-rest-proxy origin + Spectrum project credentials. */
const baseUrl = env('AI_TOOLS_IMESSAGE_BASE_URL') ?? env('AI_TOOLS_IMESSAGE_PROXY_URL')
const projectId = env('AI_TOOLS_IMESSAGE_PROJECT_ID')
const projectSecret = env('AI_TOOLS_IMESSAGE_PROJECT_SECRET')
const chatId = env('AI_TOOLS_IMESSAGE_CHAT_ID')
const phone = env('AI_TOOLS_IMESSAGE_PHONE')
const inboundFileId = env('AI_TOOLS_IMESSAGE_FILE_ID')

const run = baseUrl && projectId && projectSecret && chatId ? describe : describe.skip

function client() {
	const auth: ImessageAuth = {
		base_url: baseUrl!,
		project_id: projectId!,
		project_secret: projectSecret!,
		...(phone ? { phone } : {})
	}
	return new ImessageClient(auth)
}

run('live vendor imessage (photon-rest-proxy)', () => {
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
			expect(edited.message_id).toBeTruthy()

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

			await c.read({ chat_id: chatId! })

			const media = await c.sendMedia({
				chat_id: chatId!,
				kind: 'document',
				file_name: 'ai-tools-it.txt',
				body_base64: Buffer.from('imessage media it').toString('base64'),
				content_type: 'text/plain'
			})
			expect(media.message_id).toBeTruthy()

			await c.unsend({ chat_id: chatId!, message_id: media.message_id })

			if (inboundFileId) {
				const dl = await c.downloadFile({
					chat_id: chatId!,
					file_id: inboundFileId,
					file_name: 'imessage-dl.bin'
				})
				expect(dl.body_base64.length).toBeGreaterThan(0)
			}
		},
		{ timeout: 120_000 }
	)
})
