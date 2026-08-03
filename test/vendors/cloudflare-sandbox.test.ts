import { describe, expect, test } from 'bun:test'
import { isPlainObject } from 'es-toolkit'

import { isToolError, validateModule } from '../../src/core'
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
			'cloudflare-sandbox-export-artifact',
			'cloudflare-sandbox-health',
			'cloudflare-sandbox-import-artifact',
			'cloudflare-sandbox-list-files',
			'cloudflare-sandbox-read-file',
			'cloudflare-sandbox-read-files',
			'cloudflare-sandbox-remove-files',
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
				ok: true,
				byte_length: 8
			})
			expect(await client.readFile({ sandbox_id: 'sbx-1', path: 'hi.py' })).toEqual({
				sandbox_id: 'sbx-1',
				path: 'hi.py',
				text: 'print(1)',
				byte_length: 8
			})
			expect(await client.destroy({ sandbox_id: 'sbx-1' })).toEqual({
				sandbox_id: 'sbx-1',
				destroyed: true
			})
		} finally {
			restore()
		}
	})

	test('write/read body_base64 binary', async () => {
		const payload = new Uint8Array([0, 1, 2, 255])
		const b64 = Buffer.from(payload).toString('base64')
		const restore = mockFetch(async (input, init) => {
			const req = asRequest(input, init)
			const url = req.url
			const method = req.method.toUpperCase()
			if (url.includes('/file/workspace/bin.dat') && method === 'PUT') {
				const buf = new Uint8Array(await req.arrayBuffer())
				expect([...buf]).toEqual([0, 1, 2, 255])
				return Response.json({ ok: true })
			}
			if (url.includes('/file/workspace/bin.dat') && method === 'GET') {
				return new Response(payload, {
					status: 200,
					headers: { 'content-type': 'application/octet-stream' }
				})
			}
			return new Response(`unexpected ${method} ${url}`, { status: 500 })
		})
		try {
			const client = new CloudflareSandboxClient(auth)
			const written = await client.writeFile({
				sandbox_id: 'sbx-1',
				path: 'bin.dat',
				body_base64: b64
			})
			expect(written.byte_length).toBe(4)
			const read = await client.readFile({
				sandbox_id: 'sbx-1',
				path: 'bin.dat',
				encoding: 'base64'
			})
			expect(read.body_base64).toBe(b64)
			expect(read.byte_length).toBe(4)
			expect(read.text).toBeUndefined()
		} finally {
			restore()
		}
	})

	test('importArtifact and exportArtifact use bound storage', async () => {
		const fileBytes = new Uint8Array([9, 8, 7])
		const restore = mockFetch(async (input, init) => {
			const req = asRequest(input, init)
			const url = req.url
			const method = req.method.toUpperCase()
			// S3 get for import
			if (url.includes('example.r2.cloudflarestorage.com') && method === 'GET' && url.includes('in.bin')) {
				return new Response(fileBytes, { status: 200 })
			}
			// S3 put for export
			if (url.includes('example.r2.cloudflarestorage.com') && method === 'PUT' && url.includes('out.bin')) {
				const buf = new Uint8Array(await req.arrayBuffer())
				expect([...buf]).toEqual([9, 8, 7])
				return new Response(null, { status: 200 })
			}
			// sandbox file
			if (url.includes('/file/workspace/work.bin') && method === 'PUT') {
				const buf = new Uint8Array(await req.arrayBuffer())
				expect([...buf]).toEqual([9, 8, 7])
				return Response.json({ ok: true })
			}
			if (url.includes('/file/workspace/work.bin') && method === 'GET') {
				return new Response(fileBytes, { status: 200 })
			}
			// S3 Head often used by getBytes bounded path - return content-length
			if (url.includes('example.r2.cloudflarestorage.com') && method === 'HEAD') {
				return new Response(null, { status: 200, headers: { 'content-length': '3' } })
			}
			return new Response(`unexpected ${method} ${url}`, { status: 500 })
		})
		try {
			const client = new CloudflareSandboxClient({
				...auth,
				storage: {
					access_key_id: 'AKIA',
					secret_access_key: 'secret',
					region: 'auto',
					bucket: 'bkt',
					endpoint: 'https://example.r2.cloudflarestorage.com'
				}
			})
			const imported = await client.importArtifact({
				sandbox_id: 'sbx-1',
				path: 'work.bin',
				source: { store: 'object', key: 'in.bin' }
			})
			expect(imported).toEqual({
				sandbox_id: 'sbx-1',
				path: 'work.bin',
				ok: true,
				byte_length: 3
			})
			const exported = await client.exportArtifact({
				sandbox_id: 'sbx-1',
				path: 'work.bin',
				destination_key: 'out.bin'
			})
			expect(exported.artifact).toEqual({
				store: 'object',
				key: 'out.bin',
				byte_length: 3
			})
		} finally {
			restore()
		}
	})

	test('mount and unmount call bridge bucket mount endpoints', async () => {
		const bodies: Array<{ method: string; path: string; body: Record<string, unknown> }> = []
		const restore = mockFetch(async (input, init) => {
			const req = asRequest(input, init)
			const url = new URL(req.url)
			const method = req.method.toUpperCase()
			expect(req.headers.get('Authorization')).toBe('Bearer test-key')
			if (method === 'POST' && url.pathname.endsWith('/mount')) {
				const body = asRecord(JSON.parse(await req.text()))
				bodies.push({ method, path: url.pathname, body })
				return Response.json({ ok: true })
			}
			if (method === 'POST' && url.pathname.endsWith('/unmount')) {
				const body = asRecord(JSON.parse(await req.text()))
				bodies.push({ method, path: url.pathname, body })
				return Response.json({ ok: true })
			}
			return new Response(`unexpected ${method} ${url.pathname}`, { status: 500 })
		})
		try {
			const client = new CloudflareSandboxClient(auth)
			const mounted = await client.mount({
				sandbox_id: 'sbx-1',
				bucket: 'workspace',
				mount_path: '/data',
				endpoint: 'https://example.r2.cloudflarestorage.com',
				provider: 'r2',
				access_key_id: 'AKIA',
				secret_access_key: 'secret',
				prefix: '/agents/run-1/',
				read_only: true,
				credential_proxy: true
			})
			expect(mounted).toEqual({
				sandbox_id: 'sbx-1',
				bucket: 'workspace',
				mount_path: '/data',
				ok: true
			})
			const unmounted = await client.unmount({ sandbox_id: 'sbx-1', mount_path: '/data' })
			expect(unmounted).toEqual({ sandbox_id: 'sbx-1', mount_path: '/data', ok: true })

			expect(bodies).toHaveLength(2)
			expect(bodies[0]?.path).toBe('/v1/sandbox/sbx-1/mount')
			expect(bodies[0]?.body).toEqual({
				bucket: 'workspace',
				mountPath: '/data',
				options: {
					endpoint: 'https://example.r2.cloudflarestorage.com',
					provider: 'r2',
					readOnly: true,
					prefix: '/agents/run-1/',
					credentialProxy: true,
					credentials: {
						accessKeyId: 'AKIA',
						secretAccessKey: 'secret'
					}
				}
			})
			expect(bodies[1]?.path).toBe('/v1/sandbox/sbx-1/unmount')
			expect(bodies[1]?.body).toEqual({ mountPath: '/data' })
		} finally {
			restore()
		}
	})

	test('mount falls back to auth.storage credentials when endpoint is set', async () => {
		let mountBody: Record<string, unknown> | undefined
		const restore = mockFetch(async (input, init) => {
			const req = asRequest(input, init)
			const url = new URL(req.url)
			if (req.method.toUpperCase() === 'POST' && url.pathname.endsWith('/mount')) {
				mountBody = asRecord(JSON.parse(await req.text()))
				return Response.json({ ok: true })
			}
			return new Response('unexpected', { status: 500 })
		})
		try {
			const client = new CloudflareSandboxClient({
				...auth,
				storage: {
					access_key_id: 'FROM_STORAGE',
					secret_access_key: 'STORAGE_SECRET',
					region: 'auto',
					bucket: 'workspace',
					endpoint: 'https://storage.example.com'
				}
			})
			// Mastra workspace S3: pass endpoint (or storage.endpoint), keys fall back from auth.storage
			await client.mount({
				sandbox_id: 'sbx-1',
				bucket: 'workspace',
				mount_path: '/workspace-s3',
				endpoint: 'https://storage.example.com',
				provider: 'r2'
			})
			expect(mountBody).toEqual({
				bucket: 'workspace',
				mountPath: '/workspace-s3',
				options: {
					endpoint: 'https://storage.example.com',
					provider: 'r2',
					credentials: {
						accessKeyId: 'FROM_STORAGE',
						secretAccessKey: 'STORAGE_SECRET'
					}
				}
			})
		} finally {
			restore()
		}
	})

	test('mount R2 binding mode omits endpoint and credentials', async () => {
		let mountBody: Record<string, unknown> | undefined
		const restore = mockFetch(async (input, init) => {
			const req = asRequest(input, init)
			const url = new URL(req.url)
			if (req.method.toUpperCase() === 'POST' && url.pathname.endsWith('/mount')) {
				mountBody = asRecord(JSON.parse(await req.text()))
				return Response.json({ ok: true })
			}
			return new Response('unexpected', { status: 500 })
		})
		try {
			const client = new CloudflareSandboxClient(auth)
			await client.mount({
				sandbox_id: 'sbx-1',
				bucket: 'MY_BUCKET',
				mount_path: '/data'
			})
			expect(mountBody).toEqual({
				bucket: 'MY_BUCKET',
				mountPath: '/data'
			})
		} finally {
			restore()
		}
	})

	test('mount rejects relative mount_path and local_bucket+endpoint', async () => {
		const client = new CloudflareSandboxClient(auth)
		try {
			await client.mount({
				sandbox_id: 'sbx-1',
				bucket: 'b',
				mount_path: 'data'
			})
			expect.unreachable()
		} catch (error) {
			expect(isToolError(error) && error.code === 'bad_input').toBe(true)
		}
		try {
			await client.mount({
				sandbox_id: 'sbx-1',
				bucket: 'b',
				mount_path: '/data',
				local_bucket: true,
				endpoint: 'https://s3.amazonaws.com'
			})
			expect.unreachable()
		} catch (error) {
			expect(isToolError(error) && error.code === 'bad_input').toBe(true)
		}
	})

	test('importArtifact without storage is bad_auth', async () => {
		const client = new CloudflareSandboxClient(auth)
		try {
			await client.importArtifact({
				sandbox_id: 'sbx-1',
				path: 'a.bin',
				source: { store: 'object', key: 'k' }
			})
			expect.unreachable()
		} catch (error) {
			expect(isToolError(error) && error.code === 'bad_auth').toBe(true)
		}
	})
})
