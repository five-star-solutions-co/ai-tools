import { ToolError } from '../../../core/errors'
import type { HttpServiceOptions } from '../../../transport/http-service'
import { CloudflareSandboxClient } from '../../../vendors/cloudflare-sandbox'
import type {
	CodeSandboxExecResult,
	CodeSandboxExecuteCodeInput,
	CodeSandboxExecuteCommandInput,
	CodeSandboxListFilesInput,
	CodeSandboxListFilesOutput,
	CodeSandboxOps,
	CodeSandboxReadFilesInput,
	CodeSandboxRemoveFilesInput,
	CodeSandboxSessionIdInput,
	CodeSandboxSessionOutput,
	CodeSandboxStartSessionInput,
	CodeSandboxWriteFilesInput,
	CloudflareCodeSandboxAuth
} from '../contracts'

export type CloudflareCodeSandboxProviderOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'>

export class CloudflareCodeSandboxProvider implements CodeSandboxOps {
	readonly #client: CloudflareSandboxClient

	constructor(auth: CloudflareCodeSandboxAuth, options: CloudflareCodeSandboxProviderOptions = {}) {
		const { provider: _provider, ...vendorAuth } = auth
		this.#client = new CloudflareSandboxClient(vendorAuth, options)
	}

	async startSession(_input: CodeSandboxStartSessionInput = {}): Promise<CodeSandboxSessionOutput> {
		// Bridge create has no name/timeout fields; ignore optional start metadata.
		const created = await this.#client.create()
		return { session_id: created.sandbox_id, status: 'running', running: true }
	}

	async getSession(input: CodeSandboxSessionIdInput): Promise<CodeSandboxSessionOutput> {
		const row = await this.#client.running({ sandbox_id: input.session_id })
		return {
			session_id: input.session_id,
			running: row.running,
			status: row.running ? 'running' : 'stopped'
		}
	}

	async stopSession(input: CodeSandboxSessionIdInput): Promise<CodeSandboxSessionOutput> {
		await this.#client.destroy({ sandbox_id: input.session_id })
		return { session_id: input.session_id, status: 'stopped', running: false }
	}

	async executeCode(input: CodeSandboxExecuteCodeInput): Promise<CodeSandboxExecResult> {
		const language = normalizeLanguage(input.language)
		const out = await this.#client.executeCode({
			sandbox_id: input.session_id,
			code: input.code,
			language
		})
		return mapExec(input.session_id, out)
	}

	async executeCommand(input: CodeSandboxExecuteCommandInput): Promise<CodeSandboxExecResult> {
		const out = await this.#client.exec({
			sandbox_id: input.session_id,
			argv: ['sh', '-lc', input.command]
		})
		return mapExec(input.session_id, out)
	}

	async writeFiles(input: CodeSandboxWriteFilesInput) {
		const out = await this.#client.writeFiles({
			sandbox_id: input.session_id,
			files: input.files
		})
		return { session_id: input.session_id, paths: out.paths, ok: true as const }
	}

	async readFiles(input: CodeSandboxReadFilesInput) {
		const out = await this.#client.readFiles({
			sandbox_id: input.session_id,
			paths: input.paths
		})
		// Seam contract is utf-8 text only; vendor defaults encoding to utf8.
		return {
			session_id: input.session_id,
			files: out.files.map((file) => ({
				path: file.path,
				text: file.text ?? ''
			}))
		}
	}

	async listFiles(input: CodeSandboxListFilesInput): Promise<CodeSandboxListFilesOutput> {
		const out = await this.#client.listFiles({
			sandbox_id: input.session_id,
			...(input.directory_path !== undefined && { directory_path: input.directory_path })
		})
		return {
			session_id: input.session_id,
			paths: out.paths,
			...(out.raw !== undefined && { raw: out.raw })
		}
	}

	async removeFiles(input: CodeSandboxRemoveFilesInput) {
		const out = await this.#client.removeFiles({
			sandbox_id: input.session_id,
			paths: input.paths
		})
		return { session_id: input.session_id, paths: out.paths, ok: true as const }
	}
}

function mapExec(
	session_id: string,
	out: { stdout: string; stderr: string; exit_code?: number | undefined; success: boolean }
): CodeSandboxExecResult {
	const result: CodeSandboxExecResult = {
		session_id,
		stdout: out.stdout,
		stderr: out.stderr,
		success: out.success
	}
	if (out.exit_code !== undefined) result.exit_code = out.exit_code
	return result
}

function normalizeLanguage(language: string | undefined): 'python' | 'javascript' | 'typescript' {
	const raw = (language ?? 'python').toLowerCase()
	if (['js', 'javascript', 'node'].includes(raw)) return 'javascript'
	if (['ts', 'typescript'].includes(raw)) return 'typescript'
	if (['sh', 'bash', 'shell'].includes(raw)) {
		throw new ToolError('Use executeCommand for shell', { code: 'bad_input' })
	}
	return 'python'
}
