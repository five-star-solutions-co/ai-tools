/**
 * WooCommerce REST API vendor client (wc/v3).
 * Host: `new WoocommerceClient(auth)`. Agent tools: `fromContext(ctx)`.
 */

import { ToolError } from '../../core/errors'
import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import { HttpService } from '../../transport/http-service'
import type { HttpServiceOptions } from '../../transport/http-service'
import type {
	WoocommerceAuth,
	WoocommerceCreateCouponInput,
	WoocommerceCreateCouponOutput,
	WoocommerceCreateCustomerInput,
	WoocommerceCreateCustomerOutput,
	WoocommerceCreateOrderInput,
	WoocommerceCreateOrderNoteInput,
	WoocommerceCreateOrderNoteOutput,
	WoocommerceCreateOrderOutput,
	WoocommerceCreateOrderRefundInput,
	WoocommerceCreateOrderRefundOutput,
	WoocommerceCreateProductInput,
	WoocommerceCreateProductOutput,
	WoocommerceDeleteOrderInput,
	WoocommerceDeleteOrderOutput,
	WoocommerceDeleteProductInput,
	WoocommerceDeleteProductOutput,
	WoocommerceGetCouponInput,
	WoocommerceGetCouponOutput,
	WoocommerceGetCustomerInput,
	WoocommerceGetCustomerOutput,
	WoocommerceGetOrderInput,
	WoocommerceGetOrderOutput,
	WoocommerceGetProductCategoryInput,
	WoocommerceGetProductCategoryOutput,
	WoocommerceGetProductInput,
	WoocommerceGetProductOutput,
	WoocommerceGetProductVariationInput,
	WoocommerceGetProductVariationOutput,
	WoocommerceListCouponsInput,
	WoocommerceListCouponsOutput,
	WoocommerceListCustomersInput,
	WoocommerceListCustomersOutput,
	WoocommerceListOrderNotesInput,
	WoocommerceListOrderNotesOutput,
	WoocommerceListOrderRefundsInput,
	WoocommerceListOrderRefundsOutput,
	WoocommerceListOrdersInput,
	WoocommerceListOrdersOutput,
	WoocommerceListProductCategoriesInput,
	WoocommerceListProductCategoriesOutput,
	WoocommerceListProductsInput,
	WoocommerceListProductsOutput,
	WoocommerceListProductVariationsInput,
	WoocommerceListProductVariationsOutput,
	WoocommerceUpdateCouponInput,
	WoocommerceUpdateCouponOutput,
	WoocommerceUpdateCustomerInput,
	WoocommerceUpdateCustomerOutput,
	WoocommerceUpdateOrderInput,
	WoocommerceUpdateOrderOutput,
	WoocommerceUpdateProductInput,
	WoocommerceUpdateProductOutput
} from './contracts'
import { woocommerceAuthSchema } from './contracts'
import {
	apiBaseUrl,
	basicAuthHeader,
	couponWriteBody,
	customerWriteBody,
	listPageMeta,
	orderNoteWriteBody,
	orderRefundWriteBody,
	orderWriteBody,
	pageFromCursor,
	parseCoupon,
	parseCoupons,
	parseCustomer,
	parseCustomers,
	parseDeleteResult,
	parseOrder,
	parseOrderNote,
	parseOrderNotes,
	parseOrderRefund,
	parseOrderRefunds,
	parseOrders,
	parseProduct,
	parseProductCategories,
	parseProductCategory,
	parseProductDeleteResult,
	parseProducts,
	parseProductVariation,
	parseProductVariations,
	productWriteBody
} from './domain'

export type WoocommerceClientOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'>

export class WoocommerceClient {
	readonly #http: HttpService

