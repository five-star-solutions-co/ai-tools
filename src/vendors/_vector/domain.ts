/**
 * Shared vector parse helpers for vendor clients (not published from kit barrel).
 * Prefer es-toolkit predicates; keep only vector-specific narrowing.
 */

import { isBoolean, isNil, isNumber, isPlainObject, isString, mapValues, trim } from 'es-toolkit'

import { ToolError } from '../../core/errors'
import type { VectorMetadata, VectorMetadataValue } from './schemas'

/** Host-bound default filter on vector auth (opaque provider-native or flat equality). */
export type VectorDefaultFilter = Record<string, unknown>

export function requireCollection(
	collection: string | undefined,
	defaultCollection: string | undefined,
	label: string
): string {
	const name = trim(collection ?? defaultCollection ?? '')
	if (name === '') {
		throw new ToolError(`${label} requires collection (or default_collection on auth)`, {
			code: 'bad_input'
		})
	}
	return name
}

/** Flat metadata from provider payloads. Non-primitives JSON-stringified. */
export function parseMetadata(value: unknown): VectorMetadata | undefined {
	if (!isPlainObject(value)) return undefined
	return mapValues(value, (raw) => {
		if (isString(raw) || isNumber(raw) || isBoolean(raw) || raw === null) return raw
		if (isNil(raw)) return null
		return JSON.stringify(raw)
	})
}

export function parseNumberArray(value: unknown): number[] | undefined {
	if (!Array.isArray(value)) return undefined
	if (!value.every((item) => isNumber(item) && Number.isFinite(item))) return undefined
	return value
}

export function parsePointId(value: unknown): string | undefined {
	if (isString(value) && value.length > 0) return value
	if (isNumber(value) && Number.isFinite(value)) return String(value)
	return undefined
}

export function parseUpstreamMessage(data: unknown, fallback: string): string {
	if (!isPlainObject(data)) return fallback
	const status = data['status']
	if (isPlainObject(status) && isString(status['error']) && status['error'].length > 0) {
		return status['error']
	}
	if (isString(data['message']) && data['message'].length > 0) return data['message']
	if (isString(data['error']) && data['error'].length > 0) return data['error']
	if (isString(data['detail']) && data['detail'].length > 0) return data['detail']
	return fallback
}

export function mapVectorHttpStatus(status: number): ToolError['code'] {
	if (status === 401 || status === 403) return 'bad_auth'
	if (status === 404) return 'not_found'
	if (status === 400 || status === 409 || status === 422) return 'bad_input'
	if (status === 429) return 'rate_limited'
	return 'upstream'
}

export function parseScore(row: Record<string, unknown>): number {
	if (isNumber(row['score']) && Number.isFinite(row['score'])) return row['score']
	if (isNumber(row['similarity']) && Number.isFinite(row['similarity'])) return row['similarity']
	if (isNumber(row['distance']) && Number.isFinite(row['distance'])) return -row['distance']
	return 0
}

/**
 * Merge host-bound filter with tool filter.
 * Host keys always win on collision so the model cannot strip tenant terms.
 * Both absent → undefined. One present → that object.
 */
export function mergeVectorFilter(
	host: VectorDefaultFilter | undefined,
	tool: VectorDefaultFilter | undefined
): VectorDefaultFilter | undefined {
	if (!host && !tool) return undefined
	if (!host) return tool
	if (!tool) return host
	return { ...tool, ...host }
}

/**
 * Namespace resolution: when auth default is set it is locked (tool cannot switch NS).
 * When auth omits default, tool namespace is used.
 */
export function resolveVectorNamespace(
	authDefault: string | undefined,
	toolNamespace: string | undefined
): string | undefined {
	if (authDefault !== undefined && authDefault.length > 0) return authDefault
	return toolNamespace
}

function isFlatMetadataValue(value: unknown): value is VectorMetadataValue {
	return isString(value) || isNumber(value) || isBoolean(value) || value === null
}

/**
 * Stamp flat equality keys from host default_filter onto upsert metadata.
 * Skips operator keys (`$…`) and non-primitive values (leave complex filters query-only).
 * Host keys win over point metadata.
 */
export function stampDefaultFilterMetadata(
	metadata: VectorMetadata | undefined,
	hostFilter: VectorDefaultFilter | undefined
): VectorMetadata | undefined {
	if (!hostFilter) return metadata
	const stamped: VectorMetadata = metadata ? { ...metadata } : {}
	let added = false
	for (const [key, value] of Object.entries(hostFilter)) {
		if (key.startsWith('$')) continue
		if (!isFlatMetadataValue(value)) continue
		stamped[key] = value
		added = true
	}
	if (!added && metadata) return metadata
	if (!added) return metadata
	return stamped
}

/**
 * Qdrant: if filter is already native (`must`/`should`/`must_not`), pass through.
 * If flat equality map, convert to `{ must: [{ key, match: { value } }, …] }`.
 */
export function toQdrantFilter(filter: VectorDefaultFilter | undefined): VectorDefaultFilter | undefined {
	if (!filter) return undefined
	if ('must' in filter || 'should' in filter || 'must_not' in filter) return filter
	const must: Array<{ key: string; match: { value: unknown } }> = []
	for (const [key, value] of Object.entries(filter)) {
		if (key.startsWith('$')) continue
		must.push({ key, match: { value } })
	}
	if (must.length === 0) return filter
	return { must }
}

/**
 * Merge Qdrant filters by concatenating `must` clauses (AND).
 * Host clauses first so they are never dropped.
 */
export function mergeQdrantFilter(
	host: VectorDefaultFilter | undefined,
	tool: VectorDefaultFilter | undefined
): VectorDefaultFilter | undefined {
	const h = toQdrantFilter(host)
	const t = toQdrantFilter(tool)
	if (!h) return t
	if (!t) return h
	const mustH = isPlainObject(h) && Array.isArray(h['must']) ? h['must'] : [h]
	const mustT = isPlainObject(t) && Array.isArray(t['must']) ? t['must'] : [t]
	return { must: [...mustH, ...mustT] }
}
