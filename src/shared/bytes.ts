import { ToolError } from '../core/errors'

export function utf8ToBytes(text: string): Uint8Array {
	return new TextEncoder().encode(text)
}

export function bytesToUtf8(bytes: Uint8Array): string {
	return new TextDecoder().decode(bytes)
}

export function bytesToBase64(bytes: Uint8Array): string {
	let binary = ''
	for (let i = 0; i < bytes.length; i += 1) {
		binary += String.fromCharCode(bytes[i] ?? 0)
	}
	return btoa(binary)
}

/**
 * Decode base64. Invalid input throws `ToolError` with code `bad_input`
 * (never a raw DOMException) so hosts and batch items see a stable contract.
 */
export function base64ToBytes(base64: string): Uint8Array {
	let binary: string
	try {
		binary = atob(base64)
	} catch (error) {
		throw new ToolError('Invalid base64 body', { code: 'bad_input', cause: error })
	}
	const out = new Uint8Array(binary.length)
	for (let i = 0; i < binary.length; i += 1) {
		out[i] = binary.charCodeAt(i)
	}
	return out
}

/** Copy into a standalone ArrayBuffer (Blob/fetch bodies that reject SharedArrayBuffer views). */
export function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	const bodyBuffer = new ArrayBuffer(bytes.byteLength)
	new Uint8Array(bodyBuffer).set(bytes)
	return bodyBuffer
}

/** Encode object-key path segments; preserve `/` as path separators. */
export function encodeObjectKeyPath(key: string): string {
	return key
		.split('/')
		.map((segment) => encodeURIComponent(segment))
		.join('/')
}
