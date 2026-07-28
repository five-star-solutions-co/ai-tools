import { ToolError } from '../../../core/errors'
import { BedrockAgentCoreBrowserClient } from '../../../vendors/bedrock-agentcore-browser'
import type { BedrockAgentCoreBrowserClientOptions } from '../../../vendors/bedrock-agentcore-browser'
import type {
	AgentCoreBrowserSeamAuth,
	BrowserActionOk,
	BrowserClickInput,
	BrowserGetStateInput,
	BrowserGetStateOutput,
	BrowserNavigateInput,
	BrowserNavigateOutput,
	BrowserOps,
	BrowserScreenshotInput,
	BrowserScreenshotOutput,
	BrowserSessionIdInput,
	BrowserSnapshotInput,
	BrowserSnapshotOutput,
	BrowserStartSessionInput,
	BrowserTypeInput,
	BrowserWaitInput
} from '../contracts'

export type AgentCoreBrowserProviderOptions = BedrockAgentCoreBrowserClientOptions

function unsupportedInteractive(action: string): never {
	throw new ToolError(
		`Bound browser provider exposes automation via CDP stream only; ${action} is not available as a REST tool`,
		{ code: 'unsupported', details: { action } }
	)
}

export class AgentCoreBrowserProvider implements BrowserOps {
	readonly #client: BedrockAgentCoreBrowserClient

	constructor(auth: AgentCoreBrowserSeamAuth, options: AgentCoreBrowserProviderOptions = {}) {
		const { provider: _provider, ...vendorAuth } = auth
		this.#client = new BedrockAgentCoreBrowserClient(vendorAuth, options)
	}

	startSession(input: BrowserStartSessionInput = {}) {
		return this.#client.startSession(input)
	}

	getSession(input: BrowserSessionIdInput) {
		return this.#client.getSession(input)
	}

	stopSession(input: BrowserSessionIdInput) {
		return this.#client.stopSession(input)
	}

	navigate(_input: BrowserNavigateInput): Promise<BrowserNavigateOutput> {
		unsupportedInteractive('navigate')
	}

	snapshot(_input: BrowserSnapshotInput): Promise<BrowserSnapshotOutput> {
		unsupportedInteractive('snapshot')
	}

	click(_input: BrowserClickInput): Promise<BrowserActionOk> {
		unsupportedInteractive('click')
	}

	type(_input: BrowserTypeInput): Promise<BrowserActionOk> {
		unsupportedInteractive('type')
	}

	wait(_input: BrowserWaitInput): Promise<BrowserActionOk> {
		unsupportedInteractive('wait')
	}

	screenshot(_input: BrowserScreenshotInput): Promise<BrowserScreenshotOutput> {
		unsupportedInteractive('screenshot')
	}

	async getState(input: BrowserGetStateInput): Promise<BrowserGetStateOutput> {
		const session = await this.getSession({ session_id: input.session_id })
		return {
			session_id: session.session_id,
			...(session.status && { status: session.status }),
			...(session.streams && { streams: session.streams })
		}
	}
}
