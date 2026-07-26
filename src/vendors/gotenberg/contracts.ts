import { z } from 'zod'

import { artifactRefSchema } from '../../shared/artifact'
import { s3AuthSchema } from '../s3'

export const MAX_HTML_CHARS = 2_000_000

export const gotenbergAuthSchema = z.object({
	gotenberg_base_url: z.url().describe('Self-hosted Gotenberg origin, for example http://localhost:3000'),
	gotenberg_api_username: z.string().min(1).optional().describe('Optional basic-auth username'),
	gotenberg_api_password: z.string().min(1).optional().describe('Optional basic-auth password'),
	storage: s3AuthSchema.describe('Object storage for rendered ArtifactRef output')
})

export type GotenbergAuth = z.infer<typeof gotenbergAuthSchema>

export const gotenbergViewportSchema = z.object({
	width: z.int().min(1).max(8_000).describe('Viewport width in CSS pixels'),
	height: z.int().min(1).max(8_000).describe('Viewport height in CSS pixels'),
	device_scale_factor: z.number().min(0.1).max(4).optional().describe('Device scale factor (default 1)')
})

export const gotenbergRenderSourceSchema = z
	.object({
		html: z.string().min(1).max(MAX_HTML_CHARS).optional().describe('HTML document body to render'),
		url: z.url().optional().describe('Absolute http(s) URL to open and render')
	})
	.refine((v) => Boolean(v.html?.trim() || v.url), {
		message: 'Provide html or url'
	})
	.refine((v) => !(v.html && v.url), {
		message: 'Provide only one of html or url'
	})

export const gotenbergRenderPdfInputSchema = z.object({
	source: gotenbergRenderSourceSchema.describe('HTML string or URL to print'),
	output_key: z.string().min(1).optional().describe('Object key for the PDF. Defaults under renders/'),
	filename: z.string().min(1).optional().describe('Display filename for the result ArtifactRef')
})

export const gotenbergRenderScreenshotInputSchema = z.object({
	source: gotenbergRenderSourceSchema.describe('HTML string or URL to capture'),
	output_key: z.string().min(1).optional().describe('Object key for the PNG. Defaults under renders/'),
	filename: z.string().min(1).optional().describe('Display filename for the result ArtifactRef'),
	viewport: gotenbergViewportSchema.optional().describe('Optional screenshot viewport')
})

export const gotenbergRenderOutputSchema = z.object({
	result: artifactRefSchema,
	kind: z.enum(['pdf', 'screenshot'])
})

/** Office document → PDF via LibreOffice (not HTML print). */
export const gotenbergConvertPathSchema = z.enum(['office-to-pdf']).describe('Closed conversion path')

export const gotenbergConvertInputSchema = z.object({
	source: artifactRefSchema.describe('Input artifact in object storage (office document)'),
	path: gotenbergConvertPathSchema.default('office-to-pdf').describe('Conversion path (currently office-to-pdf only)'),
	output_key: z
		.string()
		.min(1)
		.optional()
		.describe('Object key for the PDF result. Defaults to source key with .pdf extension'),
	filename: z.string().min(1).optional().describe('Upload filename when source has none')
})

export const gotenbergConvertOutputSchema = z.object({
	source: artifactRefSchema,
	result: artifactRefSchema,
	path: gotenbergConvertPathSchema
})

export const MAX_BATCH_CONVERT = 10

export const gotenbergConvertBatchInputSchema = z.object({
	items: z
		.array(gotenbergConvertInputSchema)
		.min(1)
		.max(MAX_BATCH_CONVERT)
		.describe(`Conversions to run (max ${MAX_BATCH_CONVERT})`)
})

export type GotenbergViewport = z.infer<typeof gotenbergViewportSchema>
export type GotenbergRenderSource = z.infer<typeof gotenbergRenderSourceSchema>
export type GotenbergRenderPdfInput = z.infer<typeof gotenbergRenderPdfInputSchema>
export type GotenbergRenderScreenshotInput = z.infer<typeof gotenbergRenderScreenshotInputSchema>
export type GotenbergRenderOutput = z.infer<typeof gotenbergRenderOutputSchema>
export type GotenbergConvertPath = z.infer<typeof gotenbergConvertPathSchema>
export type GotenbergConvertInput = z.infer<typeof gotenbergConvertInputSchema>
export type GotenbergConvertOutput = z.infer<typeof gotenbergConvertOutputSchema>
export type GotenbergConvertBatchInput = z.infer<typeof gotenbergConvertBatchInputSchema>
