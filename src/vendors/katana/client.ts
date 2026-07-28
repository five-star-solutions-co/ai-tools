/**
 * Katana MRP vendor client.
 * Host: `new KatanaClient(auth)`. Agent tools: `fromContext(ctx)`.
 */

import { isPlainObject } from 'es-toolkit'

import { ToolError } from '../../core/errors'
import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import { HttpService } from '../../transport/http-service'
import type { HttpServiceOptions } from '../../transport/http-service'
import type {
	KatanaAuth,
	KatanaCreateCustomerInput,
	KatanaCreateCustomerOutput,
	KatanaCreateManufacturingOrderInput,
	KatanaCreateManufacturingOrderOutput,
	KatanaCreateProductInput,
	KatanaCreateProductOutput,
	KatanaCreatePurchaseOrderInput,
	KatanaCreatePurchaseOrderOutput,
	KatanaCreateSalesOrderInput,
	KatanaCreateSalesOrderOutput,
	KatanaCreateSupplierInput,
	KatanaCreateSupplierOutput,
	KatanaDeleteSalesOrderInput,
	KatanaDeleteSalesOrderOutput,
	KatanaGetCustomerInput,
	KatanaGetCustomerOutput,
	KatanaGetManufacturingOrderInput,
	KatanaGetManufacturingOrderOutput,
	KatanaGetMaterialInput,
	KatanaGetMaterialOutput,
	KatanaGetProductInput,
	KatanaGetProductOutput,
	KatanaGetPurchaseOrderInput,
	KatanaGetPurchaseOrderOutput,
	KatanaGetSalesOrderInput,
	KatanaGetSalesOrderOutput,
	KatanaGetSupplierInput,
	KatanaGetSupplierOutput,
	KatanaListCustomersInput,
	KatanaListCustomersOutput,
	KatanaListInventoryInput,
	KatanaListInventoryOutput,
	KatanaListManufacturingOrdersInput,
	KatanaListManufacturingOrdersOutput,
	KatanaListMaterialsInput,
	KatanaListMaterialsOutput,
	KatanaListProductsInput,
	KatanaListProductsOutput,
	KatanaListPurchaseOrdersInput,
	KatanaListPurchaseOrdersOutput,
	KatanaListSalesOrdersInput,
	KatanaListSalesOrdersOutput,
	KatanaListSuppliersInput,
	KatanaListSuppliersOutput,
	KatanaQuerySalesOrdersInput,
	KatanaQuerySalesOrdersOutput,
	KatanaUpdateCustomerInput,
	KatanaUpdateCustomerOutput,
	KatanaUpdateManufacturingOrderInput,
	KatanaUpdateManufacturingOrderOutput,
	KatanaUpdateProductInput,
	KatanaUpdateProductOutput,
	KatanaUpdatePurchaseOrderInput,
	KatanaUpdatePurchaseOrderOutput,
	KatanaUpdateSalesOrderInput,
	KatanaUpdateSalesOrderOutput
} from './contracts'
import { katanaAuthSchema } from './contracts'
import {
	KATANA_API_BASE,
	customerWriteBody,
	listPageMeta,
	manufacturingOrderCreateBody,
	manufacturingOrderUpdateBody,
	matchOrderCreatedDateScope,
	normalizeSalesOrderHeader,
	normalizeSalesOrderRow,
	pageFromCursor,
	parseCustomer,
	parseInventory,
	parseListEnvelope,
	parseManufacturingOrder,
	parseMaterial,
	parseProduct,
	parsePurchaseOrder,
	parseSalesOrder,
	parseSalesOrderCreatedAt,
	parseSalesOrderRow,
	parseSupplier,
	productCreateBody,
	productUpdateBody,
	purchaseOrderCreateBody,
	purchaseOrderUpdateBody,
	salesOrderCreateBody,
	salesOrderListDateQuery,
	salesOrderUpdateBody,
	supplierCreateBody,
	unwrapResource
} from './domain'
import type { ParsedSalesOrderRow } from './domain'

export type KatanaClientOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'>

export class KatanaClient {
	readonly #http: HttpService

