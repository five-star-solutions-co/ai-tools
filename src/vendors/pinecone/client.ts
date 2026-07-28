/**
 * Pinecone data-plane REST vendor client.
 * Host: `new PineconeClient(auth)`. Agent tools: `fromContext(ctx)`.
 * @see https://docs.pinecone.io/reference/api/data-plane
 */

import { isNumber, isPlainObject } from 'es-toolkit'

import { ToolError } from '../../core/errors'
import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import { HttpService } from '../../transport/http-service'
import type { HttpServiceOptions } from '../../transport/http-service'
import {
	mapVectorHttpStatus,
	mergeVectorFilter,
	parseMetadata,
	parseNumberArray,
	parsePointId,
	parseUpstreamMessage,
	resolveVectorNamespace,
	stampDefaultFilterMetadata
} from '../_vector/domain'
import type { VectorDefaultFilter } from '../_vector/domain'
import type {
	DeleteVectorsInput,
	DeleteVectorsOutput,
	PineconeAuth,
	QueryVectorsInput,
	QueryVectorsOutput,
	UpsertVectorsInput,
	UpsertVectorsOutput,
	VectorMatch
} from './contracts'
import { pineconeAuthSchema } from './contracts'

export type PineconeClientOptions = {
	fetch?: HttpServiceOptions['fetch'] | undefined
	signal?: HttpServiceOptions['signal'] | undefined
}

export class PineconeClient {
	readonly #http: HttpService
	readonly #defaultNamespace: string | undefined
	readonly #defaultFilter: VectorDefaultFilter | undefined

	constructor(auth: PineconeAuth, options: PineconeClientOptions = {}) {
		const parsed = pineconeAuthSchema.safeParse(auth)
		if (!parsed.success) {
			throw new ToolError('Invalid Pinecone auth credentials', {
				code: 'bad_auth',
				details: { issues: parsed.error.issues.map((issue) => issue.message) }
			})
		}
		this.#defaultNamespace = parsed.data.default_namespace
		this.#defaultFilter = parsed.data.default_filter
		const httpOptions: HttpServiceOptions = {
			baseURL: parsed.data.base_url,
			headers: {
				'Content-Type': 'application/json',
				'Api-Key': parsed.data.api_key
			},
			label: 'Pinecone'
		}
		if (options.fetch) httpOptions.fetch = options.fetch
		if (options.signal) httpOptions.signal = options.signal
		this.#http = new HttpService(httpOptions)
	}

	static fromContext(ctx: ToolContext): PineconeClient {
		const auth = requireAuth(ctx, pineconeAuthSchema)
		const options: PineconeClientOptions = {}
		if (ctx.fetch) options.fetch = ctx.fetch
		if (ctx.signal) options.signal = ctx.signal
		return new PineconeClient(auth, options)
	}

	#namespace(toolNamespace: string | undefined): string | undefined {
		return resolveVectorNamespace(this.#defaultNamespace, toolNamespace)
	}

	async upsert(input: UpsertVectorsInput): Promise<UpsertVectorsOutput> {
		const body: Record<string, unknown> = {
			vectors: input.vectors.map((point) => {
				const metadata = stampDefaultFilterMetadata(point.metadata, this.#defaultFilter)
				const row: Record<string, unknown> = { id: point.id, values: point.values }
				if (metadata) row['metadata'] = metadata
				return row
			})
		}
		const ns = this.#namespace(input.namespace)
		if (ns) body['namespace'] = ns

		const res = await this.#http.post('/vectors/upsert', body, {
			label: 'Pinecone upsert',
			noThrow: true
		})
		if (!res.ok) {
			throw new ToolError(parseUpstreamMessage(res.data, `Pinecone upsert failed with HTTP ${res.status}`), {
				code: mapVectorHttpStatus(res.status),
				details: { status: res.status }
			})
		}
		const upserted =
			isPlainObject(res.data) && isNumber(res.data['upsertedCount']) ? res.data['upsertedCount'] : input.vectors.length
		return { upserted }
	}

	async query(input: QueryVectorsInput): Promise<QueryVectorsOutput> {
		const topK = input.top_k ?? 8
		const includeMetadata = input.include_metadata !== false
		const body: Record<string, unknown> = {
			vector: input.vector,
			topK,
			includeMetadata,
			includeValues: input.include_values === true
		}
		const ns = this.#namespace(input.namespace)
		if (ns) body['namespace'] = ns
		const filter = mergeVectorFilter(this.#defaultFilter, input.filter)
		if (filter) body['filter'] = filter

		const res = await this.#http.post('/query', body, { label: 'Pinecone query', noThrow: true })
		if (!res.ok) {
			throw new ToolError(parseUpstreamMessage(res.data, `Pinecone query failed with HTTP ${res.status}`), {
				code: mapVectorHttpStatus(res.status),
				details: { status: res.status }
			})
		}

		const matchesRaw = isPlainObject(res.data) ? res.data['matches'] : undefined
		const rows = Array.isArray(matchesRaw) ? matchesRaw : []
		const matches: VectorMatch[] = []
		for (const row of rows) {
			if (!isPlainObject(row)) continue
			const id = parsePointId(row['id'])
			if (!id) continue
			const score = isNumber(row['score']) ? row['score'] : 0
			const match: VectorMatch = { id, score }
			if (includeMetadata) {
				const meta = parseMetadata(row['metadata'])
				if (meta) match.metadata = meta
			}
			if (input.include_values === true) {
				const values = parseNumberArray(row['values'])
				if (values) match.values = values
			}
			matches.push(match)
		}
		return { matches }
	}

	async delete(input: DeleteVectorsInput): Promise<DeleteVectorsOutput> {
		const body: Record<string, unknown> = { ids: input.ids }
		const ns = this.#namespace(input.namespace)
		if (ns) body['namespace'] = ns

		const res = await this.#http.post('/vectors/delete', body, {
			label: 'Pinecone delete',
			noThrow: true
		})
		if (!res.ok) {
			throw new ToolError(parseUpstreamMessage(res.data, `Pinecone delete failed with HTTP ${res.status}`), {
				code: mapVectorHttpStatus(res.status),
				details: { status: res.status }
			})
		}
		return { deleted: input.ids.length }
	}
}
