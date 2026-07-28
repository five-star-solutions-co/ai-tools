/**
 * Mastra PgVector vendor client (`@mastra/pg`).
 * Host: `new MastraVectorClient(auth)`. Agent tools: `fromContext(ctx)`.
 * Runtime: node (Postgres). Optional peer: `@mastra/pg`.
 */

import { PgVector } from '@mastra/pg'
import { isNumber, isPlainObject, isString } from 'es-toolkit'

import { ToolError } from '../../core/errors'
import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import { mergeVectorFilter, parseMetadata, requireCollection, stampDefaultFilterMetadata } from '../_vector/domain'
import type { VectorDefaultFilter } from '../_vector/domain'
import type {
	DeleteVectorsInput,
	DeleteVectorsOutput,
	MastraVectorAuth,
	QueryVectorsInput,
	QueryVectorsOutput,
	UpsertVectorsInput,
	UpsertVectorsOutput,
	VectorMatch
} from './contracts'
import { mastraVectorAuthSchema } from './contracts'

/** Injected / real store surface (filter is opaque Record for seam compatibility). */
type MastraStore = {
	upsert: (input: {
		indexName: string
		ids: string[]
		vectors: number[][]
		metadata: Array<Record<string, unknown>>
	}) => Promise<unknown>
	query: (input: {
		indexName: string
		queryVector: number[]
		topK?: number
		includeVector?: boolean
		filter?: Record<string, unknown>
	}) => Promise<Array<{ id?: string; score?: number; metadata?: unknown; vector?: number[] }>>
	deleteVectors: (input: { indexName: string; ids: string[] }) => Promise<unknown>
	createIndex: (input: { indexName: string; dimension: number }) => Promise<unknown>
	disconnect?: () => Promise<void>
}

type PgQueryArgs = Parameters<PgVector['query']>[0]

/** Narrow a built arg bag to PgVector query params (Mongo-style filter is structural). */
function isPgQueryArgs(value: unknown): value is PgQueryArgs {
	return (
		isPlainObject(value) &&
		isString(value['indexName']) &&
		value['indexName'].length > 0 &&
		Array.isArray(value['queryVector'])
	)
}

export type MastraVectorClientOptions = {
	/**
	 * Test injection — production uses PgVector.
	 * Must implement the same method names as PgVector for upsert/query/deleteVectors/createIndex.
	 */
	store?: MastraStore
}

export class MastraVectorClient {
	readonly #store: MastraStore
	readonly #defaultIndex: string | undefined
	readonly #defaultFilter: VectorDefaultFilter | undefined
	readonly #dimension: number | undefined
	readonly #autoCreateIndex: boolean
	readonly #ownsStore: boolean

