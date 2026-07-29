import { ToolError } from '../../../core/errors'
import type {
	ArtifactResolveInput,
	ArtifactsClientOps,
	ArtifactsCreateInput,
	ArtifactsCreateOutput,
	ArtifactsReadLinesInput,
	ArtifactsReadLinesOutput,
	ArtifactsReadRangeInput,
	ArtifactsReadRangeOutput,
	HostArtifactsAuth,
	ResolvedArtifact
} from '../contracts'
import {
	artifactsCreateOutputSchema,
	artifactsReadLinesOutputSchema,
	artifactsReadRangeOutputSchema,
	resolvedArtifactSchema
} from '../contracts'

function requireHostStore(store: 'object' | 'host'): void {
	if (store !== 'host') {
		throw new ToolError('The host artifact provider only resolves host-mapped references', {
			code: 'unsupported'
		})
	}
}

export class HostArtifactsProvider implements ArtifactsClientOps {
	readonly #backend: HostArtifactsAuth['backend']

	constructor(auth: HostArtifactsAuth) {
		this.#backend = auth.backend
	}

	async create(input: ArtifactsCreateInput): Promise<ArtifactsCreateOutput> {
		const output = artifactsCreateOutputSchema.parse(await this.#backend.create(input))
		requireHostStore(output.artifact.store)
		return output
	}

	async readRange(input: ArtifactsReadRangeInput): Promise<ArtifactsReadRangeOutput> {
		requireHostStore(input.source.store)
		return artifactsReadRangeOutputSchema.parse(await this.#backend.readRange(input))
	}

	async readLines(input: ArtifactsReadLinesInput): Promise<ArtifactsReadLinesOutput> {
		requireHostStore(input.source.store)
		return artifactsReadLinesOutputSchema.parse(await this.#backend.readLines(input))
	}

	async resolve(input: ArtifactResolveInput): Promise<ResolvedArtifact> {
		requireHostStore(input.source.store)
		if (input.source.byte_length !== undefined && input.source.byte_length > input.max_bytes) {
			throw new ToolError('Artifact exceeds resolution limit', {
				code: 'too_large',
				details: { max_bytes: input.max_bytes, content_length: input.source.byte_length }
			})
		}
		if (!this.#backend.resolve) {
			throw new ToolError('The host artifact backend does not support byte resolution', {
				code: 'unsupported'
			})
		}

		const output = resolvedArtifactSchema.parse(await this.#backend.resolve(input))
		requireHostStore(output.artifact.store)
		if (output.artifact.key !== input.source.key) {
			throw new ToolError('The host artifact backend resolved a different artifact', {
				code: 'internal'
			})
		}
		if (output.bytes.byteLength > input.max_bytes) {
			throw new ToolError('Artifact exceeds resolution limit', {
				code: 'too_large',
				details: { max_bytes: input.max_bytes, content_length: output.bytes.byteLength }
			})
		}
		return {
			artifact: {
				...input.source,
				...output.artifact,
				byte_length: output.bytes.byteLength
			},
			bytes: output.bytes
		}
	}
}
