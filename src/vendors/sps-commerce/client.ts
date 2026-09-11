import { isPlainObject } from 'es-toolkit'
import { z } from 'zod'

import { ToolError } from '../../core/errors'
import { requireAuth } from '../../core/provider'
import type { FetchLike, ToolContext } from '../../core/types'
import { ArtifactsClient } from '../../modules/artifacts/client'
import { bytesToBase64, toArrayBuffer } from '../../shared/bytes'
import { HttpService } from '../../transport/http-service'
import type { HttpServiceOptions } from '../../transport/http-service'
import * as c from './contracts'
import {
	parseSps,
	parseSpsJsonBytes,
	protectSps,
	spsDocumentUrl,
	spsRenderBody,
	spsRenderQuery,
	spsTransactionPath
} from './domain'

export type SpsCommerceClientOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'> &
	c.SpsCommerceRuntime & {
		now?: (() => Date) | undefined
	}
export type SpsDocumentBytes = { bytes: Uint8Array; media_type: string }

type TokenState = {
	token?: string | undefined
	expiresAt: number
	pending?: { promise: Promise<string>; signal: AbortSignal | undefined } | undefined
}
type TokenCache = {
	clientId: string
	clientSecret: string
	fetch: FetchLike | undefined
	state: TokenState
}
/** Weak ownership avoids a process-wide credential-string cache or cross-account token reuse. */
const tokenCaches = new WeakMap<object, TokenCache>()

function tokenStateFor(key: object, auth: c.SpsCommerceAuth, fetch: FetchLike | undefined): TokenState {
	if ('access_token' in auth) return { expiresAt: 0 }
	const cached = tokenCaches.get(key)
	if (cached?.clientId === auth.client_id && cached.clientSecret === auth.client_secret && cached.fetch === fetch) {
		return cached.state
	}
	const state: TokenState = { expiresAt: 0 }
	tokenCaches.set(key, { clientId: auth.client_id, clientSecret: auth.client_secret, fetch, state })
	return state
}

const tokenSchema = z.object({
	access_token: z
		.string()
		.min(1)
		.regex(/^[^\r\n]+$/),
	expires_in: z.number().positive().finite(),
	token_type: z.string().optional()
})

export class SpsCommerceClient {
	readonly #auth: c.SpsCommerceAuth
	readonly #http: HttpService
	readonly #oauth: HttpService
	readonly #documents: HttpService
	readonly #artifacts: ArtifactsClient | undefined
	readonly #documentOrigins: readonly string[]
	readonly #signal: AbortSignal | undefined
	readonly #now: () => Date
	#tokens: TokenState

