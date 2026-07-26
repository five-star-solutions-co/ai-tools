import { ToolError } from '../core/errors'
import type { ArtifactRef } from './artifact'
import { artifactRefSchema } from './artifact'
import { S3Client } from '../vendors/s3'
import type { S3Auth, S3ClientOptions } from '../vendors/s3'

export type ObjectArtifactStoreOptions = S3ClientOptions

export class ObjectArtifactStore {
	readonly #storage: S3Client

	constructor(auth: S3Auth, options: ObjectArtifactStoreOptions = {}) {
		this.#storage = new S3Client(auth, options)
	}

	async read(source: ArtifactRef, maxBytes: number): Promise<Uint8Array> {
		if (source.store !== 'object') {
			throw new ToolError('This operation requires an object-store artifact', { code: 'bad_input' })
		}
		return this.#storage.getBytes(source.key, { maxBytes })
	}

	async write(key: string, bytes: Uint8Array, mediaType: string, filename: string): Promise<ArtifactRef> {
		await this.#storage.putBytes(key, bytes, mediaType)
		return artifactRefSchema.parse({
			store: 'object',
			key,
			media_type: mediaType,
			filename,
			byte_length: bytes.byteLength
		})
	}
}
