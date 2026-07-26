import { ToolError } from '../../core/errors'
import { base64ToBytes, bytesToBase64, toArrayBuffer, utf8ToBytes } from '../../shared/bytes'
import type {
	CryptoAlgorithm,
	CryptoAuth,
	CryptoHashInput,
	CryptoHmacSignInput,
	CryptoHmacVerifyInput
} from './contracts'

function bodyBytes(input: { body: string; encoding: 'utf8' | 'base64' }): Uint8Array {
	return input.encoding === 'base64' ? base64ToBytes(input.body) : utf8ToBytes(input.body)
}

function keyBytes(auth: CryptoAuth, keyId: string): Uint8Array {
	const value = auth.hmac_keys[keyId]
	if (!value) {
		throw new ToolError('HMAC key id is not bound', { code: 'not_found', details: { key_id: keyId } })
	}
	return base64ToBytes(value)
}

async function importHmacKey(auth: CryptoAuth, keyId: string, algorithm: CryptoAlgorithm): Promise<CryptoKey> {
	try {
		return await crypto.subtle.importKey(
			'raw',
			toArrayBuffer(keyBytes(auth, keyId)),
			{ name: 'HMAC', hash: algorithm },
			false,
			['sign', 'verify']
		)
	} catch (error) {
		throw new ToolError('Failed to load HMAC key', { code: 'bad_auth', cause: error })
	}
}

export async function hashData(input: CryptoHashInput): Promise<string> {
	const digest = await crypto.subtle.digest(input.algorithm, toArrayBuffer(bodyBytes(input)))
	return bytesToBase64(new Uint8Array(digest))
}

export async function signHmac(auth: CryptoAuth, input: CryptoHmacSignInput): Promise<string> {
	const key = await importHmacKey(auth, input.key_id, input.algorithm)
	const signature = await crypto.subtle.sign('HMAC', key, toArrayBuffer(bodyBytes(input)))
	return bytesToBase64(new Uint8Array(signature))
}

export async function verifyHmac(auth: CryptoAuth, input: CryptoHmacVerifyInput): Promise<boolean> {
	const key = await importHmacKey(auth, input.key_id, input.algorithm)
	try {
		return await crypto.subtle.verify(
			'HMAC',
			key,
			toArrayBuffer(base64ToBytes(input.signature_base64)),
			toArrayBuffer(bodyBytes(input))
		)
	} catch {
		return false
	}
}
