/**
 * Document-extract seam client — picks a provider class from host auth.
 * Applies output presentation (inline | artifact | chunks) after provider extract.
 */

import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import { utf8ToBytes } from '../../shared/bytes'
import type { HttpServiceOptions } from '../../transport/http-service'
import { S3Client } from '../../vendors/s3'
import { documentExtractAuthSchema } from './contracts'
import type {
	DocumentExtractAuth,
	DocumentExtractOps,
	DocumentExtractProviderOps,
	ExtractResult,
	ExtractTextBatchInput,
	ExtractTextBatchOutput,
	ExtractTextInput,
	StatusInput
} from './contracts'
import { presentExtractResult } from './domain'
import type { PresentOptions } from './domain'
import { TextractDocumentExtractProvider } from './providers/textract'

function transportOptions(ctx: ToolContext): Pick<HttpServiceOptions, 'fetch' | 'signal'> {
	return {
		...(ctx.fetch && { fetch: ctx.fetch }),
		...(ctx.signal && { signal: ctx.signal })
	}
}

function providerFor(auth: DocumentExtractAuth, ctx: ToolContext): DocumentExtractProviderOps {
	const options = transportOptions(ctx)
	switch (auth.provider) {
		case 'textract':
			return new TextractDocumentExtractProvider(auth, options)
	}
}

function s3FromAuth(auth: DocumentExtractAuth, options: Pick<HttpServiceOptions, 'fetch' | 'signal'>): S3Client {
	if (auth.provider === 'textract') {
		return new S3Client(
			{
				access_key_id: auth.access_key_id,
				secret_access_key: auth.secret_access_key,
				region: auth.region,
				bucket: auth.bucket,
				...(auth.session_token && { session_token: auth.session_token }),
				...(auth.key_prefix && { key_prefix: auth.key_prefix })
			},
			options
		)
	}
	throw new Error('Unsupported document-extract provider for storage')
}

function presentOpts(
	output: ExtractTextInput['output'],
	destinationKey: string | undefined,
	chunk: ExtractTextInput['chunk'],
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

export class DocumentExtractClient implements DocumentExtractOps {
	readonly #ops: DocumentExtractProviderOps
	readonly #storage: S3Client

	constructor(ops: DocumentExtractProviderOps, storage: S3Client) {
		this.#ops = ops
		this.#storage = storage
	}

	static fromContext(ctx: ToolContext): DocumentExtractClient {
		const auth = requireAuth(ctx, documentExtractAuthSchema)
		const options = transportOptions(ctx)
		return new DocumentExtractClient(providerFor(auth, ctx), s3FromAuth(auth, options))
	}

	static fromAuth(auth: DocumentExtractAuth, ctx: ToolContext = {}): DocumentExtractClient {
		const options = transportOptions(ctx)
		return new DocumentExtractClient(providerFor(auth, ctx), s3FromAuth(auth, options))
	}

	async extractText(input: ExtractTextInput): Promise<ExtractResult> {
		const raw = await this.#ops.extractText({ source: input.source })
		return presentExtractResult(
			raw,
			presentOpts(input.output, input.destination_key, input.chunk, input.source.key),
			(key, text) => this.#writeExtractArtifact(key, text, input.source.filename)
		)
	}

	async getStatus(input: StatusInput): Promise<ExtractResult> {
		const raw = await this.#ops.getStatus({ job_id: input.job_id })
		return presentExtractResult(
			raw,
			presentOpts(input.output, input.destination_key, input.chunk, raw.source?.key),
			(key, text) => this.#writeExtractArtifact(key, text, raw.source?.filename)
		)
	}

	async extractTextBatch(input: ExtractTextBatchInput): Promise<ExtractTextBatchOutput> {
		const rawBatch = await this.#ops.extractTextBatch({ sources: input.sources })
		const prefix = input.destination_key_prefix ?? 'extracts/'
		const results: ExtractTextBatchOutput['results'] = []
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
}
