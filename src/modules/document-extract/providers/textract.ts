/**
 * Textract provider for the document-extract seam.
 * Wraps `TextractClient` — no AWS HTTP of its own.
 */

import type { HttpServiceOptions } from '../../../transport/http-service'
import { TextractClient } from '../../../vendors/textract'
import type {
	DocumentExtractProviderOps,
	ExtractResult,
	ExtractTextBatchOutput,
	TextractDocumentExtractAuth
} from '../contracts'
import type { ArtifactRef } from '../../../shared/artifact'

export type TextractDocumentExtractProviderOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'>

export class TextractDocumentExtractProvider implements DocumentExtractProviderOps {
	readonly #client: TextractClient

	constructor(auth: TextractDocumentExtractAuth, options: TextractDocumentExtractProviderOptions = {}) {
		const { provider: _provider, ...vendorAuth } = auth
		this.#client = new TextractClient(vendorAuth, options)
	}

	extractText(input: { source: ArtifactRef }): Promise<ExtractResult> {
		return this.#client.extractText(input)
	}

	getStatus(input: { job_id: string }): Promise<ExtractResult> {
		return this.#client.getStatus(input)
	}

	extractTextBatch(input: { sources: ArtifactRef[] }): Promise<ExtractTextBatchOutput> {
		return this.#client.extractTextBatch(input)
	}
}
