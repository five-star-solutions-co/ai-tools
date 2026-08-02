import { defineModule, defineTool } from '../../core/define'
import { CloudflareBrowserClient } from './client'
import {
	cloudflareBrowserClientAuthSchema,
	cloudflareBrowserRenderOutputSchema,
	cloudflareBrowserRenderPdfInputSchema,
	cloudflareBrowserRenderScreenshotInputSchema,
	cloudflareBrowserSessionIdInputSchema,
	cloudflareBrowserSessionOutputSchema,
	cloudflareBrowserStartSessionInputSchema
} from './contracts'

export const cloudflareBrowserRenderPdfTool = defineTool({
	id: 'cloudflare-browser-render-pdf',
	name: 'cloudflareBrowserRenderPdf',
	description:
		'Render HTML or a URL to a PDF via Cloudflare Browser Rendering. Writes the PDF to object storage and returns an ArtifactRef.',
	inputSchema: cloudflareBrowserRenderPdfInputSchema,
	outputSchema: cloudflareBrowserRenderOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => CloudflareBrowserClient.fromContext(ctx).renderPdf(input)
})

export const cloudflareBrowserRenderScreenshotTool = defineTool({
	id: 'cloudflare-browser-render-screenshot',
	name: 'cloudflareBrowserRenderScreenshot',
	description:
		'Capture a PNG screenshot of HTML or a URL via Cloudflare Browser Rendering. Writes the image to object storage and returns an ArtifactRef.',
	inputSchema: cloudflareBrowserRenderScreenshotInputSchema,
	outputSchema: cloudflareBrowserRenderOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => CloudflareBrowserClient.fromContext(ctx).renderScreenshot(input)
})

export const cloudflareBrowserStartSessionTool = defineTool({
	id: 'cloudflare-browser-start-session',
	name: 'cloudflareBrowserStartSession',
	description:
		'Start a Cloudflare Browser Run session for interactive browser control and return its connection metadata. This creates a session; it does not navigate or render content.',
	inputSchema: cloudflareBrowserStartSessionInputSchema,
	outputSchema: cloudflareBrowserSessionOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	network: true,
	execute: async (input, ctx) => CloudflareBrowserClient.fromContext(ctx).startSession(input)
})

export const cloudflareBrowserGetSessionTool = defineTool({
	id: 'cloudflare-browser-get-session',
	name: 'cloudflareBrowserGetSession',
	description:
		'Get the status and connection metadata for an existing Cloudflare Browser Run session. Use this to reconnect or check whether the session is still available.',
	inputSchema: cloudflareBrowserSessionIdInputSchema,
	outputSchema: cloudflareBrowserSessionOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	network: true,
	execute: async (input, ctx) => CloudflareBrowserClient.fromContext(ctx).getSession(input)
})

export const cloudflareBrowserStopSessionTool = defineTool({
	id: 'cloudflare-browser-stop-session',
	name: 'cloudflareBrowserStopSession',
	description: 'Close a Cloudflare Browser Run session by session id.',
	inputSchema: cloudflareBrowserSessionIdInputSchema,
	outputSchema: cloudflareBrowserSessionOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	network: true,
	execute: async (input, ctx) => CloudflareBrowserClient.fromContext(ctx).stopSession(input)
})

export const cloudflareBrowserModule = defineModule({
	id: 'cloudflare-browser',
	title: 'Cloudflare Browser Run',
	description:
		'Cloudflare Browser Run vendor pack for browser sessions plus HTML/URL PDF and screenshot quick actions.',
	runtime: 'both',
	auth: { type: 'custom', schema: cloudflareBrowserClientAuthSchema },
	categories: ['browser', 'cloudflare'],
	classification: 'standard',
	tags: ['render', 'cdp', 'session'],
	tools: [
		cloudflareBrowserStartSessionTool,
		cloudflareBrowserGetSessionTool,
		cloudflareBrowserStopSessionTool,
		cloudflareBrowserRenderPdfTool,
		cloudflareBrowserRenderScreenshotTool
	]
})
