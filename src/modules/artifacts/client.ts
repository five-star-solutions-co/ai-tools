import { ToolError } from '../../core/errors'
import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import type {
	ArtifactResolveInput,
	ArtifactsAuth,
	ArtifactsClientOps,
	ArtifactsCreateInput,
	ArtifactsReadLinesInput,
	ArtifactsReadRangeInput,
	ResolvedArtifact
} from './contracts'
import { artifactResolveInputSchema, artifactsAuthSchema, resolvedArtifactSchema } from './contracts'
import { HostArtifactsProvider } from './providers/host'
import { ObjectArtifactsProvider } from './providers/object'

function transportOptions(ctx: ToolContext) {
	return {
		...(ctx.fetch && { fetch: ctx.fetch }),
		...(ctx.signal && { signal: ctx.signal })
	}
}

function providerFor(auth: ArtifactsAuth, ctx: ToolContext): ArtifactsClientOps {
	switch (auth.provider) {
		case 'object':
			return new ObjectArtifactsProvider(auth, transportOptions(ctx))
		case 'host':
			return new HostArtifactsProvider(auth)
	}
}

export class ArtifactsClient implements ArtifactsClientOps {
	readonly #ops: ArtifactsClientOps

	constructor(ops: ArtifactsClientOps) {
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

	async resolve(input: ArtifactResolveInput): Promise<ResolvedArtifact> {
		const parsedInput = artifactResolveInputSchema.parse(input)
		const output = resolvedArtifactSchema.parse(await this.#ops.resolve(parsedInput))
		if (output.bytes.byteLength > parsedInput.max_bytes) {
			throw new ToolError('Artifact exceeds resolution limit', {
				code: 'too_large',
				details: { max_bytes: parsedInput.max_bytes, content_length: output.bytes.byteLength }
			})
		}
		return {
			artifact: {
				...output.artifact,
				byte_length: output.bytes.byteLength
			},
			bytes: output.bytes
		}
	}
}
