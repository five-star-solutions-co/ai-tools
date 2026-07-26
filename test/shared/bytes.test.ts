import { describe, expect, test } from 'bun:test'

import { isToolError } from '../../src/core'
import { base64ToBytes, bytesToBase64, utf8ToBytes } from '../../src/shared/bytes'

describe('base64ToBytes', () => {
	test('round-trips valid base64', () => {
		const raw = utf8ToBytes('hello')
		expect(base64ToBytes(bytesToBase64(raw))).toEqual(raw)
	})

	test('invalid base64 throws ToolError bad_input (not DOMException)', () => {
		try {
			base64ToBytes('%%%not-base64%%%')
			expect.unreachable()
		} catch (error) {
			expect(isToolError(error)).toBe(true)
			if (isToolError(error)) {
				expect(error.code).toBe('bad_input')
				expect(error.message).toBe('Invalid base64 body')
			}
			expect(error instanceof DOMException).toBe(false)
		}
	})
})
