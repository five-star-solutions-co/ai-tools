import { describe, expect, test } from 'bun:test'
import { isPlainObject } from 'es-toolkit'

import { validateModule } from '../../src/core'
import { CodeSandboxClient, codeSandboxModule } from '../../src/modules/code-sandbox'

function asRecord(value: unknown): Record<string, unknown> {
	if (!isPlainObject(value)) throw new Error('expected object')
	return value
}

function asRequest(input: RequestInfo | URL, init?: RequestInit): Request {
	return input instanceof Request ? input : new Request(input, init)
}

function mockFetch(handler: (input: RequestInfo | URL, init?: RequestInit) => Response | Promise<Response>) {
	const original = globalThis.fetch
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) =>
		handler(input, init)) as typeof globalThis.fetch
	return () => {
		globalThis.fetch = original
	}
}

describe('code-sandbox', () => {
	test('module contracts and capability tool ids', () => {
		expect(validateModule(codeSandboxModule).ok).toBe(true)
		expect(codeSandboxModule.tools.map((t) => t.id).sort()).toEqual([
			'code-sandbox-execute-code',
			'code-sandbox-execute-command',
			'code-sandbox-get-session',
			'code-sandbox-list-files',
			'code-sandbox-read-files',
			'code-sandbox-remove-files',
			'code-sandbox-start-session',
			'code-sandbox-stop-session',
			'code-sandbox-write-files'
		])
	})

	test('cloudflare provider lifecycle and execute', async () => {
		const restore = mockFetch(async (input, init) => {
			const req = asRequest(input, init)
			const url = req.url
			const method = req.method.toUpperCase()
			if (url.endsWith('/v1/sandbox') && method === 'POST') {
				return Response.json({ id: 'sbx-9' })
			}
			if (url.includes('/running') && method === 'GET') {
				return Response.json({ running: true })
			}
			if (url.includes('/exec') && method === 'POST') {
				const body = asRecord(JSON.parse(await req.text()))
				expect(Array.isArray(body['argv'])).toBe(true)
				const stream = [
					'event: stdout',
					`data: ${Buffer.from('ok\n').toString('base64')}`,
					'',
					'event: exit',
					'data: {"exit_code":0}',
					''
				].join('\n')
				return new Response(stream, {
					status: 200,
					headers: { 'content-type': 'text/event-stream' }
				})
			}
			if (url.includes('/file/') && method === 'PUT') {
				return Response.json({ ok: true })
			}
			if (url.includes('/file/') && method === 'GET') {
				return new Response('x = 1', { status: 200 })
			}
			if (url.includes('/v1/sandbox/sbx-9') && method === 'DELETE') {
				return new Response(null, { status: 204 })
			}
			return new Response(`unexpected ${method} ${url}`, { status: 500 })
		})
		try {
			const client = CodeSandboxClient.fromAuth({
				provider: 'cloudflare',
				base_url: 'https://bridge.example',
				api_key: 'k'
			})
			const started = await client.startSession()
			expect(started.session_id).toBe('sbx-9')
			expect((await client.getSession({ session_id: 'sbx-9' })).running).toBe(true)
			const code = await client.executeCode({ session_id: 'sbx-9', code: 'print(1)' })
			expect(code.success).toBe(true)
			expect(code.stdout).toBe('ok\n')
			await client.writeFiles({
				session_id: 'sbx-9',
				files: [{ path: 'a.py', text: 'x = 1' }]
			})
			const read = await client.readFiles({ session_id: 'sbx-9', paths: ['a.py'] })
			expect(read.files[0]?.text).toBe('x = 1')
			expect((await client.stopSession({ session_id: 'sbx-9' })).running).toBe(false)
		} finally {
			restore()
		}
	})

	test('bedrock-agentcore provider maps session and executeCode', async () => {
		const restore = mockFetch(async (input, init) => {
			const req = asRequest(input, init)
			const url = req.url
			const method = req.method.toUpperCase()
			if (url.includes('/sessions/start') && method === 'PUT') {
				return Response.json({ sessionId: 'aws-1', status: 'READY' })
			}
			if (url.includes('/tools/invoke') && method === 'POST') {
				const body = asRecord(JSON.parse(await req.text()))
				expect(body['name']).toBe('executeCode')
				return Response.json({ result: { stdout: '7\n', exitCode: 0 } })
			}
			if (url.includes('/sessions/stop') && method === 'PUT') {
				return Response.json({ sessionId: 'aws-1', status: 'TERMINATED' })
			}
			return new Response(`unexpected ${method} ${url}`, { status: 500 })
		})
		try {
			const client = CodeSandboxClient.fromAuth({
				provider: 'bedrock-agentcore',
				access_key_id: 'AKIAtest',
				secret_access_key: 'secret',
				region: 'us-east-1'
			})
			const started = await client.startSession({ name: 'it' })
			expect(started.session_id).toBe('aws-1')
			const code = await client.executeCode({ session_id: 'aws-1', code: 'print(7)' })
			expect(code.stdout).toBe('7\n')
			await client.stopSession({ session_id: 'aws-1' })
		} finally {
			restore()
		}
	})
})
