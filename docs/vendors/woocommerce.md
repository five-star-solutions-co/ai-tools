# WooCommerce

| | |
| --- | --- |
| **Import** | `@5ss/ai-tools/woocommerce` |
| **Kind** | **vendor** (`src/vendors/woocommerce`) |
| **Module id** | `woocommerce` |
| **Client** | `WoocommerceClient` |
| **API** | REST `wc/v3` |

Full first-class surface: **orders** (CRUD, notes, refunds), **products** (CRUD, variations), **customers**, **coupons**, and **product categories**.

## Auth

```ts
{
  store_url: string         // https://shop.example.com
  consumer_key: string
  consumer_secret: string
}
```

HTTPS Basic Auth (consumer key as username, secret as password). Base path: `{store_url}/wp-json/wc/v3`.

## Tools

### Orders

| id | Client method |
| --- | --- |
| `woocommerce-list-orders` | `listOrders` |
| `woocommerce-get-order` | `getOrder` |
| `woocommerce-create-order` | `createOrder` |
| `woocommerce-update-order` | `updateOrder` |
| `woocommerce-delete-order` | `deleteOrder` |
| `woocommerce-list-order-notes` | `listOrderNotes` |
| `woocommerce-create-order-note` | `createOrderNote` |
| `woocommerce-list-order-refunds` | `listOrderRefunds` |
| `woocommerce-create-order-refund` | `createOrderRefund` |

### Products

| id | Client method |
| --- | --- |
| `woocommerce-list-products` | `listProducts` |
| `woocommerce-get-product` | `getProduct` |
| `woocommerce-create-product` | `createProduct` |
| `woocommerce-update-product` | `updateProduct` |
| `woocommerce-delete-product` | `deleteProduct` |
| `woocommerce-list-product-variations` | `listProductVariations` |
| `woocommerce-get-product-variation` | `getProductVariation` |

### Customers

| id | Client method |
| --- | --- |
| `woocommerce-list-customers` | `listCustomers` |
| `woocommerce-get-customer` | `getCustomer` |
| `woocommerce-create-customer` | `createCustomer` |
| `woocommerce-update-customer` | `updateCustomer` |

### Coupons

| id | Client method |
| --- | --- |
| `woocommerce-list-coupons` | `listCoupons` |
| `woocommerce-get-coupon` | `getCoupon` |
| `woocommerce-create-coupon` | `createCoupon` |
| `woocommerce-update-coupon` | `updateCoupon` |

### Product categories

| id | Client method |
| --- | --- |
| `woocommerce-list-product-categories` | `listProductCategories` |
| `woocommerce-get-product-category` | `getProductCategory` |

List endpoints accept `cursor` (page number string) and `limit` (1–100, default 10). When more pages exist, responses include `next_cursor` and `truncated: true`.

## Bind

```ts
import { WoocommerceClient, woocommerceModule } from '@5ss/ai-tools/woocommerce'
import { withAuth } from '@5ss/ai-tools/core'

new WoocommerceClient({
  store_url: 'https://shop.example.com',
  consumer_key: 'ck_…',
  consumer_secret: 'cs_…',
})

withAuth(woocommerceModule, { /* same */ })
```
