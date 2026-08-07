import { describe, expect, test } from 'bun:test'

import { ImessageClient } from '../../../src/vendors/imessage'
import type { ImessageAuth } from '../../../src/vendors/imessage'
import { env } from '../env'

/** Spectrum Cloud project credentials (preferred) or direct gRPC address+token. */
const projectId = env('AI_TOOLS_IMESSAGE_PROJECT_ID')
const projectSecret = env('AI_TOOLS_IMESSAGE_PROJECT_SECRET')
const address = env('AI_TOOLS_IMESSAGE_GRPC_ADDRESS') ?? env('AI_TOOLS_IMESSAGE_ADDRESS')
const token = env('AI_TOOLS_IMESSAGE_TOKEN')
const chatId = env('AI_TOOLS_IMESSAGE_CHAT_ID')
/** Optional dedicated instance id. */
const server = env('AI_TOOLS_IMESSAGE_SERVER')
const inboundFileId = env('AI_TOOLS_IMESSAGE_FILE_ID')
const spectrumCloudUrl = env('AI_TOOLS_IMESSAGE_SPECTRUM_CLOUD_URL')
const sharedGrpcOverride = env('AI_TOOLS_IMESSAGE_SPECTRUM_IMESSAGE_ADDRESS')

const hasSpectrum = Boolean(projectId && projectSecret)
const hasDirect = Boolean(address && token)
const run = chatId && (hasSpectrum || hasDirect) ? describe : describe.skip

function client() {
	const auth: ImessageAuth = hasSpectrum
		? {
				project_id: projectId!,
				project_secret: projectSecret!,
				...(server ? { server } : {}),
				...(spectrumCloudUrl ? { spectrum_cloud_url: spectrumCloudUrl } : {}),
				...(sharedGrpcOverride ? { spectrum_imessage_address: sharedGrpcOverride } : {})
			}
		: {
				address: address!,
				token: token!,
				...(server ? { server } : {})
			}
	return new ImessageClient(auth)
}

run('live vendor imessage (gRPC / Spectrum)', () => {
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
			expect(c.grpcAddress).toBeTruthy()

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

			await c.close()
		},
		{ timeout: 120_000 }
	)
})
