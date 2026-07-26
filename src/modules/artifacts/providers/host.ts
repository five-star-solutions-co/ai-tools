import { ToolError } from '../../../core/errors'
import type {
	ArtifactsCreateInput,
	ArtifactsCreateOutput,
	ArtifactsOps,
	ArtifactsReadLinesInput,
	ArtifactsReadLinesOutput,
	ArtifactsReadRangeInput,
	ArtifactsReadRangeOutput,
	HostArtifactsAuth
} from '../contracts'
import {
	artifactsCreateOutputSchema,
	artifactsReadLinesOutputSchema,
	artifactsReadRangeOutputSchema
} from '../contracts'

function requireHostStore(store: 'object' | 'host'): void {
	if (store !== 'host') {
		throw new ToolError('The host artifact provider only resolves host-mapped references', {
			code: 'unsupported'
		})
	}
}

export class HostArtifactsProvider implements ArtifactsOps {
	readonly #backend: ArtifactsOps

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
}
