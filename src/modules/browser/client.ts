import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import type {
	BrowserAuth,
	BrowserClickInput,
	BrowserGetStateInput,
	BrowserNavigateInput,
	BrowserOps,
	BrowserScreenshotInput,
	BrowserSessionIdInput,
	BrowserSnapshotInput,
	BrowserStartSessionInput,
	BrowserTypeInput,
	BrowserWaitInput
} from './contracts'
import { browserAuthSchema } from './contracts'
import { AgentCoreBrowserProvider } from './providers/bedrock-agentcore'
import { CloudflareBrowserProvider } from './providers/cloudflare'

function providerFor(auth: BrowserAuth, ctx: ToolContext): BrowserOps {
	switch (auth.provider) {
		case 'bedrock-agentcore':
			return new AgentCoreBrowserProvider(auth, {
				...(ctx.fetch && { fetch: ctx.fetch }),
				...(ctx.signal && { signal: ctx.signal })
			})
		case 'cloudflare':
			return new CloudflareBrowserProvider(auth, {
				...(ctx.fetch && { fetch: ctx.fetch }),
				...(ctx.signal && { signal: ctx.signal })
			})
	}
}

export class BrowserClient implements BrowserOps {
	readonly #ops: BrowserOps

	constructor(ops: BrowserOps) {
		this.#ops = ops
	}

	static fromContext(ctx: ToolContext): BrowserClient {
		return new BrowserClient(providerFor(requireAuth(ctx, browserAuthSchema), ctx))
	}

	static fromAuth(auth: BrowserAuth, ctx: ToolContext = {}): BrowserClient {
		return new BrowserClient(providerFor(auth, ctx))
	}

	startSession(input: BrowserStartSessionInput = {}) {
		return this.#ops.startSession(input)
	}

	getSession(input: BrowserSessionIdInput) {
		return this.#ops.getSession(input)
	}

	stopSession(input: BrowserSessionIdInput) {
		return this.#ops.stopSession(input)
	}

	navigate(input: BrowserNavigateInput) {
		return this.#ops.navigate(input)
	}

	snapshot(input: BrowserSnapshotInput) {
		return this.#ops.snapshot(input)
	}

	click(input: BrowserClickInput) {
		return this.#ops.click(input)
	}

	type(input: BrowserTypeInput) {
		return this.#ops.type(input)
	}

	wait(input: BrowserWaitInput) {
		return this.#ops.wait(input)
	}

	screenshot(input: BrowserScreenshotInput) {
		return this.#ops.screenshot(input)
	}

	getState(input: BrowserGetStateInput) {
		return this.#ops.getState(input)
	}
}
