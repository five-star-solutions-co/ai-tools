import { z } from 'zod'

import { artifactRefSchema } from '../../shared/artifact'
import {
	bedrockAgentCoreBrowserAuthSchema,
	browserSessionIdInputSchema,
	browserSessionOutputSchema,
	browserStartSessionInputSchema,
	browserStreamSchema
} from '../../vendors/bedrock-agentcore-browser'
import { cloudflareBrowserClientAuthSchema } from '../../vendors/cloudflare-browser'
import type {
	BrowserSessionIdInput,
	BrowserSessionOutput,
	BrowserStartSessionInput
} from '../../vendors/bedrock-agentcore-browser'

export { browserSessionIdInputSchema, browserSessionOutputSchema, browserStartSessionInputSchema, browserStreamSchema }
export type {
	BrowserSessionIdInput,
	BrowserSessionOutput,
	BrowserStartSessionInput
} from '../../vendors/bedrock-agentcore-browser'

export const agentCoreBrowserSeamAuthSchema = bedrockAgentCoreBrowserAuthSchema.extend({
	provider: z.literal('bedrock-agentcore')
})

/** Optional storage for screenshot ArtifactRef on Cloudflare. */
export const cloudflareBrowserSeamAuthSchema = cloudflareBrowserClientAuthSchema.extend({
	provider: z.literal('cloudflare')
})

export const browserAuthSchema = z.discriminatedUnion('provider', [
	agentCoreBrowserSeamAuthSchema,
	cloudflareBrowserSeamAuthSchema
])

export type AgentCoreBrowserSeamAuth = z.infer<typeof agentCoreBrowserSeamAuthSchema>
export type CloudflareBrowserSeamAuth = z.infer<typeof cloudflareBrowserSeamAuthSchema>
export type BrowserAuth = z.infer<typeof browserAuthSchema>

const sessionId = z.string().min(1).describe('Browser session id from start-session')

export const browserNavigateInputSchema = z.object({
	session_id: sessionId,
	url: z.url().describe('Absolute http(s) URL to open')
})

export const browserNavigateOutputSchema = z.object({
	session_id: z.string(),
	url: z.string(),
	title: z.string().optional().describe('Document title when available'),
	html: z.string().optional().describe('Rendered HTML when the bound provider returns it')
})

export const browserSnapshotInputSchema = z.object({
	session_id: sessionId,
	url: z.url().optional().describe('URL to open before snapshot when the provider is one-shot REST'),
	format: z.enum(['html', 'text']).optional().describe('Snapshot format (default html)')
})

export const browserSnapshotOutputSchema = z.object({
	session_id: z.string(),
	format: z.enum(['html', 'text']),
	content: z.string().describe('Page HTML or extracted text'),
	url: z.string().optional()
})

export const browserClickInputSchema = z.object({
	session_id: sessionId,
	selector: z.string().min(1).describe('CSS selector of the element to click')
})

export const browserTypeInputSchema = z.object({
	session_id: sessionId,
	selector: z.string().min(1).describe('CSS selector of the input to type into'),
	text: z.string().describe('Text to type'),
	clear: z.boolean().optional().describe('Clear existing value before typing when supported')
})

export const browserWaitInputSchema = z.object({
	session_id: sessionId,
	selector: z.string().min(1).optional().describe('Wait for this selector when supported'),
	timeout_ms: z.int().min(1).max(120_000).optional().describe('Max wait ms (default provider-specific)'),
	url: z.url().optional().describe('Wait until navigation to this URL when supported')
})

export const browserScreenshotInputSchema = z.object({
	session_id: sessionId,
	url: z.url().optional().describe('URL to capture when the provider is one-shot REST'),
	output_key: z.string().min(1).optional().describe('Object key for the PNG ArtifactRef'),
	full_page: z.boolean().optional().describe('Capture full page when supported')
})

export const browserScreenshotOutputSchema = z.object({
	session_id: z.string(),
	result: artifactRefSchema.describe('PNG screenshot in object storage')
})

export const browserGetStateInputSchema = z.object({
	session_id: sessionId
})

export const browserGetStateOutputSchema = z.object({
	session_id: z.string(),
	status: z.string().optional(),
	url: z.string().optional().describe('Current page URL when known'),
	title: z.string().optional(),
	streams: browserStreamSchema.optional()
})

export const browserActionOkSchema = z.object({
	session_id: z.string(),
	ok: z.literal(true)
})

export type BrowserNavigateInput = z.infer<typeof browserNavigateInputSchema>
export type BrowserNavigateOutput = z.infer<typeof browserNavigateOutputSchema>
export type BrowserSnapshotInput = z.infer<typeof browserSnapshotInputSchema>
export type BrowserSnapshotOutput = z.infer<typeof browserSnapshotOutputSchema>
export type BrowserClickInput = z.infer<typeof browserClickInputSchema>
export type BrowserTypeInput = z.infer<typeof browserTypeInputSchema>
export type BrowserWaitInput = z.infer<typeof browserWaitInputSchema>
export type BrowserScreenshotInput = z.infer<typeof browserScreenshotInputSchema>
export type BrowserScreenshotOutput = z.infer<typeof browserScreenshotOutputSchema>
export type BrowserGetStateInput = z.infer<typeof browserGetStateInputSchema>
export type BrowserGetStateOutput = z.infer<typeof browserGetStateOutputSchema>
export type BrowserActionOk = z.infer<typeof browserActionOkSchema>

export type BrowserOps = {
	startSession(input?: BrowserStartSessionInput): Promise<BrowserSessionOutput>
	getSession(input: BrowserSessionIdInput): Promise<BrowserSessionOutput>
	stopSession(input: BrowserSessionIdInput): Promise<BrowserSessionOutput>
	navigate(input: BrowserNavigateInput): Promise<BrowserNavigateOutput>
	snapshot(input: BrowserSnapshotInput): Promise<BrowserSnapshotOutput>
	click(input: BrowserClickInput): Promise<BrowserActionOk>
	type(input: BrowserTypeInput): Promise<BrowserActionOk>
	wait(input: BrowserWaitInput): Promise<BrowserActionOk>
	screenshot(input: BrowserScreenshotInput): Promise<BrowserScreenshotOutput>
	getState(input: BrowserGetStateInput): Promise<BrowserGetStateOutput>
}
