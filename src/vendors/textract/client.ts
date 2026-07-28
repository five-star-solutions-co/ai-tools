/**
 * Amazon Textract vendor client (async text detection).
 * Host: `new TextractClient(auth)`. Agent tools: `fromContext(ctx)`.
 */

import { isPlainObject, isString } from 'es-toolkit'
import { isArray } from 'es-toolkit/compat'

import { ToolError } from '../../core/errors'
import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import { runBatchItems } from '../../shared/batch'
import { parseAwsJsonBody } from '../../transport/aws-json'
import { AwsService } from '../../transport/aws-service'
import type { HttpServiceOptions } from '../../transport/http-service'
import { normalizeKeyPrefix, resolveObjectKey } from '../_storage'
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
import { lineTextFromBlocks, mapJobStatus, sleep } from './domain'

export type TextractClientOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'>

export class TextractClient {
	readonly #auth: TextractAuth
	readonly #aws: AwsService
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
	}

	static fromContext(ctx: ToolContext): TextractClient {
		const auth = requireAuth(ctx, textractAuthSchema)
		return new TextractClient(auth, {
			...(ctx.fetch && { fetch: ctx.fetch }),
			...(ctx.signal && { signal: ctx.signal })
		})
	}

	/** StartDocumentTextDetection + poll until done, failed, or timeout → pending. */
	async extractText(input: TextractExtractTextInput): Promise<TextractExtractResult> {
		if (input.source.store !== 'object') {
			throw new ToolError('Textract requires source.store "object"', { code: 'bad_input' })
		}

		// Logical ArtifactRef.key → wire S3 object name under optional key_prefix.
		const wireName = resolveObjectKey(input.source.key, this.#keyPrefix)

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
						key: input.source.key
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
						source: input.source
					})
				}
				if (status === 'failed') {
					const msg = payload['StatusMessage']
					return textractExtractResultSchema.parse({
						status: 'failed',
						job_id: jobId,
						error: isString(msg) ? msg : 'Textract job failed',
						source: input.source
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
			source: input.source
		})
	}

	/** GetDocumentTextDetection (paged) for an existing job. */
	async getStatus(input: TextractStatusInput): Promise<TextractExtractResult> {
		const payload = await this.#getJobPayload(input.job_id)
		const statusRaw = payload['JobStatus']
		const status = isString(statusRaw) ? mapJobStatus(statusRaw) : 'pending'

		if (status === 'succeeded') {
			const lines = lineTextFromBlocks(payload)
			return textractExtractResultSchema.parse({
				status: 'succeeded',
				job_id: input.job_id,
				text: lines.text,
				...(lines.page_count !== undefined && { page_count: lines.page_count })
			})
		}
		if (status === 'failed') {
			const msg = payload['StatusMessage']
			return textractExtractResultSchema.parse({
				status: 'failed',
				job_id: input.job_id,
				error: isString(msg) ? msg : 'Textract job failed'
			})
		}
		return textractExtractResultSchema.parse({
			status: 'pending',
			job_id: input.job_id
		})
	}

	async extractTextBatch(input: TextractExtractTextBatchInput): Promise<TextractExtractTextBatchOutput> {
		return runBatchItems(input.sources, (source) => this.extractText({ source }))
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
