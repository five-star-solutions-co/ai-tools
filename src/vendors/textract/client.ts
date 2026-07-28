/**
 * Amazon Textract vendor client (async text detection + presentation).
 * Host: `new TextractClient(auth)`. Agent tools: `fromContext(ctx)`.
 * Output modes (inline | artifact | chunks) live here — not in the seam module.
 */

import { isPlainObject, isString } from 'es-toolkit'
import { isArray } from 'es-toolkit/compat'

import { ToolError } from '../../core/errors'
import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import { runBatchItems } from '../../shared/batch'
import { utf8ToBytes } from '../../shared/bytes'
import { parseAwsJsonBody } from '../../transport/aws-json'
import { AwsService } from '../../transport/aws-service'
import type { HttpServiceOptions } from '../../transport/http-service'
import { normalizeKeyPrefix, resolveObjectKey } from '../_storage'
import { S3Client } from '../s3'
import type {
	TextractAuth,
	TextractExtractResult,
	TextractExtractTextBatchInput,
	TextractExtractTextBatchOutput,
	TextractExtractTextInput,
	TextractStatusInput
} from './contracts'
import {
	DEFAULT_POLL_INTERVAL_MS,
	DEFAULT_POLL_TIMEOUT_MS,
	textractAuthSchema,
	textractExtractResultSchema
} from './contracts'
import { lineTextFromBlocks, mapJobStatus, presentExtractResult, sleep } from './domain'
import type { PresentOptions } from './domain'

export type TextractClientOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'>

export class TextractClient {
	readonly #auth: TextractAuth
	readonly #aws: AwsService
	readonly #storage: S3Client
	readonly #signal: AbortSignal | undefined
	/** Normalized key_prefix with trailing `/`, or undefined when unbound. */
	readonly #keyPrefix: string | undefined

	constructor(auth: TextractAuth, options: TextractClientOptions = {}) {
		const parsed = textractAuthSchema.safeParse(auth)
		if (!parsed.success) {
			throw new ToolError('Invalid Textract auth credentials', {
				code: 'bad_auth',
				details: { issues: parsed.error.issues.map((issue) => issue.message) }
			})
		}
		this.#auth = parsed.data
		this.#keyPrefix = parsed.data.key_prefix !== undefined ? normalizeKeyPrefix(parsed.data.key_prefix) : undefined
		this.#signal = options.signal
		this.#aws = new AwsService({
			...options,
			accessKeyId: this.#auth.access_key_id,
			secretAccessKey: this.#auth.secret_access_key,
			region: this.#auth.region,
			service: 'textract',
			baseURL: `https://textract.${this.#auth.region}.amazonaws.com`,
			label: 'Textract',
			...(this.#auth.session_token && { sessionToken: this.#auth.session_token })
		})
		this.#storage = new S3Client(
			{
				access_key_id: this.#auth.access_key_id,
				secret_access_key: this.#auth.secret_access_key,
				region: this.#auth.region,
				bucket: this.#auth.bucket,
				...(this.#auth.session_token && { session_token: this.#auth.session_token }),
				...(this.#auth.key_prefix && { key_prefix: this.#auth.key_prefix })
			},
			options
		)
	}

	static fromContext(ctx: ToolContext): TextractClient {
		const auth = requireAuth(ctx, textractAuthSchema)
		return new TextractClient(auth, {
			...(ctx.fetch && { fetch: ctx.fetch }),
			...(ctx.signal && { signal: ctx.signal })
		})
	}

	/** StartDocumentTextDetection + poll until done, failed, or timeout → pending; then present. */
	async extractText(input: TextractExtractTextInput): Promise<TextractExtractResult> {
		const raw = await this.#extractRaw(input.source)
		return presentExtractResult(
			raw,
			presentOpts(input.output, input.destination_key, input.chunk, input.source.key),
			(key, text) => this.#writeExtractArtifact(key, text, input.source.filename)
		)
	}

	/** GetDocumentTextDetection (paged) for an existing job; then present. */
	async getStatus(input: TextractStatusInput): Promise<TextractExtractResult> {
		const raw = await this.#statusRaw(input.job_id)
		return presentExtractResult(
			raw,
			presentOpts(input.output, input.destination_key, input.chunk, raw.source?.key),
			(key, text) => this.#writeExtractArtifact(key, text, raw.source?.filename)
		)
	}

