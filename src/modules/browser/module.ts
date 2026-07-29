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

export const browserNavigateTool = defineTool({
	id: 'browser-navigate',
	name: 'browserNavigate',
	description:
		'Open a URL in the browser session context. When supported, returns rendered HTML and title. Requires session_id from start-session.',
	inputSchema: browserNavigateInputSchema,
	outputSchema: browserNavigateOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	network: true,
	execute: async (input, ctx) => BrowserClient.fromContext(ctx).navigate(input)
})

export const browserSnapshotTool = defineTool({
	id: 'browser-snapshot',
	name: 'browserSnapshot',
	description:
		'Capture page content as HTML or text. Some providers require url (one-shot). Prefer snapshot over dumping full pages into chat when large.',
	inputSchema: browserSnapshotInputSchema,
	outputSchema: browserSnapshotOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	network: true,
	execute: async (input, ctx) => BrowserClient.fromContext(ctx).snapshot(input)
})

export const browserClickTool = defineTool({
	id: 'browser-click',
	name: 'browserClick',
	description: 'Click an element by CSS selector when the bound provider supports interactive control.',
	inputSchema: browserClickInputSchema,
	outputSchema: browserActionOkSchema,
	sideEffect: 'write',
	runtime: 'both',
	network: true,
	execute: async (input, ctx) => BrowserClient.fromContext(ctx).click(input)
})

export const browserTypeTool = defineTool({
	id: 'browser-type',
	name: 'browserType',
	description: 'Type text into an element by CSS selector when interactive control is supported.',
	inputSchema: browserTypeInputSchema,
	outputSchema: browserActionOkSchema,
	sideEffect: 'write',
	runtime: 'both',
	network: true,
	execute: async (input, ctx) => BrowserClient.fromContext(ctx).type(input)
})

export const browserWaitTool = defineTool({
	id: 'browser-wait',
	name: 'browserWait',
	description: 'Wait for a selector, navigation, or timeout when interactive control is supported.',
	inputSchema: browserWaitInputSchema,
	outputSchema: browserActionOkSchema,
	sideEffect: 'read',
	runtime: 'both',
	network: true,
	execute: async (input, ctx) => BrowserClient.fromContext(ctx).wait(input)
})

export const browserScreenshotTool = defineTool({
	id: 'browser-screenshot',
	name: 'browserScreenshot',
	description:
		'Capture a PNG screenshot and return its ArtifactRef. Use for a visual record of the current page or a one-shot URL. For HTML supplied as content or print-ready output, use the document render tools.',
	inputSchema: browserScreenshotInputSchema,
	outputSchema: browserScreenshotOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	network: true,
	execute: async (input, ctx) => BrowserClient.fromContext(ctx).screenshot(input)
})

export const browserGetStateTool = defineTool({
	id: 'browser-get-state',
	name: 'browserGetState',
	description: 'Get session status and stream metadata for a browser session (current URL when known).',
	inputSchema: browserGetStateInputSchema,
	outputSchema: browserGetStateOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	network: true,
	execute: async (input, ctx) => BrowserClient.fromContext(ctx).getState(input)
})

export const browserModule = defineModule({
	id: 'browser',
	title: 'Browser',
	description:
		'Browser sessions and page actions: start/stop, navigate, snapshot, click, type, wait, screenshot, and get-state when the bound provider supports them.',
	runtime: 'both',
	auth: { type: 'custom', schema: browserAuthSchema },
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
