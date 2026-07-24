import { describe, expect, test } from 'bun:test'

import { isToolError } from '../../../src/core'
import { MessagingClient } from '../../../src/modules/messaging'
import { env } from '../env'

const tgToken = env('AI_TOOLS_TELEGRAM_BOT_TOKEN')
const tgChat = env('AI_TOOLS_TELEGRAM_CHAT_ID')
const runTg = tgToken && tgChat ? describe : describe.skip

const slackToken = env('AI_TOOLS_SLACK_BOT_TOKEN')
const slackChannel = env('AI_TOOLS_SLACK_CHANNEL_ID')
const runSlack = slackToken && slackChannel ? describe : describe.skip

const imBase = env('AI_TOOLS_IMESSAGE_PROXY_URL')
const imProject = env('AI_TOOLS_IMESSAGE_PROJECT_ID')
const imSecret = env('AI_TOOLS_IMESSAGE_PROJECT_SECRET')
const imChat = env('AI_TOOLS_IMESSAGE_CHAT_ID')
/** User-sent message in the same space — required for a successful seam read. */
const imInboundMessageId = env('AI_TOOLS_IMESSAGE_INBOUND_MESSAGE_ID')
const runIm = imBase && imProject && imSecret && imChat ? describe : describe.skip

const teamsApp = env('AI_TOOLS_TEAMS_APP_ID')
const teamsPass = env('AI_TOOLS_TEAMS_APP_PASSWORD')
const teamsChat = env('AI_TOOLS_TEAMS_CHAT_ID')
const teamsService = env('AI_TOOLS_TEAMS_SERVICE_URL')
const runTeams = teamsApp && teamsPass && teamsChat && teamsService ? describe : describe.skip

const tinyDoc = (label: string) => Buffer.from(label).toString('base64')

async function expectWarnNoOp(run: () => Promise<void>, fragments: string[]): Promise<void> {
	const warnings: string[] = []
	const original = console.warn
	console.warn = (...args: unknown[]) => {
		warnings.push(args.map(String).join(' '))
	}
	try {
		await run()
		const hit = warnings.some((line) => fragments.every((f) => line.includes(f)))
		expect(hit).toBe(true)
	} finally {
		console.warn = original
	}
}

runTg('live seam messaging (telegram)', () => {
	test(
		'full surface: send edit action stopTyping react media download batch read/unsend gaps',
		async () => {
			const client = MessagingClient.fromAuth({
				provider: 'telegram',
				bot_token: tgToken!
			})
			const chat_id = tgChat!

			const msg = await client.sendText({
				chat_id,
				text: `[ai-tools it] messaging tg ${Date.now()}`
			})
			expect(msg.message_id).toBeTruthy()

			const edited = await client.editText({
				chat_id,
				message_id: msg.message_id,
				text: `[ai-tools it] messaging tg edited ${Date.now()}`
			})
			expect(edited.message_id).toBeTruthy()

			await client.sendChatAction({ chat_id, action: 'typing' })
			// Telegram typing auto-expires — successful no-op (no warn).
			await client.stopTyping({ chat_id })

			const reaction = await client.setReaction({
				chat_id,
				message_id: msg.message_id,
				emoji: '👍'
			})
			expect(reaction.message_id).toBeUndefined()
			await client.clearReaction({
				chat_id,
				message_id: msg.message_id
			})

			const mediaBody = 'tg seam media'
			const media = await client.sendMedia({
				chat_id,
				kind: 'document',
				file_name: 'msg-tg.txt',
				body_base64: Buffer.from(mediaBody).toString('base64'),
				content_type: 'text/plain'
			})
			expect(media.message_id).toBeTruthy()
			expect(media.file_id).toBeTruthy()

			const downloaded = await client.downloadFile({
				file_id: media.file_id!,
				file_name: 'msg-tg-dl.txt'
			})
			expect(Buffer.from(downloaded.body_base64, 'base64').toString('utf8')).toBe(mediaBody)

			const batch = await client.sendMediaBatch({
				chat_id,
				items: [
					{
						kind: 'document',
						file_name: 'tg-a.txt',
						body_base64: tinyDoc('a'),
						content_type: 'text/plain'
					},
					{
						kind: 'document',
						file_name: 'tg-b.txt',
						body_base64: tinyDoc('b'),
						content_type: 'text/plain'
					}
				]
			})
			expect(batch.message_ids.length).toBe(2)
			expect(batch.results.succeeded).toBe(2)
			expect(batch.results.failed).toBe(0)

			// Optional lifecycle verbs: warn + no-op (not throws).
			await expectWarnNoOp(() => client.read({ chat_id, message_id: msg.message_id }), ['telegram', 'read'])
			await expectWarnNoOp(() => client.unsend({ chat_id, message_id: msg.message_id }), ['telegram', 'unsend'])
		},
		{ timeout: 60_000 }
	)
})

