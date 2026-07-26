import { defineModule, defineTool } from '../../core/define'
import { ImageClient } from './client'
import {
	imageAuthSchema,
	imageConvertInputSchema,
	imageCropInputSchema,
	imageMetadataInputSchema,
	imageMetadataSchema,
	imageResizeInputSchema,
	imageThumbnailInputSchema,
	imageTransformOutputSchema
} from './contracts'

export const imageMetadataTool = defineTool({
	id: 'image-metadata',
	name: 'inspectImage',
	description:
		'Inspect an image artifact and return decoded format, dimensions, color space, channels, and page metadata.',
	inputSchema: imageMetadataInputSchema,
	outputSchema: imageMetadataSchema,
	sideEffect: 'read',
	runtime: 'node',
	artifacts: true,
	execute: async (input, ctx) => ImageClient.fromContext(ctx).metadata(input)
})

export const imageResizeTool = defineTool({
	id: 'image-resize',
	name: 'resizeImage',
	description:
		'Resize an image artifact to a target width, height, or bounding box while preserving its encoded format.',
	inputSchema: imageResizeInputSchema,
	outputSchema: imageTransformOutputSchema,
	sideEffect: 'write',
	runtime: 'node',
	artifacts: true,
	execute: async (input, ctx) => ImageClient.fromContext(ctx).resize(input)
})

export const imageCropTool = defineTool({
	id: 'image-crop',
	name: 'cropImage',
	description: 'Crop a rectangular pixel region from an image artifact and write a new image artifact.',
	inputSchema: imageCropInputSchema,
	outputSchema: imageTransformOutputSchema,
	sideEffect: 'write',
	runtime: 'node',
	artifacts: true,
	execute: async (input, ctx) => ImageClient.fromContext(ctx).crop(input)
})

export const imageThumbnailTool = defineTool({
	id: 'image-thumbnail',
	name: 'createImageThumbnail',
	description: 'Create a bounded thumbnail that fits within the requested dimensions without enlarging smaller images.',
	inputSchema: imageThumbnailInputSchema,
	outputSchema: imageTransformOutputSchema,
	sideEffect: 'write',
	runtime: 'node',
	artifacts: true,
	execute: async (input, ctx) => ImageClient.fromContext(ctx).thumbnail(input)
})

export const imageConvertTool = defineTool({
	id: 'image-convert',
	name: 'convertImage',
	description: 'Re-encode an image artifact as JPEG, PNG, WebP, AVIF, TIFF, or GIF.',
	inputSchema: imageConvertInputSchema,
	outputSchema: imageTransformOutputSchema,
	sideEffect: 'write',
	runtime: 'node',
	artifacts: true,
	execute: async (input, ctx) => ImageClient.fromContext(ctx).convert(input)
})

export const imageModule = defineModule({
	id: 'image',
	title: 'Image',
	description: 'Inspect, resize, crop, thumbnail, and re-encode image artifacts.',
	runtime: 'node',
	auth: { type: 'custom', schema: imageAuthSchema },
	tools: [imageMetadataTool, imageResizeTool, imageCropTool, imageThumbnailTool, imageConvertTool]
})
