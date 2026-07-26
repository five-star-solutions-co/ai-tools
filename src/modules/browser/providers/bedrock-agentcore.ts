import { BedrockAgentCoreBrowserClient } from '../../../vendors/bedrock-agentcore-browser'
import type { BedrockAgentCoreBrowserClientOptions } from '../../../vendors/bedrock-agentcore-browser'
import type {
	AgentCoreBrowserSeamAuth,
	BrowserOps,
	BrowserSessionIdInput,
	BrowserStartSessionInput
} from '../contracts'

export type AgentCoreBrowserProviderOptions = BedrockAgentCoreBrowserClientOptions

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
}
