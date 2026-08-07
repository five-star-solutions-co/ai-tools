/**
 * Cloudflare Browser Rendering vendor client (HTML/URL → PDF or screenshot).
 * Host: `new CloudflareBrowserClient(auth)`. Agent tools: `fromContext(ctx)`.
 */

import { ToolError } from '../../core/errors'
import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import { isNumber, isPlainObject, isString } from 'es-toolkit'
import { artifactRefSchema } from '../../shared/artifact'
import { HttpService } from '../../transport/http-service'
import type { HttpServiceOptions } from '../../transport/http-service'
import { S3Client } from '../s3'
import type {
	CloudflareBrowserClientAuth,
	CloudflareBrowserEngine,
	CloudflareBrowserRenderOutput,
	CloudflareBrowserRenderPdfInput,
	CloudflareBrowserRenderScreenshotInput,
	CloudflareBrowserSessionIdInput,
	CloudflareBrowserSessionOutput,
	CloudflareBrowserStartSessionInput
} from './contracts'
import {
	cloudflareBrowserClientAuthSchema,
	cloudflareBrowserRenderOutputSchema,
	cloudflareBrowserSessionOutputSchema
} from './contracts'
import {
	assertBinaryPrefix,
	browserEngineQuery,
	defaultRenderKey,
	resolveBrowserEngine,
	sourceBody,
	titleFromHtml
} from './domain'

export type CloudflareBrowserClientOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'>

export class CloudflareBrowserClient {
	readonly #auth: CloudflareBrowserClientAuth
	readonly #http: HttpService
	readonly #storage?: S3Client

