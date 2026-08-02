import { defineModule, defineTool } from '../../core/define'
import { WebFetchClient } from './client'
import {
	webFetchAuthSchema,
	webFetchGetInputSchema,
	webFetchRequestInputSchema,
	webFetchRequestOutputSchema
} from './contracts'

export type { WebFetchAuth } from './contracts'
export { webFetchAuthSchema }

export const webFetchGetTool = defineTool({
	id: 'web-fetch-get',
	name: 'httpGet',
	description:
		'Send HTTP GET or HEAD to an absolute allowlisted URL. Use to read an approved API when no purpose-built tool exists. Returns status, headers, and a parsed JSON or text body. No request body; protected headers cannot be supplied in arguments.',
	inputSchema: webFetchGetInputSchema,
	outputSchema: webFetchRequestOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => WebFetchClient.fromContext(ctx).get(input)
})

export const webFetchRequestTool = defineTool({
	id: 'web-fetch-request',
	name: 'httpRequest',
	description:
		'Send HTTP POST, PUT, PATCH, or DELETE to an absolute allowlisted URL. Use for an approved API or webhook only when no purpose-built tool exists. Objects and arrays are JSON-encoded; returns status, headers, and a parsed body. Protected headers cannot be supplied in arguments.',
	inputSchema: webFetchRequestInputSchema,
	outputSchema: webFetchRequestOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => WebFetchClient.fromContext(ctx).request(input)
})

export const webFetchModule = defineModule({
	id: 'web-fetch',
	title: 'Web Fetch',
	description:
		'Fallback HTTP access to allowlisted absolute URLs. Use GET or HEAD for reads and POST, PUT, PATCH, or DELETE for writes only when no purpose-built tool covers the API.',
	runtime: 'both',
	auth: { type: 'custom', schema: webFetchAuthSchema },
	categories: ['http', 'web'],
	classification: 'standard',
	tags: ['allowlist'],
	tools: [webFetchGetTool, webFetchRequestTool]
})
