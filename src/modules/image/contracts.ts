import { z } from 'zod'

import { artifactRefSchema } from '../../shared/artifact'
import { s3AuthSchema } from '../../vendors/s3'

export const MAX_IMAGE_BYTES = 50 * 1024 * 1024
export const MAX_IMAGE_DIMENSION = 16_384

export const imageAuthSchema = z.object({
	storage: s3AuthSchema.describe('Object storage for source and output image artifacts')
})

const source = artifactRefSchema.describe('Source image artifact')
const outputKey = z.string().min(1).max(1_024).describe('Destination object key')
const filename = z.string().min(1).max(512).optional().describe('Display filename for the output image')
const dimension = z.int().min(1).max(MAX_IMAGE_DIMENSION)
const quality = z.int().min(1).max(100).optional().describe('Encoder quality from 1 to 100')

export const imageMetadataInputSchema = z.object({ source })

export const imageMetadataSchema = z.object({
	format: z.string(),
	media_type: z.string().optional(),
	width: z.int().positive(),
	height: z.int().positive(),
	space: z.string(),
	channels: z.int().positive(),
	density: z.number().positive().optional(),
	has_alpha: z.boolean(),
	pages: z.int().positive().optional()
})

export const imageTransformOutputSchema = z.object({
	result: artifactRefSchema.describe('Written image artifact'),
	image: imageMetadataSchema
})

export const imageResizeInputSchema = z
	.object({
		source,
		width: dimension.optional().describe('Target width in pixels'),
		height: dimension.optional().describe('Target height in pixels'),
		fit: z
			.enum(['cover', 'contain', 'fill', 'inside', 'outside'])
			.optional()
			.describe('How the image fits the target box'),
		without_enlargement: z.boolean().optional().describe('Prevent enlarging smaller images'),
		output_key: outputKey,
		filename
	})
	.refine((input) => input.width !== undefined || input.height !== undefined, {
		message: 'width or height is required',
		path: ['width']
	})

export const imageCropInputSchema = z.object({
	source,
	left: z.int().min(0).describe('Left edge in pixels'),
	top: z.int().min(0).describe('Top edge in pixels'),
	width: dimension.describe('Crop width in pixels'),
	height: dimension.describe('Crop height in pixels'),
	output_key: outputKey,
	filename
})

export const imageThumbnailInputSchema = z.object({
	source,
	width: dimension.describe('Maximum thumbnail width in pixels'),
	height: dimension.describe('Maximum thumbnail height in pixels'),
	output_key: outputKey,
	filename
})

export const imageFormatSchema = z.enum(['jpeg', 'png', 'webp', 'avif', 'tiff', 'gif'])

export const imageConvertInputSchema = z.object({
	source,
	format: imageFormatSchema.describe('Destination image format'),
	quality,
	output_key: outputKey,
	filename
})

export type ImageAuth = z.infer<typeof imageAuthSchema>
export type ImageMetadataInput = z.infer<typeof imageMetadataInputSchema>
export type ImageMetadata = z.infer<typeof imageMetadataSchema>
export type ImageResizeInput = z.infer<typeof imageResizeInputSchema>
export type ImageCropInput = z.infer<typeof imageCropInputSchema>
export type ImageThumbnailInput = z.infer<typeof imageThumbnailInputSchema>
export type ImageConvertInput = z.infer<typeof imageConvertInputSchema>
export type ImageTransformOutput = z.infer<typeof imageTransformOutputSchema>
