import { defineModule, defineTool } from '../../core/define'
import { KatanaClient } from './client'
import {
	katanaAuthSchema,
	katanaCreateCustomerInputSchema,
	katanaCreateCustomerOutputSchema,
	katanaCreateManufacturingOrderInputSchema,
	katanaCreateManufacturingOrderOutputSchema,
	katanaCreateProductInputSchema,
	katanaCreateProductOutputSchema,
	katanaCreatePurchaseOrderInputSchema,
	katanaCreatePurchaseOrderOutputSchema,
	katanaCreateSalesOrderInputSchema,
	katanaCreateSalesOrderOutputSchema,
	katanaCreateSupplierInputSchema,
	katanaCreateSupplierOutputSchema,
	katanaDeleteSalesOrderInputSchema,
	katanaDeleteSalesOrderOutputSchema,
	katanaQuerySalesOrdersInputSchema,
	katanaQuerySalesOrdersOutputSchema,
	katanaGetCustomerInputSchema,
	katanaGetCustomerOutputSchema,
	katanaGetManufacturingOrderInputSchema,
	katanaGetManufacturingOrderOutputSchema,
	katanaGetMaterialInputSchema,
	katanaGetMaterialOutputSchema,
	katanaGetProductInputSchema,
	katanaGetProductOutputSchema,
	katanaGetPurchaseOrderInputSchema,
	katanaGetPurchaseOrderOutputSchema,
	katanaGetSalesOrderInputSchema,
	katanaGetSalesOrderOutputSchema,
	katanaGetSupplierInputSchema,
	katanaGetSupplierOutputSchema,
	katanaListCustomersInputSchema,
	katanaListCustomersOutputSchema,
	katanaListInventoryInputSchema,
	katanaListInventoryOutputSchema,
	katanaListManufacturingOrdersInputSchema,
	katanaListManufacturingOrdersOutputSchema,
	katanaListMaterialsInputSchema,
	katanaListMaterialsOutputSchema,
	katanaListProductsInputSchema,
	katanaListProductsOutputSchema,
	katanaListPurchaseOrdersInputSchema,
	katanaListPurchaseOrdersOutputSchema,
	katanaListSalesOrdersInputSchema,
	katanaListSalesOrdersOutputSchema,
	katanaListSuppliersInputSchema,
	katanaListSuppliersOutputSchema,
	katanaUpdateCustomerInputSchema,
	katanaUpdateCustomerOutputSchema,
	katanaUpdateManufacturingOrderInputSchema,
	katanaUpdateManufacturingOrderOutputSchema,
	katanaUpdateProductInputSchema,
	katanaUpdateProductOutputSchema,
	katanaUpdatePurchaseOrderInputSchema,
	katanaUpdatePurchaseOrderOutputSchema,
	katanaUpdateSalesOrderInputSchema,
	katanaUpdateSalesOrderOutputSchema
} from './contracts'

// ── Sales orders ────────────────────────────────────────────────────────────

export const katanaListSalesOrdersTool = defineTool({
	id: 'katana-list-sales-orders',
	name: 'katanaListSalesOrders',
	description:
		'List Katana MRP sales orders with optional status, customer, order number, and location filters. Paginate with cursor (page number).',
	inputSchema: katanaListSalesOrdersInputSchema,
	outputSchema: katanaListSalesOrdersOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => KatanaClient.fromContext(ctx).listSalesOrders(input)
})

export const katanaGetSalesOrderTool = defineTool({
	id: 'katana-get-sales-order',
	name: 'katanaGetSalesOrder',
	description: 'Get one Katana MRP sales order by numeric id.',
	inputSchema: katanaGetSalesOrderInputSchema,
	outputSchema: katanaGetSalesOrderOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => KatanaClient.fromContext(ctx).getSalesOrder(input)
})

export const katanaCreateSalesOrderTool = defineTool({
	id: 'katana-create-sales-order',
	name: 'katanaCreateSalesOrder',
	description:
		'Create a Katana MRP sales order (customer_id and sales_order_rows required). Optional order number, dates, currency, location, and status.',
	inputSchema: katanaCreateSalesOrderInputSchema,
	outputSchema: katanaCreateSalesOrderOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => KatanaClient.fromContext(ctx).createSalesOrder(input)
})

