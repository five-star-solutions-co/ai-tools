/**
 * ShipStation V2 and V1 vendor client.
 * Host: `new ShipstationClient(auth)`. Agent tools: `fromContext(ctx)`.
 */

import type { output, ZodType } from 'zod'

import { ToolError } from '../../core/errors'
import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import { bytesToBase64, utf8ToBytes } from '../../shared/bytes'
import { HttpService } from '../../transport/http-service'
import type { HttpServiceOptions } from '../../transport/http-service'
import type {
	ShipstationAuth,
	ShipstationCarrierIdInput,
	ShipstationGetCarrierOutput,
	ShipstationListCarrierOptionsOutput,
	ShipstationListCarrierPackagesOutput,
	ShipstationListCarriersOutput,
	ShipstationListCarrierServicesOutput,
	ShipstationListFulfillmentsPageInput,
	ShipstationListFulfillmentsPageOutput,
	ShipstationListLabelsPageInput,
	ShipstationListLabelsPageOutput,
	ShipstationListOrdersPageInput,
	ShipstationListOrdersPageOutput,
	ShipstationListShipmentsPageInput,
	ShipstationListShipmentsPageOutput,
	ShipstationListStoresInput,
	ShipstationListStoresOutput
} from './contracts'
import {
	shipstationAuthSchema,
	shipstationCarrierIdInputSchema,
	shipstationCarrierRawSchema,
	shipstationListCarrierOptionsResponseSchema,
	shipstationListCarrierPackagesResponseSchema,
	shipstationListCarriersResponseSchema,
	shipstationListCarrierServicesResponseSchema,
	shipstationListFulfillmentsPageInputSchema,
	shipstationListFulfillmentsResponseSchema,
	shipstationListLabelsPageInputSchema,
	shipstationListLabelsResponseSchema,
	shipstationListOrdersPageInputSchema,
	shipstationListOrdersResponseSchema,
	shipstationListShipmentsPageInputSchema,
	shipstationListShipmentsResponseSchema,
	shipstationListStoresInputSchema,
	shipstationListStoresResponseSchema
} from './contracts'

const SHIPSTATION_V2_API_BASE = 'https://api.shipstation.com/v2'
const SHIPSTATION_V1_API_BASE = 'https://ssapi.shipstation.com'
const DEFAULT_PAGE_SIZE = 25

export type ShipstationClientOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'>

function parseInput<TSchema extends ZodType>(schema: TSchema, input: unknown, message: string): output<TSchema> {
	const parsed = schema.safeParse(input)
	if (!parsed.success) {
		throw new ToolError(message, {
			code: 'bad_input',
			details: { issues: parsed.error.issues.map((issue) => issue.message) }
		})
	}
	return parsed.data
}

function parseResponse<TSchema extends ZodType>(schema: TSchema, data: unknown, message: string): output<TSchema> {
	const parsed = schema.safeParse(data)
	if (!parsed.success) {
		throw new ToolError(message, {
			code: 'upstream',
			details: { issues: parsed.error.issues.map((issue) => issue.message) }
		})
	}
	return parsed.data
}

function v1Authorization(apiKey: string, apiSecret: string): string {
	return `Basic ${bytesToBase64(utf8ToBytes(`${apiKey}:${apiSecret}`))}`
}

export class ShipstationClient {
	readonly #v2: HttpService
	readonly #v1: HttpService

