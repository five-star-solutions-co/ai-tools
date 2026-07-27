import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import type {
	CodeSandboxAuth,
	CodeSandboxExecuteCodeInput,
	CodeSandboxExecuteCommandInput,
	CodeSandboxListFilesInput,
	CodeSandboxOps,
	CodeSandboxReadFilesInput,
	CodeSandboxRemoveFilesInput,
	CodeSandboxSessionIdInput,
	CodeSandboxStartSessionInput,
	CodeSandboxWriteFilesInput
} from './contracts'
import { codeSandboxAuthSchema } from './contracts'
import { AgentCoreCodeSandboxProvider } from './providers/bedrock-agentcore'
import { CloudflareCodeSandboxProvider } from './providers/cloudflare-sandbox'

function providerFor(auth: CodeSandboxAuth, ctx: ToolContext): CodeSandboxOps {
	switch (auth.provider) {
		case 'cloudflare':
			return new CloudflareCodeSandboxProvider(auth, {
				...(ctx.fetch && { fetch: ctx.fetch }),
				...(ctx.signal && { signal: ctx.signal })
			})
		case 'bedrock-agentcore':
			return new AgentCoreCodeSandboxProvider(auth, {
				...(ctx.fetch && { fetch: ctx.fetch }),
				...(ctx.signal && { signal: ctx.signal })
			})
	}
}

export class CodeSandboxClient implements CodeSandboxOps {
	readonly #ops: CodeSandboxOps

	constructor(ops: CodeSandboxOps) {
		this.#ops = ops
	}

	static fromContext(ctx: ToolContext): CodeSandboxClient {
		return new CodeSandboxClient(providerFor(requireAuth(ctx, codeSandboxAuthSchema), ctx))
	}

	static fromAuth(auth: CodeSandboxAuth, ctx: ToolContext = {}): CodeSandboxClient {
		return new CodeSandboxClient(providerFor(auth, ctx))
	}

	startSession(input: CodeSandboxStartSessionInput = {}) {
		return this.#ops.startSession(input)
	}

	getSession(input: CodeSandboxSessionIdInput) {
		return this.#ops.getSession(input)
	}

	stopSession(input: CodeSandboxSessionIdInput) {
		return this.#ops.stopSession(input)
	}

	executeCode(input: CodeSandboxExecuteCodeInput) {
		return this.#ops.executeCode(input)
	}

	executeCommand(input: CodeSandboxExecuteCommandInput) {
		return this.#ops.executeCommand(input)
	}

	writeFiles(input: CodeSandboxWriteFilesInput) {
		return this.#ops.writeFiles(input)
	}

	readFiles(input: CodeSandboxReadFilesInput) {
		return this.#ops.readFiles(input)
	}

	listFiles(input: CodeSandboxListFilesInput) {
		return this.#ops.listFiles(input)
	}

	removeFiles(input: CodeSandboxRemoveFilesInput) {
		return this.#ops.removeFiles(input)
	}
}
