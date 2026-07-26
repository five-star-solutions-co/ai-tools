/**
 * Messaging kit for channel vendor packs (telegram, …).
 * Not published — directory `_messaging` is skipped by surface codegen.
 *
 * Shared method names + pure presentation helpers (live message, typing pulse).
 * Full channel packs own native-only APIs; this is not a multi-provider seam module.
 */

export type ChannelChatAction =
	| 'typing'
	| 'upload_photo'
	| 'record_video'
	| 'upload_video'
	| 'record_voice'
	| 'upload_voice'
	| 'upload_document'
	| 'choose_sticker'
	| 'find_location'
	| 'record_video_note'
	| 'upload_video_note'

export type ChannelSendTextInput = {
	chat_id: string
	text: string
	reply_to_message_id?: string
	/** Channel-native reply markup when supported. */
	reply_markup?: unknown
}

export type ChannelEditTextInput = {
	chat_id: string
	message_id: string
	text: string
	reply_markup?: unknown
}

export type ChannelSendChatActionInput = {
	chat_id: string
	action: ChannelChatAction
	/** Thread / reply anchor (Slack: thread_ts for assistant.threads.setStatus). */
	reply_to_message_id?: string
}

export type ChannelSetReactionInput = {
	chat_id: string
	message_id: string
	/** Any emoji the channel API accepts. */
	emoji: string
}

export type ChannelClearReactionInput = {
	chat_id: string
	message_id: string
}

export type ChannelSendMediaInput = {
	chat_id: string
	kind: 'photo' | 'document'
	/** File body as base64. */
	body_base64: string
	file_name: string
	caption?: string
	reply_to_message_id?: string
	content_type?: string
}

export type ChannelDownloadFileInput = {
	file_id: string
	file_name?: string
}

export type ChannelAnswerCallbackInput = {
	callback_query_id: string
	text?: string
	show_alert?: boolean
}

export type ChannelMessageRef = {
	message_id: string
}

export type ChannelDownloadFileResult = {
	file_name: string
	file_size?: number
	bytes: Uint8Array
}

/**
 * Shared transport subset every channel client implements with identical method names.
 * Channel-specific ops stay on the pack client only.
 */
export type ChannelTransport = {
	sendText: (input: ChannelSendTextInput) => Promise<ChannelMessageRef>
	editText: (input: ChannelEditTextInput) => Promise<ChannelMessageRef>
	sendChatAction: (input: ChannelSendChatActionInput) => Promise<void>
	setReaction: (input: ChannelSetReactionInput) => Promise<void>
	clearReaction: (input: ChannelClearReactionInput) => Promise<void>
	sendMedia: (input: ChannelSendMediaInput) => Promise<ChannelMessageRef>
	downloadFile: (input: ChannelDownloadFileInput) => Promise<ChannelDownloadFileResult>
	answerCallback: (input: ChannelAnswerCallbackInput) => Promise<void>
}

const DEFAULT_LIVE_INTERVAL_MS = 1000
const DEFAULT_TYPING_INTERVAL_MS = 4000

export type LiveMessageDeps = {
	sendText: (text: string) => Promise<ChannelMessageRef>
	editText: (messageId: string, text: string) => Promise<ChannelMessageRef>
	/** True when the provider definitively rejected the request (safe to fallback send). */
	isDefiniteRejection: (error: unknown) => boolean
	/** True when outcome is unknown (do not blindly resend). */
	isOutcomeUnknown: (error: unknown) => boolean
	intervalMs?: number
	now?: () => number
	sleep?: (ms: number) => Promise<void>
}

export type LiveMessage = {
	/** First visible message (send). No-op if already started. */
	start: (text: string) => Promise<void>
	/** Cadenced edit of the live message. No-op before start or after finalize. */
	update: (text: string) => Promise<void>
	/** Authoritative final text (edit or send). */
	finalize: (text: string) => Promise<{ message_id: string; edit_count: number }>
}

