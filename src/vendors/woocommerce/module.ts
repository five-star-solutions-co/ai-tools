import { defineModule, defineTool } from '../../core/define'
import { WoocommerceClient } from './client'
import {
	woocommerceAuthSchema,
	woocommerceCreateCouponInputSchema,
	woocommerceCreateCouponOutputSchema,
	woocommerceCreateCustomerInputSchema,
	woocommerceCreateCustomerOutputSchema,
	woocommerceCreateOrderInputSchema,
	woocommerceCreateOrderNoteInputSchema,
	woocommerceCreateOrderNoteOutputSchema,
	woocommerceCreateOrderOutputSchema,
	woocommerceCreateOrderRefundInputSchema,
	woocommerceCreateOrderRefundOutputSchema,
	woocommerceCreateProductInputSchema,
	woocommerceCreateProductOutputSchema,
	woocommerceDeleteOrderInputSchema,
	woocommerceDeleteOrderOutputSchema,
	woocommerceDeleteProductInputSchema,
	woocommerceDeleteProductOutputSchema,
	woocommerceGetCouponInputSchema,
	woocommerceGetCouponOutputSchema,
	woocommerceGetCustomerInputSchema,
	woocommerceGetCustomerOutputSchema,
	woocommerceGetOrderInputSchema,
	woocommerceGetOrderOutputSchema,
	woocommerceGetProductCategoryInputSchema,
	woocommerceGetProductCategoryOutputSchema,
	woocommerceGetProductInputSchema,
	woocommerceGetProductOutputSchema,
	woocommerceGetProductVariationInputSchema,
	woocommerceGetProductVariationOutputSchema,
	woocommerceListCouponsInputSchema,
	woocommerceListCouponsOutputSchema,
	woocommerceListCustomersInputSchema,
	woocommerceListCustomersOutputSchema,
	woocommerceListOrderNotesInputSchema,
	woocommerceListOrderNotesOutputSchema,
	woocommerceListOrderRefundsInputSchema,
	woocommerceListOrderRefundsOutputSchema,
	woocommerceListOrdersInputSchema,
	woocommerceListOrdersOutputSchema,
	woocommerceListProductCategoriesInputSchema,
	woocommerceListProductCategoriesOutputSchema,
	woocommerceListProductsInputSchema,
	woocommerceListProductsOutputSchema,
	woocommerceListProductVariationsInputSchema,
	woocommerceListProductVariationsOutputSchema,
	woocommerceUpdateCouponInputSchema,
	woocommerceUpdateCouponOutputSchema,
	woocommerceUpdateCustomerInputSchema,
	woocommerceUpdateCustomerOutputSchema,
	woocommerceUpdateOrderInputSchema,
	woocommerceUpdateOrderOutputSchema,
	woocommerceUpdateProductInputSchema,
	woocommerceUpdateProductOutputSchema
} from './contracts'

// ── Orders ──────────────────────────────────────────────────────────────────

export const woocommerceListOrdersTool = defineTool({
	id: 'woocommerce-list-orders',
	name: 'woocommerceListOrders',
	description:
		'List WooCommerce orders with optional status, date, search, and customer filters. Paginate with cursor (page number).',
	inputSchema: woocommerceListOrdersInputSchema,
	outputSchema: woocommerceListOrdersOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => WoocommerceClient.fromContext(ctx).listOrders(input)
})

export const woocommerceGetOrderTool = defineTool({
	id: 'woocommerce-get-order',
	name: 'woocommerceGetOrder',
	description: 'Get one WooCommerce order by numeric order id.',
	inputSchema: woocommerceGetOrderInputSchema,
	outputSchema: woocommerceGetOrderOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => WoocommerceClient.fromContext(ctx).getOrder(input)
})

export const woocommerceCreateOrderTool = defineTool({
	id: 'woocommerce-create-order',
	name: 'woocommerceCreateOrder',
	description:
		'Create a WooCommerce order with optional line items, billing/shipping, customer, status, and payment fields.',
	inputSchema: woocommerceCreateOrderInputSchema,
	outputSchema: woocommerceCreateOrderOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => WoocommerceClient.fromContext(ctx).createOrder(input)
})

