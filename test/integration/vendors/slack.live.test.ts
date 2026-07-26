import { describe, expect, test } from 'bun:test'

import { SlackClient } from '../../../src/vendors/slack'
import { env } from '../env'

const token = env('AI_TOOLS_SLACK_BOT_TOKEN')
const channel = env('AI_TOOLS_SLACK_CHANNEL_ID')
/** Optional: real Slack user id for postEphemeral (bot user alone is not enough). */
const ephemeralUser = env('AI_TOOLS_SLACK_USER_ID')
const run = token ? describe : describe.skip

run('live vendor slack', () => {
	test('getBot + listConversations', async () => {
		const client = new SlackClient({ bot_token: token! })
		const bot = await client.getBot()
		expect(bot.bot_id).toBeTruthy()
		const convos = await client.listConversations({ limit: 5 })
		expect(Array.isArray(convos.channels)).toBe(true)
	})

	test(
		'channel surface: send edit thread-typing react media download (+ optional ephemeral; answerCallback no-op)',
		async () => {
			if (!channel) return
			const client = new SlackClient({ bot_token: token! })
			const msg = await client.sendText({
				chat_id: channel,
				text: `[ai-tools it] slack ${Date.now()}`
			})
			expect(msg.message_id).toBeTruthy()

			const edited = await client.editText({
				chat_id: channel,
				message_id: msg.message_id,
				text: `[ai-tools it] slack edited ${Date.now()}`
			})
			expect(edited.message_id).toBeTruthy()

			// Real assistant.threads.setStatus path requires thread_ts (reply_to_message_id).
			await client.sendChatAction({
				chat_id: channel,
				action: 'typing',
				reply_to_message_id: msg.message_id
			})
			await client.stopTyping({
				chat_id: channel,
				reply_to_message_id: msg.message_id
			})

			await client.setReaction({
				chat_id: channel,
				message_id: msg.message_id,
				emoji: 'thumbsup'
			})
			await client.clearReaction({
				chat_id: channel,
				message_id: msg.message_id,
				emoji: 'thumbsup'
			})

			const mediaBody = 'slack media it'
			const media = await client.sendMedia({
				chat_id: channel,
				kind: 'document',
				file_name: 'ai-tools-it.txt',
				body_base64: Buffer.from(mediaBody).toString('base64'),
				content_type: 'text/plain'
			})
			expect(media.message_id).toBeTruthy()
			expect(media.file_id).toBeTruthy()

			const downloaded = await client.downloadFile({
				file_id: media.file_id!,
				file_name: 'slack-dl.txt'
			})
			expect(downloaded.body_base64.length).toBeGreaterThan(0)
			expect(Buffer.from(downloaded.body_base64, 'base64').toString('utf8')).toBe(mediaBody)

			if (ephemeralUser) {
				const eph = await client.postEphemeral({
					chat_id: channel,
					user_id: ephemeralUser,
					text: `[ai-tools it] ephemeral ${Date.now()}`
				})
				expect(eph.message_id).toBeTruthy()
			}

			// Non-URL callback_query_id is a documented successful no-op.
			await client.answerCallback({ callback_query_id: 'not-a-response-url' })
		},
		{ timeout: 60_000 }
	)
})
