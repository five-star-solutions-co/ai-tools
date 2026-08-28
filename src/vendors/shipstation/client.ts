/**
 * ShipStation V2 vendor client.
 * Host: `new ShipstationClient(auth)`. Agent tools: `fromContext(ctx)`.
 */

import { ToolError } from '../../core/errors'
import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import { HttpService } from '../../transport/http-service'
import type { HttpServiceOptions } from '../../transport/http-service'
import type {
	ShipstationAuth,
	ShipstationListLabelsPageInput,
	ShipstationListLabelsPageOutput,
	ShipstationListShipmentsPageInput,
	ShipstationListShipmentsPageOutput
} from './contracts'
import {
	shipstationAuthSchema,
	shipstationListLabelsPageInputSchema,
	shipstationListLabelsResponseSchema,
	shipstationListShipmentsPageInputSchema,
	shipstationListShipmentsResponseSchema
} from './contracts'

const SHIPSTATION_API_BASE = 'https://api.shipstation.com/v2'
const DEFAULT_PAGE_SIZE = 25

export type ShipstationClientOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'>

export class ShipstationClient {
	readonly #http: HttpService

	constructor(auth: ShipstationAuth, options: ShipstationClientOptions = {}) {
		const parsed = shipstationAuthSchema.safeParse(auth)
		if (!parsed.success) {
			throw new ToolError('Invalid ShipStation auth credentials', {
				code: 'bad_auth',
				details: { issues: parsed.error.issues.map((issue) => issue.message) }
			})
		}

		this.#http = new HttpService({
			...options,
			baseURL: SHIPSTATION_API_BASE,
			headers: {
				Accept: 'application/json',
				'API-Key': parsed.data.api_key
			},
			label: 'ShipStation'
		})
	}

	static fromContext(ctx: ToolContext): ShipstationClient {
		const auth = requireAuth(ctx, shipstationAuthSchema)
		return new ShipstationClient(auth, {
			...(ctx.fetch && { fetch: ctx.fetch }),
			...(ctx.signal && { signal: ctx.signal })
		})
	}

	/** One GET /labels request with provider pagination and filters. */
	async listLabelsPage(input: ShipstationListLabelsPageInput = {}): Promise<ShipstationListLabelsPageOutput> {
		const parsedInput = shipstationListLabelsPageInputSchema.safeParse(input)
		if (!parsedInput.success) {
			throw new ToolError('Invalid ShipStation labels page input', {
				code: 'bad_input',
				details: { issues: parsedInput.error.issues.map((issue) => issue.message) }
			})
		}

		const page = parsedInput.data.page ?? 1
		const pageSize = parsedInput.data.page_size ?? DEFAULT_PAGE_SIZE
		const { data } = await this.#http.get('/labels', {
			label: 'ShipStation listLabelsPage',
			query: { ...parsedInput.data, page, page_size: pageSize }
		})
		const parsedResponse = shipstationListLabelsResponseSchema.safeParse(data)
		if (!parsedResponse.success) {
			throw new ToolError('ShipStation returned an invalid labels page', {
				code: 'upstream',
				details: { issues: parsedResponse.error.issues.map((issue) => issue.message) }
			})
		}

		return {
			items: parsedResponse.data.labels,
			pagination: {
				total: parsedResponse.data.total,
				page: parsedResponse.data.page,
				pages: parsedResponse.data.pages,
				page_size: pageSize,
				has_more: parsedResponse.data.page < parsedResponse.data.pages
			}
		}
	}

	/** One GET /shipments request with provider pagination and filters. */
	async listShipmentsPage(input: ShipstationListShipmentsPageInput = {}): Promise<ShipstationListShipmentsPageOutput> {
		const parsedInput = shipstationListShipmentsPageInputSchema.safeParse(input)
		if (!parsedInput.success) {
			throw new ToolError('Invalid ShipStation shipments page input', {
				code: 'bad_input',
				details: { issues: parsedInput.error.issues.map((issue) => issue.message) }
			})
		}

		const page = parsedInput.data.page ?? 1
		const pageSize = parsedInput.data.page_size ?? DEFAULT_PAGE_SIZE
		const { data } = await this.#http.get('/shipments', {
			label: 'ShipStation listShipmentsPage',
			query: { ...parsedInput.data, page, page_size: pageSize }
		})
		const parsedResponse = shipstationListShipmentsResponseSchema.safeParse(data)
		if (!parsedResponse.success) {
			throw new ToolError('ShipStation returned an invalid shipments page', {
				code: 'upstream',
				details: { issues: parsedResponse.error.issues.map((issue) => issue.message) }
			})
		}

		return {
			items: parsedResponse.data.shipments,
			pagination: {
				total: parsedResponse.data.total,
				page: parsedResponse.data.page,
				pages: parsedResponse.data.pages,
				page_size: pageSize,
				has_more: parsedResponse.data.page < parsedResponse.data.pages
			}
		}
	}
}