	constructor(auth: CloudflareBrowserClientAuth, options: CloudflareBrowserClientOptions = {}) {
		const parsed = cloudflareBrowserClientAuthSchema.safeParse(auth)
		if (!parsed.success) {
			throw new ToolError('Invalid Cloudflare Browser auth credentials', {
				code: 'bad_auth',
				details: { issues: parsed.error.issues.map((issue) => issue.message) }
			})
		}
		this.#auth = parsed.data
		this.#http = new HttpService({
			...options,
			baseURL: `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(this.#auth.account_id)}`,
			headers: {
				Authorization: `Bearer ${this.#auth.api_token}`
			},
			timeout: 60_000,
			label: 'Cloudflare Browser'
		})
		if (this.#auth.storage) this.#storage = new S3Client(this.#auth.storage, options)
	}

	static fromContext(ctx: ToolContext): CloudflareBrowserClient {
		const auth = requireAuth(ctx, cloudflareBrowserClientAuthSchema)
		return new CloudflareBrowserClient(auth, {
			...(ctx.fetch && { fetch: ctx.fetch }),
			...(ctx.signal && { signal: ctx.signal })
		})
	}

	async startSession(input: CloudflareBrowserStartSessionInput = {}): Promise<CloudflareBrowserSessionOutput> {
		const { data } = await this.#http.post('/browser-rendering/devtools/browser', undefined, {
			query: {
				...(input.keep_alive_seconds !== undefined && { keep_alive: input.keep_alive_seconds * 1_000 }),
				...browserEngineQuery(this.#engine(input.browser))
			}
		})
		return this.#mapSession(data, undefined, 'active')
	}

	async getSession(input: CloudflareBrowserSessionIdInput): Promise<CloudflareBrowserSessionOutput> {
		const { data } = await this.#http.get(`/browser-rendering/devtools/session/${encodeURIComponent(input.session_id)}`)
		return this.#mapSession(data, input.session_id, 'active')
	}

	async stopSession(input: CloudflareBrowserSessionIdInput): Promise<CloudflareBrowserSessionOutput> {
		const { data } = await this.#http.delete(
			`/browser-rendering/devtools/browser/${encodeURIComponent(input.session_id)}`
		)
		return this.#mapSession(data, input.session_id, 'closing')
	}

	/** Browser Rendering PDF; store result in object storage. */
	async renderPdf(input: CloudflareBrowserRenderPdfInput): Promise<CloudflareBrowserRenderOutput> {
		return this.#renderAndStore('pdf', input)
	}

	/** Browser Rendering screenshot (PNG); store result in object storage. */
	async renderScreenshot(input: CloudflareBrowserRenderScreenshotInput): Promise<CloudflareBrowserRenderOutput> {
		return this.#renderAndStore('screenshot', input)
	}

	/**
	 * One-shot rendered HTML for a URL or HTML source (Browser Rendering content API).
	 * Not session-bound CDP; used for seam navigate/snapshot on Cloudflare.
	 */
	async fetchContent(input: {
		url?: string
		html?: string
		browser?: CloudflareBrowserEngine
	}): Promise<{ html: string; title?: string }> {
		const body: Record<string, unknown> = {
			...sourceBody({
				...(input.url && { url: input.url }),
				...(input.html && { html: input.html })
			}),
			setJavaScriptEnabled: true
		}
		const { data } = await this.#http.post('/browser-rendering/content', body, {
			label: 'Cloudflare Browser content',
			headers: { 'Content-Type': 'application/json', Accept: 'text/html, application/json' },
			query: browserEngineQuery(this.#engine(input.browser))
		})
		if (isString(data)) {
			const out: { html: string; title?: string } = { html: data }
			const title = titleFromHtml(data)
			if (title) out.title = title
			return out
		}
		if (isPlainObject(data)) {
			const result = data['result']
			const html = isString(result) ? result : isString(data['html']) ? data['html'] : undefined
			if (html) {
				const out: { html: string; title?: string } = { html }
				const title = titleFromHtml(html)
				if (title) out.title = title
				return out
			}
		}
		throw new ToolError('Cloudflare Browser content response missing HTML', { code: 'upstream' })
	}

	async #renderAndStore(
		kind: 'pdf' | 'screenshot',
		input: CloudflareBrowserRenderPdfInput | CloudflareBrowserRenderScreenshotInput
	): Promise<CloudflareBrowserRenderOutput> {
		const body: Record<string, unknown> = {
			...sourceBody(input.source),
			setJavaScriptEnabled: true
		}
		if (kind === 'pdf') {
			body['preferCSSPageSize'] = true
			body['printBackground'] = true
		} else {
			body['fullPage'] = true
			body['type'] = 'png'
			if ('viewport' in input && input.viewport) {
				const viewport: Record<string, unknown> = {
					width: input.viewport.width,
					height: input.viewport.height
				}
				if (input.viewport.device_scale_factor !== undefined) {
					viewport['deviceScaleFactor'] = input.viewport.device_scale_factor
				}
				body['viewport'] = viewport
			}
		}

		const path = kind === 'pdf' ? '/browser-rendering/pdf' : '/browser-rendering/screenshot'
		const accept = kind === 'pdf' ? 'application/pdf' : 'image/png'
		const { bytes } = await this.#http.bytes('POST', path, {
			label: `Cloudflare Browser ${kind}`,
			body,
			headers: {
				'Content-Type': 'application/json',
				Accept: accept
			},
			query: browserEngineQuery(this.#engine(input.browser))
		})
		assertBinaryPrefix(bytes, kind)

		const mediaType = kind === 'pdf' ? 'application/pdf' : 'image/png'
		const key = defaultRenderKey(kind, input.output_key)
		const filename = input.filename ?? (kind === 'pdf' ? 'render.pdf' : 'render.png')
		const storage = this.#storage
		if (!storage) {
			throw new ToolError('Cloudflare Browser rendering requires object storage', { code: 'bad_auth' })
		}
		await storage.putBytes(key, bytes, mediaType)

		const result = artifactRefSchema.parse({
			store: 'object',
			key,
			media_type: mediaType,
			filename,
			byte_length: bytes.byteLength
		})
		return cloudflareBrowserRenderOutputSchema.parse({ result, kind })
	}

	#engine(override?: CloudflareBrowserEngine): CloudflareBrowserEngine | undefined {
		return resolveBrowserEngine(override, this.#auth.browser)
	}

	#mapSession(data: unknown, fallbackSessionId?: string, fallbackStatus?: string): CloudflareBrowserSessionOutput {
		const payload = isPlainObject(data) && isPlainObject(data['result']) ? data['result'] : data
		if (!isPlainObject(payload)) {
			throw new ToolError('Unexpected Cloudflare Browser session response', { code: 'upstream' })
		}
		const sessionId = isString(payload['sessionId']) ? payload['sessionId'] : fallbackSessionId
		if (!sessionId) {
			throw new ToolError('Cloudflare Browser session response missing sessionId', { code: 'upstream' })
		}
		const output: CloudflareBrowserSessionOutput = { session_id: sessionId }
		if (isString(payload['status'])) {
			output.status = payload['status']
		} else if (isString(payload['closeReason']) || isNumber(payload['endTime'])) {
			output.status = 'closed'
		} else if (fallbackStatus) {
			output.status = fallbackStatus
		}
		if (isString(payload['webSocketDebuggerUrl'])) {
			output.websocket_debugger_url = payload['webSocketDebuggerUrl']
		}
		if (isString(payload['devtoolsFrontendUrl'])) {
			output.devtools_frontend_url = payload['devtoolsFrontendUrl']
		}
		return cloudflareBrowserSessionOutputSchema.parse(output)
	}
}
