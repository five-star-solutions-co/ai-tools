/**
 * S3 / S3-compatible object-store client (AwsService SigV4).
 * Host: `new S3Client(auth)`. Agent tools: `fromContext(ctx)`.
 */

import { isNil, isString } from 'es-toolkit'

import { isToolError, ToolError } from '../../core/errors'
import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import { base64ToBytes, bytesToBase64, bytesToUtf8, toArrayBuffer, utf8ToBytes } from '../../shared/bytes'
import { AwsService } from '../../transport/aws-service'
import type { AwsServiceOptions } from '../../transport/aws-service'
import type { HttpServiceOptions } from '../../transport/http-service'
import type {
	AbortMultipartUploadInput,
	AbortMultipartUploadOutput,
	CompleteMultipartUploadInput,
	CompleteMultipartUploadOutput,
	CopyObjectInput,
	CopyObjectOutput,
	CreateMultipartUploadInput,
	CreateMultipartUploadOutput,
	DeleteObjectInput,
	DeleteObjectOutput,
	GetObjectInput,
	GetObjectOutput,
	HeadObjectInput,
	HeadObjectOutput,
	ListObjectsInput,
	ListObjectsOutput,
	PutObjectInput,
	PutObjectOutput,
	S3Auth,
	SignedUrlInput,
	SignedUrlOutput,
	UploadPartInput,
	UploadPartOutput
} from './contracts'
import { DEFAULT_SIGNED_URL_SECONDS, MAX_MULTIPART_PART_BYTES, MAX_OBJECT_BYTES, s3AuthSchema } from './contracts'
import {
	contentRangeTotal,
	copySourceHeader,
	firstXmlText,
	listUrl,
	objectUrl,
	parseListResult,
	stripEtagQuotes
} from './domain'

export type S3ClientOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'>

function objectNotFound(): never {
	throw new ToolError('Object not found', { code: 'not_found' })
}

function remapNotFound(error: unknown): never {
	if (isToolError(error) && error.code === 'not_found') objectNotFound()
	throw error
}

export class S3Client {
	readonly #auth: S3Auth
	readonly #aws: AwsService

	constructor(auth: S3Auth, options: S3ClientOptions = {}) {
		const parsed = s3AuthSchema.safeParse(auth)
		if (!parsed.success) {
			throw new ToolError('Invalid S3 auth credentials', {
				code: 'bad_auth',
				details: { issues: parsed.error.issues.map((issue) => issue.message) }
			})
		}
		this.#auth = parsed.data

		const awsOptions: AwsServiceOptions = {
			accessKeyId: this.#auth.access_key_id,
			secretAccessKey: this.#auth.secret_access_key,
			region: this.#auth.region,
			service: 's3',
			label: 'S3'
		}
		if (options.fetch) awsOptions.fetch = options.fetch
		if (options.signal) awsOptions.signal = options.signal
		if (this.#auth.session_token) awsOptions.sessionToken = this.#auth.session_token
		this.#aws = new AwsService(awsOptions)
	}

	static fromContext(ctx: ToolContext): S3Client {
		const auth = requireAuth(ctx, s3AuthSchema)
		const options: S3ClientOptions = {}
		if (ctx.fetch) options.fetch = ctx.fetch
		if (ctx.signal) options.signal = ctx.signal
		return new S3Client(auth, options)
	}

	async list(input: ListObjectsInput): Promise<ListObjectsOutput> {
		const params = new URLSearchParams({ 'list-type': '2' })
		if (input.prefix) params.set('prefix', input.prefix)
		if (input.delimiter) params.set('delimiter', input.delimiter)
		if (input.cursor) params.set('continuation-token', input.cursor)
		if (input.limit !== undefined) params.set('max-keys', String(input.limit))

		const { bytes } = await this.#aws.bytes('GET', listUrl(this.#auth, params), { label: 'S3 list' })
		const listed = parseListResult(bytesToUtf8(bytes))
		const out: ListObjectsOutput = {
			keys: listed.items.map((o) => o.key),
			items: listed.items,
			truncated: listed.truncated
		}
		if (listed.common_prefixes && listed.common_prefixes.length > 0) {
			out.common_prefixes = listed.common_prefixes
		}
		if (listed.next_cursor) out.next_cursor = listed.next_cursor
		return out
	}

	/** HEAD size gate + Range GET (and If-Match when etag known). Never buffers past maxBytes+1. */
	async #getBounded(
		key: string,
		maxBytes: number,
		limitMessage: string
	): Promise<{ bytes: Uint8Array; headers: Headers; head: HeadObjectOutput }> {
		const head = await this.head({ key })
		if (!head.exists) objectNotFound()
		if (!isNil(head.content_length) && head.content_length > maxBytes) {
			throw new ToolError(limitMessage, {
				code: 'too_large',
				details: { max_bytes: maxBytes, content_length: head.content_length }
			})
		}

		const headers: Record<string, string> = { Range: `bytes=0-${maxBytes}` }
		if (head.etag) headers['If-Match'] = head.etag.startsWith('"') ? head.etag : `"${head.etag}"`

		let response
		try {
			response = await this.#aws.bytes('GET', objectUrl(this.#auth, key), { label: 'S3 get', headers })
		} catch (error) {
			if (isToolError(error) && error.details?.['status'] === 412) {
				throw new ToolError('Object changed during download', {
					code: 'upstream',
					details: { status: 412, key },
					cause: error
				})
			}
			remapNotFound(error)
		}

		if (response.bytes.byteLength > maxBytes) {
			throw new ToolError(limitMessage, {
				code: 'too_large',
				details: {
					max_bytes: maxBytes,
					content_length: contentRangeTotal(response.headers.get('content-range')) ?? response.bytes.byteLength
				}
			})
		}
		return { bytes: response.bytes, headers: response.headers, head }
	}

