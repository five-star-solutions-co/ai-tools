/**
 * Cloudflare Sandbox Bridge vendor client (HttpService + Bearer).
 * Host: `new CloudflareSandboxClient(auth)`. Agent: `fromContext(ctx)`.
 * Gold: `src/vendors/resend/client.ts`.
 * @see https://developers.cloudflare.com/sandbox/bridge/http-api/
 */

import { isPlainObject, isString, trimEnd } from 'es-toolkit'

import { ToolError } from '../../core/errors'
import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import { HttpService } from '../../transport/http-service'
import type { HttpServiceOptions } from '../../transport/http-service'
import type {
	CloudflareSandboxAuth,
	CreateBridgeSessionOutput,
	CreateSandboxOutput,
	DeleteBridgeSessionInput,
	DeleteBridgeSessionOutput,
	DestroySandboxOutput,
	ExecInput,
	ExecOutput,
	ExecuteCodeInput,
	HealthOutput,
	ReadFileInput,
	ReadFileOutput,
	ReadFilesInput,
	ReadFilesOutput,
	RunningOutput,
	SandboxIdInput,
	WriteFileInput,
	WriteFileOutput,
	WriteFilesInput,
	WriteFilesOutput
} from './contracts'
import { DEFAULT_EXEC_TIMEOUT_MS, cloudflareSandboxAuthSchema } from './contracts'
import { executeCodeArgv, parseExecSse, workspaceFileKey } from './domain'

export type CloudflareSandboxClientOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'>

export class CloudflareSandboxClient {
	readonly #http: HttpService

