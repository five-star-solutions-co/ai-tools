/**
 * Amazon Bedrock AgentCore Browser contracts (session lifecycle + stream metadata).
 * Interactive automation uses stream endpoints (host/Playwright) — not faked REST click tools.
 */

import { z } from 'zod'

export const DEFAULT_BROWSER_ID = 'aws.browser.v1'

export const bedrockAgentCoreBrowserAuthSchema = z.object({
	access_key_id: z.string().min(1).describe('AWS access key id'),
	secret_access_key: z.string().min(1).describe('AWS secret access key'),
	region: z.string().min(1).describe('AWS region for Bedrock AgentCore'),
	session_token: z.string().min(1).optional().describe('Optional session token'),
	browser_id: z.string().min(1).optional().describe('Browser resource id (default aws.browser.v1)')
})

export type BedrockAgentCoreBrowserAuth = z.infer<typeof bedrockAgentCoreBrowserAuthSchema>

const sessionId = z.string().min(1).max(40).describe('Browser session id')

export const browserStartSessionInputSchema = z.object({
	name: z.string().min(1).max(100).optional().describe('Optional session name'),
	session_timeout_seconds: z.int().min(1).max(28_800).optional().describe('Session TTL in seconds (max 8 hours)'),
	viewport_width: z.int().min(1).max(10_000).optional().describe('Viewport width in pixels'),
	viewport_height: z.int().min(1).max(10_000).optional().describe('Viewport height in pixels')
})

export const browserSessionIdInputSchema = z.object({
	session_id: sessionId
})

export const browserStreamSchema = z.object({
	automation_stream_endpoint: z.string().optional().describe('Automation WebSocket/stream endpoint when returned'),
	automation_stream_status: z.string().optional().describe('Automation stream status when returned'),
	live_view_stream_endpoint: z.string().optional().describe('Live view stream endpoint when returned')
})

export const browserSessionOutputSchema = z.object({
	session_id: z.string().describe('Browser session id'),
	browser_id: z.string().optional().describe('Browser resource id'),
	created_at: z.string().optional(),
	status: z.string().optional().describe('Session status when returned'),
	streams: browserStreamSchema.optional().describe('Automation and live-view stream metadata')
})

export type BrowserStartSessionInput = z.infer<typeof browserStartSessionInputSchema>
export type BrowserSessionIdInput = z.infer<typeof browserSessionIdInputSchema>
export type BrowserSessionOutput = z.infer<typeof browserSessionOutputSchema>
