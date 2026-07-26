import { describe, expect, test } from 'bun:test'
import { isPlainObject } from 'es-toolkit'

import { validateModule } from '../../src/core'
import {
	BedrockAgentCoreCodeInterpreterClient,
	bedrockAgentCoreCodeInterpreterModule
} from '../../src/vendors/bedrock-agentcore-code-interpreter'

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
	access_key_id: 'AKIAtest',
	secret_access_key: 'secret',
	region: 'us-east-1'
} as const

describe('bedrock-agentcore-code-interpreter', () => {
	test('module contracts', () => {
		expect(validateModule(bedrockAgentCoreCodeInterpreterModule).ok).toBe(true)
		expect(bedrockAgentCoreCodeInterpreterModule.tools.length).toBe(12)
	})

	test('start session and execute code', async () => {
		const restore = mockFetch(async (input, init) => {
			const req = asRequest(input, init)
			const url = req.url
			const method = req.method.toUpperCase()
			if (url.includes('/sessions/start') && method === 'PUT') {
				return new Response(
					JSON.stringify({ sessionId: 'sess1', codeInterpreterIdentifier: 'aws.codeinterpreter.v1' }),
					{
						status: 200,
						headers: { 'content-type': 'application/json' }
					}
				)
			}
			if (url.includes('/tools/invoke') && method === 'POST') {
				const body = asRecord(JSON.parse(await req.text()))
				expect(body['name']).toBe('executeCode')
				return new Response(JSON.stringify({ result: { stdout: 'hi' } }), {
					status: 200,
					headers: { 'content-type': 'application/json' }
				})
			}
			return new Response(`unexpected ${method} ${url}`, { status: 500 })
		})
		try {
			const client = new BedrockAgentCoreCodeInterpreterClient(auth)
			const session = await client.startSession({ name: 't' })
			expect(session.session_id).toBe('sess1')
			const exec = await client.executeCode({ session_id: 'sess1', code: 'print(1)' })
			expect(asRecord(exec.result as object)['stdout']).toBe('hi')
		} finally {
			restore()
		}
	})

	test('get/stop session and file/command/task invokes', async () => {
		const invokes: string[] = []
		const restore = mockFetch(async (input, init) => {
			const req = asRequest(input, init)
			const url = req.url
			const method = req.method.toUpperCase()
			if (url.includes('/sessions/get') && method === 'GET') {
				return new Response(JSON.stringify({ sessionId: 'sess1', status: 'READY' }), {
					status: 200,
					headers: { 'content-type': 'application/json' }
				})
			}
			if (url.includes('/sessions/stop') && method === 'PUT') {
				return new Response(JSON.stringify({ sessionId: 'sess1', status: 'TERMINATED' }), {
					status: 200,
					headers: { 'content-type': 'application/json' }
				})
			}
			if (url.includes('/tools/invoke') && method === 'POST') {
				const body = asRecord(JSON.parse(await req.text()))
				const name = String(body['name'])
				invokes.push(name)
				expect(req.headers.get('x-amzn-code-interpreter-session-id')).toBe('sess1')
				if (name === 'startCommandExecution') {
					return new Response(JSON.stringify({ result: { taskId: 'task-9' } }), {
						status: 200,
						headers: { 'content-type': 'application/json' }
					})
				}
				return new Response(JSON.stringify({ result: { ok: true, name } }), {
					status: 200,
					headers: { 'content-type': 'application/json' }
				})
			}
			return new Response(`unexpected ${method} ${url}`, { status: 500 })
		})
		try {
			const client = new BedrockAgentCoreCodeInterpreterClient(auth)
			expect((await client.getSession({ session_id: 'sess1' })).status).toBe('READY')
			await client.executeCommand({ session_id: 'sess1', command: 'echo hi' })
			await client.writeFiles({ session_id: 'sess1', files: [{ path: '/tmp/a.txt', text: 'x' }] })
			await client.listFiles({ session_id: 'sess1', directory_path: '/tmp' })
			await client.readFiles({ session_id: 'sess1', paths: ['/tmp/a.txt'] })
			await client.removeFiles({ session_id: 'sess1', paths: ['/tmp/a.txt'] })
			const started = await client.startCommand({ session_id: 'sess1', command: 'sleep 1' })
			expect(asRecord(started.result as object)?.['taskId']).toBe('task-9')
			await client.getTask({ session_id: 'sess1', task_id: 'task-9' })
			await client.stopTask({ session_id: 'sess1', task_id: 'task-9' })
			expect((await client.stopSession({ session_id: 'sess1' })).status).toBe('TERMINATED')
			expect(invokes).toEqual([
				'executeCommand',
				'writeFiles',
				'listFiles',
				'readFiles',
				'removeFiles',
				'startCommandExecution',
				'getTask',
				'stopTask'
			])
		} finally {
			restore()
		}
	})
})
