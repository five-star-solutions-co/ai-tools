/**
 * Bedrock AgentCore Browser client — session lifecycle + stream endpoints.
 */

import { isPlainObject, isString } from 'es-toolkit'

import { ToolError } from '../../core/errors'
import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import { AwsService } from '../../transport/aws-service'
import type { AwsServiceOptions } from '../../transport/aws-service'
import type { HttpServiceOptions } from '../../transport/http-service'
import type {
	BedrockAgentCoreBrowserAuth,
	BrowserSessionIdInput,
	BrowserSessionOutput,
	BrowserStartSessionInput
} from './contracts'
import { DEFAULT_BROWSER_ID, bedrockAgentCoreBrowserAuthSchema } from './contracts'

export type BedrockAgentCoreBrowserClientOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'>

export class BedrockAgentCoreBrowserClient {
	readonly #auth: BedrockAgentCoreBrowserAuth
	readonly #aws: AwsService
	readonly #browserId: string

	constructor(auth: BedrockAgentCoreBrowserAuth, options: BedrockAgentCoreBrowserClientOptions = {}) {
		const parsed = bedrockAgentCoreBrowserAuthSchema.safeParse(auth)
		if (!parsed.success) {
			throw new ToolError('Invalid Bedrock AgentCore Browser auth', {
				code: 'bad_auth',
				details: { issues: parsed.error.issues.map((issue) => issue.message) }
			})
		}
		this.#auth = parsed.data
		this.#browserId = this.#auth.browser_id ?? DEFAULT_BROWSER_ID
		const awsOptions: AwsServiceOptions = {
			accessKeyId: this.#auth.access_key_id,
			secretAccessKey: this.#auth.secret_access_key,
			region: this.#auth.region,
			service: 'bedrock-agentcore',
			baseURL: `https://bedrock-agentcore.${this.#auth.region}.amazonaws.com`,
			label: 'Bedrock AgentCore Browser'
		}
		if (options.fetch) awsOptions.fetch = options.fetch
		if (options.signal) awsOptions.signal = options.signal
		if (this.#auth.session_token) awsOptions.sessionToken = this.#auth.session_token
		this.#aws = new AwsService(awsOptions)
	}

	static fromContext(ctx: ToolContext): BedrockAgentCoreBrowserClient {
		const auth = requireAuth(ctx, bedrockAgentCoreBrowserAuthSchema)
		const options: BedrockAgentCoreBrowserClientOptions = {}
		if (ctx.fetch) options.fetch = ctx.fetch
		if (ctx.signal) options.signal = ctx.signal
		return new BedrockAgentCoreBrowserClient(auth, options)
	}

	#base(): string {
		return `/browsers/${encodeURIComponent(this.#browserId)}`
	}

	async startSession(input: BrowserStartSessionInput = {}): Promise<BrowserSessionOutput> {
		const body: Record<string, unknown> = {}
		if (input.name) body['name'] = input.name
		if (input.session_timeout_seconds !== undefined) body['sessionTimeoutSeconds'] = input.session_timeout_seconds
		if (input.viewport_width !== undefined || input.viewport_height !== undefined) {
			body['viewPort'] = {
				width: input.viewport_width ?? 1280,
				height: input.viewport_height ?? 720
			}
		}
		const { data } = await this.#aws.put(`${this.#base()}/sessions/start`, body)
		return this.#mapSession(data)
	}

	async stopSession(input: BrowserSessionIdInput): Promise<BrowserSessionOutput> {
		const { data } = await this.#aws.put(
			`${this.#base()}/sessions/stop?sessionId=${encodeURIComponent(input.session_id)}`,
			{}
		)
		return this.#mapSession(data, input.session_id)
	}

	async getSession(input: BrowserSessionIdInput): Promise<BrowserSessionOutput> {
		const { data } = await this.#aws.get(
			`${this.#base()}/sessions/get?sessionId=${encodeURIComponent(input.session_id)}`
		)
		return this.#mapSession(data, input.session_id)
	}

	#mapSession(data: unknown, fallbackSessionId?: string): BrowserSessionOutput {
		if (!isPlainObject(data)) {
			if (fallbackSessionId) return { session_id: fallbackSessionId, browser_id: this.#browserId }
			throw new ToolError('Unexpected browser session response', { code: 'upstream' })
		}
		const sessionId = isString(data['sessionId']) ? data['sessionId'] : fallbackSessionId
		if (!sessionId) throw new ToolError('Browser session response missing sessionId', { code: 'upstream' })
		const out: BrowserSessionOutput = {
			session_id: sessionId,
			browser_id: isString(data['browserIdentifier']) ? data['browserIdentifier'] : this.#browserId
		}
		if (isString(data['createdAt'])) out.created_at = data['createdAt']
		if (isString(data['status'])) out.status = data['status']

		const streams = isPlainObject(data['streams']) ? data['streams'] : undefined
		if (streams) {
			const automation = isPlainObject(streams['automationStream']) ? streams['automationStream'] : undefined
			const live = isPlainObject(streams['liveViewStream']) ? streams['liveViewStream'] : undefined
			const mapped: NonNullable<BrowserSessionOutput['streams']> = {}
			if (automation && isString(automation['streamEndpoint'])) {
				mapped.automation_stream_endpoint = automation['streamEndpoint']
			}
			if (automation && isString(automation['streamStatus'])) {
				mapped.automation_stream_status = automation['streamStatus']
			}
			if (live && isString(live['streamEndpoint'])) {
				mapped.live_view_stream_endpoint = live['streamEndpoint']
			}
			if (Object.keys(mapped).length > 0) out.streams = mapped
		}
		return out
	}
}