/** Progressive outbound text via send + edit cadence. Shared across channels. */
export function createLiveMessage(deps: LiveMessageDeps): LiveMessage {
	const intervalMs = deps.intervalMs ?? DEFAULT_LIVE_INTERVAL_MS
	const now = deps.now ?? Date.now
	const sleep = deps.sleep ?? sleepMs

	let editCount = 0
	let finalizing = false
	let initialSendOutcomeUnknown: unknown
	let lastAttemptedText = ''
	let lastAttemptError: unknown
	let lastSuccessfulText = ''
	let lastUpdateAt = 0
	let latestText = ''
	let messageId: string | null = null
	let pump: Promise<void> | null = null

	const waitForCadence = async () => {
		const waitMs = Math.max(0, lastUpdateAt + intervalMs - now())
		if (waitMs > 0) await sleep(waitMs)
	}

	const runPump = async () => {
		while (!finalizing && messageId !== null && latestText !== '' && latestText !== lastAttemptedText) {
			await waitForCadence()
			if (finalizing || messageId === null) return

			const nextText = latestText
			lastAttemptedText = nextText
			try {
				await deps.editText(messageId, nextText)
				lastAttemptError = undefined
				lastSuccessfulText = nextText
				editCount += 1
			} catch (error) {
				// Intermediate edits are presentation only; finalize remains authoritative.
				lastAttemptError = error
			} finally {
				lastUpdateAt = now()
			}
		}
	}

	const ensurePump = () => {
		if (pump !== null) return
		pump = runPump().finally(() => {
			pump = null
			if (!finalizing && messageId !== null && latestText !== '' && latestText !== lastAttemptedText) {
				ensurePump()
			}
		})
	}

	return {
		start: async (text: string) => {
			if (initialSendOutcomeUnknown) throw initialSendOutcomeUnknown
			if (finalizing || messageId !== null) return

			try {
				const sent = await deps.sendText(text)
				messageId = sent.message_id
				lastAttemptedText = text
				lastSuccessfulText = text
				lastUpdateAt = now()
			} catch (error) {
				if (deps.isOutcomeUnknown(error)) {
					initialSendOutcomeUnknown = error
					throw error
				}
				// Progress is presentation only; finalize may still send permanently.
			}
		},
		update: async (text: string) => {
			if (finalizing || messageId === null || text === '') return
			latestText = text
			if (latestText !== lastAttemptedText) ensurePump()
		},
		finalize: async (text: string) => {
			finalizing = true
			latestText = text
			if (pump !== null) await pump
			if (initialSendOutcomeUnknown) throw initialSendOutcomeUnknown

			if (messageId === null) {
				const sent = await deps.sendText(text)
				return { message_id: sent.message_id, edit_count: editCount }
			}
			if (lastSuccessfulText === text) return { message_id: messageId, edit_count: editCount }
			if (lastAttemptedText === text && lastAttemptError && deps.isOutcomeUnknown(lastAttemptError)) {
				throw lastAttemptError
			}

			await waitForCadence()
			try {
				await deps.editText(messageId, text)
				editCount += 1
				return { message_id: messageId, edit_count: editCount }
			} catch (error) {
				if (deps.isDefiniteRejection(error)) {
					const sent = await deps.sendText(text)
					return { message_id: sent.message_id, edit_count: editCount }
				}
				throw error
			}
		}
	}
}

export type TypingPulseDeps = {
	send: () => Promise<void>
	intervalMs?: number
	sleep?: (ms: number) => Promise<void>
}

export type TypingPulse = {
	start: () => Promise<void>
	stop: () => void
}

/**
 * Renew chat-action (typing) while a turn is active.
 * Immediate pulse on start, then once per interval until stop.
 * stop() bumps generation so in-flight work cannot restart a dead schedule.
 */
export function createTypingPulse(deps: TypingPulseDeps): TypingPulse {
	const intervalMs = deps.intervalMs ?? DEFAULT_TYPING_INTERVAL_MS
	const sleep = deps.sleep ?? sleepMs
	let active = false
	let generation = 0
	let wake: (() => void) | undefined

	const pulse = async () => {
		try {
			await deps.send()
		} catch {
			// Typing is presentation only.
		}
	}

	const waitInterval = () =>
		new Promise<void>((resolve) => {
			let settled = false
			const done = () => {
				if (settled) return
				settled = true
				if (wake === done) wake = undefined
				resolve()
			}
			wake = done
			void sleep(intervalMs).then(done)
		})

	const renew = async (mine: number) => {
		while (active && mine === generation) {
			await waitInterval()
			if (!active || mine !== generation) return
			await pulse()
		}
	}

	return {
		start: async () => {
			if (active) return
			active = true
			const mine = generation
			await pulse()
			if (!active || mine !== generation) return
			// Always schedule renew for this generation (do not gate on a shared loop handle).
			void renew(mine)
		},
		stop: () => {
			active = false
			generation += 1
			wake?.()
		}
	}
}

function sleepMs(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}