export const woocommerceUpdateOrderTool = defineTool({
	id: 'woocommerce-update-order',
	name: 'woocommerceUpdateOrder',
	description: 'Update a WooCommerce order by id (status, line items, addresses, payment, notes, and meta).',
	inputSchema: woocommerceUpdateOrderInputSchema,
	outputSchema: woocommerceUpdateOrderOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => WoocommerceClient.fromContext(ctx).updateOrder(input)
})

export const woocommerceDeleteOrderTool = defineTool({
	id: 'woocommerce-delete-order',
	name: 'woocommerceDeleteOrder',
	description: 'Delete a WooCommerce order by id. force defaults to true for permanent delete.',
	inputSchema: woocommerceDeleteOrderInputSchema,
	outputSchema: woocommerceDeleteOrderOutputSchema,
	sideEffect: 'delete',
	runtime: 'both',
	execute: async (input, ctx) => WoocommerceClient.fromContext(ctx).deleteOrder(input)
})

export const woocommerceListOrderNotesTool = defineTool({
	id: 'woocommerce-list-order-notes',
	name: 'woocommerceListOrderNotes',
	description: 'List notes on a WooCommerce order. Optional type filter: any, customer, or internal.',
	inputSchema: woocommerceListOrderNotesInputSchema,
	outputSchema: woocommerceListOrderNotesOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => WoocommerceClient.fromContext(ctx).listOrderNotes(input)
})

export const woocommerceCreateOrderNoteTool = defineTool({
	id: 'woocommerce-create-order-note',
	name: 'woocommerceCreateOrderNote',
	description: 'Add a note to a WooCommerce order. Optional customer_note makes it visible to the customer.',
	inputSchema: woocommerceCreateOrderNoteInputSchema,
	outputSchema: woocommerceCreateOrderNoteOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => WoocommerceClient.fromContext(ctx).createOrderNote(input)
})

export const woocommerceListOrderRefundsTool = defineTool({
	id: 'woocommerce-list-order-refunds',
	name: 'woocommerceListOrderRefunds',
	description: 'List refunds for a WooCommerce order. Paginate with cursor.',
	inputSchema: woocommerceListOrderRefundsInputSchema,
	outputSchema: woocommerceListOrderRefundsOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => WoocommerceClient.fromContext(ctx).listOrderRefunds(input)
})

export const woocommerceCreateOrderRefundTool = defineTool({
	id: 'woocommerce-create-order-refund',
	name: 'woocommerceCreateOrderRefund',
	description:
		'Create a refund on a WooCommerce order. Optional amount, reason, per-line items, and api_refund gateway flag.',
	inputSchema: woocommerceCreateOrderRefundInputSchema,
	outputSchema: woocommerceCreateOrderRefundOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => WoocommerceClient.fromContext(ctx).createOrderRefund(input)
})

// ── Products ────────────────────────────────────────────────────────────────

export const woocommerceListProductsTool = defineTool({
	id: 'woocommerce-list-products',
	name: 'woocommerceListProducts',
	description:
		'List WooCommerce products with optional status, search, SKU, category, and type filters. Paginate with cursor.',
	inputSchema: woocommerceListProductsInputSchema,
	outputSchema: woocommerceListProductsOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => WoocommerceClient.fromContext(ctx).listProducts(input)
})

export const woocommerceGetProductTool = defineTool({
	id: 'woocommerce-get-product',
	name: 'woocommerceGetProduct',
	description: 'Get one WooCommerce product by numeric product id.',
	inputSchema: woocommerceGetProductInputSchema,
	outputSchema: woocommerceGetProductOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => WoocommerceClient.fromContext(ctx).getProduct(input)
})

