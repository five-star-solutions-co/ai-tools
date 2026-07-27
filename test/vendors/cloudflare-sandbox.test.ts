import { describe, expect, test } from 'bun:test'
import { isPlainObject } from 'es-toolkit'

import { validateModule } from '../../src/core'
import {
	CloudflareSandboxClient,
	cloudflareSandboxModule,
	parseExecSse,
	workspaceFileKey
} from '../../src/vendors/cloudflare-sandbox'

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

const auth = {
	base_url: 'https://sandbox-bridge.example.workers.dev',
	api_key: 'test-key'
} as const

describe('cloudflare-sandbox', () => {
	test('module contracts and tool ids', () => {
		expect(validateModule(cloudflareSandboxModule).ok).toBe(true)
		expect(cloudflareSandboxModule.tools.map((t) => t.id).sort()).toEqual([
			'cloudflare-sandbox-create',
			'cloudflare-sandbox-create-session',
			'cloudflare-sandbox-delete-session',
			'cloudflare-sandbox-destroy',
			'cloudflare-sandbox-exec',
			'cloudflare-sandbox-execute-code',
			'cloudflare-sandbox-health',
			'cloudflare-sandbox-read-file',
			'cloudflare-sandbox-read-files',
			'cloudflare-sandbox-running',
			'cloudflare-sandbox-write-file',
			'cloudflare-sandbox-write-files'
		])
	})

	test('workspaceFileKey and parseExecSse helpers', () => {
		expect(workspaceFileKey('hello.py')).toBe('workspace/hello.py')
		expect(workspaceFileKey('/workspace/a/b.txt')).toBe('workspace/a/b.txt')
		expect(() => workspaceFileKey('../etc/passwd')).toThrow()

		const sse = [
			'event: stdout',
			`data: ${Buffer.from('hello\n').toString('base64')}`,
			'',
			'event: stderr',
			`data: ${Buffer.from('warn\n').toString('base64')}`,
			'',
			'event: exit',
			'data: {"exit_code":0}',
			''
		].join('\n')
		const parsed = parseExecSse(sse)
		expect(parsed.stdout).toBe('hello\n')
		expect(parsed.stderr).toBe('warn\n')
		expect(parsed.exit_code).toBe(0)
	})

	test('create, exec SSE, write/read, destroy', async () => {
		const restore = mockFetch(async (input, init) => {
			const req = asRequest(input, init)
			const url = req.url
			const method = req.method.toUpperCase()
			expect(req.headers.get('Authorization')).toBe('Bearer test-key')

			if (url.endsWith('/health') && method === 'GET') {
				return Response.json({ ok: true })
			}
			if (url.endsWith('/v1/sandbox') && method === 'POST') {
				return Response.json({ id: 'sbx-1' })
			}
			if (url.includes('/v1/sandbox/sbx-1/running') && method === 'GET') {
				return Response.json({ running: true })
			}
			if (url.includes('/v1/sandbox/sbx-1/exec') && method === 'POST') {
				const body = asRecord(JSON.parse(await req.text()))
				expect(body['argv']).toEqual(['python3', '-c', 'print(42)'])
				const stream = [
					'event: stdout',
					`data: ${Buffer.from('42\n').toString('base64')}`,
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
			if (url.includes('/file/workspace/hi.py') && method === 'PUT') {
				expect(await req.text()).toBe('print(1)')
				return Response.json({ ok: true })
			}
			if (url.includes('/file/workspace/hi.py') && method === 'GET') {
				return new Response('print(1)', {
					status: 200,
					headers: { 'content-type': 'application/octet-stream' }
				})
			}
			if (url.endsWith('/v1/sandbox/sbx-1') && method === 'DELETE') {
				return new Response(null, { status: 204 })
			}
			return new Response(`unexpected ${method} ${url}`, { status: 500 })
		})
		try {
			const client = new CloudflareSandboxClient(auth)
			expect(await client.health()).toEqual({ ok: true })
			expect(await client.create()).toEqual({ sandbox_id: 'sbx-1' })
			expect(await client.running({ sandbox_id: 'sbx-1' })).toEqual({
				sandbox_id: 'sbx-1',
				running: true
			})
			const exec = await client.executeCode({
				sandbox_id: 'sbx-1',
				code: 'print(42)',
				language: 'python'
			})
			expect(exec.success).toBe(true)
			expect(exec.stdout).toBe('42\n')
			expect(exec.exit_code).toBe(0)

			expect(await client.writeFile({ sandbox_id: 'sbx-1', path: 'hi.py', text: 'print(1)' })).toEqual({
				sandbox_id: 'sbx-1',
				path: 'hi.py',
				ok: true
			})
			expect(await client.readFile({ sandbox_id: 'sbx-1', path: 'hi.py' })).toEqual({
				sandbox_id: 'sbx-1',
				path: 'hi.py',
				text: 'print(1)'
			})
			expect(await client.destroy({ sandbox_id: 'sbx-1' })).toEqual({
				sandbox_id: 'sbx-1',
				destroyed: true
			})
		} finally {
			restore()
		}
	})
})
