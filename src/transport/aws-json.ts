/**
 * Parse AWS JSON protocol response bodies.
 *
 * ofetch only auto-parses `application/json`. Services that use
 * `application/x-amz-json-1.0` / `1.1` (SQS, Textract, …) often leave a
 * string or Blob in `HttpService` `data` — callers must re-parse.
 */

import { isString } from 'es-toolkit'

export async function parseAwsJsonBody(data: unknown): Promise<unknown> {
	let payload: unknown = data
	if (typeof Blob !== 'undefined' && payload instanceof Blob) {
		payload = await payload.text()
	}
	if (isString(payload)) {
		try {
			return payload.length === 0 ? {} : JSON.parse(payload)
		} catch {
			return { Message: payload }
		}
	}
	return payload
}