export const katanaUpdateSalesOrderTool = defineTool({
	id: 'katana-update-sales-order',
	name: 'katanaUpdateSalesOrder',
	description: 'Update a Katana MRP sales order by id (status, customer, dates, location, currency, notes, reference).',
	inputSchema: katanaUpdateSalesOrderInputSchema,
	outputSchema: katanaUpdateSalesOrderOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => KatanaClient.fromContext(ctx).updateSalesOrder(input)
})

export const katanaDeleteSalesOrderTool = defineTool({
	id: 'katana-delete-sales-order',
	name: 'katanaDeleteSalesOrder',
	description: 'Delete a Katana MRP sales order by numeric id.',
	inputSchema: katanaDeleteSalesOrderInputSchema,
	outputSchema: katanaDeleteSalesOrderOutputSchema,
	sideEffect: 'delete',
	runtime: 'both',
	execute: async (input, ctx) => KatanaClient.fromContext(ctx).deleteSalesOrder(input)
})

export const katanaQuerySalesOrdersTool = defineTool({
	id: 'katana-query-sales-orders',
	name: 'katanaQuerySalesOrders',
	description:
		'Composite Katana MRP sales-order query for reporting: multi-scope union (status × date windows), sequential page drain, dedupe by order id, customer name enrichment, and line rows with tax-exclusive revenue and COGS in integer cents. Use when list/get alone are not enough for reconciliation.',
	inputSchema: katanaQuerySalesOrdersInputSchema,
	outputSchema: katanaQuerySalesOrdersOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => KatanaClient.fromContext(ctx).querySalesOrders(input)
})

// ── Products ────────────────────────────────────────────────────────────────

export const katanaListProductsTool = defineTool({
	id: 'katana-list-products',
	name: 'katanaListProducts',
	description:
		'List Katana MRP products with optional name and sellable/producible/purchasable filters. Paginate with cursor.',
	inputSchema: katanaListProductsInputSchema,
	outputSchema: katanaListProductsOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => KatanaClient.fromContext(ctx).listProducts(input)
})

export const katanaGetProductTool = defineTool({
	id: 'katana-get-product',
	name: 'katanaGetProduct',
	description: 'Get one Katana MRP product by numeric id.',
	inputSchema: katanaGetProductInputSchema,
	outputSchema: katanaGetProductOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => KatanaClient.fromContext(ctx).getProduct(input)
})

export const katanaCreateProductTool = defineTool({
	id: 'katana-create-product',
	name: 'katanaCreateProduct',
	description:
		'Create a Katana MRP product (name and variants required). Optional UoM, category, sellable/producible/purchasable flags.',
	inputSchema: katanaCreateProductInputSchema,
	outputSchema: katanaCreateProductOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => KatanaClient.fromContext(ctx).createProduct(input)
})

export const katanaUpdateProductTool = defineTool({
	id: 'katana-update-product',
	name: 'katanaUpdateProduct',
	description: 'Update a Katana MRP product by id (name, UoM, category, flags, supplier, notes).',
	inputSchema: katanaUpdateProductInputSchema,
	outputSchema: katanaUpdateProductOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => KatanaClient.fromContext(ctx).updateProduct(input)
})

// ── Materials ───────────────────────────────────────────────────────────────

export const katanaListMaterialsTool = defineTool({
	id: 'katana-list-materials',
	name: 'katanaListMaterials',
	description: 'List Katana MRP materials with optional name filter. Paginate with cursor.',
	inputSchema: katanaListMaterialsInputSchema,
	outputSchema: katanaListMaterialsOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => KatanaClient.fromContext(ctx).listMaterials(input)
})

export const katanaGetMaterialTool = defineTool({
	id: 'katana-get-material',
	name: 'katanaGetMaterial',
	description: 'Get one Katana MRP material by numeric id.',
	inputSchema: katanaGetMaterialInputSchema,
	outputSchema: katanaGetMaterialOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => KatanaClient.fromContext(ctx).getMaterial(input)
})

// ── Customers ───────────────────────────────────────────────────────────────