	constructor(auth: c.SpsCommerceAuth, options: SpsCommerceClientOptions = {}) {
		this.#auth = parseSps(c.spsCommerceAuthSchema, auth, 'bad_auth')
		const runtime = parseSps(c.spsCommerceRuntimeSchema, options, 'bad_auth')
		this.#documentOrigins = runtime.document_origins ?? []
		this.#signal = options.signal
		this.#now = options.now ?? (() => new Date())
		this.#tokens = tokenStateFor(auth, this.#auth, options.fetch)
		// All I/O still belongs to HttpService. Disable redirects at its fetch boundary,
		// including 307/308 mutation replay and document redirects outside the allowlist.
		const fetch = options.fetch ?? globalThis.fetch
		const noRedirects: FetchLike = (input, init) => fetch(input, { ...init, redirect: 'error' })
		const transport = { fetch: noRedirects, ...(options.signal && { signal: options.signal }) }
		this.#http = new HttpService({ ...transport, baseURL: 'https://api.spscommerce.com', label: 'SPS Commerce' })
		this.#oauth = new HttpService({
			...transport,
			baseURL: 'https://auth.spscommerce.com',
			label: 'SPS authentication'
		})
		this.#documents = new HttpService({ ...transport, label: 'SPS document' })
		this.#artifacts = runtime.artifacts ? ArtifactsClient.fromAuth(runtime.artifacts, options) : undefined
	}

	static fromContext(ctx: ToolContext): SpsCommerceClient {
		const auth = requireAuth(ctx, c.spsCommerceAuthSchema)
		const client = new SpsCommerceClient(auth, {
			...parseSps(c.spsCommerceRuntimeSchema, ctx.extras ?? {}, 'bad_auth'),
			...(ctx.fetch && { fetch: ctx.fetch }),
			...(ctx.signal && { signal: ctx.signal }),
			...(ctx.now && { now: ctx.now })
		})
		if (isPlainObject(ctx.auth)) client.#tokens = tokenStateFor(ctx.auth, auth, ctx.fetch)
		return client
	}

	#checkCancelled(): void {
		if (this.#signal?.aborted) throw new ToolError('SPS request was aborted', { code: 'timeout' })
	}

	async #issueToken(): Promise<string> {
		if ('access_token' in this.#auth) return this.#auth.access_token
		const issuedAt = this.#now().getTime()
		const response = await protectSps(
			this.#oauth.post('/oauth/token', {
				audience: 'https://spscommerce.com',
				grant_type: 'client_credentials',
				client_id: this.#auth.client_id,
				client_secret: this.#auth.client_secret
			}),
			false
		)
		const token = parseSps(tokenSchema, response.data, 'bad_auth')
		if (token.token_type && token.token_type.toLowerCase() !== 'bearer') {
			throw new ToolError('Invalid SPS token type', { code: 'bad_auth' })
		}
		this.#tokens.token = token.access_token
		const lifetime = token.expires_in * 1000
		this.#tokens.expiresAt = issuedAt + lifetime - Math.min(60_000, lifetime * 0.1)
		return token.access_token
	}

	async #headers(): Promise<Record<string, string>> {
		this.#checkCancelled()
		if ('access_token' in this.#auth) return { Authorization: `Bearer ${this.#auth.access_token}` }
		if (this.#tokens.token && this.#now().getTime() < this.#tokens.expiresAt) {
			return { Authorization: `Bearer ${this.#tokens.token}` }
		}
		let pending = this.#tokens.pending
		// Sharing a request tied to somebody else's abort signal would couple cancellations.
		if (!pending || pending.signal !== this.#signal) {
			pending = { promise: this.#issueToken(), signal: this.#signal }
			this.#tokens.pending = pending
		}
		try {
			const token = await pending.promise
			this.#checkCancelled()
			return { Authorization: `Bearer ${token}` }
		} finally {
			if (this.#tokens.pending === pending) this.#tokens.pending = undefined
		}
	}

	#storage(): ArtifactsClient {
		this.#checkCancelled()
		if (!this.#artifacts) throw new ToolError('SPS artifact storage is not configured', { code: 'bad_auth' })
		return this.#artifacts
	}

	async #store(destination: string, document: SpsDocumentBytes) {
		const storage = this.#storage()
		const output = await protectSps(
			storage.create({
				key: destination,
				body: bytesToBase64(document.bytes),
				encoding: 'base64',
				media_type: document.media_type
			}),
			false
		)
		return parseSps(c.spsArtifactOutputSchema, output, 'upstream')
	}

	/** GET /transactions/v5/data/{directory-path}; a single native cursor page. */
	async listTransactions(input: c.SpsListTransactionsInput) {
		const { path, ...query } = parseSps(c.spsListTransactionsInputSchema, input)
		const response = await protectSps(
			this.#http.get(spsTransactionPath(path), { query, headers: await this.#headers() })
		)
		return parseSps(c.spsListTransactionsOutputSchema, response.data, 'upstream')
	}

	/** POST /transactions/v5/data/{file-path}; same-path writes overwrite and are never replayed. */
	async uploadTransactionBytes(input: c.SpsUploadTransactionBytesInput) {
		const parsed = parseSps(c.spsUploadTransactionBytesInputSchema, input)
		if (parsed.bytes.byteLength > c.SPS_TRANSACTION_MAX_BYTES)
			throw new ToolError('SPS transaction exceeds 2 GB', { code: 'too_large' })
		const headers: Record<string, string> = { ...(await this.#headers()), 'Content-Type': 'application/octet-stream' }
		for (const [key, value] of Object.entries(parsed.metadata ?? {})) headers[`sps-meta-${key}`] = value
		const response = await protectSps(
			this.#http.post(spsTransactionPath(parsed.path), toArrayBuffer(parsed.bytes), { headers }),
			false
		)
		return parseSps(c.spsUploadTransactionOutputSchema, response.data, 'upstream')
	}

	async uploadTransaction(input: c.SpsUploadTransactionInput) {
		const parsed = parseSps(c.spsUploadTransactionInputSchema, input)
		const resolved = await protectSps(this.#storage().resolve({ source: parsed.source, max_bytes: parsed.max_bytes }))
		return this.uploadTransactionBytes({
			path: parsed.path,
			bytes: resolved.bytes,
			...(parsed.metadata && { metadata: parsed.metadata })
		})
	}

	/** GET only: never DELETE or acknowledge after reading. */
	async readTransactionBytes(input: c.SpsReadTransactionBytesInput): Promise<SpsDocumentBytes> {
		const parsed = parseSps(c.spsReadTransactionBytesInputSchema, input)
		const response = await protectSps(
			this.#http.bytes('GET', spsTransactionPath(parsed.path), {
				headers: await this.#headers(),
				maxBytes: parsed.max_bytes
			})
		)
		return { bytes: response.bytes, media_type: response.headers.get('content-type') ?? 'application/octet-stream' }
	}

	async readTransaction(input: c.SpsReadTransactionInput) {
		const { destination, ...parsed } = parseSps(c.spsReadTransactionInputSchema, input)
		this.#storage()
		return this.#store(destination, await this.readTransactionBytes(parsed))
	}

	/** DELETE /transactions/v5/data/{file-path}; explicit removal, not business-order acceptance. */
	async deleteTransaction(input: c.SpsTransactionFileInput) {
		const parsed = parseSps(c.spsTransactionFileInputSchema, input)
		await protectSps(this.#http.delete(spsTransactionPath(parsed.path), { headers: await this.#headers() }), false)
		return c.spsDeleteTransactionOutputSchema.parse({ deleted: true })
	}

	/** GET /transactions/v5/history; reports may lag processing by five minutes. */
	async listTransactionHistory(input: c.SpsTransactionHistoryInput = {}) {
		const query = parseSps(c.spsTransactionHistoryInputSchema, input)
		const response = await protectSps(
			this.#http.get('/transactions/v5/history', { query, headers: await this.#headers() })
		)
		return parseSps(c.spsTransactionHistoryOutputSchema, response.data, 'upstream')
	}

	/** GET /label/v1/ */
	async listLabels(input: c.SpsListTemplatesInput = {}) {
		const query = parseSps(c.spsListTemplatesInputSchema, input)
		const response = await protectSps(this.#http.get('/label/v1/', { query, headers: await this.#headers() }))
		return parseSps(c.spsListTemplatesOutputSchema, response.data, 'upstream')
	}

	/** GET /label/v1/{label-id} */
	async getLabel(input: c.SpsTemplateInput) {
		const parsed = parseSps(c.spsTemplateInputSchema, input)
		const response = await protectSps(this.#http.get(`/label/v1/${parsed.id}`, { headers: await this.#headers() }))
		return parseSps(c.spsTemplateSchema, response.data, 'upstream')
	}

	/** GET /label/v1/{label-id}/schema */
	async getLabelSchema(input: c.SpsTemplateSchemaInput) {
		const { id, ...query } = parseSps(c.spsTemplateSchemaInputSchema, input)
		const response = await protectSps(
			this.#http.get(`/label/v1/${id}/schema`, { query, headers: await this.#headers() })
		)
		return parseSps(c.spsJsonObjectSchema, response.data, 'upstream')
	}

	/** GET /label/v1/{label-id}/sample-json */
	async getLabelSample(input: c.SpsTemplateInput) {
		const parsed = parseSps(c.spsTemplateInputSchema, input)
		const response = await protectSps(
			this.#http.get(`/label/v1/${parsed.id}/sample-json`, { headers: await this.#headers() })
		)
		return parseSps(c.spsJsonObjectSchema, response.data, 'upstream')
	}

	/** GET /label/v1/{label-id}/[sample/{sample-uid}/]sample-pdf */
	async getLabelSamplePdfBytes(input: c.SpsSampleLabelBytesInput): Promise<SpsDocumentBytes> {
		const { id, sample_uid, max_bytes, ...query } = parseSps(c.spsSampleLabelBytesInputSchema, input)
		const path = sample_uid ? `/label/v1/${id}/sample/${sample_uid}/sample-pdf` : `/label/v1/${id}/sample-pdf`
		const response = await protectSps(
			this.#http.bytes('GET', path, { query, maxBytes: max_bytes, headers: await this.#headers() })
		)
		return { bytes: response.bytes, media_type: 'application/pdf' }
	}

	async getLabelSamplePdf(input: c.SpsSampleLabelInput) {
		const { destination, ...parsed } = parseSps(c.spsSampleLabelInputSchema, input)
		this.#storage()
		return this.#store(destination, await this.getLabelSamplePdfBytes(parsed))
	}

	/** POST /label/v1/{label-id}/pdf; private direct-byte response (url=false). */
	async renderLabelPdfBytes(input: c.SpsRenderLabelPdfBytesInput): Promise<SpsDocumentBytes> {
		const parsed = parseSps(c.spsRenderLabelPdfBytesInputSchema, input)
		const body = spsRenderBody(parsed.data)
		const query = spsRenderQuery(parsed)
		const response = await protectSps(
			this.#http.bytes('POST', `/label/v1/${parsed.id}/pdf`, {
				body,
				query: { ...query, url: false },
				maxBytes: parsed.max_bytes,
				headers: { ...(await this.#headers()), 'Content-Type': 'application/json' }
			}),
			false
		)
		return { bytes: response.bytes, media_type: 'application/pdf' }
	}

	async renderLabelPdf(input: c.SpsRenderLabelPdfInput) {
		const { destination, ...parsed } = parseSps(c.spsRenderLabelPdfInputSchema, input)
		this.#storage()
		return this.#store(destination, await this.renderLabelPdfBytes(parsed))
	}

	/** POST /label/v1/{label-id}/zpl; native zplData array retained as bounded JSON bytes. */
	async renderLabelZplBytes(input: c.SpsRenderLabelZplBytesInput): Promise<SpsDocumentBytes> {
		const parsed = parseSps(c.spsRenderLabelZplBytesInputSchema, input)
		const body = spsRenderBody(parsed.data)
		const query = spsRenderQuery(parsed)
		const response = await protectSps(
			this.#http.bytes('POST', `/label/v1/${parsed.id}/zpl`, {
				body,
				query: { ...query, url: false },
				maxBytes: parsed.max_bytes,
				headers: { ...(await this.#headers()), 'Content-Type': 'application/json' }
			}),
			false
		)
		parseSps(c.spsZplDataSchema, parseSpsJsonBytes(response.bytes), 'upstream')
		return { bytes: response.bytes, media_type: 'application/json' }
	}

	async renderLabelZpl(input: c.SpsRenderLabelZplInput) {
		const { destination, ...parsed } = parseSps(c.spsRenderLabelZplInputSchema, input)
		this.#storage()
		return this.#store(destination, await this.renderLabelZplBytes(parsed))
	}

	/** POST /label/v1/{label-id}/pdf/batches; no polling or write replay. */
	async createLabelPdfBatch(input: c.SpsCreateLabelPdfBatchInput) {
		const parsed = parseSps(c.spsCreateLabelPdfBatchInputSchema, input)
		const body = spsRenderBody(parsed.data)
		const query = spsRenderQuery(parsed)
		const response = await protectSps(
			this.#http.post(`/label/v1/${parsed.id}/pdf/batches`, body, {
				query,
				headers: { ...(await this.#headers()), 'Content-Type': 'application/json' }
			}),
			false
		)
		return parseSps(c.spsCreateLabelBatchOutputSchema, response.data, 'upstream')
	}

	/** POST /label/v1/{label-id}/zpl/batches */
	async createLabelZplBatch(input: c.SpsCreateLabelZplBatchInput) {
		const parsed = parseSps(c.spsCreateLabelZplBatchInputSchema, input)
		const body = spsRenderBody(parsed.data)
		const query = spsRenderQuery(parsed)
		const response = await protectSps(
			this.#http.post(`/label/v1/${parsed.id}/zpl/batches`, body, {
				query,
				headers: { ...(await this.#headers()), 'Content-Type': 'application/json' }
			}),
			false
		)
		return parseSps(c.spsCreateLabelBatchOutputSchema, response.data, 'upstream')
	}

	/** GET /label/v1/batches/{batchId}; host descriptor includes a potentially signed resultURL. */
	async getLabelBatch(input: c.SpsLabelBatchInput) {
		const parsed = parseSps(c.spsLabelBatchInputSchema, input)
		const response = await protectSps(
			this.#http.get(`/label/v1/batches/${parsed.batch_id}`, { headers: await this.#headers() })
		)
		return parseSps(c.spsLabelBatchStatusSchema, response.data, 'upstream')
	}

	async getLabelBatchStatus(input: c.SpsLabelBatchInput) {
		return c.spsLabelBatchStatusOutputSchema.parse(await this.getLabelBatch(input))
	}

	async getLabelBatchResultBytes(input: c.SpsLabelBatchBytesInput): Promise<SpsDocumentBytes> {
		const parsed = parseSps(c.spsLabelBatchBytesInputSchema, input)
		const batch = await this.getLabelBatch({ batch_id: parsed.batch_id })
		if (batch.status !== 'Completed' || !batch.resultURL) {
			throw new ToolError('SPS label batch has no completed result', { code: 'bad_input' })
		}
		const url = spsDocumentUrl(batch.resultURL, this.#documentOrigins)
		// Separate transport has no SPS authorization or metadata headers.
		const response = await protectSps(this.#documents.bytes('GET', url, { maxBytes: parsed.max_bytes }))
		return { bytes: response.bytes, media_type: response.headers.get('content-type') ?? 'application/octet-stream' }
	}

	async getLabelBatchResult(input: c.SpsLabelBatchResultInput) {
		const { destination, ...parsed } = parseSps(c.spsLabelBatchResultInputSchema, input)
		this.#storage()
		return this.#store(destination, await this.getLabelBatchResultBytes(parsed))
	}

	/** GET /packing-slip/v1/ */
	async listPackingSlips(input: c.SpsListTemplatesInput = {}) {
		const query = parseSps(c.spsListTemplatesInputSchema, input)
		const response = await protectSps(this.#http.get('/packing-slip/v1/', { query, headers: await this.#headers() }))
		return parseSps(c.spsListTemplatesOutputSchema, response.data, 'upstream')
	}

	/** GET /packing-slip/v1/{slip-id} */
	async getPackingSlip(input: c.SpsTemplateInput) {
		const parsed = parseSps(c.spsTemplateInputSchema, input)
		const response = await protectSps(
			this.#http.get(`/packing-slip/v1/${parsed.id}`, { headers: await this.#headers() })
		)
		return parseSps(c.spsTemplateSchema, response.data, 'upstream')
	}

	/** GET /packing-slip/v1/{slip-id}/schema */
	async getPackingSlipSchema(input: c.SpsTemplateSchemaInput) {
		const { id, ...query } = parseSps(c.spsTemplateSchemaInputSchema, input)
		const response = await protectSps(
			this.#http.get(`/packing-slip/v1/${id}/schema`, { query, headers: await this.#headers() })
		)
		return parseSps(c.spsJsonObjectSchema, response.data, 'upstream')
	}

	/** GET /packing-slip/v1/{slip-id}/sample-json */
	async getPackingSlipSample(input: c.SpsTemplateInput) {
		const parsed = parseSps(c.spsTemplateInputSchema, input)
		const response = await protectSps(
			this.#http.get(`/packing-slip/v1/${parsed.id}/sample-json`, { headers: await this.#headers() })
		)
		return parseSps(c.spsJsonObjectSchema, response.data, 'upstream')
	}

	/** GET /packing-slip/v1/{slip-id}/[sample/{sample-uid}/]sample-pdf */
	async getPackingSlipSamplePdfBytes(input: c.SpsSamplePackingSlipBytesInput): Promise<SpsDocumentBytes> {
		const { id, sample_uid, max_bytes, ...query } = parseSps(c.spsSamplePackingSlipBytesInputSchema, input)
		const path = sample_uid
			? `/packing-slip/v1/${id}/sample/${sample_uid}/sample-pdf`
			: `/packing-slip/v1/${id}/sample-pdf`
		const response = await protectSps(
			this.#http.bytes('GET', path, { query, maxBytes: max_bytes, headers: await this.#headers() })
		)
		return { bytes: response.bytes, media_type: 'application/pdf' }
	}

	async getPackingSlipSamplePdf(input: c.SpsSamplePackingSlipInput) {
		const { destination, ...parsed } = parseSps(c.spsSamplePackingSlipInputSchema, input)
		this.#storage()
		return this.#store(destination, await this.getPackingSlipSamplePdfBytes(parsed))
	}

	/** POST /packing-slip/v1/{slip-id}/pdf */
	async renderPackingSlipPdfBytes(input: c.SpsRenderPackingSlipPdfBytesInput): Promise<SpsDocumentBytes> {
		const parsed = parseSps(c.spsRenderPackingSlipPdfBytesInputSchema, input)
		const body = spsRenderBody(parsed.data)
		const response = await protectSps(
			this.#http.bytes('POST', `/packing-slip/v1/${parsed.id}/pdf`, {
				body,
				query: { pendingChange: parsed.pendingChange, url: false },
				maxBytes: parsed.max_bytes,
				headers: { ...(await this.#headers()), 'Content-Type': 'application/json' }
			}),
			false
		)
		return { bytes: response.bytes, media_type: 'application/pdf' }
	}

	async renderPackingSlipPdf(input: c.SpsRenderPackingSlipPdfInput) {
		const { destination, ...parsed } = parseSps(c.spsRenderPackingSlipPdfInputSchema, input)
		this.#storage()
		return this.#store(destination, await this.renderPackingSlipPdfBytes(parsed))
	}

	/** GET /submissions/v1/forms */
	async listSubmissionForms(input: c.SpsListSubmissionFormsInput = {}) {
		const query = parseSps(c.spsListSubmissionFormsInputSchema, input)
		const response = await protectSps(
			this.#http.get('/submissions/v1/forms', { query, headers: await this.#headers() })
		)
		return parseSps(c.spsListSubmissionFormsOutputSchema, response.data, 'upstream')
	}

	/** GET /submissions/v1/forms/{id} */
	async getSubmissionForm(input: c.SpsSubmissionFormInput) {
		const parsed = parseSps(c.spsSubmissionFormInputSchema, input)
		const response = await protectSps(
			this.#http.get(`/submissions/v1/forms/${parsed.id}`, { headers: await this.#headers() })
		)
		return parseSps(c.spsSubmissionFormSchema, response.data, 'upstream')
	}

	/** POST /submissions/v1/trading-partners; creates supplier onboarding records. */
	async createTradingPartners(input: c.SpsCreateTradingPartnersInput) {
		const parsed = parseSps(c.spsCreateTradingPartnersInputSchema, input)
		const response = await protectSps(
			this.#http.post('/submissions/v1/trading-partners', parsed, { headers: await this.#headers() }),
			false
		)
		return parseSps(c.spsCreateTradingPartnersOutputSchema, response.data, 'upstream')
	}
}
