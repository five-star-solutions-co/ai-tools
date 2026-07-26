import { z } from 'zod'

import { artifactRefSchema } from '../../shared/artifact'
import { s3AuthSchema } from '../s3'

export const MAX_HTML_CHARS = 2_000_000

export const cloudflareBrowserSessionAuthSchema = z.object({
	account_id: z.string().min(1).describe('Cloudflare account id'),
	api_token: z.string().min(1).describe('Cloudflare API token with Browser Rendering permission')
})

export const cloudflareBrowserClientAuthSchema = cloudflareBrowserSessionAuthSchema.extend({
	storage: s3AuthSchema.optional().describe('Object storage required for rendered ArtifactRef output')
})

export const cloudflareBrowserAuthSchema = cloudflareBrowserSessionAuthSchema.extend({
	storage: s3AuthSchema.describe('Object storage for rendered ArtifactRef output')
})

export type CloudflareBrowserAuth = z.infer<typeof cloudflareBrowserAuthSchema>
export type CloudflareBrowserClientAuth = z.infer<typeof cloudflareBrowserClientAuthSchema>
export type CloudflareBrowserSessionAuth = z.infer<typeof cloudflareBrowserSessionAuthSchema>

export const cloudflareBrowserStartSessionInputSchema = z.object({
	keep_alive_seconds: z
		.int()
		.min(60)
		.max(600)
		.optional()
		.describe('How long the browser session remains available, from 60 to 600 seconds')
})

export const cloudflareBrowserSessionIdInputSchema = z.object({
	session_id: z.string().uuid().describe('Cloudflare browser session id')
})

export const cloudflareBrowserSessionOutputSchema = z.object({
	session_id: z.string().describe('Cloudflare browser session id'),
	status: z.string().optional().describe('Current session status'),
	websocket_debugger_url: z.string().optional().describe('WebSocket endpoint for Chrome DevTools Protocol'),
	devtools_frontend_url: z.string().optional().describe('Hosted DevTools and live-view URL')
})

export type CloudflareBrowserStartSessionInput = z.infer<typeof cloudflareBrowserStartSessionInputSchema>
export type CloudflareBrowserSessionIdInput = z.infer<typeof cloudflareBrowserSessionIdInputSchema>
export type CloudflareBrowserSessionOutput = z.infer<typeof cloudflareBrowserSessionOutputSchema>

export const cloudflareBrowserViewportSchema = z.object({
	width: z.int().min(1).max(8_000).describe('Viewport width in CSS pixels'),
	height: z.int().min(1).max(8_000).describe('Viewport height in CSS pixels'),
	device_scale_factor: z.number().min(0.1).max(4).optional().describe('Device scale factor (default 1)')
})

export const cloudflareBrowserRenderSourceSchema = z
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

export const cloudflareBrowserRenderPdfInputSchema = z.object({
	source: cloudflareBrowserRenderSourceSchema.describe('HTML string or URL to print'),
	output_key: z.string().min(1).optional().describe('Object key for the PDF. Defaults under renders/'),
	filename: z.string().min(1).optional().describe('Display filename for the result ArtifactRef')
})

export const cloudflareBrowserRenderScreenshotInputSchema = z.object({
	source: cloudflareBrowserRenderSourceSchema.describe('HTML string or URL to capture'),
	output_key: z.string().min(1).optional().describe('Object key for the PNG. Defaults under renders/'),
	filename: z.string().min(1).optional().describe('Display filename for the result ArtifactRef'),
	viewport: cloudflareBrowserViewportSchema.optional().describe('Optional screenshot viewport')
})

export const cloudflareBrowserRenderOutputSchema = z.object({
	result: artifactRefSchema,
	kind: z.enum(['pdf', 'screenshot'])
})

export type CloudflareBrowserViewport = z.infer<typeof cloudflareBrowserViewportSchema>
export type CloudflareBrowserRenderSource = z.infer<typeof cloudflareBrowserRenderSourceSchema>
export type CloudflareBrowserRenderPdfInput = z.infer<typeof cloudflareBrowserRenderPdfInputSchema>
export type CloudflareBrowserRenderScreenshotInput = z.infer<typeof cloudflareBrowserRenderScreenshotInputSchema>
export type CloudflareBrowserRenderOutput = z.infer<typeof cloudflareBrowserRenderOutputSchema>
