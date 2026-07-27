import { isPlainObject, isString } from 'es-toolkit'

import type { HttpServiceOptions } from '../../../transport/http-service'
import { BedrockAgentCoreCodeInterpreterClient } from '../../../vendors/bedrock-agentcore-code-interpreter'
import type {
	AgentCoreCodeSandboxAuth,
	CodeSandboxExecResult,
	CodeSandboxExecuteCodeInput,
	CodeSandboxExecuteCommandInput,
	CodeSandboxListFilesInput,
	CodeSandboxListFilesOutput,
	CodeSandboxOps,
	CodeSandboxReadFilesInput,
	CodeSandboxReadFilesOutput,
	CodeSandboxRemoveFilesInput,
	CodeSandboxSessionIdInput,
	CodeSandboxSessionOutput,
	CodeSandboxStartSessionInput,
	CodeSandboxWriteFilesInput
} from '../contracts'

export type AgentCoreCodeSandboxProviderOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'>

export class AgentCoreCodeSandboxProvider implements CodeSandboxOps {
	readonly #client: BedrockAgentCoreCodeInterpreterClient

	constructor(auth: AgentCoreCodeSandboxAuth, options: AgentCoreCodeSandboxProviderOptions = {}) {
		const { provider: _provider, ...vendorAuth } = auth
		this.#client = new BedrockAgentCoreCodeInterpreterClient(vendorAuth, options)
	}

	async startSession(input: CodeSandboxStartSessionInput = {}): Promise<CodeSandboxSessionOutput> {
		const out = await this.#client.startSession({
			...(input.name && { name: input.name }),
			...(input.session_timeout_seconds !== undefined && {
				session_timeout_seconds: input.session_timeout_seconds
			})
		})
		return {
			session_id: out.session_id,
			...(out.status && { status: out.status }),
			running: true
		}
	}

	async getSession(input: CodeSandboxSessionIdInput): Promise<CodeSandboxSessionOutput> {
		const out = await this.#client.getSession({ session_id: input.session_id })
		return {
			session_id: out.session_id,
			...(out.status && { status: out.status }),
			running: out.status ? out.status.toUpperCase() !== 'TERMINATED' : true
		}
	}

	async stopSession(input: CodeSandboxSessionIdInput): Promise<CodeSandboxSessionOutput> {
		const out = await this.#client.stopSession({ session_id: input.session_id })
		return {
			session_id: out.session_id,
			...(out.status && { status: out.status }),
			running: false
		}
	}

	async executeCode(input: CodeSandboxExecuteCodeInput): Promise<CodeSandboxExecResult> {
		const out = await this.#client.executeCode({
			session_id: input.session_id,
			code: input.code,
			...(input.language && { language: input.language })
		})
		return mapInvoke(input.session_id, out.result, out.raw)
	}

	async executeCommand(input: CodeSandboxExecuteCommandInput): Promise<CodeSandboxExecResult> {
		const out = await this.#client.executeCommand({
			session_id: input.session_id,
			command: input.command
		})
		return mapInvoke(input.session_id, out.result, out.raw)
	}

	async writeFiles(input: CodeSandboxWriteFilesInput) {
		await this.#client.writeFiles({
			session_id: input.session_id,
			files: input.files
		})
		return {
			session_id: input.session_id,
			paths: input.files.map((f) => f.path),
			ok: true as const
		}
	}

	async readFiles(input: CodeSandboxReadFilesInput): Promise<CodeSandboxReadFilesOutput> {
		const out = await this.#client.readFiles({
			session_id: input.session_id,
			paths: input.paths
		})
		const files = extractFiles(out.result ?? out.raw, input.paths)
		return { session_id: input.session_id, files }
	}

	async listFiles(input: CodeSandboxListFilesInput): Promise<CodeSandboxListFilesOutput> {
		const out = await this.#client.listFiles({
			session_id: input.session_id,
			...(input.directory_path !== undefined && { directory_path: input.directory_path })
		})
		const paths = extractPaths(out.result ?? out.raw)
		return { session_id: input.session_id, paths, raw: out.result ?? out.raw }
	}

	async removeFiles(input: CodeSandboxRemoveFilesInput) {
		await this.#client.removeFiles({
			session_id: input.session_id,
			paths: input.paths
		})
		return { session_id: input.session_id, paths: input.paths, ok: true as const }
	}
}

function mapInvoke(session_id: string, result: unknown, raw: unknown): CodeSandboxExecResult {
	const out: CodeSandboxExecResult = { session_id, result: result ?? raw, success: true }
	if (isPlainObject(result)) {
		if (isString(result['stdout'])) out.stdout = result['stdout']
		if (isString(result['stderr'])) out.stderr = result['stderr']
		if (typeof result['exitCode'] === 'number') out.exit_code = result['exitCode']
		if (typeof result['exit_code'] === 'number') out.exit_code = result['exit_code']
		if (typeof result['success'] === 'boolean') out.success = result['success']
	}
	return out
}

function extractFiles(payload: unknown, fallbackPaths: string[]): { path: string; text: string }[] {
	if (isPlainObject(payload)) {
		const content = payload['content'] ?? payload['files']
		if (Array.isArray(content)) {
			const files: { path: string; text: string }[] = []
			for (const row of content) {
				if (!isPlainObject(row)) continue
				const path = row['path']
				const text = row['text'] ?? row['content'] ?? ''
				if (isString(path) && isString(text)) files.push({ path, text })
			}
			if (files.length > 0) return files
		}
	}
	// Best-effort: single string body for first path
	if (isString(payload) && fallbackPaths[0]) {
		return [{ path: fallbackPaths[0], text: payload }]
	}
	return fallbackPaths.map((path) => ({ path, text: '' }))
}

function extractPaths(payload: unknown): string[] {
	if (!isPlainObject(payload)) return []
	const list = payload['files'] ?? payload['paths'] ?? payload['entries']
	if (!Array.isArray(list)) return []
	const paths: string[] = []
	for (const row of list) {
		if (isString(row)) {
			paths.push(row)
			continue
		}
		if (isPlainObject(row)) {
			const path = row['path'] ?? row['name']
			if (isString(path)) paths.push(path)
		}
	}
	return paths
}
