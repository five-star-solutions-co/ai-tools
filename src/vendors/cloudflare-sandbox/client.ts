/**
 * Cloudflare Sandbox Bridge vendor client (HttpService + Bearer).
 * Host: `new CloudflareSandboxClient(auth)`. Agent: `fromContext(ctx)`.
 * Gold: `src/vendors/resend/client.ts` + messaging ArtifactRef storage pattern.
 * @see https://developers.cloudflare.com/sandbox/bridge/http-api/
 */

import { isPlainObject, isString, trimEnd } from 'es-toolkit'

import { ToolError } from '../../core/errors'
import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import { bytesToBase64, bytesToUtf8, toArrayBuffer } from '../../shared/bytes'
import { HttpService } from '../../transport/http-service'
import type { HttpServiceOptions } from '../../transport/http-service'
import { S3Client } from '../s3'
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
	ExportArtifactInput,
	ExportArtifactOutput,
	HealthOutput,
	ImportArtifactInput,
	ImportArtifactOutput,
	ListFilesInput,
	ListFilesOutput,
	ReadFileInput,
	ReadFileOutput,
	ReadFilesInput,
	ReadFilesOutput,
	RemoveFilesInput,
	RemoveFilesOutput,
	RunningOutput,
	SandboxIdInput,
	WriteFileInput,
	WriteFileOutput,
	WriteFilesInput,
	WriteFilesOutput
} from './contracts'
import { DEFAULT_EXEC_TIMEOUT_MS, MAX_FILE_BYTES, MAX_LIST_FILES, cloudflareSandboxAuthSchema } from './contracts'
import {
	executeCodeArgv,
	parseExecSse,
	resolveWriteFileBytes,
	shellQuote,
	workspaceAbsolutePath,
	workspaceFileKey
} from './domain'

export type CloudflareSandboxClientOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'>

export class CloudflareSandboxClient {
	readonly #http: HttpService
	readonly #storage: S3Client | undefined

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
		this.#storage = parsed.data.storage
			? new S3Client(parsed.data.storage, {
					...(options.fetch && { fetch: options.fetch }),
					...(options.signal && { signal: options.signal })
				})
			: undefined
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
	 * Optional onStdout/onStderr fire while walking the buffered SSE (not true wire streaming).
	 */
	async exec(
		input: ExecInput,
		stream: { onStdout?: (chunk: string) => void; onStderr?: (chunk: string) => void } = {}
	): Promise<ExecOutput> {
		const body: Record<string, unknown> = {
			argv: input.argv,
			timeout_ms: input.timeout_ms ?? DEFAULT_EXEC_TIMEOUT_MS
		}
		if (input.cwd) body['cwd'] = input.cwd
		if (input.env && Object.keys(input.env).length > 0) body['env'] = input.env

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
		const parsed = parseExecSse(text, {
			...(stream.onStdout && { onStdout: stream.onStdout }),
			...(stream.onStderr && { onStderr: stream.onStderr })
		})
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
		const bytes = resolveWriteFileBytes(input)
		await this.#putFileBytes(input.sandbox_id, input.path, bytes, input.session_id)
		return {
			sandbox_id: input.sandbox_id,
			path: input.path,
			ok: true,
			byte_length: bytes.byteLength
		}
	}

	async readFile(input: ReadFileInput): Promise<ReadFileOutput> {
		const bytes = await this.#getFileBytes(input.sandbox_id, input.path, input.session_id)
		const encoding = input.encoding ?? 'utf8'
		const out: ReadFileOutput = {
			sandbox_id: input.sandbox_id,
			path: input.path,
			byte_length: bytes.byteLength
		}
		if (encoding === 'base64') {
			out.body_base64 = bytesToBase64(bytes)
		} else {
			out.text = bytesToUtf8(bytes)
		}
		return out
	}

	async writeFiles(input: WriteFilesInput): Promise<WriteFilesOutput> {
		const paths: string[] = []
		for (const file of input.files) {
			await this.writeFile({
				sandbox_id: input.sandbox_id,
				path: file.path,
				...(file.text !== undefined && { text: file.text }),
				...(file.body_base64 !== undefined && { body_base64: file.body_base64 }),
				...(input.session_id && { session_id: input.session_id })
			})
			paths.push(file.path)
		}
		return { sandbox_id: input.sandbox_id, paths, ok: true }
	}

	async readFiles(input: ReadFilesInput): Promise<ReadFilesOutput> {
		const files: ReadFilesOutput['files'] = []
		for (const path of input.paths) {
			const row = await this.readFile({
				sandbox_id: input.sandbox_id,
				path,
				...(input.encoding && { encoding: input.encoding }),
				...(input.session_id && { session_id: input.session_id })
			})
			files.push({
				path: row.path,
				...(row.text !== undefined && { text: row.text }),
				...(row.body_base64 !== undefined && { body_base64: row.body_base64 }),
				...(row.byte_length !== undefined && { byte_length: row.byte_length })
			})
		}
		return { sandbox_id: input.sandbox_id, files }
	}

