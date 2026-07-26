import { z } from 'zod'

import {
	bedrockAgentCoreBrowserAuthSchema,
	browserSessionIdInputSchema,
	browserSessionOutputSchema,
	browserStartSessionInputSchema,
	browserStreamSchema
} from '../../vendors/bedrock-agentcore-browser'
import { cloudflareBrowserSessionAuthSchema } from '../../vendors/cloudflare-browser'
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

export const cloudflareBrowserSeamAuthSchema = cloudflareBrowserSessionAuthSchema.extend({
	provider: z.literal('cloudflare')
})

export const browserAuthSchema = z.discriminatedUnion('provider', [
	agentCoreBrowserSeamAuthSchema,
	cloudflareBrowserSeamAuthSchema
])

export type AgentCoreBrowserSeamAuth = z.infer<typeof agentCoreBrowserSeamAuthSchema>
export type CloudflareBrowserSeamAuth = z.infer<typeof cloudflareBrowserSeamAuthSchema>
export type BrowserAuth = z.infer<typeof browserAuthSchema>

export type BrowserOps = {
	startSession(input?: BrowserStartSessionInput): Promise<BrowserSessionOutput>
	getSession(input: BrowserSessionIdInput): Promise<BrowserSessionOutput>
	stopSession(input: BrowserSessionIdInput): Promise<BrowserSessionOutput>
}
