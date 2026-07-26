/**
 * Gotenberg vendor client.
 * Chromium: HTML/URL → PDF or screenshot.
 * LibreOffice: office documents → PDF (file convert).
 * Host: `new GotenbergClient(auth)`. Agent tools: `fromContext(ctx)`.
 */

import { ToolError } from '../../core/errors'
import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import { artifactRefSchema } from '../../shared/artifact'
import { runBatchItems } from '../../shared/batch'
import { toArrayBuffer } from '../../shared/bytes'
import { HttpService } from '../../transport/http-service'
import type { HttpServiceOptions } from '../../transport/http-service'
import { S3Client } from '../s3'
import type {
	GotenbergAuth,
	GotenbergConvertBatchInput,
	GotenbergConvertInput,
	GotenbergConvertOutput,
	GotenbergRenderOutput,
	GotenbergRenderPdfInput,
	GotenbergRenderScreenshotInput
} from './contracts'
import { gotenbergAuthSchema, gotenbergConvertOutputSchema, gotenbergRenderOutputSchema } from './contracts'
import {
	appendSource,
	defaultRenderKey,
	guessOfficeMediaType,
	htmlPath,
	LIBREOFFICE_CONVERT_PATH,
	officeToPdfResultKey,
	officeUploadName
} from './domain'

export type GotenbergClientOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'>

export class GotenbergClient {
	readonly #auth: GotenbergAuth
	readonly #http: HttpService
	readonly #storage: S3Client

	constructor(auth: GotenbergAuth, options: GotenbergClientOptions = {}) {
		const parsed = gotenbergAuthSchema.safeParse(auth)
		if (!parsed.success) {
			throw new ToolError('Invalid Gotenberg auth credentials', {
				code: 'bad_auth',
				details: { issues: parsed.error.issues.map((issue) => issue.message) }
			})
		}
		this.#auth = parsed.data
		const headers: Record<string, string> = {}
		if (this.#auth.gotenberg_api_username && this.#auth.gotenberg_api_password) {
			const token = btoa(`${this.#auth.gotenberg_api_username}:${this.#auth.gotenberg_api_password}`)
			headers['Authorization'] = `Basic ${token}`
		}
		this.#http = new HttpService({
			...options,
			baseURL: this.#auth.gotenberg_base_url,
			headers,
			label: 'Gotenberg'
		})
		this.#storage = new S3Client(this.#auth.storage, options)
	}

	static fromContext(ctx: ToolContext): GotenbergClient {
		const auth = requireAuth(ctx, gotenbergAuthSchema)
		return new GotenbergClient(auth, {
			...(ctx.fetch && { fetch: ctx.fetch }),
			...(ctx.signal && { signal: ctx.signal })
		})
	}

	/** Chromium HTML/URL → PDF; store result in object storage. */
	async renderPdf(input: GotenbergRenderPdfInput): Promise<GotenbergRenderOutput> {
		return this.#renderAndStore('pdf', input)
	}

	/** Chromium HTML/URL → PNG screenshot; store result in object storage. */
	async renderScreenshot(input: GotenbergRenderScreenshotInput): Promise<GotenbergRenderOutput> {
		return this.#renderAndStore('screenshot', input)
	}

	/**
	 * LibreOffice convert: office document in object storage → PDF ArtifactRef.
	 * Path: office-to-pdf only (docx/pptx/xlsx/odt/…). Not for HTML layout print.
	 */
	async convert(input: GotenbergConvertInput): Promise<GotenbergConvertOutput> {
		if (input.source.store !== 'object') {
			throw new ToolError('Gotenberg convert requires source.store "object"', { code: 'bad_input' })
		}
		// path is a closed enum (office-to-pdf); future paths branch here.

		const bytes = await this.#storage.getBytes(input.source.key)
		const filename = officeUploadName(input.source, input.filename)
		const mediaType = guessOfficeMediaType(filename, input.source.media_type)

		const form = new FormData()
		const blob = new Blob([toArrayBuffer(bytes)], { type: mediaType })
		form.append('files', blob, filename)

		const { bytes: outBytes } = await this.#http.bytes('POST', LIBREOFFICE_CONVERT_PATH, {
			label: 'Gotenberg libreoffice convert',
			body: form
		})

		const resultKey = officeToPdfResultKey(input.source.key, input.output_key)
		const resultName = filename.replace(/\.[^./]+$/, '') + '.pdf'
		await this.#storage.putBytes(resultKey, outBytes, 'application/pdf')

		const result = artifactRefSchema.parse({
			store: 'object',
			key: resultKey,
			media_type: 'application/pdf',
			filename: resultName,
			byte_length: outBytes.byteLength
		})

		return gotenbergConvertOutputSchema.parse({
			source: input.source,
			result,
			path: 'office-to-pdf'
		})
	}

	async convertBatch(input: GotenbergConvertBatchInput) {
		return runBatchItems(input.items, (item) => this.convert(item))
	}

	async #renderAndStore(
		kind: 'pdf' | 'screenshot',
		input: GotenbergRenderPdfInput | GotenbergRenderScreenshotInput
	): Promise<GotenbergRenderOutput> {
		const form = new FormData()
		appendSource(form, input.source)
		if (kind === 'screenshot' && 'viewport' in input && input.viewport) {
			form.append('width', String(input.viewport.width))
			form.append('height', String(input.viewport.height))
			if (input.viewport.device_scale_factor !== undefined) {
				form.append('deviceScaleFactor', String(input.viewport.device_scale_factor))
			}
		}

		const path = htmlPath(kind, input.source)
		const { bytes } = await this.#http.bytes('POST', path, {
			label: `Gotenberg ${kind}`,
			body: form
		})

		const mediaType = kind === 'pdf' ? 'application/pdf' : 'image/png'
		const key = defaultRenderKey(kind, input.output_key)
		const filename = input.filename ?? (kind === 'pdf' ? 'render.pdf' : 'render.png')
		await this.#storage.putBytes(key, bytes, mediaType)

		const result = artifactRefSchema.parse({
			store: 'object',
			key,
			media_type: mediaType,
			filename,
			byte_length: bytes.byteLength
		})
		return gotenbergRenderOutputSchema.parse({ result, kind })
	}
}