	/** List files via find in the workspace (bridge has no list route). */
	async listFiles(input: ListFilesInput): Promise<ListFilesOutput> {
		const dir = input.directory_path?.trim() || '/workspace'
		const abs = dir.startsWith('/') ? dir : workspaceAbsolutePath(dir)
		const out = await this.exec({
			sandbox_id: input.sandbox_id,
			argv: ['sh', '-lc', `find ${shellQuote(abs)} -maxdepth 4 -type f 2>/dev/null | head -n ${MAX_LIST_FILES}`],
			...(input.session_id && { session_id: input.session_id })
		})
		const paths = out.stdout
			.split('\n')
			.map((line) => line.trim())
			.filter((line) => line.length > 0)
		return {
			sandbox_id: input.sandbox_id,
			paths,
			raw: { stdout: out.stdout, stderr: out.stderr, exit_code: out.exit_code }
		}
	}

	/** Remove files via rm (bridge has no delete-file route). */
	async removeFiles(input: RemoveFilesInput): Promise<RemoveFilesOutput> {
		for (const path of input.paths) {
			const abs = path.startsWith('/') ? path : workspaceAbsolutePath(path)
			await this.exec({
				sandbox_id: input.sandbox_id,
				argv: ['rm', '-f', '--', abs],
				...(input.session_id && { session_id: input.session_id })
			})
		}
		return { sandbox_id: input.sandbox_id, paths: input.paths, ok: true }
	}

	/**
	 * Copy an object-store ArtifactRef into the sandbox workspace.
	 * Requires auth.storage.
	 */
	async importArtifact(input: ImportArtifactInput): Promise<ImportArtifactOutput> {
		const storage = this.#requireStorage('importArtifact')
		if (input.source.store !== 'object') {
			throw new ToolError('Sandbox importArtifact only supports store=object ArtifactRefs', {
				code: 'bad_input'
			})
		}
		const bytes = await storage.getBytes(input.source.key, { maxBytes: MAX_FILE_BYTES })
		await this.#putFileBytes(input.sandbox_id, input.path, bytes, input.session_id)
		return {
			sandbox_id: input.sandbox_id,
			path: input.path,
			ok: true,
			byte_length: bytes.byteLength
		}
	}

	/**
	 * Copy a sandbox workspace file to object storage and return an ArtifactRef.
	 * Requires auth.storage.
	 */
	async exportArtifact(input: ExportArtifactInput): Promise<ExportArtifactOutput> {
		const storage = this.#requireStorage('exportArtifact')
		const bytes = await this.#getFileBytes(input.sandbox_id, input.path, input.session_id)
		await storage.putBytes(input.destination_key, bytes)
		return {
			sandbox_id: input.sandbox_id,
			path: input.path,
			artifact: {
				store: 'object',
				key: input.destination_key,
				byte_length: bytes.byteLength
			}
		}
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

	#requireStorage(op: string): S3Client {
		if (!this.#storage) {
			throw new ToolError(`${op} requires storage credentials on sandbox auth`, {
				code: 'bad_auth'
			})
		}
		return this.#storage
	}

	async #putFileBytes(
		sandboxId: string,
		path: string,
		bytes: Uint8Array,
		sessionId: string | undefined
	): Promise<void> {
		const key = workspaceFileKey(path)
		const headers: Record<string, string> = {
			'Content-Type': 'application/octet-stream'
		}
		if (sessionId) headers['Session-Id'] = sessionId
		const { data } = await this.#http.put(
			`/v1/sandbox/${encodeURIComponent(sandboxId)}/file/${key.split('/').map(encodeURIComponent).join('/')}`,
			toArrayBuffer(bytes),
			{ headers, label: 'Cloudflare Sandbox writeFile' }
		)
		if (isPlainObject(data) && data['ok'] === false) {
			throw new ToolError('Sandbox writeFile failed', { code: 'upstream' })
		}
	}

	async #getFileBytes(sandboxId: string, path: string, sessionId: string | undefined): Promise<Uint8Array> {
		const key = workspaceFileKey(path)
		const headers: Record<string, string> = {}
		if (sessionId) headers['Session-Id'] = sessionId
		const { bytes } = await this.#http.bytes(
			'GET',
			`/v1/sandbox/${encodeURIComponent(sandboxId)}/file/${key.split('/').map(encodeURIComponent).join('/')}`,
			{ headers, label: 'Cloudflare Sandbox readFile', maxBytes: MAX_FILE_BYTES }
		)
		return bytes
	}
}
