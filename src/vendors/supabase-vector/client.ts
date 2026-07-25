/**
 * Supabase pgvector vendor client (PostgREST).
 * Host: `new SupabaseVectorClient(auth)`. Agent tools: `fromContext(ctx)`.
 */

import { isPlainObject, trimEnd } from 'es-toolkit'

import { ToolError } from '../../core/errors'
import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import { HttpService } from '../../transport/http-service'
import type { HttpServiceOptions } from '../../transport/http-service'
import {
	mapVectorHttpStatus,
	parseMetadata,
	parseNumberArray,
	parsePointId,
	parseScore,
	parseUpstreamMessage,
	requireCollection
} from '../_vector/domain'
import type {
	DeleteVectorsInput,
	DeleteVectorsOutput,
	QueryVectorsInput,
	QueryVectorsOutput,
	SupabaseVectorAuth,
	UpsertVectorsInput,
	UpsertVectorsOutput,
	VectorMatch
} from './contracts'
import { supabaseVectorAuthSchema } from './contracts'

export type SupabaseVectorClientOptions = {
	fetch?: HttpServiceOptions['fetch'] | undefined
	signal?: HttpServiceOptions['signal'] | undefined
}

export class SupabaseVectorClient {
	readonly #http: HttpService
	readonly #defaultCollection: string | undefined
	readonly #idColumn: string
	readonly #embeddingColumn: string
	readonly #metadataColumn: string
	readonly #matchRpc: string

	constructor(auth: SupabaseVectorAuth, options: SupabaseVectorClientOptions = {}) {
		const parsed = supabaseVectorAuthSchema.safeParse(auth)
		if (!parsed.success) {
			throw new ToolError('Invalid Supabase vector auth credentials', {
				code: 'bad_auth',
				details: { issues: parsed.error.issues.map((issue) => issue.message) }
			})
		}
		const data = parsed.data
		this.#defaultCollection = data.default_collection
		this.#idColumn = data.id_column ?? 'id'
		this.#embeddingColumn = data.embedding_column ?? 'embedding'
		this.#metadataColumn = data.metadata_column ?? 'metadata'
		this.#matchRpc = data.match_rpc ?? 'match_vectors'

		const schema = data.schema ?? 'public'
		// Project url + API path prefix (trimEnd like HttpService/teams).
		const httpOptions: HttpServiceOptions = {
			baseURL: `${trimEnd(data.url, '/')}/rest/v1`,
			headers: {
				'Content-Type': 'application/json',
				apikey: data.api_key,
				Authorization: `Bearer ${data.api_key}`,
				'Content-Profile': schema,
				'Accept-Profile': schema
			},
			label: 'Supabase vector'
		}
		if (options.fetch) httpOptions.fetch = options.fetch
		if (options.signal) httpOptions.signal = options.signal
		this.#http = new HttpService(httpOptions)
	}

	static fromContext(ctx: ToolContext): SupabaseVectorClient {
		const auth = requireAuth(ctx, supabaseVectorAuthSchema)
		const options: SupabaseVectorClientOptions = {}
		if (ctx.fetch) options.fetch = ctx.fetch
		if (ctx.signal) options.signal = ctx.signal
		return new SupabaseVectorClient(auth, options)
	}

	async upsert(input: UpsertVectorsInput): Promise<UpsertVectorsOutput> {
		const table = requireCollection(input.collection, this.#defaultCollection, 'Supabase vector upsert')
		const rows = input.vectors.map((point) => {
			const row: Record<string, unknown> = {
				[this.#idColumn]: point.id,
				[this.#embeddingColumn]: point.values
			}
			if (point.metadata) row[this.#metadataColumn] = point.metadata
			return row
		})

		const res = await this.#http.post(`/${encodeURIComponent(table)}`, rows, {
			label: 'Supabase vector upsert',
			noThrow: true,
			headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }
		})
		if (!res.ok) {
			throw new ToolError(parseUpstreamMessage(res.data, `Supabase vector upsert failed with HTTP ${res.status}`), {
				code: mapVectorHttpStatus(res.status),
				details: { status: res.status }
			})
		}
		return { upserted: input.vectors.length, collection: table }
	}

	async query(input: QueryVectorsInput): Promise<QueryVectorsOutput> {
		const table = requireCollection(input.collection, this.#defaultCollection, 'Supabase vector query')
		const topK = input.top_k ?? 8
		const includeMetadata = input.include_metadata !== false
		const body: Record<string, unknown> = {
			query_embedding: input.vector,
			match_count: topK,
			collection: table
		}
		if (input.filter) body['filter'] = input.filter

		const res = await this.#http.post(`/rpc/${encodeURIComponent(this.#matchRpc)}`, body, {
			label: 'Supabase vector match',
			noThrow: true
		})
		if (!res.ok) {
			throw new ToolError(parseUpstreamMessage(res.data, `Supabase vector match failed with HTTP ${res.status}`), {
				code: mapVectorHttpStatus(res.status),
				details: { status: res.status, match_rpc: this.#matchRpc }
			})
		}

		const rows = Array.isArray(res.data) ? res.data : []
		const matches: VectorMatch[] = []
		for (const row of rows) {
			if (!isPlainObject(row)) continue
			const id = parsePointId(row[this.#idColumn] ?? row['id'])
			if (!id) continue
			const match: VectorMatch = { id, score: parseScore(row) }
			if (includeMetadata) {
				const meta = parseMetadata(row[this.#metadataColumn] ?? row['metadata'])
				if (meta) match.metadata = meta
			}
			if (input.include_values === true) {
				const values = parseNumberArray(row[this.#embeddingColumn] ?? row['embedding'] ?? row['values'])
				if (values) match.values = values
			}
			matches.push(match)
		}
		return { matches, collection: table }
	}

	async delete(input: DeleteVectorsInput): Promise<DeleteVectorsOutput> {
		const table = requireCollection(input.collection, this.#defaultCollection, 'Supabase vector delete')
		const listed = input.ids.map((id) => `"${id.replaceAll('"', '')}"`).join(',')
		const res = await this.#http.delete(`/${encodeURIComponent(table)}`, {
			label: 'Supabase vector delete',
			noThrow: true,
			query: { [this.#idColumn]: `in.(${listed})` },
			headers: { Prefer: 'return=minimal' }
		})
		if (!res.ok) {
			throw new ToolError(parseUpstreamMessage(res.data, `Supabase vector delete failed with HTTP ${res.status}`), {
				code: mapVectorHttpStatus(res.status),
				details: { status: res.status }
			})
		}
		return { deleted: input.ids.length, collection: table }
	}
}
