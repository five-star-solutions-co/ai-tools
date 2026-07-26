/**
 * S3 URL building + XML response parse (fast-xml-parser).
 */

import { isPlainObject, isString } from 'es-toolkit'
import { isArray } from 'es-toolkit/compat'
import { XMLParser } from 'fast-xml-parser'

import { encodeObjectKeyPath } from '../../shared/bytes'
import type { S3Auth } from './contracts'

export type ListedObject = {
	key: string
	size?: number
	last_modified?: string
	etag?: string
}

export type ParsedListResult = {
	items: ListedObject[]
	truncated: boolean
	next_cursor?: string
	common_prefixes?: string[]
}

const listParser = new XMLParser({
	ignoreAttributes: true,
	trimValues: true,
	// Always arrays so single Contents/CommonPrefixes match multi-item shape
	isArray: (name) => name === 'Contents' || name === 'CommonPrefixes'
})

const genericParser = new XMLParser({
	ignoreAttributes: true,
	trimValues: true
})

export function objectUrl(auth: S3Auth, key: string, query?: string): string {
	const encodedKey = encodeObjectKeyPath(key)
	const base = auth.endpoint
		? `${auth.endpoint.replace(/\/+$/, '')}/${encodeURIComponent(auth.bucket)}/${encodedKey}`
		: `https://${auth.bucket}.s3.${auth.region}.amazonaws.com/${encodedKey}`
	return query ? `${base}?${query}` : base
}

export function listUrl(auth: S3Auth, params: URLSearchParams): string {
	const base = auth.endpoint
		? `${auth.endpoint.replace(/\/+$/, '')}/${encodeURIComponent(auth.bucket)}`
		: `https://${auth.bucket}.s3.${auth.region}.amazonaws.com`
	const qs = params.toString()
	return qs ? `${base}?${qs}` : base
}

export function copySourceHeader(auth: S3Auth, sourceKey: string, sourceBucket?: string): string {
	const bucket = sourceBucket ?? auth.bucket
	return `/${encodeURIComponent(bucket)}/${encodeObjectKeyPath(sourceKey)}`
}

export function stripEtagQuotes(etag: string): string {
	return etag.replaceAll('"', '')
}

/** Parse `Content-Range: bytes start-end/total` → total object size when known. */
export function contentRangeTotal(header: string | null): number | undefined {
	if (header === null || header.length === 0) return undefined
	const slash = header.lastIndexOf('/')
	if (slash < 0) return undefined
	const totalRaw = header.slice(slash + 1).trim()
	if (totalRaw === '*' || totalRaw.length === 0) return undefined
	const total = Number.parseInt(totalRaw, 10)
	return Number.isFinite(total) ? total : undefined
}

function asArray(value: unknown): unknown[] {
	if (value === undefined || value === null) return []
	return isArray(value) ? value : [value]
}

function textValue(value: unknown): string | undefined {
	if (isString(value) && value.length > 0) return value
	if (typeof value === 'number' && Number.isFinite(value)) return String(value)
	if (typeof value === 'boolean') return value ? 'true' : 'false'
	return undefined
}

function numberValue(value: unknown): number | undefined {
	if (typeof value === 'number' && Number.isFinite(value)) return value
	if (isString(value) && value.length > 0) {
		const n = Number.parseInt(value, 10)
		return Number.isFinite(n) ? n : undefined
	}
	return undefined
}

/** Parse ListObjectsV2 XML into list items + pagination. */
export function parseListResult(xml: string): ParsedListResult {
	const doc: unknown = listParser.parse(xml)
	const root =
		isPlainObject(doc) && isPlainObject(doc['ListBucketResult'])
			? doc['ListBucketResult']
			: isPlainObject(doc)
				? doc
				: null
	if (!root) {
		return { items: [], truncated: false }
	}

	const items: ListedObject[] = []
	for (const row of asArray(root['Contents'])) {
		if (!isPlainObject(row)) continue
		const key = textValue(row['Key'])
		if (!key) continue
		const size = numberValue(row['Size'])
		const last_modified = textValue(row['LastModified'])
		const etagRaw = textValue(row['ETag'])
		const etag = etagRaw ? stripEtagQuotes(etagRaw) : undefined
		items.push({
			key,
			...(size !== undefined && { size }),
			...(last_modified && { last_modified }),
			...(etag && { etag })
		})
	}

	const truncatedRaw = root['IsTruncated']
	const truncated =
		truncatedRaw === true ||
		truncatedRaw === 'true' ||
		(isString(truncatedRaw) && truncatedRaw.toLowerCase() === 'true')

	const next = textValue(root['NextContinuationToken'])
	const common_prefixes: string[] = []
	for (const row of asArray(root['CommonPrefixes'])) {
		if (!isPlainObject(row)) continue
		const prefix = textValue(row['Prefix'])
		if (prefix) common_prefixes.push(prefix)
	}

	return {
		items,
		truncated,
		...(next && { next_cursor: next }),
		...(common_prefixes.length > 0 && { common_prefixes })
	}
}

/** First text value for a tag anywhere in a small S3 XML body (ETag, UploadId, …). */
export function firstXmlText(xml: string, tag: string): string | undefined {
	const doc: unknown = genericParser.parse(xml)
	return findTagText(doc, tag)
}

function findTagText(node: unknown, tag: string): string | undefined {
	if (!isPlainObject(node)) return undefined
	if (Object.hasOwn(node, tag)) {
		const direct = textValue(node[tag])
		if (direct) return direct
	}
	for (const value of Object.values(node)) {
		const found = findTagText(value, tag)
		if (found) return found
	}
	return undefined
}
