/**
 * Katana live IT — full read/search surface only (no create/update/delete).
 *
 * Read methods exercised:
 * - list/get sales orders, products, materials, customers, suppliers, purchase orders, manufacturing orders
 * - list inventory
 * - querySalesOrders (composite search/report read)
 * - host page APIs for each list resource (one page each)
 */
import { describe, expect, test } from 'bun:test'

import { KatanaClient } from '../../../src/vendors/katana'
import { env } from '../env'

const apiKey = env('AI_TOOLS_KATANA_API_KEY')
const run = apiKey ? describe : describe.skip

function client() {
	return new KatanaClient({ api_key: apiKey! })
}

run('live vendor katana (read-only)', () => {
	test(
		'list + get entity surfaces',
		async () => {
			const c = client()

			const salesOrders = await c.listSalesOrders({ limit: 1 })
			expect(Array.isArray(salesOrders.items)).toBe(true)
			const so = salesOrders.items[0]
			if (so) {
				const got = await c.getSalesOrder({ sales_order_id: so.id })
				expect(got.sales_order.id).toBe(so.id)
			}

			const products = await c.listProducts({ limit: 1 })
			expect(Array.isArray(products.items)).toBe(true)
			const product = products.items[0]
			if (product) {
				const got = await c.getProduct({ product_id: product.id })
				expect(got.product.id).toBe(product.id)
			}

			const materials = await c.listMaterials({ limit: 1 })
			expect(Array.isArray(materials.items)).toBe(true)
			const material = materials.items[0]
			if (material) {
				const got = await c.getMaterial({ material_id: material.id })
				expect(got.material.id).toBe(material.id)
			}

			const customers = await c.listCustomers({ limit: 1 })
			expect(Array.isArray(customers.items)).toBe(true)
			const customer = customers.items[0]
			if (customer) {
				const got = await c.getCustomer({ customer_id: customer.id })
				expect(got.customer.id).toBe(customer.id)
			}

			const suppliers = await c.listSuppliers({ limit: 1 })
			expect(Array.isArray(suppliers.items)).toBe(true)
			const supplier = suppliers.items[0]
			if (supplier) {
				const got = await c.getSupplier({ supplier_id: supplier.id })
				expect(got.supplier.id).toBe(supplier.id)
			}

			const purchaseOrders = await c.listPurchaseOrders({ limit: 1 })
			expect(Array.isArray(purchaseOrders.items)).toBe(true)
			const po = purchaseOrders.items[0]
			if (po) {
				const got = await c.getPurchaseOrder({ purchase_order_id: po.id })
				expect(got.purchase_order.id).toBe(po.id)
			}

			const mos = await c.listManufacturingOrders({ limit: 1 })
			expect(Array.isArray(mos.items)).toBe(true)
			const mo = mos.items[0]
			if (mo) {
				const got = await c.getManufacturingOrder({ manufacturing_order_id: mo.id })
				expect(got.manufacturing_order.id).toBe(mo.id)
			}

			const inventory = await c.listInventory({ limit: 1 })
			expect(Array.isArray(inventory.items)).toBe(true)
		},
		{ timeout: 90_000 }
	)

	test(
		'querySalesOrders composite search (bounded)',
		async () => {
			const c = client()
			const out = await c.querySalesOrders({
				scopes: [{}],
				page_size: 5,
				max_pages_per_list: 1
			})
			expect(out).toBeDefined()
			expect(Array.isArray(out.orders)).toBe(true)
			expect(typeof out.order_count).toBe('number')
			expect(out.order_count).toBe(out.orders.length)
		},
		{ timeout: 90_000 }
	)

	test(
		'host list*Page APIs (one page each)',
		async () => {
			const c = client()
			const page = 1
			const limit = 1

			const sales = await c.listSalesOrdersPage({ page, limit })
			expect(Array.isArray(sales.items)).toBe(true)
			expect(sales.pagination.page).toBe(page)

			const products = await c.listProductsPage({ page, limit })
			expect(Array.isArray(products.items)).toBe(true)

			const materials = await c.listMaterialsPage({ page, limit })
			expect(Array.isArray(materials.items)).toBe(true)

			const customers = await c.listCustomersPage({ page, limit })
			expect(Array.isArray(customers.items)).toBe(true)

			const suppliers = await c.listSuppliersPage({ page, limit })
			expect(Array.isArray(suppliers.items)).toBe(true)

			const purchaseOrders = await c.listPurchaseOrdersPage({ page, limit })
			expect(Array.isArray(purchaseOrders.items)).toBe(true)

			const manufacturingOrders = await c.listManufacturingOrdersPage({ page, limit })
			expect(Array.isArray(manufacturingOrders.items)).toBe(true)

			const inventory = await c.listInventoryPage({ page, limit })
			expect(Array.isArray(inventory.items)).toBe(true)
		},
		{ timeout: 90_000 }
	)
})
