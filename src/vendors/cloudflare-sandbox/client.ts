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
	CreateCodeContextInput,
	CreateCodeContextOutput,
	CreateSandboxOutput,
	DeleteBridgeSessionInput,
	DeleteBridgeSessionOutput,
	DeleteCodeContextInput,
	DeleteCodeContextOutput,
	DestroySandboxOutput,
	ExecInput,
	ExecOutput,
	ExecuteCodeInput,
	ExportArtifactInput,
	ExportArtifactOutput,
	HealthOutput,
	ImportArtifactInput,
	ImportArtifactOutput,
	ListCodeContextsOutput,
	ListFilesInput,
	ListFilesOutput,
	MountBucketInput,
	MountBucketOutput,
	ReadFileInput,
	ReadFileOutput,
	ReadFilesInput,
	ReadFilesOutput,
	RemoveFilesInput,
	RemoveFilesOutput,
	RunCodeInput,
	RunningOutput,
	SandboxIdInput,
	UnmountBucketInput,
	UnmountBucketOutput,
	WriteFileInput,
	WriteFileOutput,
	WriteFilesInput,
	WriteFilesOutput
} from './contracts'
import {
	DEFAULT_EXEC_TIMEOUT_MS,
	MAX_FILE_BYTES,
	MAX_LIST_FILES,
	cloudflareSandboxAuthSchema,
	mountBucketInputSchema,
	unmountBucketInputSchema
} from './contracts'
import {
	parseCreateCodeContextPayload,
	parseExecSse,
	parseListCodeContextsPayload,
	parseRunCodePayload,
	resolveWriteFileBytes,
	shellQuote,
	workspaceAbsolutePath,
	workspaceFileKey
} from './domain'
import type { InterpreterLanguage } from './domain'

export type CloudflareSandboxClientOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'>

export class CloudflareSandboxClient {
	readonly #http: HttpService
	readonly #storage: S3Client | undefined
	/** Optional S3 auth fields for endpoint mount credential fallback (Mastra workspace FS). */
	readonly #storageAuth:
		| {
				access_key_id: string
				secret_access_key: string
				endpoint?: string | undefined
		  }
		| undefined
	/** sandbox_id:language → interpreter context id (Node/Python stay loaded). */
	readonly #contexts = new Map<string, string>()
	readonly #pendingContexts = new Map<string, Promise<string>>()

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
		this.#storageAuth = parsed.data.storage
			? {
					access_key_id: parsed.data.storage.access_key_id,
					secret_access_key: parsed.data.storage.secret_access_key,
					...(parsed.data.storage.endpoint && { endpoint: parsed.data.storage.endpoint })
				}
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
		this.#forgetSandboxContexts(input.sandbox_id)
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

	async executeCode(input: ExecuteCodeInput): Promise<ExecOutput> {
		const language = input.language ?? 'python'
		const context_id = input.context_id ?? (await this.#ensureCodeContext(input.sandbox_id, language))
		return this.runCode({
			sandbox_id: input.sandbox_id,
			code: input.code,
			context_id,
			language,
			...(input.timeout_ms !== undefined && { timeout_ms: input.timeout_ms })
		})
	}

	async createCodeContext(input: CreateCodeContextInput): Promise<CreateCodeContextOutput> {
		const language = input.language ?? 'python'
		const { data } = await this.#http.post(
			`/v1/sandbox/${encodeURIComponent(input.sandbox_id)}/context`,
			{
				language,
				...(input.cwd && { cwd: input.cwd }),
				...(input.env && Object.keys(input.env).length > 0 && { env: input.env }),
				...(input.timeout_ms !== undefined && { timeout_ms: input.timeout_ms })
			},
			{ label: 'Cloudflare Sandbox createCodeContext' }
		)
		const row = parseCreateCodeContextPayload(data)
		return {
			sandbox_id: input.sandbox_id,
			context_id: row.id,
			language,
			...(row.cwd && { cwd: row.cwd })
		}
	}