	async get(input: GetObjectInput): Promise<GetObjectOutput> {
		const {
			bytes: bodyBytes,
			headers: responseHeaders,
			head
		} = await this.#getBounded(input.key, MAX_OBJECT_BYTES, 'Object exceeds 5 MiB download limit')
		const encoding = input.encoding ?? 'base64'
		const body = encoding === 'utf8' ? bytesToUtf8(bodyBytes) : bytesToBase64(bodyBytes)
		const contentType = responseHeaders.get('content-type') ?? head.content_type
		const lengthHeader = responseHeaders.get('content-length')
		const contentLength = isString(lengthHeader) ? Number.parseInt(lengthHeader, 10) : head.content_length
		const out: GetObjectOutput = {
			key: input.key,
			body,
			encoding
		}
		if (isString(contentType)) out.content_type = contentType
		// Prefer HEAD length (full object); Range responses report partial Content-Length.
		out.content_length =
			!isNil(head.content_length) && Number.isFinite(head.content_length)
				? head.content_length
				: isNil(contentLength) || !Number.isFinite(contentLength)
					? bodyBytes.byteLength
					: contentLength
		return out
	}

	async put(input: PutObjectInput): Promise<PutObjectOutput> {
		const encoding = input.body_encoding ?? 'utf8'
		let bodyBytes: Uint8Array
		try {
			bodyBytes = encoding === 'base64' ? base64ToBytes(input.body) : utf8ToBytes(input.body)
		} catch (error) {
			if (isToolError(error) && error.code === 'bad_input') throw error
			throw new ToolError('Invalid body encoding for putObject', {
				code: 'bad_input',
				cause: error
			})
		}
		if (bodyBytes.byteLength > MAX_OBJECT_BYTES) {
			throw new ToolError('Object exceeds 5 MiB upload limit', {
				code: 'too_large',
				details: { max_bytes: MAX_OBJECT_BYTES, content_length: bodyBytes.byteLength }
			})
		}
		const headers: Record<string, string> = {}
		if (input.content_type) headers['Content-Type'] = input.content_type

		const response = await this.#aws.put(objectUrl(this.#auth, input.key), toArrayBuffer(bodyBytes), {
			label: 'S3 put',
			headers
		})
		const etag = response.headers.get('etag')
		const out: PutObjectOutput = {
			key: input.key,
			content_length: bodyBytes.byteLength
		}
		if (isString(etag)) out.etag = stripEtagQuotes(etag)
		return out
	}

	async delete(input: DeleteObjectInput): Promise<DeleteObjectOutput> {
		await this.#aws.delete(objectUrl(this.#auth, input.key), {
			label: 'S3 delete',
			allowStatuses: [404]
		})
		return { key: input.key, deleted: true }
	}

	async head(input: HeadObjectInput): Promise<HeadObjectOutput> {
		const response = await this.#aws.head(objectUrl(this.#auth, input.key), {
			label: 'S3 head',
			allowStatuses: [404]
		})
		if (response.status === 404) {
			return { key: input.key, exists: false }
		}
		const contentType = response.headers.get('content-type')
		const lengthHeader = response.headers.get('content-length')
		const etag = response.headers.get('etag')
		const contentLength = isString(lengthHeader) ? Number.parseInt(lengthHeader, 10) : undefined
		const out: HeadObjectOutput = {
			key: input.key,
			exists: true
		}
		if (isString(contentType)) out.content_type = contentType
		if (!isNil(contentLength) && Number.isFinite(contentLength)) out.content_length = contentLength
		if (isString(etag)) out.etag = stripEtagQuotes(etag)
		return out
	}

	async copy(input: CopyObjectInput): Promise<CopyObjectOutput> {
		const response = await this.#aws.bytes('PUT', objectUrl(this.#auth, input.destination_key), {
			label: 'S3 copy',
			headers: {
				'x-amz-copy-source': copySourceHeader(this.#auth, input.source_key, input.source_bucket)
			}
		})
		const xml = bytesToUtf8(response.bytes)
		const etagRaw = firstXmlText(xml, 'ETag')
		const headerEtag = response.headers.get('etag')
		const etag = etagRaw ? stripEtagQuotes(etagRaw) : isString(headerEtag) ? stripEtagQuotes(headerEtag) : undefined
		const out: CopyObjectOutput = {
			source_key: input.source_key,
			destination_key: input.destination_key
		}
		if (etag) out.etag = etag
		return out
	}

	async createSignedUrl(input: SignedUrlInput): Promise<SignedUrlOutput> {
		const method = input.method ?? 'GET'
		const expiresIn = input.expires_in ?? DEFAULT_SIGNED_URL_SECONDS
		const url = objectUrl(this.#auth, input.key, `X-Amz-Expires=${expiresIn}`)
		const signed = await this.#aws.sign(url, {
			method,
			signQuery: true
		})
		return {
			url: signed.url,
			method,
			expires_in: expiresIn
		}
	}

	async createMultipartUpload(input: CreateMultipartUploadInput): Promise<CreateMultipartUploadOutput> {
		const headers: Record<string, string> = {}
		if (input.content_type) headers['Content-Type'] = input.content_type
		const { bytes } = await this.#aws.bytes('POST', objectUrl(this.#auth, input.key, 'uploads'), {
			label: 'S3 create multipart upload',
			headers
		})
		const uploadIdRaw = firstXmlText(bytesToUtf8(bytes), 'UploadId')
		if (!uploadIdRaw) {
			throw new ToolError('S3 create multipart upload returned no UploadId', { code: 'upstream' })
		}
		return {
			key: input.key,
			upload_id: uploadIdRaw
		}
	}

	async uploadPart(input: UploadPartInput): Promise<UploadPartOutput> {
		const encoding = input.body_encoding ?? 'utf8'
		let bodyBytes: Uint8Array
		try {
			bodyBytes = encoding === 'base64' ? base64ToBytes(input.body) : utf8ToBytes(input.body)
		} catch (error) {
			if (isToolError(error) && error.code === 'bad_input') throw error
			throw new ToolError('Invalid body encoding for uploadPart', {
				code: 'bad_input',
				cause: error
			})
		}
		if (bodyBytes.byteLength > MAX_MULTIPART_PART_BYTES) {
			throw new ToolError('Multipart part exceeds 25 MiB upload limit', {
				code: 'too_large',
				details: { max_bytes: MAX_MULTIPART_PART_BYTES, content_length: bodyBytes.byteLength }
			})
		}
		if (bodyBytes.byteLength === 0) {
			throw new ToolError('Multipart part body must not be empty', { code: 'bad_input' })
		}
		const query = new URLSearchParams({
			partNumber: String(input.part_number),
			uploadId: input.upload_id
		})
		const response = await this.#aws.put(objectUrl(this.#auth, input.key, query.toString()), toArrayBuffer(bodyBytes), {
			label: 'S3 upload part'
		})
		const etagHeader = response.headers.get('etag')
		if (!isString(etagHeader) || etagHeader.length === 0) {
			throw new ToolError('S3 upload part returned no ETag', { code: 'upstream' })
		}
		return {
			key: input.key,
			upload_id: input.upload_id,
			part_number: input.part_number,
			etag: stripEtagQuotes(etagHeader),
			content_length: bodyBytes.byteLength
		}
	}

	async completeMultipartUpload(input: CompleteMultipartUploadInput): Promise<CompleteMultipartUploadOutput> {
		const sorted = [...input.parts].sort((a, b) => a.part_number - b.part_number)
		const partsXml = sorted
			.map((part) => {
				const etag = stripEtagQuotes(part.etag)
				return `<Part><PartNumber>${part.part_number}</PartNumber><ETag>"${etag}"</ETag></Part>`
			})
			.join('')
		const body = `<CompleteMultipartUpload>${partsXml}</CompleteMultipartUpload>`
		const query = new URLSearchParams({ uploadId: input.upload_id })
		const response = await this.#aws.bytes('POST', objectUrl(this.#auth, input.key, query.toString()), {
			label: 'S3 complete multipart upload',
			body,
			headers: { 'Content-Type': 'application/xml' }
		})
		const xml = bytesToUtf8(response.bytes)
		const etagRaw = firstXmlText(xml, 'ETag')
		const headerEtag = response.headers.get('etag')
		const etag = etagRaw ? stripEtagQuotes(etagRaw) : isString(headerEtag) ? stripEtagQuotes(headerEtag) : undefined
		const out: CompleteMultipartUploadOutput = {
			key: input.key,
			upload_id: input.upload_id
		}
		if (etag) out.etag = etag
		return out
	}

	async abortMultipartUpload(input: AbortMultipartUploadInput): Promise<AbortMultipartUploadOutput> {
		const query = new URLSearchParams({ uploadId: input.upload_id })
		await this.#aws.delete(objectUrl(this.#auth, input.key, query.toString()), {
			label: 'S3 abort multipart upload',
			allowStatuses: [404]
		})
		return { key: input.key, upload_id: input.upload_id, aborted: true }
	}

	/** Host-facing raw download. Pass `maxBytes` to enforce a hard download cap. */
	async getBytes(key: string, options: { maxBytes?: number } = {}): Promise<Uint8Array> {
		const maxBytes = options.maxBytes
		if (maxBytes !== undefined) {
			const { bytes } = await this.#getBounded(key, maxBytes, 'Object exceeds download limit')
			return bytes
		}
		try {
			const { bytes } = await this.#aws.bytes('GET', objectUrl(this.#auth, key), { label: 'S3 get' })
			return bytes
		} catch (error) {
			remapNotFound(error)
		}
	}

	/** Host-facing raw upload. */
	async putBytes(key: string, bytes: Uint8Array, contentType?: string): Promise<void> {
		const headers: Record<string, string> = {}
		if (isString(contentType) && contentType.length > 0) headers['Content-Type'] = contentType
		await this.#aws.put(objectUrl(this.#auth, key), toArrayBuffer(bytes), {
			label: 'S3 put',
			headers
		})
	}
}
