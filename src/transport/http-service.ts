/**
 * Shared HTTP transport (ofetch under the hood).
 * Product clients construct this and call query/bytes/get/post/….
 */

import { createFetch } from 'ofetch'
import type { CreateFetchOptions, FetchOptions } from 'ofetch'
import { trimEnd } from 'es-toolkit'

import { ToolError } from '../core/errors'
import type { FetchLike } from '../core/types'
import { assertHttpStatusOk, mapTransportNetworkError } from './errors'

export type HttpServiceOptions = {
	/** Absolute origin or base path. Omit for free-form absolute URLs. */
	baseURL?: string
	/** Default headers (Authorization, Content-Type, …). */
	headers?: Record<string, string>
	/** Default timeout ms. */
	timeout?: number
	/**
	 * Injectable fetch (tests via ToolContext / runTool).
	 * Passed straight to ofetch — no preconnect wrapper.
	 */
	fetch?: FetchLike
	/** Default abort signal. */
	signal?: AbortSignal
	/** Prefix for ToolError messages (e.g. "Resend"). */
	label?: string
}

/**
 * Bodies ofetch accepts. `object` covers plain JSON payloads from tool input
 * (including empty objects); FormData/Blob/string live under BodyInit.
 */
export type HttpBody = BodyInit | object | null

export type HttpQueryValue = string | number | boolean | readonly (string | number | boolean)[] | undefined

export type HttpCallOptions = {
	query?: Record<string, HttpQueryValue>
	body?: HttpBody
	headers?: Record<string, string>
	/** Status codes returned without throwing. */
	allowStatuses?: readonly number[]
	/** When true, non-2xx is returned instead of throwing. Default false. */
	noThrow?: boolean
	timeout?: number
	signal?: AbortSignal
	/** Override error label for this call. */
	label?: string
}

export type HttpBytesOptions = HttpCallOptions & {
	/** Stop reading and throw `too_large` once the response exceeds this many bytes. */
	maxBytes?: number
}

export type HttpQueryResult = {
	status: number
	ok: boolean
	headers: Headers
	url: string
	/** Parsed body (JSON/text per ofetch). */
	data: unknown
}

export type HttpBytesResult = {
	status: number
	ok: boolean
	headers: Headers
	url: string
	bytes: Uint8Array
}

type OfetchInstance = ReturnType<typeof createFetch>

/**
 * HTTP client: query (parsed), bytes, get/post/put/patch/delete/head.
 * Non-2xx → ToolError by default.
 */
export class HttpService {
	readonly #http: OfetchInstance
	readonly #defaultLabel: string
	readonly #defaultSignal: AbortSignal | undefined

	constructor(options: HttpServiceOptions = {}) {
		this.#defaultLabel = options.label ?? 'HTTP'
		this.#defaultSignal = options.signal
		this.#http = createOfetch(options)
	}

