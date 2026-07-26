import { describe, expect, test } from 'bun:test'
import { isPlainObject, isString } from 'es-toolkit'

import { BedrockAgentCoreCodeInterpreterClient } from '../../../src/vendors/bedrock-agentcore-code-interpreter'
import { awsCredentialsFromEnv, env, sleep } from '../env'

const aws = awsCredentialsFromEnv()
const interpreterId = env('AI_TOOLS_AWS_CODE_INTERPRETER_ID')
const run = aws ? describe : describe.skip

function client() {
	return new BedrockAgentCoreCodeInterpreterClient({
		access_key_id: aws!.access_key_id,
		secret_access_key: aws!.secret_access_key,
		region: aws!.region,
		...(aws!.session_token && { session_token: aws!.session_token }),
		...(interpreterId && { code_interpreter_id: interpreterId })
	})
}

function taskIdFrom(result: unknown): string | undefined {
	if (!isPlainObject(result)) return undefined
	if (isString(result['taskId'])) return result['taskId']
	if (isString(result['task_id'])) return result['task_id']
	const nested = result['result']
	if (isPlainObject(nested)) {
		if (isString(nested['taskId'])) return nested['taskId']
		if (isString(nested['task_id'])) return nested['task_id']
	}
	return undefined
}

run('live vendor bedrock-agentcore-code-interpreter', () => {
	test(
		'full session: get, executeCode, executeCommand, files, async task',
		async () => {
			const c = client()
			const started = await c.startSession({
				name: 'ai-tools-it-full',
				session_timeout_seconds: 600
			})
			const session_id = started.session_id
			expect(session_id.length).toBeGreaterThan(0)

			try {
				const got = await c.getSession({ session_id })
				expect(got.session_id).toBe(session_id)

				const code = await c.executeCode({
					session_id,
					code: 'print(40 + 2)',
					language: 'python'
				})
				expect(code.name).toBe('executeCode')
				expect(code.session_id).toBe(session_id)

				const cmd = await c.executeCommand({
					session_id,
					command: 'echo ai-tools-it'
				})
				expect(cmd.name).toBe('executeCommand')

				const path = '/tmp/ai-tools-it.txt'
				const written = await c.writeFiles({
					session_id,
					files: [{ path, text: 'hello-from-ai-tools\n' }]
				})
				expect(written.name).toBe('writeFiles')

				const listed = await c.listFiles({ session_id, directory_path: '/tmp' })
				expect(listed.name).toBe('listFiles')

				const read = await c.readFiles({ session_id, paths: [path] })
				expect(read.name).toBe('readFiles')

				const removed = await c.removeFiles({ session_id, paths: [path] })
				expect(removed.name).toBe('removeFiles')

				// Long-running command → getTask (and stopTask if still running).
				const startedCmd = await c.startCommand({
					session_id,
					command: 'sleep 30'
				})
				expect(startedCmd.name).toBe('startCommandExecution')
				const task_id = taskIdFrom(startedCmd.result) ?? taskIdFrom(startedCmd.raw)
				if (task_id) {
					const polled = await c.getTask({ session_id, task_id })
					expect(polled.name).toBe('getTask')
					await c.stopTask({ session_id, task_id }).catch(() => undefined)
					await sleep(500)
				}
			} finally {
				await c.stopSession({ session_id }).catch(() => undefined)
			}
		},
		{ timeout: 180_000 }
	)
})
