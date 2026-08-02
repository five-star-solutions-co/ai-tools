import { defineModule, defineTool } from '../../core/define'
import { BrowserClient } from './client'
import {
	browserActionOkSchema,
	browserAuthSchema,
	browserClickInputSchema,
	browserGetStateInputSchema,
	browserGetStateOutputSchema,
	browserNavigateInputSchema,
	browserNavigateOutputSchema,
	browserScreenshotInputSchema,
	browserScreenshotOutputSchema,
	browserSessionIdInputSchema,
	browserSessionOutputSchema,
	browserSnapshotInputSchema,
	browserSnapshotOutputSchema,
	browserStartSessionInputSchema,
	browserTypeInputSchema,
	browserWaitInputSchema
} from './contracts'

export const browserStartSessionTool = defineTool({
	id: 'browser-start-session',
	name: 'startBrowserSession',
	description:
		'Start a browser session and return stream metadata. Prefer mintBrowserCdpConnection + host CDP client for multi-step interaction; keep REST tools for one-shot navigate/snapshot/screenshot.',
	inputSchema: browserStartSessionInputSchema,
	outputSchema: browserSessionOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	network: true,
	tags: ['session', 'lifecycle'],
	execute: async (input, ctx) => BrowserClient.fromContext(ctx).startSession(input)
})

export const browserGetSessionTool = defineTool({
	id: 'browser-get-session',
	name: 'getBrowserSession',
	description: 'Get session status and stream metadata (including CDP automation endpoint when available).',
	inputSchema: browserSessionIdInputSchema,
	outputSchema: browserSessionOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	network: true,
	tags: ['session', 'lifecycle'],
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
	tags: ['session', 'lifecycle'],
	execute: async (input, ctx) => BrowserClient.fromContext(ctx).stopSession(input)
})

export const browserNavigateTool = defineTool({
	id: 'browser-navigate',
	name: 'browserNavigate',
	description:
		'One-shot or session navigate when the bound provider supports REST. For multi-step browsing prefer the CDP automation stream from start-session. Returns HTML/title when supported.',
	inputSchema: browserNavigateInputSchema,
	outputSchema: browserNavigateOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	network: true,
	tags: ['one-shot', 'secondary'],
	execute: async (input, ctx) => BrowserClient.fromContext(ctx).navigate(input)
})

export const browserSnapshotTool = defineTool({
	id: 'browser-snapshot',
	name: 'browserSnapshot',
	description:
		'One-shot page HTML or text capture. Some providers require url. Prefer this for a single read; use CDP for agent-driven multi-step flows.',
	inputSchema: browserSnapshotInputSchema,
	outputSchema: browserSnapshotOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	network: true,
	tags: ['one-shot'],
	execute: async (input, ctx) => BrowserClient.fromContext(ctx).snapshot(input)
})

export const browserClickTool = defineTool({
	id: 'browser-click',
	name: 'browserClick',
	description:
		'Session-agent path: click by CSS selector when the bound provider supports interactive REST (often unsupported — use CDP from start-session instead).',
	inputSchema: browserClickInputSchema,
	outputSchema: browserActionOkSchema,
	sideEffect: 'write',
	runtime: 'both',
	network: true,
	tags: ['session-agent', 'interactive', 'secondary'],
	execute: async (input, ctx) => BrowserClient.fromContext(ctx).click(input)
})

export const browserTypeTool = defineTool({
	id: 'browser-type',
	name: 'browserType',
	description:
		'Session-agent path: type into a selector when interactive REST is supported (often unsupported — use CDP).',
	inputSchema: browserTypeInputSchema,
	outputSchema: browserActionOkSchema,
	sideEffect: 'write',
	runtime: 'both',
	network: true,
	tags: ['session-agent', 'interactive', 'secondary'],
	execute: async (input, ctx) => BrowserClient.fromContext(ctx).type(input)
})

export const browserWaitTool = defineTool({
	id: 'browser-wait',
	name: 'browserWait',
	description:
		'Session-agent path: wait for selector/navigation when interactive REST is supported (often unsupported — use CDP).',
	inputSchema: browserWaitInputSchema,
	outputSchema: browserActionOkSchema,
	sideEffect: 'read',
	runtime: 'both',
	network: true,
	tags: ['session-agent', 'interactive', 'secondary'],
	execute: async (input, ctx) => BrowserClient.fromContext(ctx).wait(input)
})

export const browserScreenshotTool = defineTool({
	id: 'browser-screenshot',
	name: 'browserScreenshot',
	description:
		'One-shot or session PNG screenshot as ArtifactRef. Prefer for visual capture; multi-step interaction should use CDP.',
	inputSchema: browserScreenshotInputSchema,
	outputSchema: browserScreenshotOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	network: true,
	artifacts: true,
	tags: ['one-shot', 'artifacts'],
	execute: async (input, ctx) => BrowserClient.fromContext(ctx).screenshot(input)
})

export const browserGetStateTool = defineTool({
	id: 'browser-get-state',
	name: 'browserGetState',
	description: 'Get session status and stream metadata (CDP endpoint when available).',
	inputSchema: browserGetStateInputSchema,
	outputSchema: browserGetStateOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	network: true,
	tags: ['session', 'lifecycle'],
	execute: async (input, ctx) => BrowserClient.fromContext(ctx).getState(input)
})

export const browserModule = defineModule({
	id: 'browser',
	title: 'Browser',
	description:
		'Browser session lifecycle, one-shot navigate/snapshot/screenshot, and optional interactive tools. Prefer mintBrowserCdpConnection + host CDP agent for multi-step click/type; REST interactive tools stay for migration.',
	runtime: 'both',
	auth: { type: 'custom', schema: browserAuthSchema },
	categories: ['browser', 'automation'],
	classification: 'standard',
	tags: ['session', 'cdp', 'one-shot'],
	tools: [
		browserStartSessionTool,
		browserGetSessionTool,
		browserStopSessionTool,
		browserNavigateTool,
		browserSnapshotTool,
		browserClickTool,
		browserTypeTool,
		browserWaitTool,
		browserScreenshotTool,
		browserGetStateTool
	]
})