	async extractTextBatch(input: TextractExtractTextBatchInput): Promise<TextractExtractTextBatchOutput> {
		const prefix = input.destination_key_prefix ?? 'extracts/'
		const rawBatch = await runBatchItems(input.sources, (source) => this.#extractRaw(source))
		const results: TextractExtractTextBatchOutput['results'] = []
		let succeeded = 0
		let failed = 0

		for (const row of rawBatch.results) {
			if (!row.ok || row.value === undefined) {
				results.push(row)
				failed += 1
				continue
			}
			const source = input.sources[row.index]
			const destKey =
				input.destination_key ??
				`${prefix.replace(/\/?$/, '/')}${source?.key.replace(/^.*\//, '') || `item-${row.index}`}.txt`
			try {
				const presented = await presentExtractResult(
					row.value,
					presentOpts(input.output, destKey, input.chunk, source?.key),
					(key, text) => this.#writeExtractArtifact(key, text, source?.filename)
				)
				results.push({ index: row.index, ok: true, value: presented })
				succeeded += 1
			} catch (error) {
				const message = error instanceof Error ? error.message : 'Presentation failed'
				const code =
					error instanceof Error && 'code' in error && typeof error.code === 'string' ? error.code : 'internal'
				results.push({
					index: row.index,
					ok: false,
					error: { code, message }
				})
				failed += 1
			}
		}

		return { results, succeeded, failed }
	}

	async #extractRaw(source: TextractExtractTextInput['source']): Promise<TextractExtractResult> {
		if (source.store !== 'object') {
			throw new ToolError('Textract requires source.store "object"', { code: 'bad_input' })
		}

		// Logical ArtifactRef.key → wire S3 object name under optional key_prefix.
		const wireName = resolveObjectKey(source.key, this.#keyPrefix)

		let start: Record<string, unknown>
		try {
			start = await this.#call('Textract.StartDocumentTextDetection', {
				DocumentLocation: {
					S3Object: {
						Bucket: this.#auth.bucket,
						Name: wireName
					}
				}
			})
		} catch (error) {
			if (error instanceof ToolError) {
				throw new ToolError(error.message, {
					code: error.code,
					retryable: error.retryable,
					cause: error.cause,
					details: {
						...(isPlainObject(error.details) ? error.details : {}),
						// Surface logical key to callers (not wire path).
						key: source.key
					}
				})
			}
			throw error
		}

		const jobId = start['JobId']
		if (!isString(jobId) || jobId.length === 0) {
			throw new ToolError('Textract did not return a JobId', { code: 'upstream' })
		}

		const timeoutMs = this.#auth.poll_timeout_ms ?? DEFAULT_POLL_TIMEOUT_MS
		const intervalMs = this.#auth.poll_interval_ms ?? DEFAULT_POLL_INTERVAL_MS
		const deadline = Date.now() + timeoutMs

		try {
			while (Date.now() < deadline) {
				const payload = await this.#getJobPayload(jobId)
				const statusRaw = payload['JobStatus']
				const status = isString(statusRaw) ? mapJobStatus(statusRaw) : 'pending'

				if (status === 'succeeded') {
					const lines = lineTextFromBlocks(payload)
					return textractExtractResultSchema.parse({
						status: 'succeeded',
						job_id: jobId,
						text: lines.text,
						...(lines.page_count !== undefined && { page_count: lines.page_count }),
						source
					})
				}
				if (status === 'failed') {
					const msg = payload['StatusMessage']
					return textractExtractResultSchema.parse({
						status: 'failed',
						job_id: jobId,
						error: isString(msg) ? msg : 'Textract job failed',
						source
					})
				}

				const remaining = deadline - Date.now()
				if (remaining <= 0) break
				await sleep(Math.min(intervalMs, remaining), this.#signal)
			}
		} catch (error) {
			if (error instanceof ToolError) throw error
			if (error instanceof Error && error.name === 'AbortError') {
				throw new ToolError('Textract extract was aborted', {
					code: 'timeout',
					retryable: true,
					cause: error
				})
			}
			throw error
		}

		return textractExtractResultSchema.parse({
			status: 'pending',
			job_id: jobId,
			source
		})
	}

	async #statusRaw(jobId: string): Promise<TextractExtractResult> {
		const payload = await this.#getJobPayload(jobId)
		const statusRaw = payload['JobStatus']
		const status = isString(statusRaw) ? mapJobStatus(statusRaw) : 'pending'

