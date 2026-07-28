/**
 * Object-key prefix helpers for storage vendors (S3, Textract DocumentLocation, …).
 * Logical keys are prefix-relative; wire keys include key_prefix when set.
 */

import { isToolError, ToolError } from '../../core/errors'

/** S3 object key maximum length (bytes, UTF-8). */
export const MAX_OBJECT_KEY_BYTES = 1024

function utf8ByteLength(value: string): number {
	return new TextEncoder().encode(value).byteLength
}

function assertKeyByteLimit(wireKey: string): void {
	const bytes = utf8ByteLength(wireKey)
	if (bytes > MAX_OBJECT_KEY_BYTES) {
		throw new ToolError(`Object key exceeds ${MAX_OBJECT_KEY_BYTES} bytes`, {
			code: 'bad_input',
			details: { max_bytes: MAX_OBJECT_KEY_BYTES, key_bytes: bytes }
		})
	}
}

/**
 * Split a logical path into segments. Rejects parent segments and leading absolute form.
 * Allows names like `report..final.pdf` (only a segment equal to `..` is rejected).
 */
function keySegments(
	value: string,
	options: { allowEmpty?: boolean; allowTrailingSlash?: boolean } = {}
): { segments: string[]; trailingSlash: boolean } {
	const trimmed = value.trim().replaceAll('\\', '/')
	if (trimmed.startsWith('/')) {
		throw new ToolError('Object key must not be absolute (no leading /)', { code: 'bad_input' })
	}
	const trailingSlash = trimmed.endsWith('/')
	if (trailingSlash && options.allowTrailingSlash !== true) {
		throw new ToolError('Object key must not end with /', { code: 'bad_input' })
	}
	const segments = trimmed.split('/').filter((segment) => segment.length > 0 && segment !== '.')
	for (const segment of segments) {
		if (segment === '..') {
			throw new ToolError('Object key must not contain parent-directory segments', { code: 'bad_input' })
		}
	}
	if (segments.length === 0 && !options.allowEmpty && !trailingSlash) {
		throw new ToolError('Object key is required', { code: 'bad_input' })
	}
	return { segments, trailingSlash }
}

function joinSegments(segments: string[], trailingSlash: boolean): string {
	const joined = segments.join('/')
	if (trailingSlash) return joined.length > 0 ? `${joined}/` : ''
	return joined
}

function remapAuthError(error: unknown): never {
	if (isToolError(error) && error.code === 'bad_input') {
		throw new ToolError(error.message.replace(/^Object key/, 'key_prefix'), {
			code: 'bad_auth',
			...(error.details !== undefined && { details: error.details }),
			cause: error
		})
	}
	throw error
}

/** Normalize key_prefix from auth: non-absolute, no `..` segments, always ends with `/`. */
export function normalizeKeyPrefix(keyPrefix: string): string {
	try {
		const { segments } = keySegments(keyPrefix, { allowEmpty: false, allowTrailingSlash: true })
		if (segments.length === 0) {
			throw new ToolError('key_prefix must not be empty', { code: 'bad_auth' })
		}
		const root = `${segments.join('/')}/`
		assertKeyByteLimit(root)
		return root
	} catch (error) {
		remapAuthError(error)
	}
}

/**
 * Resolve a logical object key to a wire key.
 * - No prefix: validated logical key (normalized segments).
 * - With prefix: relative keys are rooted; keys already under the prefix are accepted as-is.
 */
export function resolveObjectKey(logicalKey: string, keyPrefix: string | undefined): string {
	const { segments } = keySegments(logicalKey, { allowEmpty: false })
	const logical = joinSegments(segments, false)
	if (!keyPrefix) {
		assertKeyByteLimit(logical)
		return logical
	}
	const wire = logical.startsWith(keyPrefix) ? logical : `${keyPrefix}${logical}`
	assertKeyByteLimit(wire)
	return wire
}

/**
 * Resolve a list prefix filter under optional key_prefix.
 * Empty / omitted relative → bound prefix root (or undefined when unbound).
 */
export function resolveListPrefix(
	relativePrefix: string | undefined,
	keyPrefix: string | undefined
): string | undefined {
	if (relativePrefix === undefined || relativePrefix.trim().length === 0) {
		return keyPrefix
	}
	const { segments, trailingSlash } = keySegments(relativePrefix, {
		allowEmpty: true,
		allowTrailingSlash: true
	})
	const logical = joinSegments(segments, trailingSlash)
	if (!keyPrefix) {
		if (logical.length === 0) return undefined
		assertKeyByteLimit(logical)
		return logical
	}
	if (logical.length === 0 || logical === keyPrefix.slice(0, -1) || logical === keyPrefix) {
		return keyPrefix
	}
	if (logical.startsWith(keyPrefix)) {
		assertKeyByteLimit(logical)
		return logical
	}
	const wire = `${keyPrefix}${logical}`
	assertKeyByteLimit(wire)
	return wire
}

/**
 * Map a wire key back to a logical (public) key.
 * Returns undefined when the wire key is outside key_prefix (caller should skip/filter).
 */
export function toPublicKey(wireKey: string, keyPrefix: string | undefined): string | undefined {
	if (!keyPrefix) return wireKey
	if (!wireKey.startsWith(keyPrefix)) return undefined
	return wireKey.slice(keyPrefix.length)
}
