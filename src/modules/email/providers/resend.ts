/**
 * Resend provider for the email seam. Wraps `ResendClient`.
 */

import type { HttpServiceOptions } from '../../../transport/http-service'
import { ResendClient } from '../../../vendors/resend'
import type { EmailProviderOps, EmailProviderSendInput, EmailSendOutput, ResendEmailAuth } from '../contracts'

export type ResendEmailProviderOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'>

export class ResendEmailProvider implements EmailProviderOps {
	readonly #client: ResendClient

	constructor(auth: ResendEmailAuth, options: ResendEmailProviderOptions = {}) {
		const { provider: _provider, sender: _sender, ...vendorAuth } = auth
		this.#client = new ResendClient(vendorAuth, options)
	}

	async send(input: EmailProviderSendInput): Promise<EmailSendOutput> {
		const result = await this.#client.send(input)
		return {
			success: result.success,
			...(result.id && { id: result.id })
		}
	}
}