	constructor(auth: KatanaAuth, options: KatanaClientOptions = {}) {
		const parsed = katanaAuthSchema.safeParse(auth)
		if (!parsed.success) {
			throw new ToolError('Invalid Katana auth credentials', {
				code: 'bad_auth',
				details: { issues: parsed.error.issues.map((issue) => issue.message) }
			})
		}
		this.#http = new HttpService({
			...options,
			baseURL: KATANA_API_BASE,
			headers: {
				Authorization: `Bearer ${parsed.data.api_key}`,
				'Content-Type': 'application/json'
			},
			label: 'Katana'
		})
	}

	static fromContext(ctx: ToolContext): KatanaClient {
		const auth = requireAuth(ctx, katanaAuthSchema)
		return new KatanaClient(auth, {
			...(ctx.fetch && { fetch: ctx.fetch }),
			...(ctx.signal && { signal: ctx.signal })
		})
	}

	// ── Sales orders ────────────────────────────────────────────────────────

	/** GET /sales_orders */
	async listSalesOrders(input: KatanaListSalesOrdersInput = {}): Promise<KatanaListSalesOrdersOutput> {
		const page = pageFromCursor(input.cursor)
		const limit = input.limit ?? 50
		const { data } = await this.#http.get('/sales_orders', {
			label: 'Katana listSalesOrders',
			query: {
				page,
				limit,
				...(input.status && { status: input.status }),
				...(input.customer_id !== undefined && { customer_id: input.customer_id }),
				...(input.order_no && { order_no: input.order_no }),
				...(input.location_id !== undefined && { location_id: input.location_id })
			}
		})
		const parsed = parseListEnvelope(data, parseSalesOrder, 'sales orders')
		const pageMeta = listPageMeta(page, limit, parsed.items.length, parsed.totalPages)
		return {
			items: parsed.items,
			truncated: pageMeta.truncated,
			...(pageMeta.next_cursor && { next_cursor: pageMeta.next_cursor })
		}
	}

	/** GET /sales_orders/{id} */
	async getSalesOrder(input: KatanaGetSalesOrderInput): Promise<KatanaGetSalesOrderOutput> {
		const { data } = await this.#http.get(`/sales_orders/${input.sales_order_id}`, {
			label: 'Katana getSalesOrder'
		})
		return { sales_order: parseSalesOrder(unwrapResource(data)) }
	}

	/** POST /sales_orders */
	async createSalesOrder(input: KatanaCreateSalesOrderInput): Promise<KatanaCreateSalesOrderOutput> {
		const { data } = await this.#http.post('/sales_orders', salesOrderCreateBody(input), {
			label: 'Katana createSalesOrder'
		})
		return { sales_order: parseSalesOrder(unwrapResource(data)) }
	}

	/** PATCH /sales_orders/{id} */
	async updateSalesOrder(input: KatanaUpdateSalesOrderInput): Promise<KatanaUpdateSalesOrderOutput> {
		const { sales_order_id, ...fields } = input
		const { data } = await this.#http.patch(`/sales_orders/${sales_order_id}`, salesOrderUpdateBody(fields), {
			label: 'Katana updateSalesOrder'
		})
		return { sales_order: parseSalesOrder(unwrapResource(data)) }
	}

	/** DELETE /sales_orders/{id} */
	async deleteSalesOrder(input: KatanaDeleteSalesOrderInput): Promise<KatanaDeleteSalesOrderOutput> {
		await this.#http.delete(`/sales_orders/${input.sales_order_id}`, {
			label: 'Katana deleteSalesOrder'
		})
		return { deleted: true, id: input.sales_order_id }
	}

	/**
	 * Composite sales-order query for reporting/reconciliation.
	 * Multi-scope × multi-status sequential pagination, dedupe by id, customer + row enrichment.
	 *
	 * API spike (GET /sales_orders): created_at_min/max, single status, customer_id, location_id.
	 * order_created_date ranges are client-side (no list filter). Rows via GET /sales_order_rows
	 * with sales_order_ids + extend=variant.
	 */
	async querySalesOrders(input: KatanaQuerySalesOrdersInput): Promise<KatanaQuerySalesOrdersOutput> {
		const maxPages = input.max_pages_per_list ?? 20
		const pageSize = input.page_size ?? 50
		const byId = new Map<number, ReturnType<typeof parseSalesOrder>>()

		for (const scope of input.scopes) {
			const statuses: Array<string | undefined> =
				scope.statuses && scope.statuses.length > 0 ? scope.statuses : [undefined]
			const dateQuery = salesOrderListDateQuery(scope)
			for (const status of statuses) {
				let cursor: string | undefined
				for (let page = 0; page < maxPages; page += 1) {
					const pageNum = pageFromCursor(cursor)
					const { data } = await this.#http.get('/sales_orders', {
						label: 'Katana querySalesOrders list',
						query: {
							page: pageNum,
							limit: pageSize,
							...(status && { status }),
							...(scope.customer_id !== undefined && { customer_id: scope.customer_id }),
							...(scope.location_id !== undefined && { location_id: scope.location_id }),
							...dateQuery
						}
					})
					const parsed = parseListEnvelope(data, parseSalesOrder, 'sales orders')
					for (const order of parsed.items) {
						if (byId.has(order.id)) continue
						if (!matchOrderCreatedDateScope(order.order_created_date, scope)) continue
						const rawRows =
							isPlainObject(data) && Array.isArray(data['data']) ? data['data'] : Array.isArray(data) ? data : []
						const raw = rawRows.find((r) => isPlainObject(r) && r['id'] === order.id)
						const rawCreated = parseSalesOrderCreatedAt(raw) ?? order.created_at
						byId.set(order.id, { ...order, ...(rawCreated && { created_at: rawCreated }) })
					}
					const pageMeta = listPageMeta(pageNum, pageSize, parsed.items.length, parsed.totalPages)
					if (!pageMeta.next_cursor) break
					cursor = pageMeta.next_cursor
				}
			}
		}

		const orderIds = [...byId.keys()]
		const customerCache = new Map<number, string | undefined>()
		const rowsByOrder = new Map<number, ParsedSalesOrderRow[]>()

		const chunkSize = 50
		for (let i = 0; i < orderIds.length; i += chunkSize) {
			const chunk = orderIds.slice(i, i + chunkSize)
			const rows = await this.#listSalesOrderRowsForOrders(chunk)
			for (const row of rows) {
				const list = rowsByOrder.get(row.sales_order_id) ?? []
				list.push(row)
				rowsByOrder.set(row.sales_order_id, list)
			}
		}

		for (const order of byId.values()) {
			if (order.customer_id === undefined || customerCache.has(order.customer_id)) continue
			try {
				const { customer } = await this.getCustomer({ customer_id: order.customer_id })
				const combined = [customer.first_name, customer.last_name].filter(Boolean).join(' ')
				const name = customer.name ?? (combined.length > 0 ? combined : undefined) ?? customer.company
				customerCache.set(order.customer_id, name && name.length > 0 ? name : undefined)
			} catch {
				customerCache.set(order.customer_id, undefined)
			}
		}

		const orders = orderIds.map((id) => {
			const order = byId.get(id)
			if (!order) {
				throw new ToolError('Internal order map missing id', { code: 'internal' })
			}
			const rows = normalizeSalesOrderRow(rowsByOrder.get(id) ?? [])
			const customerName = order.customer_id !== undefined ? customerCache.get(order.customer_id) : undefined
			return normalizeSalesOrderHeader(order, customerName, rows)
		})

		return { orders, order_count: orders.length }
	}

	async #listSalesOrderRowsForOrders(salesOrderIds: number[]): Promise<ParsedSalesOrderRow[]> {
		if (salesOrderIds.length === 0) return []
		const pageSize = 250
		const out: ParsedSalesOrderRow[] = []
		let cursor: string | undefined
		for (let page = 0; page < 100; page += 1) {
			const pageNum = pageFromCursor(cursor)
			const { data } = await this.#http.get('/sales_order_rows', {
				label: 'Katana listSalesOrderRows',
				query: {
					page: pageNum,
					limit: pageSize,
					// Docs: array of integers; HttpService query values are scalar — comma join.
					sales_order_ids: salesOrderIds.join(','),
					extend: 'variant'
				}
			})
			const parsed = parseListEnvelope(data, parseSalesOrderRow, 'sales order rows')
			out.push(...parsed.items)
			const pageMeta = listPageMeta(pageNum, pageSize, parsed.items.length, parsed.totalPages)
			if (!pageMeta.next_cursor) break
			cursor = pageMeta.next_cursor
		}
		return out
	}

	// ── Products ────────────────────────────────────────────────────────────

	/** GET /products */
	async listProducts(input: KatanaListProductsInput = {}): Promise<KatanaListProductsOutput> {
		const page = pageFromCursor(input.cursor)
		const limit = input.limit ?? 50
		const { data } = await this.#http.get('/products', {
			label: 'Katana listProducts',
			query: {
				page,
				limit,
				...(input.name && { name: input.name }),
				...(input.is_sellable !== undefined && { is_sellable: input.is_sellable }),
				...(input.is_producible !== undefined && { is_producible: input.is_producible }),
				...(input.is_purchasable !== undefined && { is_purchasable: input.is_purchasable })
			}
		})
		const parsed = parseListEnvelope(data, parseProduct, 'products')
		const pageMeta = listPageMeta(page, limit, parsed.items.length, parsed.totalPages)
		return {
			items: parsed.items,
			truncated: pageMeta.truncated,
			...(pageMeta.next_cursor && { next_cursor: pageMeta.next_cursor })
		}
	}

	/** GET /products/{id} */
	async getProduct(input: KatanaGetProductInput): Promise<KatanaGetProductOutput> {
		const { data } = await this.#http.get(`/products/${input.product_id}`, {
			label: 'Katana getProduct'
		})
		return { product: parseProduct(unwrapResource(data)) }
	}

	/** POST /products */
	async createProduct(input: KatanaCreateProductInput): Promise<KatanaCreateProductOutput> {
		const { data } = await this.#http.post('/products', productCreateBody(input), {
			label: 'Katana createProduct'
		})
		return { product: parseProduct(unwrapResource(data)) }
	}

	/** PATCH /products/{id} */
	async updateProduct(input: KatanaUpdateProductInput): Promise<KatanaUpdateProductOutput> {
		const { product_id, ...fields } = input
		const { data } = await this.#http.patch(`/products/${product_id}`, productUpdateBody(fields), {
			label: 'Katana updateProduct'
		})
		return { product: parseProduct(unwrapResource(data)) }
	}

	// ── Materials ───────────────────────────────────────────────────────────

	/** GET /materials */
	async listMaterials(input: KatanaListMaterialsInput = {}): Promise<KatanaListMaterialsOutput> {
		const page = pageFromCursor(input.cursor)
		const limit = input.limit ?? 50
		const { data } = await this.#http.get('/materials', {
			label: 'Katana listMaterials',
			query: {
				page,
				limit,
				...(input.name && { name: input.name })
			}
		})
		const parsed = parseListEnvelope(data, parseMaterial, 'materials')
		const pageMeta = listPageMeta(page, limit, parsed.items.length, parsed.totalPages)
		return {
			items: parsed.items,
			truncated: pageMeta.truncated,
			...(pageMeta.next_cursor && { next_cursor: pageMeta.next_cursor })
		}
	}

	/** GET /materials/{id} */
	async getMaterial(input: KatanaGetMaterialInput): Promise<KatanaGetMaterialOutput> {
		const { data } = await this.#http.get(`/materials/${input.material_id}`, {
			label: 'Katana getMaterial'
		})
		return { material: parseMaterial(unwrapResource(data)) }
	}

	// ── Customers ───────────────────────────────────────────────────────────

	/** GET /customers */
	async listCustomers(input: KatanaListCustomersInput = {}): Promise<KatanaListCustomersOutput> {
		const page = pageFromCursor(input.cursor)
		const limit = input.limit ?? 50
		const { data } = await this.#http.get('/customers', {
			label: 'Katana listCustomers',
			query: {
				page,
				limit,
				...(input.name && { name: input.name }),
				...(input.email && { email: input.email })
			}
		})
		const parsed = parseListEnvelope(data, parseCustomer, 'customers')
		const pageMeta = listPageMeta(page, limit, parsed.items.length, parsed.totalPages)
		return {
			items: parsed.items,
			truncated: pageMeta.truncated,
			...(pageMeta.next_cursor && { next_cursor: pageMeta.next_cursor })
		}
	}

	/** GET /customers/{id} */
	async getCustomer(input: KatanaGetCustomerInput): Promise<KatanaGetCustomerOutput> {
		const { data } = await this.#http.get(`/customers/${input.customer_id}`, {
			label: 'Katana getCustomer'
		})
		return { customer: parseCustomer(unwrapResource(data)) }
	}

	/** POST /customers */
	async createCustomer(input: KatanaCreateCustomerInput): Promise<KatanaCreateCustomerOutput> {
		const { data } = await this.#http.post('/customers', customerWriteBody(input), {
			label: 'Katana createCustomer'
		})
		return { customer: parseCustomer(unwrapResource(data)) }
	}

	/** PATCH /customers/{id} */
	async updateCustomer(input: KatanaUpdateCustomerInput): Promise<KatanaUpdateCustomerOutput> {
		const { customer_id, ...fields } = input
		const { data } = await this.#http.patch(`/customers/${customer_id}`, customerWriteBody(fields), {
			label: 'Katana updateCustomer'
		})
		return { customer: parseCustomer(unwrapResource(data)) }
	}

	// ── Suppliers ───────────────────────────────────────────────────────────

	/** GET /suppliers */
	async listSuppliers(input: KatanaListSuppliersInput = {}): Promise<KatanaListSuppliersOutput> {
		const page = pageFromCursor(input.cursor)
		const limit = input.limit ?? 50
		const { data } = await this.#http.get('/suppliers', {
			label: 'Katana listSuppliers',
			query: {
				page,
				limit,
				...(input.name && { name: input.name })
			}
		})
		const parsed = parseListEnvelope(data, parseSupplier, 'suppliers')
		const pageMeta = listPageMeta(page, limit, parsed.items.length, parsed.totalPages)
		return {
			items: parsed.items,
			truncated: pageMeta.truncated,
			...(pageMeta.next_cursor && { next_cursor: pageMeta.next_cursor })
		}
	}

	/** GET /suppliers/{id} */
	async getSupplier(input: KatanaGetSupplierInput): Promise<KatanaGetSupplierOutput> {
		const { data } = await this.#http.get(`/suppliers/${input.supplier_id}`, {
			label: 'Katana getSupplier'
		})
		return { supplier: parseSupplier(unwrapResource(data)) }
	}

	/** POST /suppliers */
	async createSupplier(input: KatanaCreateSupplierInput): Promise<KatanaCreateSupplierOutput> {
		const { data } = await this.#http.post('/suppliers', supplierCreateBody(input), {
			label: 'Katana createSupplier'
		})
		return { supplier: parseSupplier(unwrapResource(data)) }
	}

	// ── Purchase orders ─────────────────────────────────────────────────────

	/** GET /purchase_orders */
	async listPurchaseOrders(input: KatanaListPurchaseOrdersInput = {}): Promise<KatanaListPurchaseOrdersOutput> {
		const page = pageFromCursor(input.cursor)
		const limit = input.limit ?? 50
		const { data } = await this.#http.get('/purchase_orders', {
			label: 'Katana listPurchaseOrders',
			query: {
				page,
				limit,
				...(input.status && { status: input.status }),
				...(input.supplier_id !== undefined && { supplier_id: input.supplier_id }),
				...(input.order_no && { order_no: input.order_no }),
				...(input.location_id !== undefined && { location_id: input.location_id })
			}
		})
		const parsed = parseListEnvelope(data, parsePurchaseOrder, 'purchase orders')
		const pageMeta = listPageMeta(page, limit, parsed.items.length, parsed.totalPages)
		return {
			items: parsed.items,
			truncated: pageMeta.truncated,
			...(pageMeta.next_cursor && { next_cursor: pageMeta.next_cursor })
		}
	}

	/** GET /purchase_orders/{id} */
	async getPurchaseOrder(input: KatanaGetPurchaseOrderInput): Promise<KatanaGetPurchaseOrderOutput> {
		const { data } = await this.#http.get(`/purchase_orders/${input.purchase_order_id}`, {
			label: 'Katana getPurchaseOrder'
		})
		return { purchase_order: parsePurchaseOrder(unwrapResource(data)) }
	}

	/** POST /purchase_orders */
	async createPurchaseOrder(input: KatanaCreatePurchaseOrderInput): Promise<KatanaCreatePurchaseOrderOutput> {
		const { data } = await this.#http.post('/purchase_orders', purchaseOrderCreateBody(input), {
			label: 'Katana createPurchaseOrder'
		})
		return { purchase_order: parsePurchaseOrder(unwrapResource(data)) }
	}

	/** PATCH /purchase_orders/{id} */
	async updatePurchaseOrder(input: KatanaUpdatePurchaseOrderInput): Promise<KatanaUpdatePurchaseOrderOutput> {
		const { purchase_order_id, ...fields } = input
		const { data } = await this.#http.patch(`/purchase_orders/${purchase_order_id}`, purchaseOrderUpdateBody(fields), {
			label: 'Katana updatePurchaseOrder'
		})
		return { purchase_order: parsePurchaseOrder(unwrapResource(data)) }
	}

	// ── Manufacturing orders ────────────────────────────────────────────────

	/** GET /manufacturing_orders */
	async listManufacturingOrders(
		input: KatanaListManufacturingOrdersInput = {}
	): Promise<KatanaListManufacturingOrdersOutput> {
		const page = pageFromCursor(input.cursor)
		const limit = input.limit ?? 50
		const { data } = await this.#http.get('/manufacturing_orders', {
			label: 'Katana listManufacturingOrders',
			query: {
				page,
				limit,
				...(input.status && { status: input.status }),
				...(input.variant_id !== undefined && { variant_id: input.variant_id }),
				...(input.location_id !== undefined && { location_id: input.location_id }),
				...(input.order_no && { order_no: input.order_no })
			}
		})
		const parsed = parseListEnvelope(data, parseManufacturingOrder, 'manufacturing orders')
		const pageMeta = listPageMeta(page, limit, parsed.items.length, parsed.totalPages)
		return {
			items: parsed.items,
			truncated: pageMeta.truncated,
			...(pageMeta.next_cursor && { next_cursor: pageMeta.next_cursor })
		}
	}

	/** GET /manufacturing_orders/{id} */
	async getManufacturingOrder(input: KatanaGetManufacturingOrderInput): Promise<KatanaGetManufacturingOrderOutput> {
		const { data } = await this.#http.get(`/manufacturing_orders/${input.manufacturing_order_id}`, {
			label: 'Katana getManufacturingOrder'
		})
		return { manufacturing_order: parseManufacturingOrder(unwrapResource(data)) }
	}

	/** POST /manufacturing_orders */
	async createManufacturingOrder(
		input: KatanaCreateManufacturingOrderInput
	): Promise<KatanaCreateManufacturingOrderOutput> {
		const { data } = await this.#http.post('/manufacturing_orders', manufacturingOrderCreateBody(input), {
			label: 'Katana createManufacturingOrder'
		})
		return { manufacturing_order: parseManufacturingOrder(unwrapResource(data)) }
	}

	/** PATCH /manufacturing_orders/{id} */
	async updateManufacturingOrder(
		input: KatanaUpdateManufacturingOrderInput
	): Promise<KatanaUpdateManufacturingOrderOutput> {
		const { manufacturing_order_id, ...fields } = input
		const { data } = await this.#http.patch(
			`/manufacturing_orders/${manufacturing_order_id}`,
			manufacturingOrderUpdateBody(fields),
			{ label: 'Katana updateManufacturingOrder' }
		)
		return { manufacturing_order: parseManufacturingOrder(unwrapResource(data)) }
	}

	// ── Inventory ───────────────────────────────────────────────────────────

	/** GET /inventory */
	async listInventory(input: KatanaListInventoryInput = {}): Promise<KatanaListInventoryOutput> {
		const page = pageFromCursor(input.cursor)
		const limit = input.limit ?? 50
		const { data } = await this.#http.get('/inventory', {
			label: 'Katana listInventory',
			query: {
				page,
				limit,
				...(input.variant_id !== undefined && { variant_id: input.variant_id }),
				...(input.location_id !== undefined && { location_id: input.location_id })
			}
		})
		const parsed = parseListEnvelope(data, parseInventory, 'inventory')
		const pageMeta = listPageMeta(page, limit, parsed.items.length, parsed.totalPages)
		return {
			items: parsed.items,
			truncated: pageMeta.truncated,
			...(pageMeta.next_cursor && { next_cursor: pageMeta.next_cursor })
		}
	}
}
