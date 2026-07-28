import { ToolError } from '../../../core/errors'
import { CloudflareBrowserClient } from '../../../vendors/cloudflare-browser'
import type {
	CloudflareBrowserClientOptions,
	CloudflareBrowserSessionOutput
} from '../../../vendors/cloudflare-browser'
import type {
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
	BrowserSessionOutput,
	BrowserSnapshotInput,
	BrowserSnapshotOutput,
	BrowserStartSessionInput,
	BrowserTypeInput,
	BrowserWaitInput,
	CloudflareBrowserSeamAuth
} from '../contracts'
import { browserSessionOutputSchema } from '../contracts'

export type CloudflareBrowserProviderOptions = CloudflareBrowserClientOptions

function mapSession(input: CloudflareBrowserSessionOutput): BrowserSessionOutput {
	const streams: NonNullable<BrowserSessionOutput['streams']> = {}
	if (input.websocket_debugger_url) streams.automation_stream_endpoint = input.websocket_debugger_url
	if (input.devtools_frontend_url) streams.live_view_stream_endpoint = input.devtools_frontend_url
	return browserSessionOutputSchema.parse({
		session_id: input.session_id,
		status: input.status,
		...(Object.keys(streams).length > 0 && { streams })
	})
}

function unsupportedInteractive(action: string): never {
	throw new ToolError(
		`Bound browser provider does not support ${action} over REST; use the automation stream (CDP) from start-session`,
		{ code: 'unsupported', details: { action } }
	)
}

export class CloudflareBrowserProvider implements BrowserOps {
	readonly #client: CloudflareBrowserClient

	constructor(auth: CloudflareBrowserSeamAuth, options: CloudflareBrowserProviderOptions = {}) {
		const { provider: _provider, ...vendorAuth } = auth
		this.#client = new CloudflareBrowserClient(vendorAuth, options)
	}

	async startSession(input: BrowserStartSessionInput = {}) {
		const unsupported = [
			...(input.name ? ['name'] : []),
			...(input.viewport_width !== undefined ? ['viewport_width'] : []),
			...(input.viewport_height !== undefined ? ['viewport_height'] : [])
		]
		if (unsupported.length > 0) {
			throw new ToolError('Bound browser provider does not support these start-session fields', {
				code: 'bad_input',
				details: { fields: unsupported }
			})
		}
		if (
			input.session_timeout_seconds !== undefined &&
			(input.session_timeout_seconds < 60 || input.session_timeout_seconds > 600)
		) {
			throw new ToolError('Bound browser provider requires a session timeout from 60 to 600 seconds', {
				code: 'bad_input'
			})
		}
		return mapSession(
			await this.#client.startSession({
				...(input.session_timeout_seconds !== undefined && {
					keep_alive_seconds: input.session_timeout_seconds
				})
			})
		)
	}

	async getSession(input: BrowserSessionIdInput) {
		return mapSession(await this.#client.getSession(input))
	}

	async stopSession(input: BrowserSessionIdInput) {
		return mapSession(await this.#client.stopSession(input))
	}

	async navigate(input: BrowserNavigateInput): Promise<BrowserNavigateOutput> {
		const page = await this.#client.fetchContent({ url: input.url })
		return {
			session_id: input.session_id,
			url: input.url,
			html: page.html,
			...(page.title && { title: page.title })
		}
	}

	async snapshot(input: BrowserSnapshotInput): Promise<BrowserSnapshotOutput> {
		const format = input.format ?? 'html'
		const url = input.url
		if (!url) {
			throw new ToolError('Bound browser provider requires url for snapshot (one-shot REST content API)', {
				code: 'bad_input'
			})
		}
		const page = await this.#client.fetchContent({ url })
		if (format === 'text') {
			const text = page.html
				.replace(/<script[\s\S]*?<\/script>/gi, ' ')
				.replace(/<style[\s\S]*?<\/style>/gi, ' ')
				.replace(/<[^>]+>/g, ' ')
				.replace(/\s+/g, ' ')
				.trim()
			return { session_id: input.session_id, format: 'text', content: text, url }
		}
		return { session_id: input.session_id, format: 'html', content: page.html, url }
	}

	async click(_input: BrowserClickInput): Promise<BrowserActionOk> {
		unsupportedInteractive('click')
	}

	async type(_input: BrowserTypeInput): Promise<BrowserActionOk> {
		unsupportedInteractive('type')
	}

	async wait(_input: BrowserWaitInput): Promise<BrowserActionOk> {
		unsupportedInteractive('wait')
	}

	async screenshot(input: BrowserScreenshotInput): Promise<BrowserScreenshotOutput> {
		const url = input.url
		if (!url) {
			throw new ToolError('Bound browser provider requires url for screenshot (one-shot REST API)', {
				code: 'bad_input'
			})
		}
		const out = await this.#client.renderScreenshot({
			source: { url },
			...(input.output_key && { output_key: input.output_key })
		})
		return { session_id: input.session_id, result: out.result }
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