runSlack('live seam messaging (slack)', () => {
	test(
		'full surface: send edit action stopTyping react media batch read/unsend gaps',
		async () => {
			const client = MessagingClient.fromAuth({
				provider: 'slack',
				bot_token: slackToken!
			})
			const chat_id = slackChannel!

			const msg = await client.sendText({
				chat_id,
				text: `[ai-tools it] messaging slack ${Date.now()}`
			})
			expect(msg.message_id).toBeTruthy()

			const edited = await client.editText({
				chat_id,
				message_id: msg.message_id,
				text: `[ai-tools it] messaging slack edited ${Date.now()}`
			})
			expect(edited.message_id).toBeTruthy()

			await client.sendChatAction({ chat_id, action: 'typing' })
			await client.stopTyping({ chat_id })

			const reaction = await client.setReaction({
				chat_id,
				message_id: msg.message_id,
				emoji: 'thumbsup'
			})
			expect(reaction.message_id).toBeUndefined()
			await client.clearReaction({
				chat_id,
				message_id: msg.message_id,
				emoji: 'thumbsup'
			})

			const media = await client.sendMedia({
				chat_id,
				kind: 'document',
				file_name: 'msg-slack.txt',
				body_base64: Buffer.from('slack seam media').toString('base64'),
				content_type: 'text/plain'
			})
			expect(media.message_id).toBeTruthy()

			const batch = await client.sendMediaBatch({
				chat_id,
				items: [
					{
						kind: 'document',
						file_name: 'slack-a.txt',
						body_base64: tinyDoc('a'),
						content_type: 'text/plain'
					},
					{
						kind: 'document',
						file_name: 'slack-b.txt',
						body_base64: tinyDoc('b'),
						content_type: 'text/plain'
					}
				]
			})
			expect(batch.message_ids.length).toBe(2)
			expect(batch.results.succeeded).toBe(2)
			expect(batch.results.failed).toBe(0)

			await expectWarnNoOp(() => client.read({ chat_id, message_id: msg.message_id }), ['slack', 'read'])
			await expectWarnNoOp(() => client.unsend({ chat_id, message_id: msg.message_id }), ['slack', 'unsend'])
		},
		{ timeout: 60_000 }
	)
})