export const katanaListCustomersTool = defineTool({
	id: 'katana-list-customers',
	name: 'katanaListCustomers',
	description: 'List Katana MRP customers with optional name and email filters. Paginate with cursor.',
	inputSchema: katanaListCustomersInputSchema,
	outputSchema: katanaListCustomersOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => KatanaClient.fromContext(ctx).listCustomers(input)
})

export const katanaGetCustomerTool = defineTool({
	id: 'katana-get-customer',
	name: 'katanaGetCustomer',
	description: 'Get one Katana MRP customer by numeric id.',
	inputSchema: katanaGetCustomerInputSchema,
	outputSchema: katanaGetCustomerOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => KatanaClient.fromContext(ctx).getCustomer(input)
})

export const katanaCreateCustomerTool = defineTool({
	id: 'katana-create-customer',
	name: 'katanaCreateCustomer',
	description:
		'Create a Katana MRP customer (name required). Optional contact fields, currency, category, and discount.',
	inputSchema: katanaCreateCustomerInputSchema,
	outputSchema: katanaCreateCustomerOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => KatanaClient.fromContext(ctx).createCustomer(input)
})

export const katanaUpdateCustomerTool = defineTool({
	id: 'katana-update-customer',
	name: 'katanaUpdateCustomer',
	description: 'Update a Katana MRP customer by id (name, contact fields, currency, category, discount).',
	inputSchema: katanaUpdateCustomerInputSchema,
	outputSchema: katanaUpdateCustomerOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => KatanaClient.fromContext(ctx).updateCustomer(input)
})

// ── Suppliers ───────────────────────────────────────────────────────────────

export const katanaListSuppliersTool = defineTool({
	id: 'katana-list-suppliers',
	name: 'katanaListSuppliers',
	description: 'List Katana MRP suppliers with optional name filter. Paginate with cursor.',
	inputSchema: katanaListSuppliersInputSchema,
	outputSchema: katanaListSuppliersOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => KatanaClient.fromContext(ctx).listSuppliers(input)
})

export const katanaGetSupplierTool = defineTool({
	id: 'katana-get-supplier',
	name: 'katanaGetSupplier',
	description: 'Get one Katana MRP supplier by numeric id.',
	inputSchema: katanaGetSupplierInputSchema,
	outputSchema: katanaGetSupplierOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => KatanaClient.fromContext(ctx).getSupplier(input)
})

export const katanaCreateSupplierTool = defineTool({
	id: 'katana-create-supplier',
	name: 'katanaCreateSupplier',
	description: 'Create a Katana MRP supplier (name required). Optional currency, email, phone, and comment.',
	inputSchema: katanaCreateSupplierInputSchema,
	outputSchema: katanaCreateSupplierOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => KatanaClient.fromContext(ctx).createSupplier(input)
})

// ── Purchase orders ─────────────────────────────────────────────────────────

export const katanaListPurchaseOrdersTool = defineTool({
	id: 'katana-list-purchase-orders',
	name: 'katanaListPurchaseOrders',
	description:
		'List Katana MRP purchase orders with optional status, supplier, order number, and location filters. Paginate with cursor.',
	inputSchema: katanaListPurchaseOrdersInputSchema,
	outputSchema: katanaListPurchaseOrdersOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => KatanaClient.fromContext(ctx).listPurchaseOrders(input)
})

export const katanaGetPurchaseOrderTool = defineTool({
	id: 'katana-get-purchase-order',
	name: 'katanaGetPurchaseOrder',
	description: 'Get one Katana MRP purchase order by numeric id.',
	inputSchema: katanaGetPurchaseOrderInputSchema,
	outputSchema: katanaGetPurchaseOrderOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => KatanaClient.fromContext(ctx).getPurchaseOrder(input)
})

export const katanaCreatePurchaseOrderTool = defineTool({
	id: 'katana-create-purchase-order',
	name: 'katanaCreatePurchaseOrder',
	description: 'Create a Katana MRP purchase order (supplier_id, location_id, and purchase_order_rows required).',
	inputSchema: katanaCreatePurchaseOrderInputSchema,
	outputSchema: katanaCreatePurchaseOrderOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => KatanaClient.fromContext(ctx).createPurchaseOrder(input)
})

