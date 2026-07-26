import { describe, expect, test } from 'bun:test'

import { TelegramClient } from '../../../src/vendors/telegram'
import { env, IT } from '../env'

const botToken = env('AI_TOOLS_TELEGRAM_BOT_TOKEN')
const chatId = env('AI_TOOLS_TELEGRAM_CHAT_ID')
/** HTTPS URL only. Temporarily replaces any existing webhook; always deleted after. */
const webhookUrl = env('AI_TOOLS_TELEGRAM_WEBHOOK_URL')
const webhookSecret = env('AI_TOOLS_TELEGRAM_WEBHOOK_SECRET') ?? IT.telegram.webhookSecret
const run = botToken ? describe : describe.skip

run('live vendor telegram', () => {
	test('getBot + getWebhookInfo', async () => {
		const client = new TelegramClient({ bot_token: botToken! })
		const bot = await client.getBot()
		expect(bot.bot_id).toBeTruthy()
		expect(bot.username).toBeTruthy()
		const wh = await client.getWebhookInfo()
		expect(wh).toBeDefined()
		expect(typeof wh.url).toBe('string')
		expect(typeof wh.pending_update_count).toBe('number')
	})

	test(
		'setWebhook + getWebhookInfo + deleteWebhook (optional)',
		async () => {
			if (!webhookUrl) return
			if (!webhookUrl.startsWith('https://')) {
				throw new Error('AI_TOOLS_TELEGRAM_WEBHOOK_URL must be https://…')
			}
			const client = new TelegramClient({ bot_token: botToken! })
			try {
				await client.setWebhook({
					url: webhookUrl,
					secret_token: webhookSecret
				})
				const afterSet = await client.getWebhookInfo()
				expect(afterSet.url).toBe(webhookUrl)
			} finally {
				await client.deleteWebhook({ drop_pending_updates: true })
				const afterDelete = await client.getWebhookInfo()
				expect(afterDelete.url).toBe('')
			}
		},
		{ timeout: 20_000 }
	)

	test(
		'chat surface: send edit action react media download (optional chat)',
		async () => {
			if (!chatId) return
			const client = new TelegramClient({ bot_token: botToken! })
			const msg = await client.sendText({
				chat_id: chatId,
				text: `[ai-tools it] telegram ${Date.now()}`
			})
			expect(msg.message_id).toBeTruthy()

			const edited = await client.editText({
				chat_id: chatId,
				message_id: msg.message_id,
				text: `[ai-tools it] telegram edited ${Date.now()}`
			})
			expect(edited.message_id).toBeTruthy()

			await client.sendChatAction({ chat_id: chatId, action: 'typing' })

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
				kind: 'document',
				file_name: 'ai-tools-it.txt',
				body_base64: Buffer.from('telegram media it').toString('base64'),
				content_type: 'text/plain'
			})
			expect(media.message_id).toBeTruthy()
			expect(media.file_id).toBeTruthy()

			const downloaded = await client.downloadFile({
				file_id: media.file_id!,
				file_name: 'ai-tools-it-dl.txt'
			})
			expect(downloaded.body_base64).toBeTruthy()
			expect(Buffer.from(downloaded.body_base64, 'base64').toString('utf8')).toBe('telegram media it')

			const group = await client.sendMediaGroup({
				chat_id: chatId,
				items: [
					{
						kind: 'document',
						file_name: 'a.txt',
						body_base64: Buffer.from('a').toString('base64')
					},
					{
						kind: 'document',
						file_name: 'b.txt',
						body_base64: Buffer.from('b').toString('base64')
					}
				]
			})
			expect(group.message_ids.length).toBeGreaterThan(0)
		},
		{ timeout: 30_000 }
	)
})
