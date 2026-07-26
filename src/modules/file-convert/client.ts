/**
 * File-convert seam client — picks gotenberg (LibreOffice) from host auth.
 */

import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import { fileConvertAuthSchema } from './contracts'
import type { ConvertBatchInput, ConvertInput, FileConvertAuth, FileConvertOps } from './contracts'
import { GotenbergFileConvertProvider } from './providers/gotenberg'

function transportOptions(ctx: ToolContext) {
	return {
		...(ctx.fetch && { fetch: ctx.fetch }),
		...(ctx.signal && { signal: ctx.signal })
	}
}

function providerFor(auth: FileConvertAuth, ctx: ToolContext): FileConvertOps {
	const options = transportOptions(ctx)
	switch (auth.provider) {
		case 'gotenberg':
			return new GotenbergFileConvertProvider(auth, options)
	}
}

export class FileConvertClient implements FileConvertOps {
	readonly #ops: FileConvertOps

	constructor(ops: FileConvertOps) {
		this.#ops = ops
	}

	static fromContext(ctx: ToolContext): FileConvertClient {
		const auth = requireAuth(ctx, fileConvertAuthSchema)
		return new FileConvertClient(providerFor(auth, ctx))
	}

	static fromAuth(auth: FileConvertAuth, ctx: ToolContext = {}): FileConvertClient {
		return new FileConvertClient(providerFor(auth, ctx))
	}

	convert(input: ConvertInput) {
		return this.#ops.convert(input)
	}

	convertBatch(input: ConvertBatchInput) {
		return this.#ops.convertBatch(input)
	}
}