export const katanaUpdatePurchaseOrderTool = defineTool({
	id: 'katana-update-purchase-order',
	name: 'katanaUpdatePurchaseOrder',
	description: 'Update a Katana MRP purchase order by id (status, supplier, location, dates, currency, notes).',
	inputSchema: katanaUpdatePurchaseOrderInputSchema,
	outputSchema: katanaUpdatePurchaseOrderOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => KatanaClient.fromContext(ctx).updatePurchaseOrder(input)
})

// ── Manufacturing orders ────────────────────────────────────────────────────

export const katanaListManufacturingOrdersTool = defineTool({
	id: 'katana-list-manufacturing-orders',
	name: 'katanaListManufacturingOrders',
	description:
		'List Katana MRP manufacturing orders with optional status, variant, location, and order number filters. Paginate with cursor.',
	inputSchema: katanaListManufacturingOrdersInputSchema,
	outputSchema: katanaListManufacturingOrdersOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => KatanaClient.fromContext(ctx).listManufacturingOrders(input)
})

export const katanaGetManufacturingOrderTool = defineTool({
	id: 'katana-get-manufacturing-order',
	name: 'katanaGetManufacturingOrder',
	description: 'Get one Katana MRP manufacturing order by numeric id.',
	inputSchema: katanaGetManufacturingOrderInputSchema,
	outputSchema: katanaGetManufacturingOrderOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => KatanaClient.fromContext(ctx).getManufacturingOrder(input)
})

export const katanaCreateManufacturingOrderTool = defineTool({
	id: 'katana-create-manufacturing-order',
	name: 'katanaCreateManufacturingOrder',
	description:
		'Create a Katana MRP manufacturing order (variant_id, location_id, and planned_quantity required). Recipe and operations are generated from the product.',
	inputSchema: katanaCreateManufacturingOrderInputSchema,
	outputSchema: katanaCreateManufacturingOrderOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => KatanaClient.fromContext(ctx).createManufacturingOrder(input)
})

export const katanaUpdateManufacturingOrderTool = defineTool({
	id: 'katana-update-manufacturing-order',
	name: 'katanaUpdateManufacturingOrder',
	description: 'Update a Katana MRP manufacturing order by id (status, quantities, dates, notes, order number).',
	inputSchema: katanaUpdateManufacturingOrderInputSchema,
	outputSchema: katanaUpdateManufacturingOrderOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => KatanaClient.fromContext(ctx).updateManufacturingOrder(input)
})

// ── Inventory ───────────────────────────────────────────────────────────────

export const katanaListInventoryTool = defineTool({
	id: 'katana-list-inventory',
	name: 'katanaListInventory',
	description:
		'List current Katana MRP inventory levels by variant and location. Optional variant_id and location_id filters. Paginate with cursor.',
	inputSchema: katanaListInventoryInputSchema,
	outputSchema: katanaListInventoryOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => KatanaClient.fromContext(ctx).listInventory(input)
})

export const katanaModule = defineModule({
	id: 'katana',
	title: 'Katana',
	description:
		'Katana MRP vendor pack: sales orders (including composite query for reporting), products, materials, customers, suppliers, purchase orders, manufacturing orders, and inventory.',
	runtime: 'both',
	auth: { type: 'custom', schema: katanaAuthSchema },
	tools: [
		katanaListSalesOrdersTool,
		katanaGetSalesOrderTool,
		katanaCreateSalesOrderTool,
		katanaUpdateSalesOrderTool,
		katanaDeleteSalesOrderTool,
		katanaQuerySalesOrdersTool,
		katanaListProductsTool,
		katanaGetProductTool,
		katanaCreateProductTool,
		katanaUpdateProductTool,
		katanaListMaterialsTool,
		katanaGetMaterialTool,
		katanaListCustomersTool,
		katanaGetCustomerTool,
		katanaCreateCustomerTool,
		katanaUpdateCustomerTool,
		katanaListSuppliersTool,
		katanaGetSupplierTool,
		katanaCreateSupplierTool,
		katanaListPurchaseOrdersTool,
		katanaGetPurchaseOrderTool,
		katanaCreatePurchaseOrderTool,
		katanaUpdatePurchaseOrderTool,
		katanaListManufacturingOrdersTool,
		katanaGetManufacturingOrderTool,
		katanaCreateManufacturingOrderTool,
		katanaUpdateManufacturingOrderTool,
		katanaListInventoryTool
	]
})
