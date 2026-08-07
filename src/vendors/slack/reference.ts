/**
 * Pure Slack mrkdwn / reference helpers (no HTTP).
 * Host uses these when resolving mentions, channel refs, and permalinks for tools.
 */

/** User mention: `<@U123>` or `<@U123|label>` → user id. */
const USER_MENTION = /<@([UW][A-Z0-9]+)(?:\|[^>]*)?>/g

/** Channel reference: `<#C123>` or `<#C123|name>` → channel id. */
const CHANNEL_REF = /<#([CGD][A-Z0-9]+)(?:\|[^>]*)?>/g

/** Special commands / mailto / bare links in angle brackets. */
const SPECIAL_CMD = /<!([^>|]+)(?:\|[^>]*)?>/g

/**
 * Extract Slack user ids mentioned in message text (`<@U…>`).
 */
export function extractSlackUserMentions(text: string): string[] {
	const ids: string[] = []
	const seen = new Set<string>()
	USER_MENTION.lastIndex = 0
	let match: RegExpExecArray | null
	while ((match = USER_MENTION.exec(text)) !== null) {
		const id = match[1]
		if (id && !seen.has(id)) {
			seen.add(id)
			ids.push(id)
		}
	}
	return ids
}

/**
 * Extract channel ids from `<#C…>` references in text.
 */
export function extractSlackChannelRefs(text: string): string[] {
	const ids: string[] = []
	const seen = new Set<string>()
	CHANNEL_REF.lastIndex = 0
	let match: RegExpExecArray | null
	while ((match = CHANNEL_REF.exec(text)) !== null) {
		const id = match[1]
		if (id && !seen.has(id)) {
			seen.add(id)
			ids.push(id)
		}
	}
	return ids
}

/**
 * Format a user mention for outgoing mrkdwn.
 */
export function formatSlackUserMention(userId: string, label?: string): string {
	return label && label.length > 0 ? `<@${userId}|${label}>` : `<@${userId}>`
}

/**
 * Format a channel reference for outgoing mrkdwn.
 */
export function formatSlackChannelRef(channelId: string, name?: string): string {
	return name && name.length > 0 ? `<#${channelId}|${name}>` : `<#${channelId}>`
}

/**
 * Build an app message permalink.
 * @see https://api.slack.com/methods/chat.getPermalink (host may also call the API)
 */
export function formatSlackMessagePermalink(input: {
	team_domain: string
	chat_id: string
	message_id: string
}): string {
	const domain = input.team_domain.replace(/^https?:\/\//, '').replace(/\.slack\.com\/?$/, '')
	const ts = input.message_id.replace('.', '')
	return `https://${domain}.slack.com/archives/${input.chat_id}/p${ts}`
}

/**
 * Strip a leading bot user mention from inbound text (common in channels with @bot).
 * Only removes a mention of `botUserId` at the start (optional surrounding whitespace).
 */
export function stripLeadingSlackBotMention(text: string, botUserId: string): string {
	if (!botUserId) return text
	const escaped = botUserId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
	const re = new RegExp(`^\\s*<@${escaped}(?:\\|[^>]*)?>\\s*`)
	return text.replace(re, '')
}

/**
 * Lightweight mrkdwn → plain-ish text for logging / model context (not full Slack rendering).
 * Removes mention markup, channel refs, and special commands; keeps link labels when present.
 */
export function slackMrkdwnToPlainText(text: string): string {
	let out = text
	out = out.replace(USER_MENTION, (_m, id: string) => `@${id}`)
	out = out.replace(CHANNEL_REF, (_m, id: string) => `#${id}`)
	out = out.replace(SPECIAL_CMD, (_m, cmd: string) => `@${cmd}`)
	// <url|label> or <url>
	out = out.replace(/<([^|>]+)\|([^>]+)>/g, '$2')
	out = out.replace(/<([^>]+)>/g, '$1')
	return out
}
