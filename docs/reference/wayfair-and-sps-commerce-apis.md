# Wayfair and SPS Commerce public API inventory

Public documentation inspected September 9, 2026. This is a contract/coverage reference, not a claim of live certification or complete package coverage. Project delivery is tracked in Beads epic `ai-tools-p6r`.

The current Wayfair pack contains catalog v1 reads and the dropship order lifecycle described in [its pack documentation](../vendors/wayfair.md). **SPS Commerce has no implemented pack or public import yet.** Remaining Wayfair families are tracked in `ai-tools-p6r.2`, SPS implementation in `ai-tools-p6r.3`, and documentation conflicts in `ai-tools-p6r.4`.

Only supported, publicly documented integration operations belong in these packs. Portal account administration, OAuth consent routes, placeholder mutations, and internal APIs are not model-facing business tools.

## Wayfair

Sources: [public introduction](https://developer.wayfair.io/posts/introduction) and the linked references below. The portal's current navigation exposes CastleGate, Catalog, Dropship, Multichannel, and Advertising API families.

### Endpoints

| Key | Production | Sandbox |
| --- | --- | --- |
| Orders | `https://api.wayfair.com/v1/graphql` | `https://sandbox.api.wayfair.com/v1/graphql` |
| Supplier | `https://api.wayfair.io/v1/supplier-order-api/graphql` | `https://api.wayfair.io/sandbox/v1/supplier-order-api/graphql` |
| Catalog | `https://api.wayfair.io/v1/product-catalog-api/graphql` | `https://api.wayfair.io/sandbox/v1/product-catalog-api/graphql` |
| Catalog read v2 | `https://api.wayfair.io/product-catalog-api/graphql` | `https://api.wayfair.io/sandbox/v1/product-catalog-api/graphql` |
| Advertising | `https://api.wayfair.io/advertising/v1` | `https://api.wayfair.io/sandbox/advertising/v1` |

GraphQL operations use POST. Existing catalog v1 access remains `POST https://api.wayfair.io/v1/supplier-catalog-api/graphql`.

Auth uses `POST https://sso.auth.wayfair.com/oauth/token`, `client_credentials`, client ID/secret, and the environment-specific audience (`https://api.wayfair.com/` or `https://sandbox.api.wayfair.com/`). Cache based on the returned `expires_in`, not a hardcoded lifetime. The current client remains production-only.

### Operation coverage

`Q` means query; `M` means mutation. Names retain documented GraphQL nesting. Except for the first two rows, these operations are not yet implemented.

| Family / public reference | Endpoint | Documented operations | Current pack |
| --- | --- | --- | --- |
| Existing catalog v1 | Existing catalog v1 | Q `supplierCatalog` | `listCatalogPage` / `wayfair-list-catalog` |
| [Dropship orders](https://developer.wayfair.io/posts/docs/orders-api/reference/GraphQL/v1.0.0) | Orders | Q `getDropshipPurchaseOrders`; M `purchaseOrders.accept`, `purchaseOrders.shipment` | Lightweight list, explicit detail read, acceptance, ASN |
| [Inbound milestones](https://developer.wayfair.io/posts/docs/inbound-order-shipment-milestone/reference/GraphQL/v1.0.0) | Supplier | Q `inboundOrderList` | Not implemented |
| [Inventory on hand](https://developer.wayfair.io/posts/docs/inventory-visibility-onhand-api/reference/GraphQL/v1.0.0) | Supplier | Q `inventorySummaryList` | Not implemented |
| [Inventory adjustments](https://developer.wayfair.io/posts/docs/inventory-visibility-adjustment-api/reference/GraphQL/v1.0.0) | Supplier | Q `inventoryAdjustmentList` | Not implemented |
| [CastleGate single-channel](https://developer.wayfair.io/posts/docs/castlegate-single-channel-api/reference/GraphQL/v1.0.0) | Orders | Q `getCastleGatePurchaseOrders`, `getCastleGateWarehouseShippingAdvice`; M `purchaseOrders.acknowledgeCastleGate`, `purchaseOrders.acknowledgeCastleGateWarehouseShippingAdvice` | Not implemented |
| [Catalog read v2](https://developer.wayfair.io/posts/docs/supplier-catalog-api-v2/reference/GraphQL/v2.0.0) | Catalog read v2 | Q `supplierCatalogItems` | Not implemented |
| [Product addition v2](https://developer.wayfair.io/posts/docs/product-catalog-api-v2/reference/GraphQL/v2.0.0) | Catalog; conflicting example omits `/v1` | Q `supplierBrand.brandAssociations`, `media.mediaMetaDataTags`, `taxonomyCategories`, `attributesByFilter`, `productAddition.submissionsV2`; M `productAddition.submitV2` | Not implemented |
| [Product updates](https://developer.wayfair.io/posts/docs/product-catalog-update-api/reference/GraphQL/v1.0.0) | Catalog | Q `attributesByFilter`, `statusOfUpdateRequest`; M `updateCatalogItemsMedia`, `updateMarketSpecificCatalogItemGroups`, `updateMarketSpecificCatalogItems` | Not implemented |
| [Dropship inventory](https://developer.wayfair.io/posts/docs/inventory-api/reference/GraphQL/v1.0.0) | Orders | M `inventory.save` | Not implemented |
| [Registration and labels](https://developer.wayfair.io/posts/docs/shipping-api/reference/GraphQL/v1.0.0) | Orders | Q `labelGenerationEvents`; M `purchaseOrders.register` | Not implemented |
| [Shipping documents](https://developer.wayfair.io/posts/docs/shipping-api/reference/REST/v1.0.0) | REST below | GET BOL, packing slip, shipping label | Not implemented |
| [Consolidated BOL](https://developer.wayfair.io/posts/docs/consolidated-bol-documentation-api/reference/GraphQL/v1.0.0) | Supplier | Q `consolidatedBolDocument` | Not implemented |
| [Cancellations](https://developer.wayfair.io/posts/docs/order-cancellation-api/reference/GraphQL/v1.0.0) | Supplier | Q `lineItemCancellationRequestByPurchaseOrders`, `lineItemCancellationRequestByWarehouses`; M `confirmLineItemCancellationRequest`, `rejectLineItemCancellationRequest` | Not implemented |
| [Multichannel fulfillment](https://developer.wayfair.io/posts/docs/castlegate-order-api/reference/GraphQL/v1.0.0) | Supplier | Q `fulfillmentOrderDetails`, `fulfillmentOrderDetailsList`, `warehouseShippingAdvices`; M `cancelFulfillmentOrder`, `createFulfillmentOrder` | Not implemented |
| [Advertising](https://developer.wayfair.io/posts/docs/advertising-api/reference/REST/v1.0.0) | Advertising | POST `/reports`; GET `/reports?reportId=...`; POST `/campaign/{id}` | Not implemented |

Shipping document paths are `GET /v1/bill_of_lading/{purchaseOrderNumber}`, `GET /v1/packing_slip/{purchaseOrderNumber}`, and `GET /v1/shipping_label/{purchaseOrderNumber}` on `https://api.wayfair.com` (sandbox: `https://sandbox.api.wayfair.com`). They return documents, not a reason to pass PDF bytes through a model.

### Access and contract boundaries

- Catalog v2 requires `X-SELECTED-SUPPLIER-ID` and `read:catalog_products`. Public addition/update docs also name `READ_CATALOG_MEDIA`, `READ_TAXONOMY_CATEGORIES`, and `READ_TAXONOMY_ATTRIBUTES`; do not assume scope spelling is interchangeable.
- Inbound milestones name `read:cgf_inbound_orders`; inventory visibility names `read:inventory_visibility`; adjustments name `read:inventory_transactions`.
- Advertising distinguishes `modify-bids` from `modify-campaigns`. These are consequential business writes, not generic read tools.
- The inventory-adjustment mutation `adjustmentMutationNotAvailable` is explicitly a placeholder (“Nothing to see here, yet!”). It must not become a tool.
- Catalog production paths disagree between the endpoint table and examples. Do not silently normalize `/v1` away or assume catalog v1 is catalog v2.
- Cancellation's header names an inbound-milestone scope, which appears copied. Its write entitlement is not established by that example.
- Inventory examples disagree with the declared `[inventoryInput!]!` type and select `id`, which the displayed transaction type does not expose. Sandbox supports only `TRUE_UP`; inputs beyond 500 lines are truncated. A client must not silently lose excess inventory updates.
- Advertising's route version, page version, and repeated base-path headings disagree. Full request URLs, not duplicated headings, establish path composition.
- No separate invoice/payment/returns operation contract was established from this public navigation. Supplier-facing marketing is not proof of an endpoint.
- CastleGate receipt acknowledgments and warehouse-shipping-advice acknowledgments must remain explicit writes, never side effects of a read.

## SPS Commerce

Sources: [Developer Center](https://developercenter.spscommerce.com/), its public Services navigation, and [Community Submission OpenAPI](https://api.spscommerce.com/submissions/openapi.json).

`https://docs.api.spscommerce.com/` labels itself an internal reference and directs external users to Developer Center. The public Services navigation exposes Transaction, Shipping Doc, and Trading Partner Submission APIs. A Max Connect beta banner is not an additional verified API contract.

### Authentication

Machine-to-machine documentation specifies `POST https://auth.spscommerce.com/oauth/token` with JSON `audience: "https://spscommerce.com"`, `client_id`, `client_secret`, and `grant_type: "client_credentials"`. Responses provide `access_token` and `expires_in`; token reuse is required because issuance is rate-limited.

M2M is intended for a company connecting on its own behalf. Delegated access uses a host-owned authorization-code/refresh flow. Consent redirects, state validation, secret persistence, and OAuth callbacks remain host responsibilities. Business requests use bearer authorization.

### Transaction API v5

Base: `https://api.spscommerce.com`. These operations exchange files, usually RSX XML; they are **not** conventional JSON order CRUD.

| Method | Path | Meaning |
| --- | --- | --- |
| POST | `/transactions/v5/data/{file-path}` | Upload bytes, `application/octet-stream`, up to the documented 2 GB limit |
| GET | `/transactions/v5/data/{directory-path}` | List files/directories |
| GET | `/transactions/v5/data/{file-path}` | Retrieve bytes |
| DELETE | `/transactions/v5/data/{file-path}` | Delete a file explicitly |
| GET | `/transactions/v5/history` | Read processing reports |

- Paths are case-sensitive. Directory paths end in `/`; root has an empty path.
- Uploading the same path overwrites an existing transaction. Do not call uploads idempotent or automatically replay them.
- Optional upload metadata uses `sps-meta-{key}` headers.
- Listing exposes `limit` (1–1000, default 1000), `cursor`, and case-sensitive `entryNamePrefix`.
- History exposes `limit` (default 100), `offset` (default 0), and `after`/`until` timestamps in `YYYY-MM-DDTHH:mm:ss` format. Follow documented paging links rather than the contradictory example offset arithmetic.
- History can lag transfers by five minutes.
- SPS deletes inbound files after processing. Outbound files should be deleted only after the consumer successfully processes them. A read tool must not perform this deletion.
- Production routing requires an SPS agreement and enablement. Sandbox tokens do not route transactions into the trading-partner network.

### Shipping Label API v1

Source: [public label reference](https://developercenter.spscommerce.com/#/docs/shipping-doc-api/labels/get_all_labels). Base: `https://api.spscommerce.com`.

| Method | Path |
| --- | --- |
| GET | `/label/v1/` |
| GET | `/label/v1/{label-id}` |
| GET | `/label/v1/{label-id}/schema` |
| GET | `/label/v1/{label-id}/sample-json` |
| GET | `/label/v1/{label-id}/sample-pdf` |
| GET | `/label/v1/{label-id}/sample/{sample-uid}/sample-pdf` |
| POST | `/label/v1/{label-id}/pdf` |
| POST | `/label/v1/{label-id}/zpl` |
| POST | `/label/v1/{label-id}/pdf/batches` |
| POST | `/label/v1/{label-id}/zpl/batches` |
| GET | `/label/v1/batches/{batchId}` |

Listing filters include `limit`, `offset`, `name`, `ownerName`, `ownerID`, and `canRender`. Text matches default to contains; `__EQ` requests exact matching. Render data depends on the selected template's schema, not a universal hardcoded `Header`/`Pack` example.

PDF rendering supports documented layout/pack-count/collation/copy/page controls. `url=true` returns a generated-document URL that expires after 24 hours; it is not a durable artifact. Batch results provide `batchId` and a status URL. Status is `In Progress`, `Completed`, or `Failed`, with results or validation failures as applicable. Trial access is limited to sample retailer templates.

### Packing Slip API v1

Source: [public packing-slip reference](https://developercenter.spscommerce.com/#/docs/shipping-doc-api/packing_slips/get_all_packing_slip). Base: `https://api.spscommerce.com`.

| Method | Path |
| --- | --- |
| GET | `/packing-slip/v1/` |
| GET | `/packing-slip/v1/{slip-id}` |
| GET | `/packing-slip/v1/{slip-id}/schema` |
| GET | `/packing-slip/v1/{slip-id}/sample-json` |
| GET | `/packing-slip/v1/{slip-id}/sample-pdf` |
| GET | `/packing-slip/v1/{slip-id}/sample/{sample-uid}/sample-pdf` |
| POST | `/packing-slip/v1/{slip-id}/pdf` |

The public navigation also links batch creation, append, status, result/error, per-shipment result, and processing documentation marked **`internal=true`**. Public readability does not establish supported customer access. The processing page contradicts itself on POST versus PUT. These batch operations are excluded from the verified public implementation scope pending clarification.

### Community Submission API v1

The anonymously accessible [OpenAPI 3.1 document](https://api.spscommerce.com/submissions/openapi.json) gives API version 1.0.0 and server `https://api.spscommerce.com/submissions`.

| Method | Path | Contract |
| --- | --- | --- |
| POST | `/v1/trading-partners` | Creates trading partners from `TradingPartnerInput`; 201 response |
| GET | `/v1/forms` | Lists forms with `limit` 1–50 (default 1), `offset` ≥0 (default 0) |
| GET | `/v1/forms/{id}` | Reads one submission form |

Trading-partner input requires `submissionFormId`, `tradingPartnerName`, `tradingPartnerId`, `country`, `businessContact`, and `includedDataExchanges`. Contacts require first name, last name, and email. Implement from the complete nested OpenAPI schemas, not this summary. Creating trading partners is an explicit write.

Unlike Transaction's error envelope, this API uses `application/problem+json` with `title`, `status`, `requestId`, and optional detail/context.

### Public-documentation limitations

- Static “Shipping Label API Schema” and “Packing Slip API Schema” links require sign-in. No login was attempted.
- Per-template schemas are fetched through authenticated business endpoints. No account/API requests were made to retrieve them.
- No complete RSX/XSD contract was captured. Do not invent an EDI translation layer or universal business-document schema.
- Transaction response examples are available, but a formal schema was not captured. Its upload success table says 201 while one response selector says 200.
- History defaults and example offset arithmetic conflict. Do not infer a new pagination algorithm from those examples.
- These limitations do not make all SPS APIs unavailable. The verified endpoints and Community OpenAPI support separate implementation slices, with the remaining constraints documented honestly.

## Verification boundary

All discovery used public, unauthenticated documentation. No vendor business operations, live GraphQL introspection, transaction uploads, order mutations, account creation, or production tests were executed. Mocked package tests establish local request/response behavior, not vendor certification or account entitlement.
