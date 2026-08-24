import { ToolError } from '../../../core/errors'
import { artifactRefSchema } from '../../../shared/artifact'
import { base64ToBytes, bytesToBase64, bytesToUtf8, utf8ToBytes } from '../../../shared/bytes'
import { mediaTypeFromPath } from '../../../shared/content-type'
import type { HttpServiceOptions } from '../../../transport/http-service'
import { S3Client } from '../../../vendors/s3'
import type {
	ArtifactResolveInput,
	ArtifactsClientOps,
	ArtifactsCreateInput,
	ArtifactsCreateOutput,
	ArtifactsReadLinesInput,
	ArtifactsReadLinesOutput,
	ArtifactsReadRangeInput,
	ArtifactsReadRangeOutput,
	ObjectArtifactsAuth,
	ResolvedArtifact
} from '../contracts'
import { MAX_ARTIFACT_CREATE_BYTES, MAX_ARTIFACT_READ_BYTES } from '../contracts'

export type ObjectArtifactsProviderOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'>

function requireObjectSource(store: 'object' | 'host'): void {
	if (store !== 'object') {
		throw new ToolError('The object artifact provider only resolves object-store references', {
			code: 'unsupported'
		})
	}
}

function artifactBytes(input: ArtifactsCreateInput): Uint8Array {
	const bytes = input.encoding === 'base64' ? base64ToBytes(input.body) : utf8ToBytes(input.body)
	if (bytes.byteLength > MAX_ARTIFACT_CREATE_BYTES) {
		throw new ToolError('Artifact body exceeds create limit', {
			code: 'too_large',
			details: { max_bytes: MAX_ARTIFACT_CREATE_BYTES, content_length: bytes.byteLength }
		})
	}
	return bytes
}

function textLines(text: string): string[] {
	return text.split('\n').map((line) => (line.endsWith('\r') ? line.slice(0, -1) : line))
}

export class ObjectArtifactsProvider implements ArtifactsClientOps {
	readonly #storage: S3Client

	constructor(auth: ObjectArtifactsAuth, options: ObjectArtifactsProviderOptions = {}) {
		this.#storage = new S3Client(auth.storage, options)
	}

	async create(input: ArtifactsCreateInput): Promise<ArtifactsCreateOutput> {
		const bytes = artifactBytes(input)
		const mediaType = input.media_type ?? mediaTypeFromPath(input.filename ?? input.key)
		await this.#storage.putBytes(input.key, bytes, mediaType)
		return {
			artifact: artifactRefSchema.parse({
				store: 'object',
				key: input.key,
				byte_length: bytes.byteLength,
				...(mediaType && { media_type: mediaType }),
				...(input.filename && { filename: input.filename })
			})
		}
	}

	async readRange(input: ArtifactsReadRangeInput): Promise<ArtifactsReadRangeOutput> {
		requireObjectSource(input.source.store)
		const result = await this.#storage.getBytesRange(input.source.key, {
			start_byte: input.start_byte,
			end_byte: input.end_byte
		})
		return {
			source: input.source,
			body_base64: bytesToBase64(result.bytes),
			start_byte: result.start_byte,
			end_byte: result.end_byte,
			...(result.total_bytes !== undefined && { total_bytes: result.total_bytes }),
			...(result.content_type && { media_type: result.content_type })
		}
	}

	async readLines(input: ArtifactsReadLinesInput): Promise<ArtifactsReadLinesOutput> {
		requireObjectSource(input.source.store)
		const bytes = await this.#storage.getBytes(input.source.key, { maxBytes: MAX_ARTIFACT_READ_BYTES })
		const lines = textLines(bytesToUtf8(bytes))
		return {
			source: input.source,
			text: lines.join('\n'),
			start_line: 1,
			end_line: lines.length,
			total_lines: lines.length
		}
	}

	async resolve(input: ArtifactResolveInput): Promise<ResolvedArtifact> {
		requireObjectSource(input.source.store)
		if (input.source.byte_length !== undefined && input.source.byte_length > input.max_bytes) {
			throw new ToolError('Artifact exceeds resolution limit', {
				code: 'too_large',
				details: { max_bytes: input.max_bytes, content_length: input.source.byte_length }
			})
		}

		const head = await this.#storage.head({ key: input.source.key })
		if (!head.exists) {
			throw new ToolError('Artifact not found', { code: 'not_found' })
		}
		if (head.content_length !== undefined && head.content_length > input.max_bytes) {
			throw new ToolError('Artifact exceeds resolution limit', {
				code: 'too_large',
				details: { max_bytes: input.max_bytes, content_length: head.content_length }
			})
		}

		const bytes = await this.#storage.getBytes(input.source.key, { maxBytes: input.max_bytes })
		return {
			artifact: artifactRefSchema.parse({
				...input.source,
				...(!input.source.media_type && head.content_type && { media_type: head.content_type }),
				byte_length: bytes.byteLength
			}),
			bytes
		}
	}
}
