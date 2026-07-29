/**
 * Cloudflare Email provider for the email seam. Wraps `CloudflareEmailClient`.
 */

import type { HttpServiceOptions } from '../../../transport/http-service'
import { CloudflareEmailClient } from '../../../vendors/cloudflare-email'
import type { CloudflareEmailSeamAuth, EmailProviderOps, EmailProviderSendInput, EmailSendOutput } from '../contracts'

export type CloudflareEmailProviderOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'>

export class CloudflareEmailProvider implements EmailProviderOps {
	readonly #client: CloudflareEmailClient

	constructor(auth: CloudflareEmailSeamAuth, options: CloudflareEmailProviderOptions = {}) {
		const { provider: _provider, sender: _sender, ...vendorAuth } = auth
		this.#client = new CloudflareEmailClient(vendorAuth, options)
	}

	async send(input: EmailProviderSendInput): Promise<EmailSendOutput> {
		const result = await this.#client.send(input)
		return {
			success: result.success,
			...(result.accepted && result.accepted.length > 0 && { accepted: result.accepted }),
			...(result.rejected && result.rejected.length > 0 && { rejected: result.rejected })
		}
	}
}
