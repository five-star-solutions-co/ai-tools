import { z } from 'zod'

export const DEFAULT_TIMEOUT_MS = 30_000

export const webFetchAuthSchema = z.object({
	allowed_origins: z
		.array(z.string().min(1))
		.min(1)
		.max(64)
		.describe('Exact origins permitted, for example https://api.example.com'),
	default_headers: z
		.record(z.string(), z.string())
		.optional()
		.describe('Host-injected headers (for example Authorization). Not tool inputs'),
	require_https: z.boolean().optional().describe('When true, only https URLs. Defaults to false'),
	timeout_ms: z.int().min(1).max(120_000).optional().describe('Default timeout ms (default 30000)')
})

export type WebFetchAuth = z.infer<typeof webFetchAuthSchema>

const sharedFields = {
	url: z.url().describe('Absolute http(s) URL on an allowlisted origin'),
	headers: z.record(z.string(), z.string()).optional().describe('Additional non-protected request headers'),
	query: z
		.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
		.optional()
		.describe('Query parameters'),
	timeout_ms: z.int().min(1).max(120_000).optional().describe('Per-request timeout override')
}

export const webFetchGetInputSchema = z.object({
	...sharedFields,
	method: z.enum(['GET', 'HEAD']).optional().describe('Read method. Defaults to GET')
})

export const webFetchRequestInputSchema = z.object({
	...sharedFields,
	method: z.enum(['POST', 'PUT', 'PATCH', 'DELETE']).optional().describe('Mutating method. Defaults to POST'),
	body: z
		.unknown()
		.optional()
		.describe('Request body. Objects and arrays are JSON-encoded; strings are sent as raw text. Omit when unused')
})

export const webFetchRequestOutputSchema = z.object({
	url: z.string(),
	status: z.int(),
	ok: z.boolean(),
	headers: z.record(z.string(), z.string()),
	content_type: z.string().optional(),
	/** ofetch-parsed payload: object/array for JSON, string for text, etc. */
	body: z.unknown()
})

export type WebFetchGetInput = z.infer<typeof webFetchGetInputSchema>
export type WebFetchRequestInput = z.infer<typeof webFetchRequestInputSchema>
export type WebFetchRequestOutput = z.infer<typeof webFetchRequestOutputSchema>
