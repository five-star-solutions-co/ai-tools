/** Presentation client. This capability is Node ESM-only until its PPTX dependencies support CommonJS. */
import { ToolError } from '../../core/errors'
import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import { artifactRefSchema } from '../../shared/artifact'
import type { ArtifactRef } from '../../shared/artifact'
import { S3Client } from '../../vendors/s3'
import { loadDocumentSource, sourceName } from '../document/artifacts'
import type { LoadedDocument } from '../document/artifacts'
import { presentationAuthSchema, presentationBuildOutputSchema, presentationReadOutputSchema } from './contracts'
import type {
	PresentationAuth,
	PresentationBuildInput,
	PresentationEditInput,
	PresentationReadInput,
	PresentationReadOutput
} from './contracts'
import { buildPresentation, patchPptx, readPresentation } from './domain'

export type PresentationClientOptions = {
	fetch?: ToolContext['fetch']
	signal?: ToolContext['signal']
}

const PRESENTATION_MEDIA_TYPE = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'

function transportOptions(context: PresentationClientOptions) {
	return {
		...(context.fetch && { fetch: context.fetch }),
		...(context.signal && { signal: context.signal })
	}
}

export class PresentationClient {
	readonly #storage: S3Client

	constructor(auth: PresentationAuth, context: PresentationClientOptions = {}) {
		const parsed = presentationAuthSchema.safeParse(auth)
		if (!parsed.success) {
			throw new ToolError('Invalid presentation auth credentials', {
				code: 'bad_auth',
				details: { issues: parsed.error.issues.map((issue) => issue.message) }
			})
		}
		this.#storage = new S3Client(parsed.data.storage, transportOptions(context))
	}

	static fromContext(context: ToolContext): PresentationClient {
		return new PresentationClient(requireAuth(context, presentationAuthSchema), context)
	}

	static fromAuth(auth: PresentationAuth, context: PresentationClientOptions = {}): PresentationClient {
		return new PresentationClient(auth, context)
	}

	async read(input: PresentationReadInput): Promise<PresentationReadOutput> {
		const loaded = await this.#load(input.source)
		return presentationReadOutputSchema.parse({
			format: 'pptx',
			...(await readPresentation(loaded.bytes)),
			byte_length: loaded.bytes.byteLength,
			...(loaded.filename && { filename: loaded.filename }),
			...(loaded.media_type && { media_type: loaded.media_type })
		})
	}

	async build(input: PresentationBuildInput) {
		return this.#write(
			input.output_key,
			await buildPresentation({ title: input.title, slides: input.slides }),
			input.filename ?? 'deck.pptx'
		)
	}

	async edit(input: PresentationEditInput) {
		const loaded = await this.#load(input.source)
		return this.#write(
			input.output_key,
			await patchPptx(loaded.bytes, input.replacements),
			input.filename ?? sourceName(loaded, 'deck.pptx')
		)
	}

	async #load(source: PresentationReadInput['source']): Promise<LoadedDocument> {
		return loadDocumentSource(source, (key) => this.#storage.getBytes(key))
	}

	async #write(key: string, bytes: Uint8Array, filename: string) {
		const result = await this.#putArtifact(key, bytes, filename)
		return presentationBuildOutputSchema.parse({ result })
	}

	async #putArtifact(key: string, bytes: Uint8Array, filename: string): Promise<ArtifactRef> {
		await this.#storage.putBytes(key, bytes, PRESENTATION_MEDIA_TYPE)
		return artifactRefSchema.parse({
			store: 'object',
			key,
			media_type: PRESENTATION_MEDIA_TYPE,
			filename,
			byte_length: bytes.byteLength
		})
	}
}
