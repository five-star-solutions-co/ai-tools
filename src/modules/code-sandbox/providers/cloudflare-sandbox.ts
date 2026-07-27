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
		return { session_id: input.session_id, files: out.files }
	}

	async listFiles(input: CodeSandboxListFilesInput): Promise<CodeSandboxListFilesOutput> {
		const dir = input.directory_path?.trim() || '/workspace'
		const out = await this.#client.exec({
			sandbox_id: input.session_id,
			argv: ['sh', '-lc', `find ${shellQuote(dir)} -maxdepth 4 -type f 2>/dev/null | head -n 500`]
		})
		const paths = out.stdout
			.split('\n')
			.map((line) => line.trim())
			.filter((line) => line.length > 0)
		return { session_id: input.session_id, paths, raw: { stdout: out.stdout, stderr: out.stderr } }
	}

	async removeFiles(input: CodeSandboxRemoveFilesInput) {
		for (const path of input.paths) {
			await this.#client.exec({
				sandbox_id: input.session_id,
				argv: ['rm', '-f', '--', path.startsWith('/') ? path : `/workspace/${path}`]
			})
		}
		return { session_id: input.session_id, paths: input.paths, ok: true as const }
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

function normalizeLanguage(language: string | undefined): 'python' | 'javascript' | 'typescript' | 'shell' {
	const raw = (language ?? 'python').toLowerCase()
	if (raw === 'js' || raw === 'javascript' || raw === 'node') return 'javascript'
	if (raw === 'ts' || raw === 'typescript') return 'typescript'
	if (raw === 'sh' || raw === 'bash' || raw === 'shell') return 'shell'
	return 'python'
}

function shellQuote(value: string): string {
	return `'${value.replaceAll("'", `'\\''`)}'`
}
