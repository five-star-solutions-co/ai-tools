/**
 * Email seam client — picks resend / cloudflare from host auth.
 */

import { isToolError, ToolError } from '../../core/errors'
import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import { runBatchItems } from '../../shared/batch'
import type { HttpServiceOptions } from '../../transport/http-service'
import { emailAuthSchema } from './contracts'
import type {
	EmailAuth,
	EmailOps,
	EmailProviderOps,
	EmailSendBatchInput,
	EmailSendInput,
	NamedAddress
} from './contracts'
import { CloudflareEmailProvider } from './providers/cloudflare'
import { ResendEmailProvider } from './providers/resend'

export type EmailClientOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'>

function transportOptions(ctx: ToolContext): EmailClientOptions {
	return {
		...(ctx.fetch && { fetch: ctx.fetch }),
		...(ctx.signal && { signal: ctx.signal })
	}
}

function providerFor(auth: EmailAuth, options: EmailClientOptions): EmailProviderOps {
	switch (auth.provider) {
		case 'resend':
			return new ResendEmailProvider(auth, options)
		case 'cloudflare':
			return new CloudflareEmailProvider(auth, options)
	}
}

function emailDeliveryError(error: unknown): ToolError {
	if (isToolError(error)) {
		return new ToolError('Email delivery was rejected', {
			code: error.code,
			retryable: error.retryable,
			cause: error
		})
	}
	return new ToolError('Email delivery was rejected', {
		code: 'upstream',
		cause: error
	})
}

export class EmailClient implements EmailOps {
	readonly #provider: EmailProviderOps
	readonly #sender: NamedAddress

	constructor(auth: EmailAuth, options: EmailClientOptions = {}) {
		this.#provider = providerFor(auth, options)
		this.#sender = auth.sender
	}

	static fromContext(ctx: ToolContext): EmailClient {
		const auth = requireAuth(ctx, emailAuthSchema)
		return new EmailClient(auth, transportOptions(ctx))
	}

	static fromAuth(auth: EmailAuth, ctx: ToolContext = {}): EmailClient {
		return new EmailClient(auth, transportOptions(ctx))
	}

	async send(input: EmailSendInput) {
		try {
			return await this.#provider.send({ ...input, from: this.#sender })
		} catch (error) {
			throw emailDeliveryError(error)
		}
	}

	sendBatch(input: EmailSendBatchInput) {
		return runBatchItems(input.messages, (message) => this.send(message))
	}
}