	/** Shared ofetch.raw + status assert + error map. */
	async #raw(method: string, path: string, options: HttpCallOptions, extra?: FetchOptions) {
		const label = options.label ?? this.#defaultLabel
		try {
			const res = await this.#http.raw(path, {
				signal: this.#defaultSignal ?? null,
				method,
				...options,
				...extra
			})
			assertHttpStatusOk(label, res.status, res.headers, options)
			return { status: res.status, ok: res.ok, headers: res.headers, url: res.url, data: res._data }
		} catch (error) {
			mapTransportNetworkError(error, label)
		}
	}

	/** Parsed body (JSON/text). ofetch parses JSON responses by default. */
	async query(method: string, path: string, options: HttpCallOptions = {}): Promise<HttpQueryResult> {
		return this.#raw(method, path, options)
	}

	/**
	 * Binary body. `maxBytes` switches to streaming and cancels before an
	 * oversized response is materialized.
	 */
	async bytes(method: string, path: string, options: HttpBytesOptions = {}): Promise<HttpBytesResult> {
		const { maxBytes, ...requestOptions } = options
		if (maxBytes !== undefined && (!Number.isSafeInteger(maxBytes) || maxBytes < 0)) {
			throw new ToolError('Response byte limit must be a non-negative safe integer', { code: 'bad_input' })
		}

		const res = await this.#raw(method, path, requestOptions, {
			responseType: maxBytes === undefined ? 'arrayBuffer' : 'stream'
		})
		if (maxBytes === undefined) {
			return {
				...res,
				bytes: new Uint8Array(res.data)
			}
		}

		const label = options.label ?? this.#defaultLabel
		try {
			const bytes = await readBoundedBytes(res.data, res.headers, maxBytes, label)
			return { ...res, bytes }
		} catch (error) {
			mapTransportNetworkError(error, label)
		}
	}

	get(path: string, options: HttpCallOptions = {}): Promise<HttpQueryResult> {
		return this.query('GET', path, options)
	}

	post(path: string, body?: HttpBody, options: HttpCallOptions = {}): Promise<HttpQueryResult> {
		return this.query('POST', path, body === undefined ? options : { ...options, body })
	}

	put(path: string, body?: HttpBody, options: HttpCallOptions = {}): Promise<HttpQueryResult> {
		return this.query('PUT', path, body === undefined ? options : { ...options, body })
	}

	patch(path: string, body?: HttpBody, options: HttpCallOptions = {}): Promise<HttpQueryResult> {
		return this.query('PATCH', path, body === undefined ? options : { ...options, body })
	}

	delete(path: string, options: HttpCallOptions = {}): Promise<HttpQueryResult> {
		return this.query('DELETE', path, options)
	}

	head(path: string, options: HttpCallOptions = {}): Promise<HttpQueryResult> {
		return this.query('HEAD', path, options)
	}
}

function isReadableByteStream(value: unknown): value is ReadableStream<unknown> {
	return value instanceof ReadableStream
}

function contentLength(headers: Headers): number | undefined {
	const value = headers.get('content-length')
	if (value === null || !/^\d+$/.test(value)) return undefined
	const parsed = Number(value)
	return Number.isSafeInteger(parsed) ? parsed : undefined
}

function responseTooLarge(label: string, maxBytes: number, observedBytes: number): never {
	throw new ToolError(`${label} response exceeds byte limit`, {
		code: 'too_large',
		details: { max_bytes: maxBytes, content_length: observedBytes }
	})
}

async function readBoundedBytes(data: unknown, headers: Headers, maxBytes: number, label: string): Promise<Uint8Array> {
	const declaredLength = contentLength(headers)
	if (declaredLength !== undefined && declaredLength > maxBytes) {
		if (isReadableByteStream(data)) {
			try {
				await data.cancel()
			} catch {
				// Preserve the stable too_large error.
			}
		}
		responseTooLarge(label, maxBytes, declaredLength)
	}
	if (data === null || data === undefined) return new Uint8Array()
	if (!isReadableByteStream(data)) {
		throw new ToolError(`${label} returned an invalid byte stream`, { code: 'upstream' })
	}

	const reader = data.getReader()
	const chunks: Uint8Array[] = []
	let total = 0
	try {
		while (true) {
			const chunk = await reader.read()
			if (chunk.done) break
			if (!(chunk.value instanceof Uint8Array)) {
				throw new ToolError(`${label} returned an invalid byte chunk`, { code: 'upstream' })
			}
			total += chunk.value.byteLength
			if (total > maxBytes) {
				try {
					await reader.cancel()
				} catch {
					// Preserve the stable too_large error.
				}
				responseTooLarge(label, maxBytes, declaredLength ?? total)
			}
			chunks.push(chunk.value)
		}
	} finally {
		reader.releaseLock()
	}

	const bytes = new Uint8Array(total)
	let offset = 0
	for (const chunk of chunks) {
		bytes.set(chunk, offset)
		offset += chunk.byteLength
	}
	return bytes
}

function createOfetch(options: HttpServiceOptions): OfetchInstance {
	const defaults: FetchOptions = {
		...options,
		retry: false,
		ignoreResponseError: true
	}
	if (defaults.baseURL) {
		defaults.baseURL = trimEnd(defaults.baseURL, '/')
	}
	const createOptions: CreateFetchOptions = { defaults }
	if (options.fetch) {
		Object.assign(createOptions, { fetch: options.fetch })
	}
	return createFetch(createOptions)
}
