/**
 * Gotenberg provider for the file-convert seam. Wraps `GotenbergClient` LibreOffice convert.
 */

import type { HttpServiceOptions } from '../../../transport/http-service'
import { GotenbergClient } from '../../../vendors/gotenberg'
import type { ConvertBatchInput, ConvertInput, FileConvertOps, GotenbergFileConvertAuth } from '../contracts'

export type GotenbergFileConvertProviderOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'>

export class GotenbergFileConvertProvider implements FileConvertOps {
	readonly #client: GotenbergClient

	constructor(auth: GotenbergFileConvertAuth, options: GotenbergFileConvertProviderOptions = {}) {
		const { provider: _p, ...vendorAuth } = auth
		this.#client = new GotenbergClient(vendorAuth, options)
	}

	convert(input: ConvertInput) {
		return this.#client.convert(input)
	}

	convertBatch(input: ConvertBatchInput) {
		return this.#client.convertBatch(input)
	}
}