	constructor(auth: WoocommerceAuth, options: WoocommerceClientOptions = {}) {
		const parsed = woocommerceAuthSchema.safeParse(auth)
		if (!parsed.success) {
			throw new ToolError('Invalid WooCommerce auth credentials', {
				code: 'bad_auth',
				details: { issues: parsed.error.issues.map((issue) => issue.message) }
			})
		}
		this.#http = new HttpService({
			...options,
			baseURL: apiBaseUrl(parsed.data),
			headers: {
				Authorization: basicAuthHeader(parsed.data),
				'Content-Type': 'application/json'
			},
			label: 'WooCommerce'
		})
	}

	static fromContext(ctx: ToolContext): WoocommerceClient {
		const auth = requireAuth(ctx, woocommerceAuthSchema)
		return new WoocommerceClient(auth, {
			...(ctx.fetch && { fetch: ctx.fetch }),
			...(ctx.signal && { signal: ctx.signal })
		})
	}

	// ── Orders ──────────────────────────────────────────────────────────────

	/** GET /orders */
	async listOrders(input: WoocommerceListOrdersInput = {}): Promise<WoocommerceListOrdersOutput> {
		const page = pageFromCursor(input.cursor)
		const limit = input.limit ?? 10
		const { data, headers } = await this.#http.get('/orders', {
			label: 'WooCommerce listOrders',
			query: {
				page,
				per_page: limit,
				...(input.status && { status: input.status }),
				...(input.after && { after: input.after }),
				...(input.before && { before: input.before }),
				...(input.search && { search: input.search }),
				...(input.customer_id !== undefined && { customer: input.customer_id })
			}
		})
		const items = parseOrders(data)
		const pageMeta = listPageMeta(page, limit, items.length, headers.get('x-wp-totalpages'))
		return {
			items,
			truncated: pageMeta.truncated,
			...(pageMeta.next_cursor && { next_cursor: pageMeta.next_cursor })
		}
	}

	/** GET /orders/{id} */
	async getOrder(input: WoocommerceGetOrderInput): Promise<WoocommerceGetOrderOutput> {
		const { data } = await this.#http.get(`/orders/${input.order_id}`, { label: 'WooCommerce getOrder' })
		return { order: parseOrder(data) }
	}

	/** POST /orders */
	async createOrder(input: WoocommerceCreateOrderInput = {}): Promise<WoocommerceCreateOrderOutput> {
		const { data } = await this.#http.post('/orders', orderWriteBody(input), {
			label: 'WooCommerce createOrder'
		})
		return { order: parseOrder(data) }
	}

	/** PUT /orders/{id} */
	async updateOrder(input: WoocommerceUpdateOrderInput): Promise<WoocommerceUpdateOrderOutput> {
		const { order_id, ...fields } = input
		const { data } = await this.#http.put(`/orders/${order_id}`, orderWriteBody(fields), {
			label: 'WooCommerce updateOrder'
		})
		return { order: parseOrder(data) }
	}

	/** DELETE /orders/{id} */
	async deleteOrder(input: WoocommerceDeleteOrderInput): Promise<WoocommerceDeleteOrderOutput> {
		const force = input.force !== false
		const { data } = await this.#http.delete(`/orders/${input.order_id}`, {
			label: 'WooCommerce deleteOrder',
			query: { force }
		})
		return parseDeleteResult(data, input.order_id)
	}

	/** GET /orders/{id}/notes */
	async listOrderNotes(input: WoocommerceListOrderNotesInput): Promise<WoocommerceListOrderNotesOutput> {
		const page = pageFromCursor(input.cursor)
		const limit = input.limit ?? 10
		const { data, headers } = await this.#http.get(`/orders/${input.order_id}/notes`, {
			label: 'WooCommerce listOrderNotes',
			query: {
				page,
				per_page: limit,
				...(input.type && input.type !== 'any' && { type: input.type })
			}
		})
		const items = parseOrderNotes(data)
		const pageMeta = listPageMeta(page, limit, items.length, headers.get('x-wp-totalpages'))
		return {
			items,
			truncated: pageMeta.truncated,
			...(pageMeta.next_cursor && { next_cursor: pageMeta.next_cursor })
		}
	}

	/** POST /orders/{id}/notes */
	async createOrderNote(input: WoocommerceCreateOrderNoteInput): Promise<WoocommerceCreateOrderNoteOutput> {
		const { order_id, ...fields } = input
		const { data } = await this.#http.post(`/orders/${order_id}/notes`, orderNoteWriteBody(fields), {
			label: 'WooCommerce createOrderNote'
		})
		return { note: parseOrderNote(data) }
	}

	/** GET /orders/{id}/refunds */
	async listOrderRefunds(input: WoocommerceListOrderRefundsInput): Promise<WoocommerceListOrderRefundsOutput> {
		const page = pageFromCursor(input.cursor)
		const limit = input.limit ?? 10
		const { data, headers } = await this.#http.get(`/orders/${input.order_id}/refunds`, {
			label: 'WooCommerce listOrderRefunds',
			query: {
				page,
				per_page: limit
			}
		})
		const items = parseOrderRefunds(data)
		const pageMeta = listPageMeta(page, limit, items.length, headers.get('x-wp-totalpages'))
		return {
			items,
			truncated: pageMeta.truncated,
			...(pageMeta.next_cursor && { next_cursor: pageMeta.next_cursor })
		}
	}

	/** POST /orders/{id}/refunds */
	async createOrderRefund(input: WoocommerceCreateOrderRefundInput): Promise<WoocommerceCreateOrderRefundOutput> {
		const { order_id, ...fields } = input
		const { data } = await this.#http.post(`/orders/${order_id}/refunds`, orderRefundWriteBody(fields), {
			label: 'WooCommerce createOrderRefund'
		})
		return { refund: parseOrderRefund(data) }
	}

	// ── Products ────────────────────────────────────────────────────────────

	/** GET /products */
	async listProducts(input: WoocommerceListProductsInput = {}): Promise<WoocommerceListProductsOutput> {
		const page = pageFromCursor(input.cursor)
		const limit = input.limit ?? 10
		const { data, headers } = await this.#http.get('/products', {
			label: 'WooCommerce listProducts',
			query: {
				page,
				per_page: limit,
				...(input.status && { status: input.status }),
				...(input.search && { search: input.search }),
				...(input.sku && { sku: input.sku }),
				...(input.category !== undefined && { category: input.category }),
				...(input.type && { type: input.type }),
				// WC REST: include is a list of product ids
				...(input.include && input.include.length > 0 && { include: input.include.join(',') })
			}
		})
		const items = parseProducts(data)
		const pageMeta = listPageMeta(page, limit, items.length, headers.get('x-wp-totalpages'))
		return {
			items,
			truncated: pageMeta.truncated,
			...(pageMeta.next_cursor && { next_cursor: pageMeta.next_cursor })
		}
	}

	/** GET /products/{id} */
	async getProduct(input: WoocommerceGetProductInput): Promise<WoocommerceGetProductOutput> {
		const { data } = await this.#http.get(`/products/${input.product_id}`, {
			label: 'WooCommerce getProduct'
		})
		return { product: parseProduct(data) }
	}

	/** POST /products */
	async createProduct(input: WoocommerceCreateProductInput): Promise<WoocommerceCreateProductOutput> {
		const { data } = await this.#http.post('/products', productWriteBody(input), {
			label: 'WooCommerce createProduct'
		})
		return { product: parseProduct(data) }
	}

	/** PUT /products/{id} */
	async updateProduct(input: WoocommerceUpdateProductInput): Promise<WoocommerceUpdateProductOutput> {
		const { product_id, ...fields } = input
		const { data } = await this.#http.put(`/products/${product_id}`, productWriteBody(fields), {
			label: 'WooCommerce updateProduct'
		})
		return { product: parseProduct(data) }
	}

	/** DELETE /products/{id} */
	async deleteProduct(input: WoocommerceDeleteProductInput): Promise<WoocommerceDeleteProductOutput> {
		const force = input.force !== false
		const { data } = await this.#http.delete(`/products/${input.product_id}`, {
			label: 'WooCommerce deleteProduct',
			query: { force }
		})
		return parseProductDeleteResult(data, input.product_id)
	}

	/** GET /products/{id}/variations */
	async listProductVariations(
		input: WoocommerceListProductVariationsInput
	): Promise<WoocommerceListProductVariationsOutput> {
		const page = pageFromCursor(input.cursor)
		const limit = input.limit ?? 10
		const { data, headers } = await this.#http.get(`/products/${input.product_id}/variations`, {
			label: 'WooCommerce listProductVariations',
			query: {
				page,
				per_page: limit,
				...(input.status && { status: input.status }),
				...(input.sku && { sku: input.sku })
			}
		})
		const items = parseProductVariations(data)
		const pageMeta = listPageMeta(page, limit, items.length, headers.get('x-wp-totalpages'))
		return {
			items,
			truncated: pageMeta.truncated,
			...(pageMeta.next_cursor && { next_cursor: pageMeta.next_cursor })
		}
	}

	/** GET /products/{product_id}/variations/{variation_id} */
	async getProductVariation(input: WoocommerceGetProductVariationInput): Promise<WoocommerceGetProductVariationOutput> {
		const { data } = await this.#http.get(`/products/${input.product_id}/variations/${input.variation_id}`, {
			label: 'WooCommerce getProductVariation'
		})
		return { variation: parseProductVariation(data) }
	}

	// ── Customers ───────────────────────────────────────────────────────────

	/** GET /customers */
	async listCustomers(input: WoocommerceListCustomersInput = {}): Promise<WoocommerceListCustomersOutput> {
		const page = pageFromCursor(input.cursor)
		const limit = input.limit ?? 10
		const { data, headers } = await this.#http.get('/customers', {
			label: 'WooCommerce listCustomers',
			query: {
				page,
				per_page: limit,
				...(input.search && { search: input.search }),
				...(input.email && { email: input.email }),
				...(input.role && { role: input.role })
			}
		})
		const items = parseCustomers(data)
		const pageMeta = listPageMeta(page, limit, items.length, headers.get('x-wp-totalpages'))
		return {
			items,
			truncated: pageMeta.truncated,
			...(pageMeta.next_cursor && { next_cursor: pageMeta.next_cursor })
		}
	}

	/** GET /customers/{id} */
	async getCustomer(input: WoocommerceGetCustomerInput): Promise<WoocommerceGetCustomerOutput> {
		const { data } = await this.#http.get(`/customers/${input.customer_id}`, {
			label: 'WooCommerce getCustomer'
		})
		return { customer: parseCustomer(data) }
	}

	/** POST /customers */
	async createCustomer(input: WoocommerceCreateCustomerInput): Promise<WoocommerceCreateCustomerOutput> {
		const { data } = await this.#http.post('/customers', customerWriteBody(input), {
			label: 'WooCommerce createCustomer'
		})
		return { customer: parseCustomer(data) }
	}

	/** PUT /customers/{id} */
	async updateCustomer(input: WoocommerceUpdateCustomerInput): Promise<WoocommerceUpdateCustomerOutput> {
		const { customer_id, ...fields } = input
		const { data } = await this.#http.put(`/customers/${customer_id}`, customerWriteBody(fields), {
			label: 'WooCommerce updateCustomer'
		})
		return { customer: parseCustomer(data) }
	}

	// ── Coupons ─────────────────────────────────────────────────────────────

	/** GET /coupons */
	async listCoupons(input: WoocommerceListCouponsInput = {}): Promise<WoocommerceListCouponsOutput> {
		const page = pageFromCursor(input.cursor)
		const limit = input.limit ?? 10
		const { data, headers } = await this.#http.get('/coupons', {
			label: 'WooCommerce listCoupons',
			query: {
				page,
				per_page: limit,
				...(input.search && { search: input.search }),
				...(input.code && { code: input.code })
			}
		})
		const items = parseCoupons(data)
		const pageMeta = listPageMeta(page, limit, items.length, headers.get('x-wp-totalpages'))
		return {
			items,
			truncated: pageMeta.truncated,
			...(pageMeta.next_cursor && { next_cursor: pageMeta.next_cursor })
		}
	}

	/** GET /coupons/{id} */
	async getCoupon(input: WoocommerceGetCouponInput): Promise<WoocommerceGetCouponOutput> {
		const { data } = await this.#http.get(`/coupons/${input.coupon_id}`, {
			label: 'WooCommerce getCoupon'
		})
		return { coupon: parseCoupon(data) }
	}

	/** POST /coupons */
	async createCoupon(input: WoocommerceCreateCouponInput): Promise<WoocommerceCreateCouponOutput> {
		const { data } = await this.#http.post('/coupons', couponWriteBody(input), {
			label: 'WooCommerce createCoupon'
		})
		return { coupon: parseCoupon(data) }
	}

	/** PUT /coupons/{id} */
	async updateCoupon(input: WoocommerceUpdateCouponInput): Promise<WoocommerceUpdateCouponOutput> {
		const { coupon_id, ...fields } = input
		const { data } = await this.#http.put(`/coupons/${coupon_id}`, couponWriteBody(fields), {
			label: 'WooCommerce updateCoupon'
		})
		return { coupon: parseCoupon(data) }
	}

	// ── Product categories ──────────────────────────────────────────────────

	/** GET /products/categories */
	async listProductCategories(
		input: WoocommerceListProductCategoriesInput = {}
	): Promise<WoocommerceListProductCategoriesOutput> {
		const page = pageFromCursor(input.cursor)
		const limit = input.limit ?? 10
		const { data, headers } = await this.#http.get('/products/categories', {
			label: 'WooCommerce listProductCategories',
			query: {
				page,
				per_page: limit,
				...(input.search && { search: input.search }),
				...(input.parent !== undefined && { parent: input.parent }),
				...(input.hide_empty !== undefined && { hide_empty: input.hide_empty })
			}
		})
		const items = parseProductCategories(data)
		const pageMeta = listPageMeta(page, limit, items.length, headers.get('x-wp-totalpages'))
		return {
			items,
			truncated: pageMeta.truncated,
			...(pageMeta.next_cursor && { next_cursor: pageMeta.next_cursor })
		}
	}

	/** GET /products/categories/{id} */
	async getProductCategory(input: WoocommerceGetProductCategoryInput): Promise<WoocommerceGetProductCategoryOutput> {
		const { data } = await this.#http.get(`/products/categories/${input.category_id}`, {
			label: 'WooCommerce getProductCategory'
		})
		return { category: parseProductCategory(data) }
	}
}
