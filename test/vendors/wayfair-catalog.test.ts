import { describe, expect, test } from 'bun:test'
import { z } from 'zod'

import { ToolError, validateModule } from '../../src/core'
import {
	WayfairClient,
	wayfairCatalogUpdateMarketInputSchema,
	wayfairGetMediaMetadataTagsInputSchema,
	wayfairGetTaxonomyAttributesInputSchema,
	wayfairListBrandAssociationsInputSchema,
	wayfairListCatalogItemsInputSchema,
	wayfairListTaxonomyCategoriesInputSchema,
	wayfairMarketContextInputSchema,
	wayfairModule,
	wayfairUpdateCatalogItemGroupsInputSchema,
	wayfairUpdateCatalogItemMediaInputSchema,
	wayfairUpdateCatalogItemsInputSchema
} from '../../src/vendors/wayfair'
import type {
	WayfairAuth,
	WayfairCatalogItem,
	WayfairGetCatalogUpdateStatusOutput,
	WayfairGetTaxonomyAttributesOutput,
	WayfairListCatalogItemsOutput,
	WayfairUpdateCatalogItemGroupsInput,
	WayfairUpdateCatalogItemMediaInput,
	WayfairUpdateCatalogItemsInput
} from '../../src/vendors/wayfair'

const auth: WayfairAuth = { client_id: 'client', client_secret: 'secret', supplier_id: 2683 }
const market = { country: 'UNITED_STATES', locale: 'en-US', brand: 'WAYFAIR' } as const
const bodySchema = z.object({ query: z.string(), variables: z.record(z.string(), z.json()) })

function harness(response: unknown, environment?: 'production' | 'sandbox', status = 200) {
	const requests: Array<{ url: string; headers: Headers; body: z.infer<typeof bodySchema> }> = []
	const tokens: unknown[] = []
	const client = new WayfairClient(
		{ ...auth, ...(environment && { environment }) },
		{
			fetch: async (input, init) => {
				const request = new Request(input, init)
				if (new URL(request.url).pathname === '/oauth/token') {
					tokens.push(await request.json())
					return Response.json({ access_token: 'access', expires_in: 900 })
				}
				expect(request.method).toBe('POST')
				requests.push({ url: request.url, headers: request.headers, body: bodySchema.parse(await request.json()) })
				return Response.json(response, { status })
			}
		}
	)
	return { client, requests, tokens }
}

async function rejection(promise: Promise<unknown>) {
	try {
		await promise
	} catch (error) {
		if (error instanceof ToolError) return error
		throw error
	}
	throw new Error('Expected a ToolError')
}

const item: WayfairCatalogItem = {
	supplierPartNumber: 'PART-1',
	marketContext: { locale: 'en-US', country: 'US', brand: 'WF', channel: 'ECM', segment: null, location: null },
	catalogItemStatus: null,
	class: { classId: '12', className: null },
	listings: [{ listingId: 'SKU-1' }],
	salesChannels: [
		{
			supplierPartNumber: 'PART-1',
			marketContext: { locale: 'en-GB', country: 'GB', brand: 'WF', channel: null, segment: 'B2B', location: null },
			catalogItemStatus: 'LIVE',
			class: null,
			listings: []
		}
	]
}
const page: WayfairListCatalogItemsOutput = {
	paginationInfo: { page: 1, pageSize: 30, hasNextPage: false, totalPages: 1, totalCount: 1 },
	supplier: { supplierId: '2683', supplierName: null },
	catalogItems: [item]
}
function catalogResponse(value: unknown = page) {
	return {
		data: {
			supplierCatalogItems: { __typename: 'SupplierCatalogItems', ...z.record(z.string(), z.unknown()).parse(value) }
		}
	}
}
function queryOf(requests: ReturnType<typeof harness>['requests']) {
	const query = requests[0]?.body.query
	if (!query) throw new Error('No captured query')
	return query.replace(/\s+/g, ' ').trim()
}

