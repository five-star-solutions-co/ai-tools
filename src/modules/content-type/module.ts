import { z } from 'zod'

import { defineModule, defineTool } from '../../core/define'
import { allExtensionsFromMediaType, extensionFromMediaType, mediaTypeFromPath } from '../../shared/content-type'

const getTypeInput = z.object({
	path: z
		.string()
		.min(1)
		.describe('File path, filename, or extension (with or without leading dot), for example report.pdf or pdf')
})

const getTypeOutput = z.object({
	media_type: z.string().nullable().describe('Content type (MIME), or null when unrecognized')
})

const getExtensionInput = z.object({
	media_type: z
		.string()
		.min(1)
		.describe('Content type; optional charset is ignored, for example text/html; charset=utf-8')
})

const getExtensionOutput = z.object({
	extension: z.string().nullable().describe('Preferred file extension without a leading dot, or null')
})

const getAllExtensionsOutput = z.object({
	extensions: z.array(z.string()).describe('All known extensions for the type (may be empty)')
})

export const contentTypeGetTool = defineTool({
	id: 'content-type-get',
	name: 'getContentType',
	description:
		'Look up the media type for a file path, filename, or extension. Use when another tool requires a media type and only the name or extension is known. Returns null for an unknown extension.',
	inputSchema: getTypeInput,
	outputSchema: getTypeOutput,
	sideEffect: 'none',
	runtime: 'both',
	execute: async (input) => {
		const mediaType = mediaTypeFromPath(input.path)
		return getTypeOutput.parse({ media_type: mediaType ?? null })
	}
})

export const contentTypeExtensionTool = defineTool({
	id: 'content-type-extension',
	name: 'getContentTypeExtension',
	description:
		'Look up the preferred file extension for a media type. Use when naming an output whose media type is known. Charset parameters are ignored; returns null when unknown.',
	inputSchema: getExtensionInput,
	outputSchema: getExtensionOutput,
	sideEffect: 'none',
	runtime: 'both',
	execute: async (input) => {
		const extension = extensionFromMediaType(input.media_type)
		return getExtensionOutput.parse({ extension: extension ?? null })
	}
})

export const contentTypeExtensionsTool = defineTool({
	id: 'content-type-extensions',
	name: 'getContentTypeExtensions',
	description:
		'List all known file extensions for a content type (for example image/jpeg → jpeg, jpg, jpe). Empty when unknown.',
	inputSchema: getExtensionInput,
	outputSchema: getAllExtensionsOutput,
	sideEffect: 'none',
	runtime: 'both',
	execute: async (input) => {
		return getAllExtensionsOutput.parse({
			extensions: [...allExtensionsFromMediaType(input.media_type)]
		})
	}
})

export const contentTypeModule = defineModule({
	id: 'content-type',
	title: 'Content Type',
	description: 'Look up media types from extensions and extensions from media types. This does not inspect file bytes.',
	runtime: 'both',
	auth: { type: 'none' },
	tools: [contentTypeGetTool, contentTypeExtensionTool, contentTypeExtensionsTool]
})