export const woocommerceCreateProductTool = defineTool({
	id: 'woocommerce-create-product',
	name: 'woocommerceCreateProduct',
	description:
		'Create a WooCommerce product (name required). Optional type, status, SKU, prices, stock, categories, and meta.',
	inputSchema: woocommerceCreateProductInputSchema,
	outputSchema: woocommerceCreateProductOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => WoocommerceClient.fromContext(ctx).createProduct(input)
})

export const woocommerceUpdateProductTool = defineTool({
	id: 'woocommerce-update-product',
	name: 'woocommerceUpdateProduct',
	description: 'Update a WooCommerce product by id (name, status, SKU, prices, stock, categories, meta).',
	inputSchema: woocommerceUpdateProductInputSchema,
	outputSchema: woocommerceUpdateProductOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => WoocommerceClient.fromContext(ctx).updateProduct(input)
})

export const woocommerceDeleteProductTool = defineTool({
	id: 'woocommerce-delete-product',
	name: 'woocommerceDeleteProduct',
	description: 'Delete a WooCommerce product by id. force defaults to true for permanent delete.',
	inputSchema: woocommerceDeleteProductInputSchema,
	outputSchema: woocommerceDeleteProductOutputSchema,
	sideEffect: 'delete',
	runtime: 'both',
	execute: async (input, ctx) => WoocommerceClient.fromContext(ctx).deleteProduct(input)
})

export const woocommerceListProductVariationsTool = defineTool({
	id: 'woocommerce-list-product-variations',
	name: 'woocommerceListProductVariations',
	description: 'List variations for a variable WooCommerce product. Paginate with cursor.',
	inputSchema: woocommerceListProductVariationsInputSchema,
	outputSchema: woocommerceListProductVariationsOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => WoocommerceClient.fromContext(ctx).listProductVariations(input)
})

export const woocommerceGetProductVariationTool = defineTool({
	id: 'woocommerce-get-product-variation',
	name: 'woocommerceGetProductVariation',
	description: 'Get one product variation by parent product id and variation id.',
	inputSchema: woocommerceGetProductVariationInputSchema,
	outputSchema: woocommerceGetProductVariationOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => WoocommerceClient.fromContext(ctx).getProductVariation(input)
})

// ── Customers ───────────────────────────────────────────────────────────────

export const woocommerceListCustomersTool = defineTool({
	id: 'woocommerce-list-customers',
	name: 'woocommerceListCustomers',
	description: 'List WooCommerce customers with optional search, email, and role filters. Paginate with cursor.',
	inputSchema: woocommerceListCustomersInputSchema,
	outputSchema: woocommerceListCustomersOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => WoocommerceClient.fromContext(ctx).listCustomers(input)
})

export const woocommerceGetCustomerTool = defineTool({
	id: 'woocommerce-get-customer',
	name: 'woocommerceGetCustomer',
	description: 'Get one WooCommerce customer by numeric customer id.',
	inputSchema: woocommerceGetCustomerInputSchema,
	outputSchema: woocommerceGetCustomerOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => WoocommerceClient.fromContext(ctx).getCustomer(input)
})

export const woocommerceCreateCustomerTool = defineTool({
	id: 'woocommerce-create-customer',
	name: 'woocommerceCreateCustomer',
	description: 'Create a WooCommerce customer (email required). Optional name, username, password, and addresses.',
	inputSchema: woocommerceCreateCustomerInputSchema,
	outputSchema: woocommerceCreateCustomerOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => WoocommerceClient.fromContext(ctx).createCustomer(input)
})

export const woocommerceUpdateCustomerTool = defineTool({
	id: 'woocommerce-update-customer',
	name: 'woocommerceUpdateCustomer',
	description: 'Update a WooCommerce customer by id (email, name, username, password, addresses, meta).',
	inputSchema: woocommerceUpdateCustomerInputSchema,
	outputSchema: woocommerceUpdateCustomerOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => WoocommerceClient.fromContext(ctx).updateCustomer(input)
})

// ── Coupons ─────────────────────────────────────────────────────────────────

