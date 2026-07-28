import { describe, expect, test } from 'bun:test'

import {
	mergeQdrantFilter,
	mergeVectorFilter,
	resolveVectorNamespace,
	stampDefaultFilterMetadata,
	toQdrantFilter
} from '../../src/vendors/_vector/domain'

describe('vector default filter helpers', () => {
	test('mergeVectorFilter host keys win', () => {
		expect(mergeVectorFilter(undefined, undefined)).toBeUndefined()
		expect(mergeVectorFilter({ organization_id: 'host' }, undefined)).toEqual({ organization_id: 'host' })
		expect(mergeVectorFilter(undefined, { organization_id: 'tool' })).toEqual({ organization_id: 'tool' })
		expect(mergeVectorFilter({ organization_id: 'host', keep: true }, { organization_id: 'tool', extra: 1 })).toEqual({
			organization_id: 'host',
			keep: true,
			extra: 1
		})
	})

	test('resolveVectorNamespace locks auth default', () => {
		expect(resolveVectorNamespace('org_ns', 'other')).toBe('org_ns')
		expect(resolveVectorNamespace(undefined, 'other')).toBe('other')
		expect(resolveVectorNamespace(undefined, undefined)).toBeUndefined()
	})

	test('stampDefaultFilterMetadata stamps flat keys only', () => {
		expect(stampDefaultFilterMetadata({ text: 'hi' }, { organization_id: 'o1', $and: [] })).toEqual({
			text: 'hi',
			organization_id: 'o1'
		})
		expect(stampDefaultFilterMetadata(undefined, { organization_id: 'o1' })).toEqual({
			organization_id: 'o1'
		})
		expect(stampDefaultFilterMetadata({ text: 'hi' }, undefined)).toEqual({ text: 'hi' })
	})

	test('toQdrantFilter converts flat equality to must', () => {
		expect(toQdrantFilter({ organization_id: 'o1' })).toEqual({
			must: [{ key: 'organization_id', match: { value: 'o1' } }]
		})
		expect(toQdrantFilter({ must: [{ key: 'a', match: { value: 1 } }] })).toEqual({
			must: [{ key: 'a', match: { value: 1 } }]
		})
	})

	test('mergeQdrantFilter concatenates must', () => {
		expect(mergeQdrantFilter({ organization_id: 'host' }, { doc_type: 'pdf' })).toEqual({
			must: [
				{ key: 'organization_id', match: { value: 'host' } },
				{ key: 'doc_type', match: { value: 'pdf' } }
			]
		})
	})
})
