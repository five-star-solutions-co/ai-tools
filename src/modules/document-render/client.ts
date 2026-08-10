/**
 * Document-render seam client — picks cloudflare-browser from host auth.
 */

import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import { documentRenderAuthSchema } from './contracts'
import type { DocumentRenderAuth, DocumentRenderOps, RenderPdfInput, RenderScreenshotInput } from './contracts'
import { CloudflareBrowserDocumentRenderProvider } from './providers/cloudflare-browser'

function transportOptions(ctx: ToolContext) {
	return {
		...(ctx.fetch && { fetch: ctx.fetch }),
		...(ctx.signal && { signal: ctx.signal })
	}
}

function providerFor(auth: DocumentRenderAuth, ctx: ToolContext): DocumentRenderOps {
	const options = transportOptions(ctx)
	switch (auth.provider) {
		case 'cloudflare-browser':
			return new CloudflareBrowserDocumentRenderProvider(auth, options)
	}
}

export class DocumentRenderClient implements DocumentRenderOps {
	readonly #ops: DocumentRenderOps

	constructor(ops: DocumentRenderOps) {
		this.#ops = ops
	}

	static fromContext(ctx: ToolContext): DocumentRenderClient {
		const auth = requireAuth(ctx, documentRenderAuthSchema)
		return new DocumentRenderClient(providerFor(auth, ctx))
	}

	static fromAuth(auth: DocumentRenderAuth, ctx: ToolContext = {}): DocumentRenderClient {
		return new DocumentRenderClient(providerFor(auth, ctx))
	}

	renderPdf(input: RenderPdfInput) {
		return this.#ops.renderPdf(input)
	}

	renderScreenshot(input: RenderScreenshotInput) {
		return this.#ops.renderScreenshot(input)
	}
}
