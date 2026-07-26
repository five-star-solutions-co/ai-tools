/**
 * Bedrock AgentCore Code Interpreter client (AwsService SigV4).
 */

import { isPlainObject, isString } from 'es-toolkit'

import { ToolError } from '../../core/errors'
import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import { AwsService } from '../../transport/aws-service'
import type { AwsServiceOptions } from '../../transport/aws-service'
import type { HttpServiceOptions } from '../../transport/http-service'
import type {
	BedrockAgentCoreCodeInterpreterAuth,
	ExecuteCodeInput,
	ExecuteCommandInput,
	InvokeResult,
	ListFilesInput,
	ReadFilesInput,
	RemoveFilesInput,
	SessionIdInput,
	SessionOutput,
	StartCommandInput,
	StartSessionInput,
	TaskIdInput,
	WriteFilesInput
} from './contracts'
import { DEFAULT_CODE_INTERPRETER_ID, bedrockAgentCoreCodeInterpreterAuthSchema } from './contracts'

export type BedrockAgentCoreCodeInterpreterClientOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'>

export class BedrockAgentCoreCodeInterpreterClient {
	readonly #auth: BedrockAgentCoreCodeInterpreterAuth
	readonly #aws: AwsService
	readonly #interpreterId: string

	constructor(auth: BedrockAgentCoreCodeInterpreterAuth, options: BedrockAgentCoreCodeInterpreterClientOptions = {}) {
		const parsed = bedrockAgentCoreCodeInterpreterAuthSchema.safeParse(auth)
		if (!parsed.success) {
			throw new ToolError('Invalid Bedrock AgentCore Code Interpreter auth', {
				code: 'bad_auth',
				details: { issues: parsed.error.issues.map((issue) => issue.message) }
			})
		}
		this.#auth = parsed.data
		this.#interpreterId = this.#auth.code_interpreter_id ?? DEFAULT_CODE_INTERPRETER_ID
		const awsOptions: AwsServiceOptions = {
			accessKeyId: this.#auth.access_key_id,
			secretAccessKey: this.#auth.secret_access_key,
			region: this.#auth.region,
			service: 'bedrock-agentcore',
			baseURL: `https://bedrock-agentcore.${this.#auth.region}.amazonaws.com`,
			label: 'Bedrock AgentCore Code Interpreter'
		}
		if (options.fetch) awsOptions.fetch = options.fetch
		if (options.signal) awsOptions.signal = options.signal
		if (this.#auth.session_token) awsOptions.sessionToken = this.#auth.session_token
		this.#aws = new AwsService(awsOptions)
	}

	static fromContext(ctx: ToolContext): BedrockAgentCoreCodeInterpreterClient {
		const auth = requireAuth(ctx, bedrockAgentCoreCodeInterpreterAuthSchema)
		const options: BedrockAgentCoreCodeInterpreterClientOptions = {}
		if (ctx.fetch) options.fetch = ctx.fetch
		if (ctx.signal) options.signal = ctx.signal
		return new BedrockAgentCoreCodeInterpreterClient(auth, options)
	}

	#base(): string {
		return `/code-interpreters/${encodeURIComponent(this.#interpreterId)}`
	}

	async startSession(input: StartSessionInput = {}): Promise<SessionOutput> {
		const body: Record<string, unknown> = {}
		if (input.name) body['name'] = input.name
		if (input.session_timeout_seconds !== undefined) body['sessionTimeoutSeconds'] = input.session_timeout_seconds
		const { data } = await this.#aws.put(`${this.#base()}/sessions/start`, body)
		return this.#mapSession(data)
	}

	async stopSession(input: SessionIdInput): Promise<SessionOutput> {
		const { data } = await this.#aws.put(
			`${this.#base()}/sessions/stop?sessionId=${encodeURIComponent(input.session_id)}`,
			{}
		)
		return this.#mapSession(data, input.session_id)
	}

	async getSession(input: SessionIdInput): Promise<SessionOutput> {
		const { data } = await this.#aws.get(
			`${this.#base()}/sessions/get?sessionId=${encodeURIComponent(input.session_id)}`
		)
		return this.#mapSession(data, input.session_id)
	}

	async executeCode(input: ExecuteCodeInput): Promise<InvokeResult> {
		return this.#invoke(input.session_id, 'executeCode', {
			language: input.language ?? 'python',
			code: input.code
		})
	}

	async executeCommand(input: ExecuteCommandInput): Promise<InvokeResult> {
		return this.#invoke(input.session_id, 'executeCommand', { command: input.command })
	}

	async startCommand(input: StartCommandInput): Promise<InvokeResult> {
		return this.#invoke(input.session_id, 'startCommandExecution', { command: input.command })
	}

	async getTask(input: TaskIdInput): Promise<InvokeResult> {
		return this.#invoke(input.session_id, 'getTask', { taskId: input.task_id })
	}

	async stopTask(input: TaskIdInput): Promise<InvokeResult> {
		return this.#invoke(input.session_id, 'stopTask', { taskId: input.task_id })
	}

	async listFiles(input: ListFilesInput): Promise<InvokeResult> {
		return this.#invoke(input.session_id, 'listFiles', {
			directoryPath: input.directory_path ?? ''
		})
	}

	async readFiles(input: ReadFilesInput): Promise<InvokeResult> {
		return this.#invoke(input.session_id, 'readFiles', { paths: input.paths })
	}

	async writeFiles(input: WriteFilesInput): Promise<InvokeResult> {
		return this.#invoke(input.session_id, 'writeFiles', {
			content: input.files.map((f) => ({ path: f.path, text: f.text }))
		})
	}

	async removeFiles(input: RemoveFilesInput): Promise<InvokeResult> {
		return this.#invoke(input.session_id, 'removeFiles', { paths: input.paths })
	}

	async #invoke(sessionId: string, name: string, args: Record<string, unknown>): Promise<InvokeResult> {
		const { data } = await this.#aws.post(
			`${this.#base()}/tools/invoke`,
			{ name, arguments: args },
			{
				headers: {
					'x-amzn-code-interpreter-session-id': sessionId,
					Accept: 'application/json'
				}
			}
		)
		const out: InvokeResult = { session_id: sessionId, name, raw: data }
		if (isPlainObject(data)) {
			if ('result' in data) out.result = data['result']
			else out.result = data
		} else {
			out.result = data
		}
		return out
	}

	#mapSession(data: unknown, fallbackSessionId?: string): SessionOutput {
		if (!isPlainObject(data)) {
			if (fallbackSessionId) return { session_id: fallbackSessionId, code_interpreter_id: this.#interpreterId }
			throw new ToolError('Unexpected session response', { code: 'upstream' })
		}
		const sessionId = isString(data['sessionId']) ? data['sessionId'] : fallbackSessionId
		if (!sessionId) throw new ToolError('Session response missing sessionId', { code: 'upstream' })
		const out: SessionOutput = {
			session_id: sessionId,
			code_interpreter_id: isString(data['codeInterpreterIdentifier'])
				? data['codeInterpreterIdentifier']
				: this.#interpreterId
		}
		if (isString(data['createdAt'])) out.created_at = data['createdAt']
		if (isString(data['status'])) out.status = data['status']
		return out
	}
}
