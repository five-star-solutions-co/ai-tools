import { defineModule, defineTool } from '../../core/define'
import { BrowserClient } from './client'
import {
	browserAuthSchema,
	browserSessionIdInputSchema,
	browserSessionOutputSchema,
	browserStartSessionInputSchema
} from './contracts'

export const browserStartSessionTool = defineTool({
	id: 'browser-start-session',
	name: 'startBrowserSession',
	description: 'Start a browser session on the bound provider and return session and stream metadata when available.',
	inputSchema: browserStartSessionInputSchema,
	outputSchema: browserSessionOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	network: true,
	execute: async (input, ctx) => BrowserClient.fromContext(ctx).startSession(input)
})

export const browserGetSessionTool = defineTool({
	id: 'browser-get-session',
	name: 'getBrowserSession',
	description: 'Get the current status and available stream metadata for a browser session.',
	inputSchema: browserSessionIdInputSchema,
	outputSchema: browserSessionOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	network: true,
	execute: async (input, ctx) => BrowserClient.fromContext(ctx).getSession(input)
})

export const browserStopSessionTool = defineTool({
	id: 'browser-stop-session',
	name: 'stopBrowserSession',
	description: 'Stop a browser session on the bound provider.',
	inputSchema: browserSessionIdInputSchema,
	outputSchema: browserSessionOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	network: true,
	execute: async (input, ctx) => BrowserClient.fromContext(ctx).stopSession(input)
})

export const browserModule = defineModule({
	id: 'browser',
	title: 'Browser',
	description: 'Start, inspect, and stop browser sessions through the bound provider.',
	runtime: 'both',
	auth: { type: 'custom', schema: browserAuthSchema },
	tools: [browserStartSessionTool, browserGetSessionTool, browserStopSessionTool]
})