describe('Wayfair verified catalog', () => {
	test('exposes nine explicit described tools and preserves the existing 31', () => {
		expect(validateModule(wayfairModule).ok).toBe(true)
		expect(wayfairModule.tools).toHaveLength(40)
		const ids = [
			'wayfair-list-catalog-items',
			'wayfair-list-brand-associations',
			'wayfair-get-media-metadata-tags',
			'wayfair-list-taxonomy-categories',
			'wayfair-get-taxonomy-attributes',
			'wayfair-get-catalog-update-status',
			'wayfair-update-catalog-item-media',
			'wayfair-update-catalog-items',
			'wayfair-update-catalog-item-groups'
		]
		for (const id of ids) {
			const tool = wayfairModule.tools.find((entry) => entry.id === id)
			expect(tool).toBeDefined()
			expect(tool?.description.length).toBeGreaterThan(50)
			expect(tool?.meta.network).toBe(true)
			expect(tool?.meta.supportsCancel).toBe(true)
			const write = id.startsWith('wayfair-update-')
			expect(tool?.meta.sideEffect).toBe(write ? 'write' : 'read')
			expect(tool?.meta.idempotent).toBe(!write)
			if (write) expect(tool?.meta.requiresConfirmation).toBe(true)
		}
		expect(wayfairModule.tools.find((tool) => tool.id === 'wayfair-list-catalog')).toBeDefined()
	})

	test('reads a bounded union projection from the distinct production route', async () => {
		const { client, requests, tokens } = harness(catalogResponse())
		expect(await client.listCatalogItems({ pagination_options: {} })).toEqual(page)
		expect(requests[0]?.url).toBe('https://api.wayfair.io/product-catalog-api/graphql')
		expect(requests[0]?.headers.get('X-SELECTED-SUPPLIER-ID')).toBe('2683')
		expect(requests[0]?.headers.get('Authorization')).toBe('Bearer access')
		expect(requests[0]?.body.variables).toEqual({ input: { paginationOptions: { page: 1, pageSize: 30 } } })
		expect(tokens[0]).toMatchObject({ audience: 'https://api.wayfair.com/' })
		const query = queryOf(requests)
		expect(query).toContain(
			'query SupplierCatalogItems($input: SupplierCatalogItemsInput!, $marketContext: MarketContextInput)'
		)
		expect(query).toContain('supplierCatalogItems(input: $input) { __typename ... on SupplierCatalogItems')
		expect(query).toContain('paginationInfo { page pageSize hasNextPage totalPages totalCount }')
		expect(query).toContain(
			'... on SupplierCatalogItemsError { httpError { code message } internalError { code message } }'
		)
		expect(query.match(/salesChannels/g)).toHaveLength(1)
		expect(query).not.toContain('insights')
		expect(query).not.toContain('attributes')
	})

	test('maps catalog filters and sales-channel market, using the sandbox v1 route', async () => {
		const { client, requests, tokens } = harness(catalogResponse(), 'sandbox')
		await client.listCatalogItems({
			pagination_options: { page: 2, page_size: 15 },
			filter: {
				supplier_part_numbers: ['PART-1'],
				listing_ids: ['SKU-1'],
				catalog_item_statuses: ['LIVE', 'LAUNCHING']
			},
			market_context: market
		})
		expect(requests[0]?.url).toBe('https://api.wayfair.io/sandbox/v1/product-catalog-api/graphql')
		expect(tokens[0]).toMatchObject({ audience: 'https://sandbox.api.wayfair.com/' })
		expect(requests[0]?.body.variables).toEqual({
			input: {
				paginationOptions: { page: 2, pageSize: 15 },
				filter: { supplierPartNumbers: ['PART-1'], listingIds: ['SKU-1'], catalogItemStatuses: ['LIVE', 'LAUNCHING'] }
			},
			marketContext: market
		})
		expect(queryOf(requests)).toContain('salesChannels(marketContextInput: $marketContext)')
	})

	test('catalog pagination is required and validated before any network I/O', async () => {
		for (const input of [
			{},
			{ pagination_options: { page: 0 } },
			{ pagination_options: { page_size: 31 } },
			{ pagination_options: { page_size: 0 } },
			{ pagination_options: {}, filter: { catalog_item_statuses: ['ARCHIVED'] } },
			{ pagination_options: {}, supplier_id: 1 }
		]) {
			expect(wayfairListCatalogItemsInputSchema.safeParse(input).success).toBe(false)
		}
		const { client, tokens, requests } = harness({})
		expect((await rejection(client.listCatalogItems({ pagination_options: { page_size: 31 } }))).code).toBe('bad_input')
		expect(tokens).toHaveLength(0)
		expect(requests).toHaveLength(0)
	})

	test('preserves a valid empty page but rejects missing, malformed and wrong-supplier success', async () => {
		const empty = {
			...page,
			catalogItems: [],
			paginationInfo: { ...page.paginationInfo, totalPages: 0, totalCount: 0 }
		}
		expect(await harness(catalogResponse(empty)).client.listCatalogItems({ pagination_options: {} })).toEqual(empty)
		for (const response of [
			{ data: null },
			{ data: { supplierCatalogItems: null } },
			catalogResponse({ ...page, catalogItems: null }),
			catalogResponse({ ...page, supplier: { supplierId: 'other', supplierName: null } }),
			catalogResponse({ ...page, catalogItems: [{ ...item, marketContext: null }] }),
			{ data: { supplierCatalogItems: page } }
		]) {
			expect((await rejection(harness(response).client.listCatalogItems({ pagination_options: {} }))).code).toBe(
				'upstream'
			)
		}
	})

	test.each([
		['httpError', 'UNAUTHORIZED', 'bad_auth'],
		['httpError', 'BAD_REQUEST', 'bad_input'],
		['httpError', 'FORBIDDEN', 'forbidden'],
		['internalError', 'READ_PARTIAL_DATA', 'upstream'],
		['internalError', 'INTERNAL_ERROR', 'upstream'],
		['httpError', 'secret-provider-code', 'upstream']
	])('sanitizes %s %s union errors without returning an empty page', async (field, code, expected) => {
		const { client, requests } = harness({
			data: {
				supplierCatalogItems: {
					__typename: 'SupplierCatalogItemsError',
					[field]: { code, message: 'secret-provider-message' }
				}
			}
		})
		const error = await rejection(client.listCatalogItems({ pagination_options: {} }))
		expect(error.code).toBe<string>(expected)
		expect(JSON.stringify(error)).not.toContain('secret-provider')
		expect(error.message).not.toContain('secret-provider')
		expect(requests).toHaveLength(1)
	})

	test.each([{ classification: 'ValidationError' }, { errorType: 'BAD_REQUEST' }, { category: 'BAD_REQUEST' }])(
		'sanitizes GraphQL validation errors even with partial data',
		async (extensions) => {
			const { client } = harness({
				data: { supplierCatalogItems: null },
				errors: [{ message: 'secret-echo', extensions }]
			})
			const error = await rejection(client.listCatalogItems({ pagination_options: {} }))
			expect(error.code).toBe('bad_input')
			expect(JSON.stringify(error)).not.toContain('secret-echo')
		}
	)

	test('brand associations bind numeric supplier and preserve nullable entries', async () => {
		const associations = {
			brands: [null, { id: 'brand', manufacturer: { id: 'manufacturer', name: null } }],
			pageInfo: { hasNextPage: true, hasPreviousPage: false, totalPages: 2 }
		}
		const { client, requests } = harness({ data: { supplierBrand: { brandAssociations: associations } } })
		expect(await client.listBrandAssociations({ market_context: {}, page_size: 500, page: 1 })).toEqual(associations)
		expect(requests[0]?.url).toBe('https://api.wayfair.io/v1/product-catalog-api/graphql')
		expect(requests[0]?.body.variables).toEqual({
			request: { supplierId: 2683, marketContext: {}, pageSize: 500, page: 1 }
		})
		expect(queryOf(requests)).toBe(
			'query SupplierBrandAssociations($request: GetSupplierBrandsAssociationsRequest!) { supplierBrand { brandAssociations(request: $request) { brands { id manufacturer { id name } } pageInfo { hasNextPage hasPreviousPage totalPages } } } }'
		)
		expect(wayfairListBrandAssociationsInputSchema.safeParse({ market_context: {} }).success).toBe(false)
		const nullable = harness({ data: { supplierBrand: { brandAssociations: { ...associations, brands: null } } } })
		expect((await nullable.client.listBrandAssociations({ market_context: {}, page_size: 10 })).brands).toBeNull()
		expect(nullable.requests[0]?.body.variables).toEqual({
			request: { supplierId: 2683, marketContext: {}, pageSize: 10 }
		})
	})

	test('media metadata tags use the declared nested query and ID strings', async () => {
		const tags = [{ metaDataTagType: 'DOCUMENT', metaDataTags: [{ metaDataId: 'tag', name: 'Manual' }] }]
		const { client, requests } = harness({ data: { media: { mediaMetaDataTags: tags } } }, 'sandbox')
		expect(
			await client.getMediaMetadataTags({
				market_context: market,
				meta_data_tag_types: ['DOCUMENT', 'LEGAL_DOCUMENT', 'LANGUAGE', 'REGION']
			})
		).toEqual(tags)
		expect(requests[0]?.url).toBe('https://api.wayfair.io/sandbox/v1/product-catalog-api/graphql')
		expect(requests[0]?.body.variables).toEqual({
			input: { marketContext: market, metaDataTagTypes: ['DOCUMENT', 'LEGAL_DOCUMENT', 'LANGUAGE', 'REGION'] }
		})
		expect(queryOf(requests)).toBe(
			'query MediaMetadataTags($input: MediaMetaDataTagInput!) { media { mediaMetaDataTags(mediaMetaDataTag: $input) { metaDataTagType metaDataTags { metaDataId name } } } }'
		)
		expect(
			wayfairGetMediaMetadataTagsInputSchema.safeParse({ market_context: {}, meta_data_tag_types: ['IMAGE'] }).success
		).toBe(false)
	})

	test('taxonomy categories preserve nullable page metadata without invented defaults', async () => {
		const categories = { pageInfo: null, taxonomyCategories: [{ taxonomyCategoryId: '12', name: null }] }
		const { client, requests } = harness({ data: { taxonomyCategories: categories } })
		expect(await client.listTaxonomyCategories({ market_context: {} })).toEqual(categories)
		expect(requests[0]?.body.variables).toEqual({ marketContext: {} })
		expect(queryOf(requests)).toBe(
			'query TaxonomyCategories($marketContext: MarketContextInput!, $paginationOptions: PaginationOptions) { taxonomyCategories(marketContext: $marketContext, paginationOptions: $paginationOptions) { pageInfo { page pageSize hasNextPage totalPages } taxonomyCategories { taxonomyCategoryId name } } }'
		)
		await client.listTaxonomyCategories({ market_context: market, pagination_options: { page: 2, page_size: 50 } })
		expect(requests[1]?.body.variables).toEqual({ marketContext: market, paginationOptions: { page: 2, pageSize: 50 } })
		expect(
			wayfairListTaxonomyCategoriesInputSchema.safeParse({ market_context: {}, pagination_options: { page_size: 30 } })
				.success
		).toBe(false)
	})

	test('taxonomy attributes follow UPDATE schema, one child level and conditionality nullability', async () => {
		const base = {
			taxonomyAttributeId: '1',
			title: 'Material',
			description: null,
			market: null,
			requirement: 'REQUIRED' as const,
			valueFormat: {
				canValueBeCustomized: null,
				canValueBeSetToUnavailable: false,
				canValueBeSetToNotApplicable: true,
				datatype: 'SINGLE_CHOICE' as const,
				measurement: { measurementName: null, measurementUnit: { name: null, symbol: 'cm' } }
			},
			possibleAttributeValues: [null, { value: 'Wood', definition: null }],
			parentAttributeId: null,
			relatedAttributeIds: ['2'],
			taxonomyCategoryIds: ['12']
		}
		const attributes: WayfairGetTaxonomyAttributesOutput = [
			{
				taxonomyCategoryId: '12',
				attributes: [
					null,
					{ ...base, childAttributes: [null, { ...base, taxonomyAttributeId: '2', relatedAttributeIds: null }] }
				],
				conditionalityRules: [
					{
						taxonomyAttributeId: '1',
						rules: [
							{
								upstreamCondition: { taxonomyAttributeId: '1', operation: 'EQUALS', answers: ['Wood', null] },
								downstreamConditions: [
									{ taxonomyAttributeId: '2', validationType: null, answers: [null], operation: 'ASSIGN' }
								]
							}
						]
					}
				]
			},
			{ taxonomyCategoryId: '13', attributes: null, conditionalityRules: null }
		]
		const { client, requests } = harness({ data: { attributesByFilter: attributes } })
		expect(await client.getTaxonomyAttributes({ taxonomy_category_id: 12, market_context: market })).toEqual(attributes)
		expect(requests[0]?.body.variables).toEqual({ input: { taxonomyCategoryId: 12, marketContext: market } })
		const query = queryOf(requests)
		expect(query).toContain(
			'query TaxonomyAttributes($input: AttributesFilterInput!) { attributesByFilter(input: $input)'
		)
		expect(query.match(/childAttributes/g)).toHaveLength(1)
		expect(query).toContain('measurement { measurementName measurementUnit { name symbol } }')
		expect(query).toContain('upstreamCondition { taxonomyAttributeId answers operation }')
		expect(query).toContain('downstreamConditions { taxonomyAttributeId validationType answers operation }')
		expect(query).not.toContain('classId')
		expect(wayfairGetTaxonomyAttributesInputSchema.safeParse({ class_id: 12, market_context: {} }).success).toBe(false)
	})

	test('catalog update status preserves partial failures and validation-only state', async () => {
		const status: WayfairGetCatalogUpdateStatusOutput = {
			requestId: 'request',
			validationOnly: true,
			status: 'COMPLETED',
			problems: [
				{
					code: 'INVALID_INPUT',
					title: null,
					detail: null,
					catalogEntityIdentifier: 'PART-2',
					catalogEntityProperty: null,
					catalogEntityPropertyId: null,
					inputValue: null
				}
			],
			successfulUpdates: [null, { entityIdentifier: 'PART-1', catalogEntityProperty: 'ITEM_NAME' }]
		}
		const { client, requests } = harness({ data: { statusOfUpdateRequest: status } })
		expect(await client.getCatalogUpdateStatus({ request_id: 'request' })).toEqual(status)
		expect(requests[0]?.body.variables).toEqual({ input: { requestId: 'request', supplierId: '2683' } })
		expect(queryOf(requests)).toContain('query CatalogUpdateStatus($input: StatusOfUpdateRequestInput!)')
		expect(queryOf(requests)).toContain(
			'problems { code title detail catalogEntityIdentifier catalogEntityProperty catalogEntityPropertyId inputValue }'
		)
		expect((await rejection(client.getCatalogUpdateStatus({ request_id: 'other' }))).code).toBe('upstream')
		for (const state of ['IN_PROGRESS', 'BLOCKED'] as const) {
			const result = await harness({
				data: { statusOfUpdateRequest: { ...status, status: state, successfulUpdates: null } }
			}).client.getCatalogUpdateStatus({ request_id: 'request' })
			expect(result.status).toBe(state)
			expect(result.successfulUpdates).toBeNull()
		}
	})

	test('media mutation maps upload/delete, preserves false and legacy zero, and returns request only', async () => {
		const input: WayfairUpdateCatalogItemMediaInput = {
			validate_only: false,
			catalog_items_to_update: [
				{
					supplier_part_number: 'PART-1',
					media_type: 'IMAGE',
					media_url: 'https://example.com/image.jpg',
					lead_image_override: false
				},
				{
					supplier_part_number: 'PART-2',
					media_type: 'VIDEO',
					action: 'DELETE',
					asset_id: 'asset',
					legacy_asset_id: 0
				},
				{ supplier_part_number: 'PART-3', media_type: 'DOCUMENT', action: 'DELETE', legacy_asset_id: 123 }
			]
		}
		const { client, requests } = harness({
			data: { updateCatalogEntitiesMutations: { updateCatalogItemsMedia: { requestId: 'request' } } }
		})
		expect(await client.updateCatalogItemMedia(input)).toEqual({ requestId: 'request' })
		expect(requests[0]?.body.variables).toEqual({
			input: {
				supplierId: '2683',
				validateOnly: false,
				catalogItemsToUpdate: [
					{
						supplierPartNumber: 'PART-1',
						mediaType: 'IMAGE',
						mediaUrl: 'https://example.com/image.jpg',
						leadImageOverride: false
					},
					{ supplierPartNumber: 'PART-2', mediaType: 'VIDEO', action: 'DELETE', assetId: 'asset', legacyAssetId: 0 },
					{ supplierPartNumber: 'PART-3', mediaType: 'DOCUMENT', action: 'DELETE', legacyAssetId: 123 }
				]
			}
		})
		expect(queryOf(requests)).toBe(
			'mutation UpdateCatalogItemMedia($input: UpdateCatalogItemsMediaInput!) { updateCatalogEntitiesMutations { updateCatalogItemsMedia(input: $input) { requestId } } }'
		)
		expect(queryOf(requests)).not.toContain('marketContext')
		expect(requests).toHaveLength(1)
	})

	test('media conditional preflight rejects missing selectors, unsupported URLs and implicit write mode', () => {
		const base = { supplier_part_number: 'PART', media_type: 'IMAGE' }
		for (const media of [
			base,
			{ ...base, action: 'UPLOAD' },
			{ ...base, action: 'DELETE' },
			{ ...base, media_url: 'file:///tmp/image.jpg' },
			{ ...base, media_url: 'https://user:password@example.com/image.jpg' }
		]) {
			expect(
				wayfairUpdateCatalogItemMediaInputSchema.safeParse({ validate_only: true, catalog_items_to_update: [media] })
					.success
			).toBe(false)
		}
		expect(wayfairUpdateCatalogItemMediaInputSchema.safeParse({ catalog_items_to_update: [] }).success).toBe(false)
		expect(
			wayfairUpdateCatalogItemMediaInputSchema.safeParse({
				validate_only: true,
				catalog_items_to_update: [],
				market_context: {}
			}).success
		).toBe(false)
	})

	test('item updates include related attribute values and explicit validateOnly', async () => {
		const input: WayfairUpdateCatalogItemsInput = {
			market_context: market,
			validate_only: true,
			catalog_items_to_update: [
				{
					supplier_part_number: 'PART',
					item_name: '',
					attributes: {
						taxonomy_category_id: '12',
						ignore_warnings: false,
						enable_autofill: false,
						updates: [
							{ attribute_id: '1', value: ['Wood'] },
							{ attribute_id: '2', value: ['Oak'] }
						]
					}
				}
			]
		}
		const { client, requests } = harness({
			data: { updateCatalogEntitiesMutations: { updateMarketSpecificCatalogItems: { requestId: 'request' } } }
		})
		expect(await client.updateCatalogItems(input)).toEqual({ requestId: 'request' })
		expect(requests[0]?.body.variables).toEqual({
			input: {
				supplierId: '2683',
				marketContext: market,
				validateOnly: true,
				catalogItemsToUpdate: [
					{
						supplierPartNumber: 'PART',
						itemName: '',
						attributes: {
							taxonomyCategoryId: '12',
							ignoreWarnings: false,
							enableAutofill: false,
							updates: [
								{ attributeId: '1', value: ['Wood'] },
								{ attributeId: '2', value: ['Oak'] }
							]
						}
					}
				]
			}
		})
		expect(queryOf(requests)).toBe(
			'mutation UpdateCatalogItems($input: UpdateMarketSpecificCatalogItemsInput!) { updateCatalogEntitiesMutations { updateMarketSpecificCatalogItems(input: $input) { requestId } } }'
		)
		expect(requests).toHaveLength(1)
	})

	test('group updates map all verified content but exclude inconsistent mediaContent', async () => {
		const input: WayfairUpdateCatalogItemGroupsInput = {
			market_context: { country: 'UNITED_KINGDOM', locale: 'en-GB' },
			validate_only: false,
			catalog_item_groups_to_update: [
				{
					item_group_id: 'group',
					item_group_name: '',
					marketing_copy: '',
					feature_bullets: ['A single bullet is permitted'],
					option_content: [{ option_id: 0, option_name: '' }]
				}
			]
		}
		const { client, requests } = harness(
			{ data: { updateCatalogEntitiesMutations: { updateMarketSpecificCatalogItemGroups: { requestId: 'request' } } } },
			'sandbox'
		)
		expect(await client.updateCatalogItemGroups(input)).toEqual({ requestId: 'request' })
		expect(requests[0]?.url).toBe('https://api.wayfair.io/sandbox/v1/product-catalog-api/graphql')
		expect(requests[0]?.body.variables).toEqual({
			input: {
				supplierId: '2683',
				marketContext: { country: 'UNITED_KINGDOM', locale: 'en-GB' },
				validateOnly: false,
				catalogItemGroupsToUpdate: [
					{
						itemGroupId: 'group',
						itemGroupName: '',
						marketingCopy: '',
						featureBullets: ['A single bullet is permitted'],
						optionContent: [{ optionId: 0, optionName: '' }]
					}
				]
			}
		})
		expect(queryOf(requests)).toBe(
			'mutation UpdateCatalogItemGroups($input: UpdateMarketSpecificCatalogItemGroupsInput!) { updateCatalogEntitiesMutations { updateMarketSpecificCatalogItemGroups(input: $input) { requestId } } }'
		)
		expect(
			wayfairUpdateCatalogItemGroupsInputSchema.safeParse({
				...input,
				catalog_item_groups_to_update: [{ item_group_id: 'group', media_content: [] }]
			}).success
		).toBe(false)
	})

	test('read markets stay optional while item/group updates require supported country and locale', () => {
		expect(wayfairMarketContextInputSchema.safeParse({}).success).toBe(true)
		for (const country of ['GERMANY', 'CANADA']) {
			expect(wayfairMarketContextInputSchema.safeParse({ country }).success).toBe(true)
			expect(wayfairCatalogUpdateMarketInputSchema.safeParse({ country, locale: 'en-US' }).success).toBe(false)
		}
		for (const context of [
			{},
			{ country: 'UNITED_STATES' },
			{ locale: 'en-US' },
			{ country: 'UNITED_STATES', locale: 'en_US' }
		]) {
			expect(wayfairCatalogUpdateMarketInputSchema.safeParse(context).success).toBe(false)
		}
		expect(
			wayfairUpdateCatalogItemsInputSchema.safeParse({ market_context: market, catalog_items_to_update: [] }).success
		).toBe(false)
		expect(
			wayfairUpdateCatalogItemGroupsInputSchema.safeParse({ market_context: market, catalog_item_groups_to_update: [] })
				.success
		).toBe(false)
		expect(
			wayfairUpdateCatalogItemsInputSchema.safeParse({
				market_context: market,
				validate_only: true,
				catalog_items_to_update: [],
				supplier_id: 'other'
			}).success
		).toBe(false)
	})

	test('all catalog mutations neither replay on HTTP failure nor return optimistic success', async () => {
		for (const status of [401, 429, 503]) {
			const { client, requests } = harness({ message: 'provider failure' }, undefined, status)
			await rejection(
				client.updateCatalogItemMedia({
					validate_only: false,
					catalog_items_to_update: [
						{ supplier_part_number: 'PART', media_type: 'IMAGE', action: 'DELETE', asset_id: 'asset' }
					]
				})
			)
			await rejection(
				client.updateCatalogItems({
					market_context: market,
					validate_only: false,
					catalog_items_to_update: [{ supplier_part_number: 'PART', item_name: 'New name' }]
				})
			)
			await rejection(
				client.updateCatalogItemGroups({
					market_context: market,
					validate_only: false,
					catalog_item_groups_to_update: [{ item_group_id: 'group', feature_bullets: [] }]
				})
			)
			expect(requests).toHaveLength(3)
		}
		const { client, requests } = harness({
			data: { updateCatalogEntitiesMutations: null },
			errors: [{ message: 'secret-echo' }]
		})
		const error = await rejection(
			client.updateCatalogItems({ market_context: market, validate_only: true, catalog_items_to_update: [] })
		)
		expect(error.code).toBe('upstream')
		expect(JSON.stringify(error)).not.toContain('secret-echo')
		expect(requests).toHaveLength(1)
	})

	test('rejects absent mutation request IDs instead of claiming applied changes', async () => {
		const { client } = harness({ data: { updateCatalogEntitiesMutations: { updateCatalogItemsMedia: null } } })
		expect(
			(await rejection(client.updateCatalogItemMedia({ validate_only: true, catalog_items_to_update: [] }))).code
		).toBe('upstream')
	})

	test('shipping document guard normalizes media type and rejects empty bytes', async () => {
		for (const response of [
			new Response('', { headers: { 'content-type': 'application/pdf' } }),
			new Response('<html>error</html>', { headers: { 'content-type': 'Text/HTML; charset=UTF-8' } }),
			new Response('{}', { headers: { 'content-type': 'Application/JSON' } })
		]) {
			const client = new WayfairClient(auth, {
				fetch: async (input, init) => {
					const request = new Request(input, init)
					return new URL(request.url).pathname === '/oauth/token'
						? Response.json({ access_token: 'access', expires_in: 900 })
						: response
				}
			})
			expect((await rejection(client.downloadPackingSlipBytes({ po_number: 'CS123', max_bytes: 100 }))).code).toBe(
				'upstream'
			)
		}
	})
})
