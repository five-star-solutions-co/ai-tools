import { defineModule, defineTool } from '../../core/define'
import { BedrockAgentCoreBrowserClient } from './client'
import {
	bedrockAgentCoreBrowserAuthSchema,
	browserSessionIdInputSchema,
	browserSessionOutputSchema,
	browserStartSessionInputSchema
} from './contracts'

const id = 'bedrock-agentcore-browser'

export const bedrockAgentCoreBrowserStartSessionTool = defineTool({
	id: `${id}-start-session`,
	name: 'bedrockAgentCoreBrowserStartSession',
	description:
		'Start a Bedrock AgentCore browser session. Returns session_id and stream endpoints (automation / live view) when provided. Interactive page control uses those streams outside this pack.',
	inputSchema: browserStartSessionInputSchema,
	outputSchema: browserSessionOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => BedrockAgentCoreBrowserClient.fromContext(ctx).startSession(input)
})

export const bedrockAgentCoreBrowserStopSessionTool = defineTool({
	id: `${id}-stop-session`,
	name: 'bedrockAgentCoreBrowserStopSession',
	description: 'Stop a Bedrock AgentCore browser session by session_id.',
	inputSchema: browserSessionIdInputSchema,
	outputSchema: browserSessionOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => BedrockAgentCoreBrowserClient.fromContext(ctx).stopSession(input)
})

export const bedrockAgentCoreBrowserGetSessionTool = defineTool({
	id: `${id}-get-session`,
	name: 'bedrockAgentCoreBrowserGetSession',
	description: 'Get a Bedrock AgentCore browser session, including status and stream endpoints when available.',
	inputSchema: browserSessionIdInputSchema,
	outputSchema: browserSessionOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => BedrockAgentCoreBrowserClient.fromContext(ctx).getSession(input)
})

export const bedrockAgentCoreBrowserModule = defineModule({
	id,
	title: 'Bedrock AgentCore Browser',
	description:
		'Amazon Bedrock AgentCore Browser: start/stop/get sessions and stream metadata. Interactive automation uses automation/live-view streams (host or Playwright), not faked click tools.',
	runtime: 'both',
	auth: { type: 'custom', schema: bedrockAgentCoreBrowserAuthSchema },
	tools: [
		bedrockAgentCoreBrowserStartSessionTool,
		bedrockAgentCoreBrowserStopSessionTool,
		bedrockAgentCoreBrowserGetSessionTool
	]
})