		if (status === 'succeeded') {
			const lines = lineTextFromBlocks(payload)
			return textractExtractResultSchema.parse({
				status: 'succeeded',
				job_id: jobId,
				text: lines.text,
				...(lines.page_count !== undefined && { page_count: lines.page_count })
			})
		}
		if (status === 'failed') {
			const msg = payload['StatusMessage']
			return textractExtractResultSchema.parse({
				status: 'failed',
				job_id: jobId,
				error: isString(msg) ? msg : 'Textract job failed'
			})
		}
		return textractExtractResultSchema.parse({
			status: 'pending',
			job_id: jobId
		})
	}

	async #writeExtractArtifact(key: string, text: string, filename?: string) {
		const bytes = utf8ToBytes(text)
		await this.#storage.putBytes(key, bytes, 'text/plain; charset=utf-8')
		return {
			store: 'object' as const,
			key,
			media_type: 'text/plain',
			byte_length: bytes.byteLength,
			...(filename && { filename: filename.replace(/\.[^.]+$/, '') + '.txt' })
		}
	}

	async #getJobPayload(jobId: string): Promise<Record<string, unknown>> {
		const allBlocks: unknown[] = []
		let nextToken: string | undefined
		let jobStatus = 'IN_PROGRESS'
		let page_count: number | undefined

		do {
			const body: Record<string, unknown> = {
				JobId: jobId,
				MaxResults: 1000,
				...(nextToken && { NextToken: nextToken })
			}
			const page = await this.#call('Textract.GetDocumentTextDetection', body)
			const status = page['JobStatus']
			if (isString(status)) jobStatus = status

			const blocks = page['Blocks']
			if (isArray(blocks)) allBlocks.push(...blocks)

			const meta = page['DocumentMetadata']
			if (isPlainObject(meta) && typeof meta['Pages'] === 'number') {
				page_count = meta['Pages']
			}

			const token = page['NextToken']
			nextToken = isString(token) && token.length > 0 ? token : undefined
			if (jobStatus !== 'SUCCEEDED' && jobStatus !== 'PARTIAL_SUCCESS') {
				nextToken = undefined
			}
		} while (nextToken)

		return {
			JobStatus: jobStatus,
			Blocks: allBlocks,
			...(page_count !== undefined && { DocumentMetadata: { Pages: page_count } })
		}
	}

	async #call(target: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
		const res = await this.#aws.post('/', JSON.stringify(body), {
			headers: {
				'Content-Type': 'application/x-amz-json-1.1',
				'X-Amz-Target': target
			},
			label: `Textract ${target}`,
			// Surface AWS __type / Message instead of a bare "HTTP 400"
			noThrow: true
		})
		// ofetch does not JSON-parse application/x-amz-json-1.1 (returns Blob/string)
		const payload = await parseAwsJsonBody(res.data)
		if (!res.ok) {
			throw new ToolError(formatTextractError(target, res.status, payload), {
				code: res.status === 401 || res.status === 403 ? 'bad_auth' : 'upstream',
				retryable: res.status >= 500 || res.status === 429,
				details: {
					status: res.status,
					...(isPlainObject(payload) && isString(payload['__type']) && { aws_type: payload['__type'] }),
					bucket: this.#auth.bucket,
					region: this.#auth.region
				}
			})
		}
		if (!isPlainObject(payload)) {
			throw new ToolError('Textract returned a non-object payload', { code: 'upstream' })
		}
		return payload
	}
}

function presentOpts(
	output: TextractExtractTextInput['output'],
	destinationKey: string | undefined,
	chunk: TextractExtractTextInput['chunk'],
	sourceKey: string | undefined
): PresentOptions {
	const opts: PresentOptions = {}
	if (output !== undefined) opts.output = output
	if (destinationKey !== undefined) opts.destination_key = destinationKey
	if (chunk !== undefined) {
		const c: NonNullable<PresentOptions['chunk']> = {}
		if (chunk.max_chars !== undefined) c.max_chars = chunk.max_chars
		if (chunk.overlap !== undefined) c.overlap = chunk.overlap
		opts.chunk = c
	}
	if (sourceKey !== undefined) opts.source_key = sourceKey
	return opts
}

function formatTextractError(target: string, status: number, payload: unknown): string {
	if (isPlainObject(payload)) {
		const type = isString(payload['__type']) ? payload['__type'].split('#').pop() : undefined
		const message =
			(isString(payload['message']) && payload['message']) ||
			(isString(payload['Message']) && payload['Message']) ||
			undefined
		if (type && message) return `Textract ${target}: ${type}: ${message}`
		if (message) return `Textract ${target}: ${message}`
		if (type) return `Textract ${target}: ${type} (HTTP ${status})`
	}
	return `Textract ${target} failed with HTTP ${status}`
}