	constructor(auth: ShipstationAuth, options: ShipstationClientOptions = {}) {
		const parsed = shipstationAuthSchema.safeParse(auth)
		if (!parsed.success) {
			throw new ToolError('Invalid ShipStation auth credentials', {
				code: 'bad_auth',
				details: { issues: parsed.error.issues.map((issue) => issue.message) }
			})
		}

		this.#v2 = new HttpService({
			...options,
			baseURL: SHIPSTATION_V2_API_BASE,
			headers: {
				Accept: 'application/json',
				'API-Key': parsed.data.v2_api_key
			},
			label: 'ShipStation V2'
		})
		this.#v1 = new HttpService({
			...options,
			baseURL: SHIPSTATION_V1_API_BASE,
			headers: {
				Accept: 'application/json',
				Authorization: v1Authorization(parsed.data.v1_api_key, parsed.data.v1_api_secret)
			},
			label: 'ShipStation V1'
		})
	}

	static fromContext(ctx: ToolContext): ShipstationClient {
		const auth = requireAuth(ctx, shipstationAuthSchema)
		return new ShipstationClient(auth, {
			...(ctx.fetch && { fetch: ctx.fetch }),
			...(ctx.signal && { signal: ctx.signal })
		})
	}

	/** One V2 GET /labels request with provider pagination and filters. */
	async listLabelsPage(input: ShipstationListLabelsPageInput = {}): Promise<ShipstationListLabelsPageOutput> {
		const parsedInput = parseInput(shipstationListLabelsPageInputSchema, input, 'Invalid ShipStation labels page input')
		const page = parsedInput.page ?? 1
		const pageSize = parsedInput.page_size ?? DEFAULT_PAGE_SIZE
		const { data } = await this.#v2.get('/labels', {
			label: 'ShipStation listLabelsPage',
			query: { ...parsedInput, page, page_size: pageSize }
		})
		const response = parseResponse(
			shipstationListLabelsResponseSchema,
			data,
			'ShipStation returned an invalid labels page'
		)

		return {
			items: response.labels,
			pagination: {
				total: response.total,
				page: response.page,
				pages: response.pages,
				page_size: pageSize,
				has_more: response.page < response.pages
			}
		}
	}

	/** One V2 GET /shipments request with provider pagination and filters. */
	async listShipmentsPage(input: ShipstationListShipmentsPageInput = {}): Promise<ShipstationListShipmentsPageOutput> {
		const parsedInput = parseInput(
			shipstationListShipmentsPageInputSchema,
			input,
			'Invalid ShipStation shipments page input'
		)
		const page = parsedInput.page ?? 1
		const pageSize = parsedInput.page_size ?? DEFAULT_PAGE_SIZE
		const { data } = await this.#v2.get('/shipments', {
			label: 'ShipStation listShipmentsPage',
			query: { ...parsedInput, page, page_size: pageSize }
		})
		const response = parseResponse(
			shipstationListShipmentsResponseSchema,
			data,
			'ShipStation returned an invalid shipments page'
		)

		return {
			items: response.shipments,
			pagination: {
				total: response.total,
				page: response.page,
				pages: response.pages,
				page_size: pageSize,
				has_more: response.page < response.pages
			}
		}
	}

	/** One V2 GET /fulfillments request with provider pagination and filters. */
	async listFulfillmentsPage(
		input: ShipstationListFulfillmentsPageInput = {}
	): Promise<ShipstationListFulfillmentsPageOutput> {
		const parsedInput = parseInput(
			shipstationListFulfillmentsPageInputSchema,
			input,
			'Invalid ShipStation fulfillments page input'
		)
		const page = parsedInput.page ?? 1
		const pageSize = parsedInput.page_size ?? DEFAULT_PAGE_SIZE
		const { data } = await this.#v2.get('/fulfillments', {
			label: 'ShipStation listFulfillmentsPage',
			query: { ...parsedInput, page, page_size: pageSize }
		})
		const response = parseResponse(
			shipstationListFulfillmentsResponseSchema,
			data,
			'ShipStation returned an invalid fulfillments page'
		)

		return {
			items: response.fulfillments,
			pagination: {
				total: response.total,
				page: response.page,
				pages: response.pages,
				page_size: pageSize,
				has_more: response.page < response.pages
			}
		}
	}

	/** V2 GET /carriers. */
	async listCarriers(): Promise<ShipstationListCarriersOutput> {
		const { data } = await this.#v2.get('/carriers', { label: 'ShipStation listCarriers' })
		const response = parseResponse(
			shipstationListCarriersResponseSchema,
			data,
			'ShipStation returned an invalid carriers response'
		)
		return { items: response.carriers }
	}

	/** V2 GET /carriers/{carrier_id}. */
	async getCarrier(input: ShipstationCarrierIdInput): Promise<ShipstationGetCarrierOutput> {
		const parsedInput = parseInput(shipstationCarrierIdInputSchema, input, 'Invalid ShipStation carrier input')
		const { data } = await this.#v2.get(`/carriers/${encodeURIComponent(parsedInput.carrier_id)}`, {
			label: 'ShipStation getCarrier'
		})
		return parseResponse(shipstationCarrierRawSchema, data, 'ShipStation returned an invalid carrier')
	}

	/** V2 GET /carriers/{carrier_id}/services. */
	async listCarrierServices(input: ShipstationCarrierIdInput): Promise<ShipstationListCarrierServicesOutput> {
		const parsedInput = parseInput(shipstationCarrierIdInputSchema, input, 'Invalid ShipStation carrier input')
		const { data } = await this.#v2.get(`/carriers/${encodeURIComponent(parsedInput.carrier_id)}/services`, {
			label: 'ShipStation listCarrierServices'
		})
		const response = parseResponse(
			shipstationListCarrierServicesResponseSchema,
			data,
			'ShipStation returned invalid carrier services'
		)
		return { items: response.services }
	}

	/** V2 GET /carriers/{carrier_id}/packages. */
	async listCarrierPackages(input: ShipstationCarrierIdInput): Promise<ShipstationListCarrierPackagesOutput> {
		const parsedInput = parseInput(shipstationCarrierIdInputSchema, input, 'Invalid ShipStation carrier input')
		const { data } = await this.#v2.get(`/carriers/${encodeURIComponent(parsedInput.carrier_id)}/packages`, {
			label: 'ShipStation listCarrierPackages'
		})
		const response = parseResponse(
			shipstationListCarrierPackagesResponseSchema,
			data,
			'ShipStation returned invalid carrier packages'
		)
		return { items: response.packages }
	}

	/** V2 GET /carriers/{carrier_id}/options. */
	async listCarrierOptions(input: ShipstationCarrierIdInput): Promise<ShipstationListCarrierOptionsOutput> {
		const parsedInput = parseInput(shipstationCarrierIdInputSchema, input, 'Invalid ShipStation carrier input')
		const { data } = await this.#v2.get(`/carriers/${encodeURIComponent(parsedInput.carrier_id)}/options`, {
			label: 'ShipStation listCarrierOptions'
		})
		const response = parseResponse(
			shipstationListCarrierOptionsResponseSchema,
			data,
			'ShipStation returned invalid carrier options'
		)
		return { items: response.options }
	}

	/** One legacy V1 GET /orders request. */
	async listOrdersPage(input: ShipstationListOrdersPageInput = {}): Promise<ShipstationListOrdersPageOutput> {
		const parsedInput = parseInput(shipstationListOrdersPageInputSchema, input, 'Invalid ShipStation orders page input')
		const page = parsedInput.page ?? 1
		const pageSize = parsedInput.page_size ?? DEFAULT_PAGE_SIZE
		const { data } = await this.#v1.get('/orders', {
			label: 'ShipStation listOrdersPage',
			query: {
				page,
				pageSize,
				...(parsedInput.customer_name && { customerName: parsedInput.customer_name }),
				...(parsedInput.item_keyword && { itemKeyword: parsedInput.item_keyword }),
				...(parsedInput.create_date_start && { createDateStart: parsedInput.create_date_start }),
				...(parsedInput.create_date_end && { createDateEnd: parsedInput.create_date_end }),
				...(parsedInput.modify_date_start && { modifyDateStart: parsedInput.modify_date_start }),
				...(parsedInput.modify_date_end && { modifyDateEnd: parsedInput.modify_date_end }),
				...(parsedInput.order_date_start && { orderDateStart: parsedInput.order_date_start }),
				...(parsedInput.order_date_end && { orderDateEnd: parsedInput.order_date_end }),
				...(parsedInput.order_number && { orderNumber: parsedInput.order_number }),
				...(parsedInput.order_status && { orderStatus: parsedInput.order_status }),
				...(parsedInput.payment_date_start && { paymentDateStart: parsedInput.payment_date_start }),
				...(parsedInput.payment_date_end && { paymentDateEnd: parsedInput.payment_date_end }),
				...(parsedInput.store_id !== undefined && { storeId: parsedInput.store_id }),
				...(parsedInput.sort_by && { sortBy: parsedInput.sort_by }),
				...(parsedInput.sort_dir && { sortDir: parsedInput.sort_dir })
			}
		})
		const response = parseResponse(
			shipstationListOrdersResponseSchema,
			data,
			'ShipStation returned an invalid orders page'
		)

		return {
			items: response.orders,
			pagination: {
				total: response.total,
				page: response.page,
				pages: response.pages,
				page_size: pageSize,
				has_more: response.page < response.pages
			}
		}
	}

	/** Legacy V1 GET /stores. */
	async listStores(input: ShipstationListStoresInput = {}): Promise<ShipstationListStoresOutput> {
		const parsedInput = parseInput(shipstationListStoresInputSchema, input, 'Invalid ShipStation stores input')
		const { data } = await this.#v1.get('/stores', {
			label: 'ShipStation listStores',
			query: {
				...(parsedInput.show_inactive !== undefined && { showInactive: parsedInput.show_inactive }),
				...(parsedInput.marketplace_id !== undefined && { marketplaceId: parsedInput.marketplace_id })
			}
		})
		return {
			items: parseResponse(shipstationListStoresResponseSchema, data, 'ShipStation returned an invalid stores response')
		}
	}
}
