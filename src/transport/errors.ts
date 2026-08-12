/**
 * HTTP status / network → ToolError for HttpService and AwsService.
 */

import { isError, isNumber } from 'es-toolkit'
import { FetchError } from 'ofetch'

import { ToolError } from '../core/errors'
import type { ToolErrorCode } from '../core/errors'

export type StatusThrowOptions = {
	allowStatuses?: readonly number[]
	/** When true, non-2xx does not throw. */
	noThrow?: boolean
}

/** Map common HTTP status codes to stable ToolError codes. */
export function httpErrorCode(status: number): ToolErrorCode {
	if (status === 401) return 'bad_auth'
	if (status === 403) return 'forbidden'
	if (status === 404) return 'not_found'
	if (status === 429) return 'rate_limited'
	if (status === 413) return 'too_large'
	return 'upstream'
}

export function throwHttpStatus(operation: string, status: number, retryAfterMs?: number): never {
	const code = httpErrorCode(status)
	throw new ToolError(`${operation} failed with HTTP ${status}`, {
		code,
		retryable: status >= 500 || status === 429,
		details: {
			status,
			operation,
			...(retryAfterMs !== undefined && { retry_after_ms: retryAfterMs })
		}
	})
}

/** Parse Retry-After header (seconds or HTTP-date) into milliseconds when possible. */
export function retryAfterMsFromHeader(value: string | null): number | undefined {
	if (value === null || value.length === 0) return undefined
	const asSeconds = Number.parseInt(value, 10)
	if (Number.isFinite(asSeconds) && asSeconds >= 0) return asSeconds * 1000
	const asDate = Date.parse(value)
	if (Number.isFinite(asDate)) {
		const delta = asDate - Date.now()
		return delta > 0 ? delta : 0
	}
	return undefined
}

/** Default: throw ToolError on non-2xx (404 → not_found). */
export function assertHttpStatusOk(
	label: string,
	status: number,
	headers: Headers,
	options: StatusThrowOptions = {}
): void {
	if (options.noThrow === true) return
	if (status >= 200 && status < 300) return
	if (options.allowStatuses && options.allowStatuses.includes(status)) return
	throwHttpStatus(label, status, retryAfterMsFromHeader(headers.get('retry-after')))
}

/** True if error or any nested `cause` is an AbortError (ofetch wraps abort in FetchError). */
export function isAbortErrorChain(error: unknown): boolean {
	let current: unknown = error
	const seen = new Set<unknown>()
	while (current !== undefined && current !== null && !seen.has(current)) {
		seen.add(current)
		if (isError(current) && (current.name === 'AbortError' || current.name === 'TimeoutError')) {
			return true
		}
		if (isError(current) && 'cause' in current) {
			current = current.cause
			continue
		}
		break
	}
	return false
}

/** Map ofetch / AbortError / unknown network failures to ToolError. */
export function mapTransportNetworkError(error: unknown, label: string): never {
	if (error instanceof ToolError) throw error
	if (isAbortErrorChain(error)) {
		throw new ToolError(`${label} request was aborted`, {
			code: 'timeout',
			retryable: true,
			cause: error
		})
	}
	if (error instanceof FetchError) {
		const status = error.statusCode ?? error.response?.status
		if (isNumber(status) && Number.isFinite(status)) {
			const retryAfter = retryAfterMsFromHeader(error.response?.headers.get('retry-after') ?? null)
			throwHttpStatus(label, status, retryAfter)
		}
		throw new ToolError(error.message || `${label} request failed`, {
			code: 'upstream',
			retryable: true,
			cause: error
		})
	}
	throw new ToolError(`${label} request failed`, {
		code: 'upstream',
		retryable: true,
		cause: error
	})
}