	constructor(auth: CloudflareSandboxAuth, options: CloudflareSandboxClientOptions = {}) {
		const parsed = cloudflareSandboxAuthSchema.safeParse(auth)
		if (!parsed.success) {
			throw new ToolError('Invalid Cloudflare Sandbox auth credentials', {
				code: 'bad_auth',
				details: { issues: parsed.error.issues.map((issue) => issue.message) }
			})
		}
		this.#http = new HttpService({
			baseURL: trimEnd(parsed.data.base_url, '/'),
			headers: {
				Authorization: `Bearer ${parsed.data.api_key}`
			},
			timeout: 120_000,
			label: 'Cloudflare Sandbox',
			...(options.fetch && { fetch: options.fetch }),
			...(options.signal && { signal: options.signal })
		})
	}

	static fromContext(ctx: ToolContext): CloudflareSandboxClient {
		return new CloudflareSandboxClient(requireAuth(ctx, cloudflareSandboxAuthSchema), {
			...(ctx.fetch && { fetch: ctx.fetch }),
			...(ctx.signal && { signal: ctx.signal })
		})
	}

	/** Liveness probe on the bridge. */
	async health(): Promise<HealthOutput> {
		const { data } = await this.#http.get('/health', {
			label: 'Cloudflare Sandbox health'
		})
		if (isPlainObject(data) && data['ok'] === true) return { ok: true }
		if (isPlainObject(data) && data['ok'] === false) return { ok: false }
		return { ok: true }
	}

	async create(): Promise<CreateSandboxOutput> {
		const { data } = await this.#http.post('/v1/sandbox', undefined, {
			label: 'Cloudflare Sandbox create'
		})
		if (!isPlainObject(data) || !isString(data['id'])) {
			throw new ToolError('Unexpected create sandbox response', { code: 'upstream' })
		}
		return { sandbox_id: data['id'] }
	}

	async destroy(input: SandboxIdInput): Promise<DestroySandboxOutput> {
		await this.#http.delete(`/v1/sandbox/${encodeURIComponent(input.sandbox_id)}`, {
			label: 'Cloudflare Sandbox destroy'
		})
		return { sandbox_id: input.sandbox_id, destroyed: true }
	}

	async running(input: SandboxIdInput): Promise<RunningOutput> {
		const { data } = await this.#http.get(`/v1/sandbox/${encodeURIComponent(input.sandbox_id)}/running`, {
			label: 'Cloudflare Sandbox running'
		})
		if (!isPlainObject(data) || typeof data['running'] !== 'boolean') {
			throw new ToolError('Unexpected running response', { code: 'upstream' })
		}
		return { sandbox_id: input.sandbox_id, running: data['running'] }
	}

	/**
	 * Run a command. Bridge returns text/event-stream (stdout/stderr base64 + exit).
	 * Uses HttpService.bytes so ofetch does not try to JSON-parse the SSE body.
	 */
	async exec(input: ExecInput): Promise<ExecOutput> {
		const body: Record<string, unknown> = {
			argv: input.argv,
			timeout_ms: input.timeout_ms ?? DEFAULT_EXEC_TIMEOUT_MS
		}
		if (input.cwd) body['cwd'] = input.cwd

		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			Accept: 'text/event-stream'
		}
		if (input.session_id) headers['Session-Id'] = input.session_id

		const { bytes } = await this.#http.bytes('POST', `/v1/sandbox/${encodeURIComponent(input.sandbox_id)}/exec`, {
			body,
			headers,
			label: 'Cloudflare Sandbox exec'
		})
		const text = new TextDecoder().decode(bytes)
		const parsed = parseExecSse(text)
		if (parsed.error && parsed.exit_code === undefined) {
			throw new ToolError(parsed.error, {
				code: 'upstream',
				details: {
					...(parsed.error_code && { error_code: parsed.error_code }),
					sandbox_id: input.sandbox_id
				}
			})
		}
		const exit_code = parsed.exit_code ?? (parsed.error ? 1 : 0)
		const out: ExecOutput = {
			sandbox_id: input.sandbox_id,
			stdout: parsed.stdout,
			stderr: parsed.stderr,
			exit_code,
			success: exit_code === 0
		}
		if (parsed.error) out.error = parsed.error
		if (parsed.error_code) out.error_code = parsed.error_code
		return out
	}

	/** Execute source via python3/node/sh on the bridge (no native runCode route). */
	async executeCode(input: ExecuteCodeInput): Promise<ExecOutput> {
		const language = input.language ?? 'python'
		return this.exec({
			sandbox_id: input.sandbox_id,
			argv: executeCodeArgv(language, input.code),
			...(input.timeout_ms !== undefined && { timeout_ms: input.timeout_ms }),
			...(input.session_id && { session_id: input.session_id })
		})
	}

	async writeFile(input: WriteFileInput): Promise<WriteFileOutput> {
		const key = workspaceFileKey(input.path)
		const headers: Record<string, string> = {
			'Content-Type': 'application/octet-stream'
		}
		if (input.session_id) headers['Session-Id'] = input.session_id
		const { data } = await this.#http.put(
			`/v1/sandbox/${encodeURIComponent(input.sandbox_id)}/file/${key.split('/').map(encodeURIComponent).join('/')}`,
			input.text,
			{ headers, label: 'Cloudflare Sandbox writeFile' }
		)
		if (isPlainObject(data) && data['ok'] === false) {
			throw new ToolError('Sandbox writeFile failed', { code: 'upstream' })
		}
		return { sandbox_id: input.sandbox_id, path: input.path, ok: true }
	}

	async readFile(input: ReadFileInput): Promise<ReadFileOutput> {
		const key = workspaceFileKey(input.path)
		const headers: Record<string, string> = {}
		if (input.session_id) headers['Session-Id'] = input.session_id
		const { bytes } = await this.#http.bytes(
			'GET',
			`/v1/sandbox/${encodeURIComponent(input.sandbox_id)}/file/${key.split('/').map(encodeURIComponent).join('/')}`,
			{ headers, label: 'Cloudflare Sandbox readFile' }
		)
		return {
			sandbox_id: input.sandbox_id,
			path: input.path,
			text: new TextDecoder().decode(bytes)
		}
	}

	async writeFiles(input: WriteFilesInput): Promise<WriteFilesOutput> {
		const paths: string[] = []
		for (const file of input.files) {
			await this.writeFile({
				sandbox_id: input.sandbox_id,
				path: file.path,
				text: file.text,
				...(input.session_id && { session_id: input.session_id })
			})
			paths.push(file.path)
		}
		return { sandbox_id: input.sandbox_id, paths, ok: true }
	}

	async readFiles(input: ReadFilesInput): Promise<ReadFilesOutput> {
		const files: { path: string; text: string }[] = []
		for (const path of input.paths) {
			const row = await this.readFile({
				sandbox_id: input.sandbox_id,
				path,
				...(input.session_id && { session_id: input.session_id })
			})
			files.push({ path: row.path, text: row.text })
		}
		return { sandbox_id: input.sandbox_id, files }
	}

	async createSession(input: SandboxIdInput): Promise<CreateBridgeSessionOutput> {
		const { data } = await this.#http.post(`/v1/sandbox/${encodeURIComponent(input.sandbox_id)}/session`, undefined, {
			label: 'Cloudflare Sandbox createSession'
		})
		if (!isPlainObject(data) || !isString(data['id'])) {
			throw new ToolError('Unexpected create session response', { code: 'upstream' })
		}
		return { sandbox_id: input.sandbox_id, session_id: data['id'] }
	}

	async deleteSession(input: DeleteBridgeSessionInput): Promise<DeleteBridgeSessionOutput> {
		await this.#http.delete(
			`/v1/sandbox/${encodeURIComponent(input.sandbox_id)}/session/${encodeURIComponent(input.session_id)}`,
			{ label: 'Cloudflare Sandbox deleteSession' }
		)
		return { sandbox_id: input.sandbox_id, session_id: input.session_id, deleted: true }
	}
}
