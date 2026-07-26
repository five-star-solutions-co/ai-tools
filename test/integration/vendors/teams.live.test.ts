import { describe, expect, test } from 'bun:test'

import { TeamsClient } from '../../../src/vendors/teams'
import { env } from '../env'

const appId = env('AI_TOOLS_TEAMS_APP_ID')
const appPassword = env('AI_TOOLS_TEAMS_APP_PASSWORD')
const chatId = env('AI_TOOLS_TEAMS_CHAT_ID')
const serviceUrl = env('AI_TOOLS_TEAMS_SERVICE_URL')
/** Optional: absolute content URL from an inbound attachment for downloadFile. */
const fileUrl = env('AI_TOOLS_TEAMS_FILE_URL')
const run = appId && appPassword ? describe : describe.skip

run('live vendor teams', () => {
	test('getBot (token + profile)', async () => {
		const client = new TeamsClient({
			app_id: appId!,
			app_password: appPassword!
		})
		const bot = await client.getBot()
		expect(bot).toBeDefined()
	})

	test(
		'conversation surface when chat + service_url set',
		async () => {
			if (!chatId || !serviceUrl) return
			const client = new TeamsClient({
				app_id: appId!,
				app_password: appPassword!
			})
			const msg = await client.sendText({
				chat_id: chatId,
				service_url: serviceUrl,
				text: `[ai-tools it] teams ${Date.now()}`
			})
			expect(msg.message_id).toBeTruthy()

			const edited = await client.editText({
				chat_id: chatId,
				service_url: serviceUrl,
				message_id: msg.message_id,
				text: `[ai-tools it] teams edited ${Date.now()}`
			})
			expect(edited.message_id).toBeTruthy()

			await client.sendChatAction({
				chat_id: chatId,
				service_url: serviceUrl,
				action: 'typing'
			})

			// presentation no-ops on Teams
			await client.setReaction({
				chat_id: chatId,
				message_id: msg.message_id,
				emoji: '👍'
			})
			await client.clearReaction({
				chat_id: chatId,
				message_id: msg.message_id
			})

			const media = await client.sendMedia({
				chat_id: chatId,
				service_url: serviceUrl,
				kind: 'document',
				file_name: 'ai-tools-it.txt',
				body_base64: Buffer.from('teams media it').toString('base64'),
				content_type: 'text/plain'
			})
			expect(media.message_id).toBeTruthy()

			// Non-URL callback_query_id is a documented successful no-op.
			await client.answerCallback({ callback_query_id: 'not-an-invoke-reply-url' })

			if (fileUrl) {
				const downloaded = await client.downloadFile({
					file_id: fileUrl,
					file_name: 'teams-dl.bin'
				})
				expect(downloaded.body_base64.length).toBeGreaterThan(0)
			}
		},
		{ timeout: 30_000 }
	)
})
