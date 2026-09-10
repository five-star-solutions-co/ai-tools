# Wayfair and SPS Commerce public API inventory

Public documentation inspected September 9, 2026. This is a contract/coverage reference, not a claim of live certification or complete package coverage. Project delivery is tracked in Beads epic `ai-tools-p6r`.

The [Wayfair pack](../vendors/wayfair.md) has 40 tools covering catalog reads/updates/reference data, dropship and CastleGate fulfillment, cancellations, inventory visibility/feeds, shipping documents, inbound milestones and advertising. The [SPS Commerce pack](../vendors/sps-commerce.md) has 25 tools and 34 client methods covering all 26 verified business method/path combinations below. Unresolved documentation conflicts remain tracked in `ai-tools-p6r.4`.

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

Auth uses `POST https://sso.auth.wayfair.com/oauth/token`, `client_credentials`, client ID/secret, and the environment-specific audience (`https://api.wayfair.com/` or `https://sandbox.api.wayfair.com/`). The client supports both environments, defaults to production, and caches/deduplicates tokens based on the returned expiry.

### Operation coverage

`Q` means query; `M` means mutation. Names retain documented GraphQL nesting. The last column distinguishes implemented operations from remaining work.

| Family / public reference | Endpoint | Documented operations | Current pack |
| --- | --- | --- | --- |
| Existing catalog v1 | Existing catalog v1 | Q `supplierCatalog` | `listCatalogPage` / `wayfair-list-catalog` |
| [Dropship orders](https://developer.wayfair.io/posts/docs/orders-api/reference/GraphQL/v1.0.0) | Orders | Q `getDropshipPurchaseOrders`; M `purchaseOrders.accept`, `purchaseOrders.shipment` | Lightweight list, explicit detail read, acceptance, ASN |
| [Inbound milestones](https://developer.wayfair.io/posts/docs/inbound-order-shipment-milestone/reference/GraphQL/v1.0.0) | Supplier | Q `inboundOrderList` | `listInboundOrders`, native limit/offset and shipment journeys |
| [Inventory on hand](https://developer.wayfair.io/posts/docs/inventory-visibility-onhand-api/reference/GraphQL/v1.0.0) | Supplier | Q `inventorySummaryList` | `listInventorySummary` / `wayfair-list-inventory-summary`, cursor pages and position breakdowns |
| [Inventory adjustments](https://developer.wayfair.io/posts/docs/inventory-visibility-adjustment-api/reference/GraphQL/v1.0.0) | Supplier | Q `inventoryAdjustmentList` | `listInventoryAdjustments` / `wayfair-list-inventory-adjustments`, zero-based pages and signed quantities |
| [CastleGate single-channel](https://developer.wayfair.io/posts/docs/castlegate-single-channel-api/reference/GraphQL/v1.0.0) | Orders | Q `getCastleGatePurchaseOrders`, `getCastleGateWarehouseShippingAdvice`; M `purchaseOrders.acknowledgeCastleGate`, `purchaseOrders.acknowledgeCastleGateWarehouseShippingAdvice` | Order/advice reads and separate explicit receipt acknowledgments |
| [Catalog read v2](https://developer.wayfair.io/posts/docs/supplier-catalog-api-v2/reference/GraphQL/v2.0.0) | Catalog read v2 | Q `supplierCatalogItems` | `listCatalogItems`, bounded identity/listing projection and error union handling |
| [Product addition v2](https://developer.wayfair.io/posts/docs/product-catalog-api-v2/reference/GraphQL/v2.0.0) | Catalog; conflicting example omits `/v1` | Q `supplierBrand.brandAssociations`, `media.mediaMetaDataTags`, `taxonomyCategories`, `attributesByFilter`, `productAddition.submissionsV2`; M `productAddition.submitV2` | Brand/media/category references implemented; taxonomy uses explicit update schema; addition submit/status blocked by conflicts below |
| [Product updates](https://developer.wayfair.io/posts/docs/product-catalog-update-api/reference/GraphQL/v1.0.0) | Catalog | Q `attributesByFilter`, `statusOfUpdateRequest`; M under `updateCatalogEntitiesMutations`: `updateCatalogItemsMedia`, `updateMarketSpecificCatalogItemGroups`, `updateMarketSpecificCatalogItems` | All five operations; group `mediaContent` excluded pending clarification |
| [Dropship inventory](https://developer.wayfair.io/posts/docs/inventory-api/reference/GraphQL/v1.0.0) | Orders | M `inventory.save` | Explicit feed kind/dry-run; sandbox rejects truncation; documented conflict policy below |
| [Registration and labels](https://developer.wayfair.io/posts/docs/shipping-api/reference/GraphQL/v1.0.0) | Orders | Q `labelGenerationEvents`; M `purchaseOrders.register` | Registration and bounded event reads |
| [Shipping documents](https://developer.wayfair.io/posts/docs/shipping-api/reference/REST/v1.0.0) | REST below | GET BOL, packing slip, shipping label | Artifact-backed tools and bounded host byte methods |
| [Consolidated BOL](https://developer.wayfair.io/posts/docs/consolidated-bol-documentation-api/reference/GraphQL/v1.0.0) | Supplier | Q `consolidatedBolDocument` | Native availability/expiry/document reference |
| [Cancellations](https://developer.wayfair.io/posts/docs/order-cancellation-api/reference/GraphQL/v1.0.0) | Supplier | Q `lineItemCancellationRequestByPurchaseOrders`, `lineItemCancellationRequestByWarehouses`; M `confirmLineItemCancellationRequest`, `rejectLineItemCancellationRequest` | Queries by PO/warehouse, native confirmation/rejection batches with per-request results |
| [Multichannel fulfillment](https://developer.wayfair.io/posts/docs/castlegate-order-api/reference/GraphQL/v1.0.0) | Supplier | Q `fulfillmentOrderDetails`, `fulfillmentOrderDetailsList`, `warehouseShippingAdvices`; M `cancelFulfillmentOrder`, `createFulfillmentOrder` | All five operations, native pagination and per-item errors |
| [Advertising](https://developer.wayfair.io/posts/docs/advertising-api/reference/REST/v1.0.0) | Advertising | POST `/reports`; GET `/reports?reportId=...`; POST `/campaign/{id}` | Report generation/status and campaign listing updates |

Shipping document paths are `GET /v1/bill_of_lading/{purchaseOrderNumber}`, `GET /v1/packing_slip/{purchaseOrderNumber}`, and `GET /v1/shipping_label/{purchaseOrderNumber}` on `https://api.wayfair.com` (sandbox: `https://sandbox.api.wayfair.com`). They return documents, not a reason to pass PDF bytes through a model.

### Access and contract boundaries

- Catalog v2 requires `X-SELECTED-SUPPLIER-ID` and `read:catalog_products`. Public addition/update docs also name `READ_CATALOG_MEDIA`, `READ_TAXONOMY_CATEGORIES`, and `READ_TAXONOMY_ATTRIBUTES`; do not assume scope spelling is interchangeable.
- Inbound milestones name `read:cgf_inbound_orders`; inventory visibility names `read:inventory_visibility`; adjustments name `read:inventory_transactions`.
- Inventory summary cursors are strings despite a numeric value in one cURL example. Adjustment pages start at zero; example totals disagree arithmetically and are preserved rather than recalculated. Adjustment start times cannot precede `2023-06-01T00:00:00-05:00`.
- Advertising distinguishes `modify-bids` from `modify-campaigns`. These are consequential business writes, not generic read tools.
- The inventory-adjustment mutation `adjustmentMutationNotAvailable` is explicitly a placeholder (“Nothing to see here, yet!”). It must not become a tool.
- Catalog production paths disagree between the endpoint table and examples. Supplier catalog read v2 has its own explicit no-`/v1` production endpoint; it is not catalog v1.
- Cancellation's header names an inbound-milestone scope, which appears copied. Its write entitlement is not established by that example.
- Cancellation's rejection error example uses the confirmation response key, contrary to its declared mutation and successful example. The pack follows the declared rejection key. PO validation follows the published `^[A-Za-z]{2}\d*$` pattern, which is more permissive than the prose's two-letters-plus-digits description.
- Inventory-write examples disagree with the declared `[inventoryInput!]!` type and select `id` and `completedCount`, which the displayed transaction type does not expose. The pack follows the nested `inventory.save` request/success examples and declared non-null inventory items, selecting only declared transaction fields. It never falls back to the conflicting root `save` cURL example. Sandbox supports only `TRUE_UP` and truncates beyond 500 lines; the client rejects both unsupported feed kinds and excess lines before HTTP.
- Advertising's route version, page version, and repeated base-path headings disagree. Full request URLs, not duplicated headings, establish path composition.
- No separate invoice/payment/returns operation contract was established from this public navigation. Supplier-facing marketing is not proof of an endpoint.
- CastleGate receipt acknowledgments and warehouse-shipping-advice acknowledgments must remain explicit writes, never side effects of a read.

### Catalog exclusions requiring clarification

The following are not implemented by guessing an endpoint, field name or numeric mapping:

| Operation/field | Public conflict | Required clarification |
| --- | --- | --- |
| `productAddition.submitV2` | Production endpoint declaration includes `/v1`, request examples omit it; operation declares an array result, successful examples return an object | Supported endpoint and response cardinality |
| `productAddition.submissionsV2` | Same route/cardinality conflict; appendix requires `jobId`, examples send `productAdditionRequestId` | Supported request identifier, endpoint and response cardinality |
| Group update `mediaContent` | Declared `mediaType: Int!`, examples send `"VIDEO"`; no numeric mapping | Correct input type or numeric enum values |
| Addition taxonomy variant | Addition uses `classId`/`classIds`; update schema uses `taxonomyCategoryId`/`taxonomyCategoryIds` at the same declared endpoint | Whether both versioned schemas exist and how they are selected |
| Rich catalog read leaves | No exact declarations for insight collections, `AttributeValue.value`, or error leaf nullability | Supported field types and nullability |

Product-addition attributes also contain contradictory variant and manufacturer examples. These do not justify inventing product-class answer schemas. Update schema definitions establish the usable update operations; stale cURL examples with nested `catalogItems`/`media`, extra market fields on media updates, or a mutation `status` result are not followed.

No private introspection or live mutation was used to resolve these differences. The absence of a safe contract for one operation does not block other verified families.

## SPS Commerce

Sources: [Developer Center](https://developercenter.spscommerce.com/), its public Services navigation, and [Community Submission OpenAPI](https://api.spscommerce.com/submissions/openapi.json).

Implemented public import: `@5ss/ai-tools/sps-commerce`, with `SpsCommerceClient` and `spsCommerceModule`. All verified routes in the following tables have client/tool coverage. Default/specific sample PDFs share a method with an optional sample ID; completed label-batch download is a composite operation, not an invented API endpoint. See the pack documentation for the complete method-to-tool map.

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

The pack uses `url=false` for synchronous renders and stores bounded PDF/ZPL results as artifacts. ZPL preserves the native JSON `zplData` array. Batch-status tools omit signed result URLs; host descriptors retain them. Composite batch downloads require an explicit host `document_origins` allowlist and use a separate unauthenticated transport with redirects disabled.

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
- These limitations do not make all SPS APIs unavailable. The verified endpoints and complete Community OpenAPI contracts are implemented; internal slip batches and inaccessible document schemas remain excluded.

## Verification boundary

All discovery used public, unauthenticated documentation. No vendor business operations, live GraphQL introspection, transaction uploads, order mutations, account creation, or production tests were executed. Mocked package tests establish local request/response behavior, not vendor certification or account entitlement.

The combined implementation passed `bun run check` (828 tests across 69 files), `bun run build`, and `bun run typecheck` on September 10, 2026. Generated flat imports include both packs. The first combined run exposed an outdated vendor list in a catalog metadata test; registering SPS there resolved it without weakening the check.