export const woocommerceListCouponsTool = defineTool({
	id: 'woocommerce-list-coupons',
	name: 'woocommerceListCoupons',
	description: 'List WooCommerce coupons with optional search and code filters. Paginate with cursor.',
	inputSchema: woocommerceListCouponsInputSchema,
	outputSchema: woocommerceListCouponsOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => WoocommerceClient.fromContext(ctx).listCoupons(input)
})

export const woocommerceGetCouponTool = defineTool({
	id: 'woocommerce-get-coupon',
	name: 'woocommerceGetCoupon',
	description: 'Get one WooCommerce coupon by numeric coupon id.',
	inputSchema: woocommerceGetCouponInputSchema,
	outputSchema: woocommerceGetCouponOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => WoocommerceClient.fromContext(ctx).getCoupon(input)
})

export const woocommerceCreateCouponTool = defineTool({
	id: 'woocommerce-create-coupon',
	name: 'woocommerceCreateCoupon',
	description:
		'Create a WooCommerce coupon (code required). Optional discount type, amount, limits, free shipping, and expiry.',
	inputSchema: woocommerceCreateCouponInputSchema,
	outputSchema: woocommerceCreateCouponOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => WoocommerceClient.fromContext(ctx).createCoupon(input)
})

export const woocommerceUpdateCouponTool = defineTool({
	id: 'woocommerce-update-coupon',
	name: 'woocommerceUpdateCoupon',
	description: 'Update a WooCommerce coupon by id (code, discount, amount, limits, free shipping, expiry).',
	inputSchema: woocommerceUpdateCouponInputSchema,
	outputSchema: woocommerceUpdateCouponOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => WoocommerceClient.fromContext(ctx).updateCoupon(input)
})

// ── Product categories ──────────────────────────────────────────────────────

export const woocommerceListProductCategoriesTool = defineTool({
	id: 'woocommerce-list-product-categories',
	name: 'woocommerceListProductCategories',
	description: 'List WooCommerce product categories with optional search, parent, and hide_empty filters.',
	inputSchema: woocommerceListProductCategoriesInputSchema,
	outputSchema: woocommerceListProductCategoriesOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => WoocommerceClient.fromContext(ctx).listProductCategories(input)
})

export const woocommerceGetProductCategoryTool = defineTool({
	id: 'woocommerce-get-product-category',
	name: 'woocommerceGetProductCategory',
	description: 'Get one WooCommerce product category by numeric category id.',
	inputSchema: woocommerceGetProductCategoryInputSchema,
	outputSchema: woocommerceGetProductCategoryOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => WoocommerceClient.fromContext(ctx).getProductCategory(input)
})

export const woocommerceModule = defineModule({
	id: 'woocommerce',
	title: 'WooCommerce',
	description:
		'WooCommerce REST API vendor pack (wc/v3): orders (CRUD, notes, refunds), products (CRUD, variations), customers, coupons, and product categories.',
	runtime: 'both',
	auth: { type: 'custom', schema: woocommerceAuthSchema },
	categories: ['commerce'],
	classification: 'pii',
	tags: ['orders', 'products'],
	tools: [
		woocommerceListOrdersTool,
		woocommerceGetOrderTool,
		woocommerceCreateOrderTool,
		woocommerceUpdateOrderTool,
		woocommerceDeleteOrderTool,
		woocommerceListOrderNotesTool,
		woocommerceCreateOrderNoteTool,
		woocommerceListOrderRefundsTool,
		woocommerceCreateOrderRefundTool,
		woocommerceListProductsTool,
		woocommerceGetProductTool,
		woocommerceCreateProductTool,
		woocommerceUpdateProductTool,
		woocommerceDeleteProductTool,
		woocommerceListProductVariationsTool,
		woocommerceGetProductVariationTool,
		woocommerceListCustomersTool,
		woocommerceGetCustomerTool,
		woocommerceCreateCustomerTool,
		woocommerceUpdateCustomerTool,
		woocommerceListCouponsTool,
		woocommerceGetCouponTool,
		woocommerceCreateCouponTool,
		woocommerceUpdateCouponTool,
		woocommerceListProductCategoriesTool,
		woocommerceGetProductCategoryTool
	]
})
