/**
 * Document-extract seam client — picks a provider class from host auth.
 * Presentation (inline | artifact | chunks) lives in the vendor client.
 */

import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import type { HttpServiceOptions } from '../../transport/http-service'
import { documentExtractAuthSchema } from './contracts'
import type {
	DocumentExtractAuth,
	DocumentExtractOps,
	ExtractTextBatchInput,
	ExtractTextInput,
	StatusInput
} from './contracts'
import { TextractDocumentExtractProvider } from './providers/textract'

function transportOptions(ctx: ToolContext): Pick<HttpServiceOptions, 'fetch' | 'signal'> {
	return {
		...(ctx.fetch && { fetch: ctx.fetch }),
		...(ctx.signal && { signal: ctx.signal })
	}
}

function providerFor(auth: DocumentExtractAuth, ctx: ToolContext): DocumentExtractOps {
	const options = transportOptions(ctx)
	switch (auth.provider) {
		case 'textract':
			return new TextractDocumentExtractProvider(auth, options)
	}
}

export class DocumentExtractClient implements DocumentExtractOps {
	readonly #ops: DocumentExtractOps

	constructor(ops: DocumentExtractOps) {
		this.#ops = ops
	}

	static fromContext(ctx: ToolContext): DocumentExtractClient {
		const auth = requireAuth(ctx, documentExtractAuthSchema)
		return new DocumentExtractClient(providerFor(auth, ctx))
	}

	static fromAuth(auth: DocumentExtractAuth, ctx: ToolContext = {}): DocumentExtractClient {
		return new DocumentExtractClient(providerFor(auth, ctx))
	}

	extractText(input: ExtractTextInput) {
		return this.#ops.extractText(input)
	}

	getStatus(input: StatusInput) {
		return this.#ops.getStatus(input)
	}

	extractTextBatch(input: ExtractTextBatchInput) {
		return this.#ops.extractTextBatch(input)
	}
}
