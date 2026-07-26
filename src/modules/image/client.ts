import sharp from 'sharp'
import type { Sharp } from 'sharp'

import { ToolError } from '../../core/errors'
import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import { extensionFromMediaType, mediaTypeFromPath } from '../../shared/content-type'
import { ObjectArtifactStore } from '../../shared/object-artifact-store'
import type { ObjectArtifactStoreOptions } from '../../shared/object-artifact-store'
import type {
	ImageAuth,
	ImageConvertInput,
	ImageCropInput,
	ImageMetadata,
	ImageMetadataInput,
	ImageResizeInput,
	ImageThumbnailInput,
	ImageTransformOutput
} from './contracts'
import { MAX_IMAGE_BYTES, imageAuthSchema, imageMetadataSchema, imageTransformOutputSchema } from './contracts'

export type ImageClientOptions = ObjectArtifactStoreOptions

function mediaTypeFor(extension: string): string {
	return mediaTypeFromPath(`image.${extension}`) ?? 'application/octet-stream'
}

function mapMetadata(metadata: Awaited<ReturnType<Sharp['metadata']>>): ImageMetadata {
	return imageMetadataSchema.parse({
		format: metadata.format,
		media_type: metadata.mediaType,
		width: metadata.width,
		height: metadata.height,
		space: metadata.space,
		channels: metadata.channels,
		density: metadata.density,
		has_alpha: metadata.hasAlpha,
		pages: metadata.pages
	})
}

export class ImageClient {
	readonly #artifacts: ObjectArtifactStore

	constructor(auth: ImageAuth, options: ImageClientOptions = {}) {
		const parsed = imageAuthSchema.safeParse(auth)
		if (!parsed.success) {
			throw new ToolError('Invalid image auth credentials', {
				code: 'bad_auth',
				details: { issues: parsed.error.issues.map((issue) => issue.message) }
			})
		}
		this.#artifacts = new ObjectArtifactStore(parsed.data.storage, options)
	}

	static fromContext(ctx: ToolContext): ImageClient {
		return new ImageClient(requireAuth(ctx, imageAuthSchema), {
			...(ctx.fetch && { fetch: ctx.fetch }),
			...(ctx.signal && { signal: ctx.signal })
		})
	}

	static fromAuth(auth: ImageAuth, options: ImageClientOptions = {}): ImageClient {
		return new ImageClient(auth, options)
	}

	async metadata(input: ImageMetadataInput): Promise<ImageMetadata> {
		try {
			return mapMetadata(await sharp(await this.#read(input.source)).metadata())
		} catch (error) {
			throw new ToolError('Failed to inspect image', { code: 'bad_input', cause: error })
		}
	}

	async resize(input: ImageResizeInput): Promise<ImageTransformOutput> {
		const pipeline = sharp(await this.#read(input.source))
			.autoOrient()
			.resize({
				width: input.width,
				height: input.height,
				fit: input.fit,
				withoutEnlargement: input.without_enlargement
			})
		return this.#write(pipeline, input.output_key, input.filename)
	}

	async crop(input: ImageCropInput): Promise<ImageTransformOutput> {
		const pipeline = sharp(await this.#read(input.source))
			.autoOrient()
			.extract({
				left: input.left,
				top: input.top,
				width: input.width,
				height: input.height
			})
		return this.#write(pipeline, input.output_key, input.filename)
	}

	async thumbnail(input: ImageThumbnailInput): Promise<ImageTransformOutput> {
		const pipeline = sharp(await this.#read(input.source))
			.autoOrient()
			.resize(input.width, input.height, { fit: 'inside', withoutEnlargement: true })
		return this.#write(pipeline, input.output_key, input.filename)
	}

	async convert(input: ImageConvertInput): Promise<ImageTransformOutput> {
		let pipeline = sharp(await this.#read(input.source)).autoOrient()
		switch (input.format) {
			case 'jpeg':
				pipeline = pipeline.jpeg({ quality: input.quality })
				break
			case 'png':
				pipeline = pipeline.png({ quality: input.quality })
				break
			case 'webp':
				pipeline = pipeline.webp({ quality: input.quality })
				break
			case 'avif':
				pipeline = pipeline.avif({ quality: input.quality })
				break
			case 'tiff':
				pipeline = pipeline.tiff({ quality: input.quality })
				break
			case 'gif':
				pipeline = pipeline.gif({ effort: input.quality ? Math.max(1, Math.round(input.quality / 10)) : undefined })
		}
		return this.#write(pipeline, input.output_key, input.filename, input.format)
	}

	async #read(source: ImageMetadataInput['source']): Promise<Uint8Array> {
		return this.#artifacts.read(source, MAX_IMAGE_BYTES)
	}

	async #write(
		pipeline: Sharp,
		key: string,
		filename?: string,
		requestedExtension?: string
	): Promise<ImageTransformOutput> {
		try {
			const { data, info } = await pipeline.toBuffer({ resolveWithObject: true })
			const extension = requestedExtension ?? info.format
			const mediaType = mediaTypeFor(extension)
			const displayName = filename ?? `image.${extensionFromMediaType(mediaType) ?? extension}`
			const result = await this.#artifacts.write(key, data, mediaType, displayName)
			const image = mapMetadata(await sharp(data).metadata())
			return imageTransformOutputSchema.parse({ result, image })
		} catch (error) {
			throw new ToolError('Failed to transform image', { code: 'bad_input', cause: error })
		}
	}
}
