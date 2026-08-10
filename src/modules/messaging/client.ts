/**
 * Messaging seam client — picks telegram / slack / teams / imessage (proxy) from host auth.
 * Resolves ArtifactRef media via optional nested S3 storage before channel calls.
 */

import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import { S3Client } from '../../vendors/s3'
import type {
	MessagingAnswerCallbackInput,
	MessagingAuth,
	MessagingClearReactionInput,
	MessagingDownloadFileInput,
	MessagingDownloadFileOutput,
	MessagingEditTextInput,
	MessagingMessageOutput,
	MessagingOps,
	MessagingReactionOutput,
	MessagingReadInput,
	MessagingSendChatActionInput,
	MessagingSendMediaBatchInput,
	MessagingSendMediaBatchOutput,
	MessagingSendMediaInput,
	MessagingSendTextInput,
	MessagingSetReactionInput,
	MessagingStopTypingInput
} from './contracts'
import { messagingAuthSchema } from './contracts'
import {
	finalizeDownloadOutput,
	mediaMaxBytesForProvider,
	resolveAndSendMediaBatch,
	resolveSendMediaInput
} from './domain'
import { ImessageMessagingProvider } from './providers/imessage'
import { SlackMessagingProvider } from './providers/slack'
import { TeamsMessagingProvider } from './providers/teams'
import { TelegramMessagingProvider } from './providers/telegram'

function transportOptions(ctx: ToolContext) {
	return {
		...(ctx.fetch && { fetch: ctx.fetch }),
		...(ctx.signal && { signal: ctx.signal })
	}
}

function providerFor(auth: MessagingAuth, ctx: ToolContext): MessagingOps {
	const options = transportOptions(ctx)
	switch (auth.provider) {
		case 'telegram':
			return new TelegramMessagingProvider(auth, options)
		case 'slack':
			return new SlackMessagingProvider(auth, options)
		case 'teams':
			return new TeamsMessagingProvider(auth, options)
		case 'imessage':
			return new ImessageMessagingProvider(auth, options)
	}
}

function storageFor(auth: MessagingAuth, ctx: ToolContext): S3Client | undefined {
	if (!auth.storage) return undefined
	return new S3Client(auth.storage, transportOptions(ctx))
}

export class MessagingClient {
	readonly #ops: MessagingOps
	readonly #storage: S3Client | undefined
	readonly #maxMediaBytes: number

	constructor(ops: MessagingOps, storage: S3Client | undefined, maxMediaBytes: number) {
		this.#ops = ops
		this.#storage = storage
		this.#maxMediaBytes = maxMediaBytes
	}

	static fromContext(ctx: ToolContext): MessagingClient {
		const auth = requireAuth(ctx, messagingAuthSchema)
		return new MessagingClient(providerFor(auth, ctx), storageFor(auth, ctx), mediaMaxBytesForProvider(auth.provider))
	}

	static fromAuth(auth: MessagingAuth, ctx: ToolContext = {}): MessagingClient {
		return new MessagingClient(providerFor(auth, ctx), storageFor(auth, ctx), mediaMaxBytesForProvider(auth.provider))
	}

	sendText(input: MessagingSendTextInput): Promise<MessagingMessageOutput> {
		return this.#ops.sendText(input)
	}

	editText(input: MessagingEditTextInput): Promise<MessagingMessageOutput> {
		return this.#ops.editText(input)
	}

	sendChatAction(input: MessagingSendChatActionInput): Promise<void> {
		return this.#ops.sendChatAction(input)
	}

	stopTyping(input: MessagingStopTypingInput): Promise<void> {
		return this.#ops.stopTyping(input)
	}

	setReaction(input: MessagingSetReactionInput): Promise<MessagingReactionOutput> {
		return this.#ops.setReaction(input)
	}

	clearReaction(input: MessagingClearReactionInput): Promise<void> {
		return this.#ops.clearReaction(input)
	}

	async sendMedia(input: MessagingSendMediaInput): Promise<MessagingMessageOutput> {
		const resolved = await resolveSendMediaInput(input, this.#storage, this.#maxMediaBytes)
		return this.#ops.sendMedia(resolved)
	}

	async sendMediaBatch(input: MessagingSendMediaBatchInput): Promise<MessagingSendMediaBatchOutput> {
		return resolveAndSendMediaBatch(input, this.#storage, this.#maxMediaBytes, (resolved) =>
			this.#ops.sendMediaBatch(resolved)
		)
	}

	async downloadFile(input: MessagingDownloadFileInput): Promise<MessagingDownloadFileOutput> {
		const got = await this.#ops.downloadFile(input)
		return finalizeDownloadOutput(got, input.destination_key, this.#storage)
	}

	answerCallback(input: MessagingAnswerCallbackInput): Promise<void> {
		return this.#ops.answerCallback(input)
	}

	read(input: MessagingReadInput): Promise<void> {
		return this.#ops.read(input)
	}
}
