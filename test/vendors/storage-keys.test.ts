import { describe, expect, test } from 'bun:test'

import { isToolError } from '../../src/core'
import {
	MAX_OBJECT_KEY_BYTES,
	normalizeKeyPrefix,
	resolveListPrefix,
	resolveObjectKey,
	toPublicKey
} from '../../src/vendors/_storage'

describe('storage key_prefix helpers', () => {
	test('normalizeKeyPrefix trims and forces trailing slash', () => {
		expect(normalizeKeyPrefix('tenants/acme')).toBe('tenants/acme/')
		expect(normalizeKeyPrefix('tenants/acme/')).toBe('tenants/acme/')
	})

	test('normalizeKeyPrefix rejects escapes and absolute form', () => {
		expect(() => normalizeKeyPrefix('/abs')).toThrow()
		expect(() => normalizeKeyPrefix('a/../b')).toThrow()
		try {
			normalizeKeyPrefix('../nope')
			expect.unreachable()
		} catch (error) {
			expect(isToolError(error)).toBe(true)
			if (isToolError(error)) expect(error.code).toBe('bad_auth')
		}
	})

	test('resolveObjectKey without prefix normalizes and allows double-dot names', () => {
		expect(resolveObjectKey('docs/report..final.pdf', undefined)).toBe('docs/report..final.pdf')
		expect(resolveObjectKey('a//b/./c', undefined)).toBe('a/b/c')
	})

	test('resolveObjectKey with prefix roots relative and accepts already-prefixed', () => {
		const root = 'tenants/acme/'
		expect(resolveObjectKey('inbox/a.pdf', root)).toBe('tenants/acme/inbox/a.pdf')
		expect(resolveObjectKey('tenants/acme/inbox/a.pdf', root)).toBe('tenants/acme/inbox/a.pdf')
	})

	test('resolveObjectKey rejects parent segments, leading slash, empty, trailing slash', () => {
		expect(() => resolveObjectKey('../x', 't/')).toThrow()
		expect(() => resolveObjectKey('/abs', undefined)).toThrow()
		expect(() => resolveObjectKey('  ', undefined)).toThrow()
		expect(() => resolveObjectKey('folder/', 't/')).toThrow()
	})

	test('resolveObjectKey rejects oversize wire keys', () => {
		const root = 'p/'
		const long = 'x'.repeat(MAX_OBJECT_KEY_BYTES)
		expect(() => resolveObjectKey(long, root)).toThrow()
	})

	test('resolveListPrefix stacks under key_prefix', () => {
		expect(resolveListPrefix(undefined, undefined)).toBeUndefined()
		expect(resolveListPrefix('docs', undefined)).toBe('docs')
		expect(resolveListPrefix(undefined, 'tenants/acme/')).toBe('tenants/acme/')
		expect(resolveListPrefix('docs/', 'tenants/acme/')).toBe('tenants/acme/docs/')
		expect(resolveListPrefix('tenants/acme/docs/', 'tenants/acme/')).toBe('tenants/acme/docs/')
	})

	test('toPublicKey strips prefix or filters outsiders', () => {
		expect(toPublicKey('tenants/acme/a.pdf', 'tenants/acme/')).toBe('a.pdf')
		expect(toPublicKey('other/a.pdf', 'tenants/acme/')).toBeUndefined()
		expect(toPublicKey('a.pdf', undefined)).toBe('a.pdf')
	})
})
