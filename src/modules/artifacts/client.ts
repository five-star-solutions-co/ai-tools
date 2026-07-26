import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import type {
	ArtifactsAuth,
	ArtifactsCreateInput,
	ArtifactsOps,
	ArtifactsReadLinesInput,
	ArtifactsReadRangeInput
} from './contracts'
import { artifactsAuthSchema } from './contracts'
import { HostArtifactsProvider } from './providers/host'
import { ObjectArtifactsProvider } from './providers/object'

function transportOptions(ctx: ToolContext) {
	return {
		...(ctx.fetch && { fetch: ctx.fetch }),
		...(ctx.signal && { signal: ctx.signal })
	}
}

function providerFor(auth: ArtifactsAuth, ctx: ToolContext): ArtifactsOps {
	switch (auth.provider) {
		case 'object':
			return new ObjectArtifactsProvider(auth, transportOptions(ctx))
		case 'host':
			return new HostArtifactsProvider(auth)
	}
}

export class ArtifactsClient implements ArtifactsOps {
	readonly #ops: ArtifactsOps

	constructor(ops: ArtifactsOps) {
		this.#ops = ops
	}

	static fromContext(ctx: ToolContext): ArtifactsClient {
		const auth = requireAuth(ctx, artifactsAuthSchema)
		return new ArtifactsClient(providerFor(auth, ctx))
	}

	static fromAuth(auth: ArtifactsAuth, ctx: ToolContext = {}): ArtifactsClient {
		return new ArtifactsClient(providerFor(auth, ctx))
	}

	create(input: ArtifactsCreateInput) {
		return this.#ops.create(input)
	}

	readRange(input: ArtifactsReadRangeInput) {
		return this.#ops.readRange(input)
	}

	readLines(input: ArtifactsReadLinesInput) {
		return this.#ops.readLines(input)
	}
}
