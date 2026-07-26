import { describe, expect, test } from 'bun:test'

import { runTool, validateModule } from '../../src/core'
import {
	cryptoHashTool,
	cryptoHmacSignTool,
	cryptoHmacVerifyTool,
	cryptoModule,
	cryptoRandomBytesTool
} from '../../src/modules/crypto'
import { bytesToBase64, utf8ToBytes } from '../../src/shared/bytes'

const auth = {
	hmac_keys: {
		primary: bytesToBase64(utf8ToBytes('test signing key'))
	}
}

describe('crypto', () => {
	test('module contracts and tool ids', () => {
		expect(validateModule(cryptoModule).ok).toBe(true)
		expect(cryptoModule.tools.map((tool) => tool.id).sort()).toEqual([
			'crypto-hash',
			'crypto-hmac-sign',
			'crypto-hmac-verify',
			'crypto-random-bytes'
		])
	})

	test('hashes, signs, verifies, and generates secure bytes', async () => {
		const hash = await runTool(cryptoHashTool, { body: 'hello', encoding: 'utf8', algorithm: 'SHA-256' }, {})
		expect(hash.digest_base64).toBe('LPJNul+wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ=')

		const signed = await runTool(
			cryptoHmacSignTool,
			{ body: 'hello', encoding: 'utf8', key_id: 'primary', algorithm: 'SHA-256' },
			{ auth }
		)
		expect(signed.signature_base64.length).toBeGreaterThan(20)

		const valid = await runTool(
			cryptoHmacVerifyTool,
			{
				body: 'hello',
				encoding: 'utf8',
				key_id: 'primary',
				algorithm: 'SHA-256',
				signature_base64: signed.signature_base64
			},
			{ auth }
		)
		expect(valid.valid).toBe(true)

		const invalid = await runTool(
			cryptoHmacVerifyTool,
			{
				body: 'changed',
				encoding: 'utf8',
				key_id: 'primary',
				algorithm: 'SHA-256',
				signature_base64: signed.signature_base64
			},
			{ auth }
		)
		expect(invalid.valid).toBe(false)

		const random = await runTool(cryptoRandomBytesTool, { byte_length: 32 }, {})
		expect(Buffer.from(random.body_base64, 'base64')).toHaveLength(32)
	})
})