runIm('live seam messaging (imessage)', () => {
	test(
		'full surface: send edit typing stopTyping react clear media batch unsend read contract',
		async () => {
			const client = MessagingClient.fromAuth({
				provider: 'imessage',
				base_url: imBase!,
				project_id: imProject!,
				project_secret: imSecret!,
				...(env('AI_TOOLS_IMESSAGE_PHONE') ? { phone: env('AI_TOOLS_IMESSAGE_PHONE') } : {})
			})
			const chat_id = imChat!

			const msg = await client.sendText({
				chat_id,
				text: `[ai-tools it] messaging imessage ${Date.now()}`
			})
			expect(msg.message_id).toBeTruthy()

			const edited = await client.editText({
				chat_id,
				message_id: msg.message_id,
				text: `[ai-tools it] messaging imessage edited ${Date.now()}`
			})
			expect(edited.message_id).toBeTruthy()

			await client.sendChatAction({ chat_id, action: 'typing' })
			await client.stopTyping({ chat_id })

			const reaction = await client.setReaction({
				chat_id,
				message_id: msg.message_id,
				emoji: '❤️'
			})
			// Spectrum returns a reaction message id — required to clear.
			if (reaction.message_id) {
				await client.clearReaction({
					chat_id,
					message_id: reaction.message_id
				})
			}

			// Spectrum only marks *inbound* messages as read. Outbound must 400, not soft-fail.
			let outboundReadError: unknown
			try {
				await client.read({ chat_id, message_id: msg.message_id })
			} catch (error) {
				outboundReadError = error
			}
			expect(isToolError(outboundReadError)).toBe(true)
			if (!isToolError(outboundReadError)) {
				throw new Error('expected ToolError for outbound iMessage read')
			}
			expect(outboundReadError.details?.['status']).toBe(400)

			if (!imInboundMessageId) {
				throw new Error(
					'AI_TOOLS_IMESSAGE_INBOUND_MESSAGE_ID is required for successful messaging seam read (user-sent message id in the same chat)'
				)
			}
			await client.read({ chat_id, message_id: imInboundMessageId })

			const media = await client.sendMedia({
				chat_id,
				kind: 'document',
				file_name: 'msg-im.txt',
				body_base64: Buffer.from('imessage seam media').toString('base64'),
				content_type: 'text/plain'
			})
			expect(media.message_id).toBeTruthy()

			const batch = await client.sendMediaBatch({
				chat_id,
				items: [
					{
						kind: 'document',
						file_name: 'im-a.txt',
						body_base64: tinyDoc('a'),
						content_type: 'text/plain'
					},
					{
						kind: 'document',
						file_name: 'im-b.txt',
						body_base64: tinyDoc('b'),
						content_type: 'text/plain'
					}
				]
			})
			expect(batch.results.succeeded).toBe(2)
			expect(batch.results.failed).toBe(0)
			expect(batch.message_ids.length).toBe(2)

			// Unsend batch items then single media (when ids present).
			for (const message_id of batch.message_ids) {
				await client.unsend({ chat_id, message_id })
			}
			if (media.message_id) {
				await client.unsend({ chat_id, message_id: media.message_id })
			}

			// Pure no-op on iMessage (no interactive callbacks).
			await client.answerCallback({ callback_query_id: 'n/a' })
		},
		{ timeout: 120_000 }
	)
})

runTeams('live seam messaging (teams)', () => {
	test(
		'full surface: send edit action stopTyping react media batch read/unsend gaps',
		async () => {
			const client = MessagingClient.fromAuth({
				provider: 'teams',
				app_id: teamsApp!,
				app_password: teamsPass!
			})
			const chat_id = teamsChat!
			const service_url = teamsService!

			const msg = await client.sendText({
				chat_id,
				service_url,
				text: `[ai-tools it] messaging teams ${Date.now()}`
			})
			expect(msg.message_id).toBeTruthy()

			const edited = await client.editText({
				chat_id,
				service_url,
				message_id: msg.message_id,
				text: `[ai-tools it] messaging teams edited ${Date.now()}`
			})
			expect(edited.message_id).toBeTruthy()

			await client.sendChatAction({ chat_id, service_url, action: 'typing' })
			await client.stopTyping({ chat_id, service_url })

			const reaction = await client.setReaction({
				chat_id,
				message_id: msg.message_id,
				emoji: '👍'
			})
			expect(reaction.message_id).toBeUndefined()
			await client.clearReaction({
				chat_id,
				message_id: msg.message_id
			})

			const media = await client.sendMedia({
				chat_id,
				service_url,
				kind: 'document',
				file_name: 'msg-teams.txt',
				body_base64: Buffer.from('teams seam media').toString('base64'),
				content_type: 'text/plain'
			})
			expect(media.message_id).toBeTruthy()

			const batch = await client.sendMediaBatch({
				chat_id,
				service_url,
				items: [
					{
						kind: 'document',
						file_name: 'teams-a.txt',
						body_base64: tinyDoc('a'),
						content_type: 'text/plain'
					},
					{
						kind: 'document',
						file_name: 'teams-b.txt',
						body_base64: tinyDoc('b'),
						content_type: 'text/plain'
					}
				]
			})
			expect(batch.message_ids.length).toBe(2)
			expect(batch.results.succeeded).toBe(2)
			expect(batch.results.failed).toBe(0)

			await expectWarnNoOp(() => client.read({ chat_id, message_id: msg.message_id, service_url }), ['teams', 'read'])
			await expectWarnNoOp(
				() => client.unsend({ chat_id, message_id: msg.message_id, service_url }),
				['teams', 'unsend']
			)
		},
		{ timeout: 60_000 }
	)
})
