import { describe, expect, test } from 'bun:test'

import { hashData, signHmac, verifyHmac } from '../../../src/modules/crypto'
import { bytesToBase64, utf8ToBytes } from '../../../src/shared/bytes'

describe('integration seam crypto', () => {
	test('native digest and HMAC round trip', async () => {
		const auth = { hmac_keys: { integration: bytesToBase64(utf8ToBytes('integration key')) } }
		const input = { body: 'payload', encoding: 'utf8', key_id: 'integration', algorithm: 'SHA-256' } as const
		expect((await hashData(input)).length).toBeGreaterThan(20)
		const signature = await signHmac(auth, input)
		expect(await verifyHmac(auth, { ...input, signature_base64: signature })).toBe(true)
	})
})