	constructor(auth: MastraVectorAuth, options: MastraVectorClientOptions = {}) {
		const parsed = mastraVectorAuthSchema.safeParse(auth)
		if (!parsed.success) {
			throw new ToolError('Invalid Mastra vector auth credentials', {
				code: 'bad_auth',
				details: { issues: parsed.error.issues.map((issue) => issue.message) }
			})
		}
		const data = parsed.data
		this.#defaultIndex = data.default_index
		this.#defaultFilter = data.default_filter
		this.#dimension = data.dimension
		this.#autoCreateIndex = data.auto_create_index === true

		if (options.store) {
			this.#store = options.store
			this.#ownsStore = false
			return
		}

		const config: {
			connectionString: string
			id: string
			schemaName?: string
			disableInit?: boolean
		} = {
			connectionString: data.connection_string,
			id: data.id
		}
		if (data.schema_name) config.schemaName = data.schema_name
		if (data.disable_init === true) config.disableInit = true

		const pg = new PgVector(config)
		// Adapt PgVector to opaque Record filters (Mongo-style / flat equality is native).
		this.#store = {
			upsert: (input) =>
				pg.upsert({
					indexName: input.indexName,
					ids: input.ids,
					vectors: input.vectors,
					metadata: input.metadata
				}),
			query: (input) => {
				const args: Record<string, unknown> = {
					indexName: input.indexName,
					queryVector: input.queryVector,
					...(input.topK !== undefined && { topK: input.topK }),
					...(input.includeVector !== undefined && { includeVector: input.includeVector }),
					...(input.filter !== undefined && { filter: input.filter })
				}
				if (!isPgQueryArgs(args)) {
					throw new ToolError('Invalid Mastra vector query args', { code: 'internal' })
				}
				return pg.query(args)
			},
			deleteVectors: (input) => pg.deleteVectors({ indexName: input.indexName, ids: input.ids }),
			createIndex: (input) => pg.createIndex({ indexName: input.indexName, dimension: input.dimension }),
			disconnect: () => pg.disconnect()
		}
		this.#ownsStore = true
	}

	static fromContext(ctx: ToolContext): MastraVectorClient {
		const auth = requireAuth(ctx, mastraVectorAuthSchema)
		return new MastraVectorClient(auth)
	}

	async upsert(input: UpsertVectorsInput): Promise<UpsertVectorsOutput> {
		const indexName = requireCollection(input.collection, this.#defaultIndex, 'Mastra vector upsert')
		await this.#ensureIndex(indexName, input.vectors[0]?.values.length)

		await this.#store.upsert({
			indexName,
			ids: input.vectors.map((point) => point.id),
			vectors: input.vectors.map((point) => point.values),
			metadata: input.vectors.map((point) => stampDefaultFilterMetadata(point.metadata, this.#defaultFilter) ?? {})
		})
		return { upserted: input.vectors.length, collection: indexName }
	}

	async query(input: QueryVectorsInput): Promise<QueryVectorsOutput> {
		const indexName = requireCollection(input.collection, this.#defaultIndex, 'Mastra vector query')
		const topK = input.top_k ?? 8
		const includeVector = input.include_values === true
		const filter = mergeVectorFilter(this.#defaultFilter, input.filter)

		const rows = await this.#store.query({
			indexName,
			queryVector: input.vector,
			topK,
			includeVector,
			...(filter && { filter })
		})

		const includeMetadata = input.include_metadata !== false
		const matches: VectorMatch[] = []
		for (const row of rows) {
			if (!isString(row.id) || row.id.length === 0) continue
			const score = isNumber(row.score) ? row.score : 0
			const match: VectorMatch = { id: row.id, score }
			if (includeMetadata && row.metadata !== undefined) {
				const meta = parseMetadata(row.metadata)
				if (meta) match.metadata = meta
			}
			if (includeVector && Array.isArray(row.vector)) {
				const values = row.vector.filter((n): n is number => isNumber(n) && Number.isFinite(n))
				if (values.length === row.vector.length) match.values = values
			}
			matches.push(match)
		}
		return { matches, collection: indexName }
	}

	async delete(input: DeleteVectorsInput): Promise<DeleteVectorsOutput> {
		const indexName = requireCollection(input.collection, this.#defaultIndex, 'Mastra vector delete')
		await this.#store.deleteVectors({ indexName, ids: input.ids })
		return { deleted: input.ids.length, collection: indexName }
	}

	async disconnect(): Promise<void> {
		if (this.#ownsStore && this.#store.disconnect) {
			await this.#store.disconnect()
		}
	}

	async #ensureIndex(indexName: string, inferredDimension: number | undefined): Promise<void> {
		if (!this.#autoCreateIndex) return
		const dimension = this.#dimension ?? inferredDimension
		if (dimension === undefined) {
			throw new ToolError('Mastra auto_create_index requires dimension on auth or non-empty vectors', {
				code: 'bad_input'
			})
		}
		try {
			await this.#store.createIndex({ indexName, dimension })
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			if (/already exists|duplicate|exist/i.test(message)) return
			throw new ToolError(`Mastra createIndex failed: ${message}`, {
				code: 'upstream',
				cause: error
			})
		}
	}
}
