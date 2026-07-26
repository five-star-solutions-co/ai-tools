/**
 * SigV4 HTTP client: HttpService + aws4fetch signing on every request.
 */

import { AwsClient } from 'aws4fetch'

import { ToolError } from '../core/errors'
import type { FetchLike } from '../core/types'
import { HttpService } from './http-service'
import type { HttpServiceOptions } from './http-service'

export type AwsCredentials = {
	accessKeyId: string
	secretAccessKey: string
	region: string
	/** AWS service name for SigV4 (s3, textract, sqs, …). */
	service: string
	sessionToken?: string
}

export type AwsServiceOptions = AwsCredentials & HttpServiceOptions

export type {
	HttpCallOptions as AwsCallOptions,
	HttpBytesOptions as AwsBytesOptions,
	HttpQueryResult as AwsQueryResult,
	HttpBytesResult as AwsBytesResult
} from './http-service'

/**
 * Same surface as HttpService (query/bytes/get/post/…).
 * Outbound requests are SigV4-signed; retries off (agent owns retry).
 */
export class AwsService extends HttpService {
	readonly #aws: AwsClient
	readonly #label: string

	constructor(options: AwsServiceOptions) {
		const {
			accessKeyId,
			secretAccessKey,
			region,
			service,
			sessionToken,
			fetch: userFetch,
			label: userLabel,
			...http
		} = options
		const label = userLabel ?? service.toUpperCase()
		const aws = new AwsClient({
			accessKeyId,
			secretAccessKey,
			region,
			service,
			retries: 0,
			...(sessionToken && { sessionToken })
		})
		const baseFetch = userFetch ?? globalThis.fetch
		const fetch: FetchLike = async (input, init) => baseFetch(await aws.sign(input, init))
		super({ ...http, fetch, label })
		this.#aws = aws
		this.#label = label
	}

	/** Query-string presign (does not perform the request). */
	async sign(
		url: string,
		options: { method?: string; signQuery?: boolean } = {}
	): Promise<{ url: string; method: string }> {
		const method = options.method ?? 'GET'
		try {
			const signed = await this.#aws.sign(url, {
				method,
				aws: { signQuery: options.signQuery ?? true }
			})
			return { url: signed.url, method }
		} catch (error) {
			throw new ToolError(`${this.#label} failed to sign URL`, {
				code: 'internal',
				cause: error
			})
		}
	}
}
