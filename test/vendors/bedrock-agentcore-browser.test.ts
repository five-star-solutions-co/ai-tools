import { describe, expect, test } from 'bun:test'

import { validateModule } from '../../src/core'
import {
	BedrockAgentCoreBrowserClient,
	bedrockAgentCoreBrowserModule
} from '../../src/vendors/bedrock-agentcore-browser'

function requestUrl(input: RequestInfo | URL): string {
	if (typeof input === 'string') return input
	if (input instanceof URL) return input.href
	if (input instanceof Request) return input.url
	return String(input)
}

function mockFetch(handler: (input: RequestInfo | URL, init?: RequestInit) => Response | Promise<Response>) {
	const original = globalThis.fetch
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) =>
		handler(input, init)) as typeof globalThis.fetch
	return () => {
		globalThis.fetch = original
	}
}

const auth = {
	access_key_id: 'AKIAtest',
	secret_access_key: 'secret',
	region: 'us-west-2'
} as const

describe('bedrock-agentcore-browser', () => {
	test('module contracts', () => {
		expect(validateModule(bedrockAgentCoreBrowserModule).ok).toBe(true)
		expect(bedrockAgentCoreBrowserModule.tools.map((t) => t.id).sort()).toEqual([
			'bedrock-agentcore-browser-get-session',
			'bedrock-agentcore-browser-start-session',
			'bedrock-agentcore-browser-stop-session'
		])
	})

	test('start session maps stream endpoints', async () => {
		const restore = mockFetch(async (input) => {
			const url = requestUrl(input)
			expect(url).toContain('/browsers/aws.browser.v1/sessions/start')
			return new Response(
				JSON.stringify({
					sessionId: 'b1',
					browserIdentifier: 'aws.browser.v1',
					streams: {
						automationStream: { streamEndpoint: 'wss://auto.example', streamStatus: 'ENABLED' },
						liveViewStream: { streamEndpoint: 'https://live.example' }
					}
				}),
				{ status: 200, headers: { 'content-type': 'application/json' } }
			)
		})
		try {
			const client = new BedrockAgentCoreBrowserClient(auth)
			const session = await client.startSession({})
			expect(session.session_id).toBe('b1')
			expect(session.streams?.automation_stream_endpoint).toBe('wss://auto.example')
			expect(session.streams?.live_view_stream_endpoint).toBe('https://live.example')
		} finally {
			restore()
		}
	})
})
