import { describe, expect, test } from 'bun:test'

import { runTool } from '../../../src/core'
import {
	cryptoHashTool,
	cryptoHmacSignTool,
	cryptoHmacVerifyTool,
	cryptoRandomBytesTool
} from '../../../src/modules/crypto'
import { bytesToBase64, utf8ToBytes } from '../../../src/shared/bytes'

/** Pure seam — always runs (no external service). */
describe('live seam crypto', () => {
	test('tools: hash, hmac sign/verify, random bytes', async () => {
		const auth = { hmac_keys: { integration: bytesToBase64(utf8ToBytes('integration key')) } }

		const digested = await runTool(cryptoHashTool, {
			body: 'payload',
			encoding: 'utf8',
			algorithm: 'SHA-256'
		})
		expect(digested.digest_base64.length).toBeGreaterThan(20)

		const signed = await runTool(
			cryptoHmacSignTool,
			{ body: 'payload', encoding: 'utf8', key_id: 'integration', algorithm: 'SHA-256' },
			{ auth }
		)
		expect(signed.signature_base64.length).toBeGreaterThan(20)

		const checked = await runTool(
			cryptoHmacVerifyTool,
			{
				body: 'payload',
				encoding: 'utf8',
				key_id: 'integration',
				algorithm: 'SHA-256',
				signature_base64: signed.signature_base64
			},
			{ auth }
		)
		expect(checked.valid).toBe(true)

		const bytes = await runTool(cryptoRandomBytesTool, { byte_length: 32 })
		expect(bytes.body_base64.length).toBeGreaterThan(20)
	})
})
