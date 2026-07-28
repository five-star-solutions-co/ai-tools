/**
 * Qdrant REST vendor client.
 * Host: `new QdrantClient(auth)`. Agent tools: `fromContext(ctx)`.
 * @see https://api.qdrant.tech/api-reference
 */

import { isNumber, isPlainObject } from 'es-toolkit'

import { ToolError } from '../../core/errors'
import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import { HttpService } from '../../transport/http-service'
import type { HttpServiceOptions } from '../../transport/http-service'
import {
	mapVectorHttpStatus,
	mergeQdrantFilter,
	parseMetadata,
	parseNumberArray,
	parsePointId,
	parseUpstreamMessage,
	requireCollection,
	stampDefaultFilterMetadata
} from '../_vector/domain'
import type { VectorDefaultFilter } from '../_vector/domain'
import type {
	DeleteVectorsInput,
	DeleteVectorsOutput,
	QdrantAuth,
	QueryVectorsInput,
	QueryVectorsOutput,
	UpsertVectorsInput,
	UpsertVectorsOutput,
	VectorMatch
} from './contracts'
import { qdrantAuthSchema } from './contracts'
import {
	isNativeQdrantId,
	QDRANT_LOGICAL_ID_KEY,
	resolveLogicalPointId,
	stripLogicalIdPayload,
	toQdrantPointId
} from './domain'

export type QdrantClientOptions = {
	fetch?: HttpServiceOptions['fetch'] | undefined
	signal?: HttpServiceOptions['signal'] | undefined
}

export class QdrantClient {
	readonly #http: HttpService
	readonly #defaultCollection: string | undefined
	readonly #defaultFilter: VectorDefaultFilter | undefined

	constructor(auth: QdrantAuth, options: QdrantClientOptions = {}) {
		const parsed = qdrantAuthSchema.safeParse(auth)
		if (!parsed.success) {
			throw new ToolError('Invalid Qdrant auth credentials', {
				code: 'bad_auth',
				details: { issues: parsed.error.issues.map((issue) => issue.message) }
			})
		}
		this.#defaultCollection = parsed.data.default_collection
		this.#defaultFilter = parsed.data.default_filter
		const headers: Record<string, string> = { 'Content-Type': 'application/json' }
		if (parsed.data.api_key) headers['api-key'] = parsed.data.api_key
		const httpOptions: HttpServiceOptions = {
			baseURL: parsed.data.base_url,
			headers,
			label: 'Qdrant'
		}
		if (options.fetch) httpOptions.fetch = options.fetch
		if (options.signal) httpOptions.signal = options.signal
		this.#http = new HttpService(httpOptions)
	}

	static fromContext(ctx: ToolContext): QdrantClient {
		const auth = requireAuth(ctx, qdrantAuthSchema)
		const options: QdrantClientOptions = {}
		if (ctx.fetch) options.fetch = ctx.fetch
		if (ctx.signal) options.signal = ctx.signal
		return new QdrantClient(auth, options)
	}

	async upsert(input: UpsertVectorsInput): Promise<UpsertVectorsOutput> {
		const collection = requireCollection(input.collection, this.#defaultCollection, 'Qdrant upsert')
		const points = input.vectors.map((point) => {
			const wireId = toQdrantPointId(point.id)
			const stamped = stampDefaultFilterMetadata(point.metadata, this.#defaultFilter)
			const payload: Record<string, string | number | boolean | null> = stamped ? { ...stamped } : {}
			if (!isNativeQdrantId(point.id)) {
				payload[QDRANT_LOGICAL_ID_KEY] = point.id
			}
			const row: Record<string, unknown> = { id: wireId, vector: point.values }
			if (Object.keys(payload).length > 0) row['payload'] = payload
			return row
		})
		const res = await this.#http.put(
			`/collections/${encodeURIComponent(collection)}/points`,
			{ points },
			{ label: 'Qdrant upsert', noThrow: true, query: { wait: 'true' } }
		)
		if (!res.ok) {
			throw new ToolError(parseUpstreamMessage(res.data, `Qdrant upsert failed with HTTP ${res.status}`), {
				code: mapVectorHttpStatus(res.status),
				details: { status: res.status }
			})
		}
		return { upserted: input.vectors.length, collection }
	}

	async query(input: QueryVectorsInput): Promise<QueryVectorsOutput> {
		const collection = requireCollection(input.collection, this.#defaultCollection, 'Qdrant query')
		const topK = input.top_k ?? 8
		const includeMetadata = input.include_metadata !== false
		// Always pull payload so free-form logical ids can be restored.
		const body: Record<string, unknown> = {
			vector: input.vector,
			limit: topK,
			with_payload: true,
			with_vector: input.include_values === true
		}
		const filter = mergeQdrantFilter(this.#defaultFilter, input.filter)
		if (filter) body['filter'] = filter

		const res = await this.#http.post(`/collections/${encodeURIComponent(collection)}/points/search`, body, {
			label: 'Qdrant search',
			noThrow: true
		})
		if (!res.ok) {
			throw new ToolError(parseUpstreamMessage(res.data, `Qdrant search failed with HTTP ${res.status}`), {
				code: mapVectorHttpStatus(res.status),
				details: { status: res.status }
			})
		}

		const result = isPlainObject(res.data) ? res.data['result'] : undefined
		const rows = Array.isArray(result) ? result : []
		const matches: VectorMatch[] = []
		for (const row of rows) {
			if (!isPlainObject(row)) continue
			const wireId = parsePointId(row['id'])
			if (!wireId) continue
			const rawPayload = isPlainObject(row['payload']) ? row['payload'] : undefined
			const score = isNumber(row['score']) ? row['score'] : 0
			const id = resolveLogicalPointId(wireId, rawPayload)
			const match: VectorMatch = { id, score }
			if (includeMetadata) {
				const meta = stripLogicalIdPayload(parseMetadata(row['payload']))
				if (meta) match.metadata = meta
			}
			if (input.include_values === true) {
				const values = parseNumberArray(row['vector'])
				if (values) match.values = values
			}
			matches.push(match)
		}
		return { matches, collection }
	}

	async delete(input: DeleteVectorsInput): Promise<DeleteVectorsOutput> {
		const collection = requireCollection(input.collection, this.#defaultCollection, 'Qdrant delete')
		const points = input.ids.map((id) => toQdrantPointId(id))
		const res = await this.#http.post(
			`/collections/${encodeURIComponent(collection)}/points/delete`,
			{ points },
			{ label: 'Qdrant delete', noThrow: true, query: { wait: 'true' } }
		)
		if (!res.ok) {
			throw new ToolError(parseUpstreamMessage(res.data, `Qdrant delete failed with HTTP ${res.status}`), {
				code: mapVectorHttpStatus(res.status),
				details: { status: res.status }
			})
		}
		return { deleted: input.ids.length, collection }
	}
}