	async listCodeContexts(input: SandboxIdInput): Promise<ListCodeContextsOutput> {
		const { data } = await this.#http.get(`/v1/sandbox/${encodeURIComponent(input.sandbox_id)}/context`, {
			label: 'Cloudflare Sandbox listCodeContexts'
		})
		return {
			sandbox_id: input.sandbox_id,
			contexts: parseListCodeContextsPayload(data)
		}
	}

	async deleteCodeContext(input: DeleteCodeContextInput): Promise<DeleteCodeContextOutput> {
		await this.#http.delete(
			`/v1/sandbox/${encodeURIComponent(input.sandbox_id)}/context/${encodeURIComponent(input.context_id)}`,
			{ label: 'Cloudflare Sandbox deleteCodeContext' }
		)
		const prefix = `${input.sandbox_id}:`
		for (const [key, contextId] of this.#contexts) {
			if (contextId === input.context_id && key.startsWith(prefix)) this.#contexts.delete(key)
		}
		return { sandbox_id: input.sandbox_id, context_id: input.context_id, deleted: true }
	}

	async runCode(input: RunCodeInput): Promise<ExecOutput> {
		const { data } = await this.#http.post(
			`/v1/sandbox/${encodeURIComponent(input.sandbox_id)}/run-code`,
			{
				code: input.code,
				...(input.context_id && { context_id: input.context_id }),
				...(input.language && { language: input.language }),
				...(input.timeout_ms !== undefined && { timeout_ms: input.timeout_ms })
			},
			{ label: 'Cloudflare Sandbox runCode' }
		)
		const parsed = parseRunCodePayload(data)
		return {
			sandbox_id: input.sandbox_id,
			stdout: parsed.stdout,
			stderr: parsed.stderr,
			exit_code: parsed.exit_code,
			success: parsed.success,
			...(parsed.error && { error: parsed.error })
		}
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

	/**
	 * Mount an S3-compatible bucket (or Worker R2 binding) at an absolute path in the sandbox.
	 * Bridge: `POST /v1/sandbox/:id/mount`.
	 * For Mastra / host workspace S3 FS: pass `endpoint` + credentials (or rely on auth.storage).
	 * @see https://developers.cloudflare.com/sandbox/bridge/http-api/#bucket-mounts
	 */
	async mount(input: MountBucketInput): Promise<MountBucketOutput> {
		const parsed = mountBucketInputSchema.safeParse(input)
		if (!parsed.success) {
			throw new ToolError('Invalid sandbox mount input', {
				code: 'bad_input',
				details: { issues: parsed.error.issues.map((issue) => issue.message) }
			})
		}
		const data = parsed.data
		if (data.local_bucket && data.endpoint) {
			throw new ToolError('local_bucket and endpoint are mutually exclusive on mount', { code: 'bad_input' })
		}
		if (data.prefix !== undefined && !data.prefix.startsWith('/')) {
			throw new ToolError('mount prefix must start with /', { code: 'bad_input' })
		}

		// Endpoint mounts only: omit endpoint for Worker R2 binding mounts.
		const endpoint = data.local_bucket ? undefined : data.endpoint
		// Credentials: explicit input, else auth.storage when doing an endpoint mount (Mastra S3 FS).
		const accessKeyId = data.access_key_id ?? (endpoint !== undefined ? this.#storageAuth?.access_key_id : undefined)
		const secretAccessKey =
			data.secret_access_key ?? (endpoint !== undefined ? this.#storageAuth?.secret_access_key : undefined)

		const options: Record<string, unknown> = {}
		if (endpoint) options['endpoint'] = endpoint
		if (data.provider) options['provider'] = data.provider
		if (data.read_only !== undefined) options['readOnly'] = data.read_only
		if (data.prefix) options['prefix'] = data.prefix
		if (data.credential_proxy !== undefined) options['credentialProxy'] = data.credential_proxy
		if (data.local_bucket) options['localBucket'] = true
		if (data.s3fs_options && data.s3fs_options.length > 0) options['s3fsOptions'] = data.s3fs_options
		if (endpoint && accessKeyId && secretAccessKey) {
			options['credentials'] = {
				accessKeyId,
				secretAccessKey
			}
		}

		const body: Record<string, unknown> = {
			mountPath: data.mount_path,
			options
		}
		if (endpoint) body['bucket'] = data.bucket
		else body['binding'] = data.bucket

		await this.#http.post(`/v1/sandbox/${encodeURIComponent(data.sandbox_id)}/mount`, body, {
			label: 'Cloudflare Sandbox mount'
		})
		return {
			sandbox_id: data.sandbox_id,
			bucket: data.bucket,
			mount_path: data.mount_path,
			ok: true
		}
	}

	/**
	 * Unmount a previously mounted bucket path.
	 * Bridge: `POST /v1/sandbox/:id/unmount` with `{ mountPath }`.
	 * Mounts are also cleared when the sandbox is destroyed.
	 */
	async unmount(input: UnmountBucketInput): Promise<UnmountBucketOutput> {
		const parsed = unmountBucketInputSchema.safeParse(input)
		if (!parsed.success) {
			throw new ToolError('Invalid sandbox unmount input', {
				code: 'bad_input',
				details: { issues: parsed.error.issues.map((issue) => issue.message) }
			})
		}
		const data = parsed.data
		await this.#http.post(
			`/v1/sandbox/${encodeURIComponent(data.sandbox_id)}/unmount`,
			{ mountPath: data.mount_path },
			{ label: 'Cloudflare Sandbox unmount' }
		)
		return {
			sandbox_id: data.sandbox_id,
			mount_path: data.mount_path,
			ok: true
		}
	}

	async #ensureCodeContext(sandboxId: string, language: InterpreterLanguage): Promise<string> {
		const key = `${sandboxId}:${language}`
		const cached = this.#contexts.get(key)
		if (cached) return cached
		const pending = this.#pendingContexts.get(key)
		if (pending) return pending
		const created = this.createCodeContext({ sandbox_id: sandboxId, language })
			.then((row) => {
				this.#contexts.set(key, row.context_id)
				return row.context_id
			})
			.finally(() => {
				this.#pendingContexts.delete(key)
			})
		this.#pendingContexts.set(key, created)
		return created
	}

	#forgetSandboxContexts(sandboxId: string): void {
		const prefix = `${sandboxId}:`
		for (const key of this.#contexts.keys()) {
			if (key.startsWith(prefix)) this.#contexts.delete(key)
		}
		for (const key of this.#pendingContexts.keys()) {
			if (key.startsWith(prefix)) this.#pendingContexts.delete(key)
		}
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
