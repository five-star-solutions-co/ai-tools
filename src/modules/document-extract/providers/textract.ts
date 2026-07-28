/**
 * Textract provider for the document-extract seam.
 * Thin wrap of `TextractClient` — presentation is owned by the vendor.
 */

import type { HttpServiceOptions } from '../../../transport/http-service'
import { TextractClient } from '../../../vendors/textract'
import type {
	DocumentExtractOps,
	ExtractResult,
	ExtractTextBatchInput,
	ExtractTextBatchOutput,
	ExtractTextInput,
	StatusInput,
	TextractDocumentExtractAuth
} from '../contracts'

export type TextractDocumentExtractProviderOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'>

export class TextractDocumentExtractProvider implements DocumentExtractOps {
	readonly #client: TextractClient

	constructor(auth: TextractDocumentExtractAuth, options: TextractDocumentExtractProviderOptions = {}) {
		const { provider: _provider, ...vendorAuth } = auth
		this.#client = new TextractClient(vendorAuth, options)
	}

	extractText(input: ExtractTextInput): Promise<ExtractResult> {
		return this.#client.extractText(input)
	}

	getStatus(input: StatusInput): Promise<ExtractResult> {
		return this.#client.getStatus(input)
	}

	extractTextBatch(input: ExtractTextBatchInput): Promise<ExtractTextBatchOutput> {
		return this.#client.extractTextBatch(input)
	}
}
