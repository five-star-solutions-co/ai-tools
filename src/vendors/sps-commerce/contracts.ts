import { z } from 'zod'

import { artifactsAuthSchema, MAX_ARTIFACT_READ_BYTES } from '../../modules/artifacts/contracts'
import { artifactRefSchema } from '../../shared/artifact'

/** SPS limits; artifact-backed operations also obey the artifact backend's lower bound. */
export const SPS_TRANSACTION_MAX_BYTES = 2_000_000_000
export const SPS_RENDER_MAX_BYTES = 8_000_000

const credential = z
	.string()
	.min(1)
	.regex(/^[^\r\n]+$/)
export const spsCommerceRuntimeSchema = z.object({
	artifacts: artifactsAuthSchema.optional().describe('Optional host-bound artifact backend'),
	document_origins: z
		.array(
			z
				.string()
				.url()
				.refine((value) => {
					const url = new URL(value)
					return url.protocol === 'https:' && url.origin === value && !url.username && !url.password
				}, 'Document origins must be bare HTTPS origins')
		)
		.optional()
		.describe('Host-approved origins for generated batch documents; no origins are allowed by default')
})
export type SpsCommerceRuntime = z.infer<typeof spsCommerceRuntimeSchema>

export const spsCommerceAuthSchema = z.union([
	z.strictObject({ access_token: credential.describe('Host-managed SPS bearer token') }),
	z.strictObject({
		client_id: credential.describe('SPS machine-to-machine client ID'),
		client_secret: credential.describe('SPS machine-to-machine client secret')
	})
])
export type SpsCommerceAuth = z.infer<typeof spsCommerceAuthSchema>

export const spsJsonObjectSchema = z.record(z.string(), z.json())
export type SpsJsonObject = z.infer<typeof spsJsonObjectSchema>

const pathSchema = z.string().refine((value) => {
	if (/[%\\?#:]/.test(value) || value.startsWith('//')) return false
	for (let index = 0; index < value.length; index += 1) {
		const code = value.charCodeAt(index)
		if (code < 32 || code === 127) return false
	}
	const path = value.startsWith('/') ? value.slice(1) : value
	const segments = path.split('/')
	if (segments.at(-1) === '') segments.pop()
	return segments.every((segment) => segment !== '' && segment !== '.' && segment !== '..')
}, 'Use a plain SPS path without traversal, escaping, query, or origin')
export const spsFilePathSchema = pathSchema
	.refine((value) => value.length > 0 && !value.endsWith('/'), 'A file path must name a file')
	.describe('Case-sensitive SPS file path, for example /out/document.xml; never deleted by a read')
export const spsDirectoryPathSchema = pathSchema
	.refine((value) => value === '' || value.endsWith('/'), 'Directory paths must end with /')
	.describe('Case-sensitive SPS directory ending with /; empty string or / means root')
const idSchema = z
	.string()
	.min(1)
	.regex(/^[A-Za-z0-9_-]+$/)
	.describe('SPS resource identifier')
const maxBytesSchema = z.int().min(1).max(MAX_ARTIFACT_READ_BYTES).describe('Maximum bytes to read or store')
const destinationSchema = z.string().min(1).max(1024).describe('Destination artifact key')

export const spsListTransactionsInputSchema = z.strictObject({
	path: spsDirectoryPathSchema,
	limit: z.int().min(1).max(1000).optional().describe('Maximum entries on this page; SPS defaults to 1000'),
	cursor: z.string().optional().describe('Opaque cursor from paging.next.cursor'),
	entryNamePrefix: z.string().optional().describe('Case-sensitive file or directory name prefix')
})
export const spsTransactionFileInputSchema = z.strictObject({ path: spsFilePathSchema })
export const spsReadTransactionBytesInputSchema = spsTransactionFileInputSchema.extend({
	max_bytes: maxBytesSchema
})
export const spsReadTransactionInputSchema = spsReadTransactionBytesInputSchema.extend({
	destination: destinationSchema
})
export const spsTransactionMetadataSchema = z
	.record(z.string().regex(/^[A-Za-z0-9_-]+$/), z.string().regex(/^[^\r\n]*$/))
	.describe('Optional upload metadata; each key becomes an sps-meta- header')
export const spsUploadTransactionInputSchema = spsTransactionFileInputSchema.extend({
	source: artifactRefSchema.describe('Artifact containing the exact transaction bytes'),
	max_bytes: maxBytesSchema,
	metadata: spsTransactionMetadataSchema.optional()
})
export const spsUploadTransactionBytesInputSchema = spsTransactionFileInputSchema.extend({
	bytes: z.custom<Uint8Array>((value) => value instanceof Uint8Array, 'Expected Uint8Array'),
	metadata: spsTransactionMetadataSchema.optional()
})
const historyTime = z.iso
	.datetime({ local: true })
	.refine((value) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value))
	.describe('SPS timestamp in YYYY-MM-DDTHH:mm:ss format without a timezone suffix')
export const spsTransactionHistoryInputSchema = z.strictObject({
	limit: z.int().min(1).optional().describe('Requested page size; SPS defaults to 100'),
	offset: z.int().min(0).optional().describe('SPS offset; preserve returned paging links'),
	after: historyTime.optional(),
	until: historyTime.optional()
})
export const spsTransactionEntrySchema = z.looseObject({
	path: z.string(),
	type: z.enum(['file', 'directory']),
	url: z.string()
})
export const spsTransactionPagingSchema = z.looseObject({
	limit: z.number().optional(),
	offset: z.number().optional(),
	total_count: z.number().optional(),
	next: z.looseObject({ cursor: z.string().optional(), url: z.string() }).nullish(),
	previous: z.looseObject({ url: z.string() }).nullish()
})
export const spsListTransactionsOutputSchema = z.looseObject({
	results: z.array(spsTransactionEntrySchema).nullable(),
	paging: spsTransactionPagingSchema.nullish()
})
export const spsUploadTransactionOutputSchema = z.looseObject({ path: z.string(), url: z.string() })
export const spsDeleteTransactionOutputSchema = z.object({ deleted: z.literal(true) })
/** Public history examples do not establish a complete item schema. Keep native report fields. */
export const spsTransactionHistoryOutputSchema = z.looseObject({
	results: z.array(spsJsonObjectSchema).nullable(),
	paging: spsTransactionPagingSchema.nullish()
})
export const spsArtifactOutputSchema = z.object({ artifact: artifactRefSchema })

export const spsListTemplatesInputSchema = z.strictObject({
	newest: z.boolean().optional().describe('Return newest templates first'),
	limit: z.int().min(1).optional().describe('Maximum templates on this page'),
	offset: z.int().min(0).optional().describe('Zero-based page offset'),
	name: z.string().optional().describe('Template name contains this text'),
	name__EQ: z.string().optional().describe('Exact template name match'),
	ownerName: z.string().optional().describe('Owner name contains this text'),
	ownerName__EQ: z.string().optional().describe('Exact owner name match'),
	ownerID: z.string().optional().describe('Owner identifier contains this text'),
	ownerID__EQ: z.string().optional().describe('Exact owner identifier match'),
	canRender: z.boolean().optional().describe('Filter by permission to render actual documents')
})
export const spsTemplateInputSchema = z.strictObject({
	id: idSchema.describe('Label or packing-slip template identifier')
})
export const spsTemplateSchemaInputSchema = spsTemplateInputSchema.extend({
	download: z.boolean().optional().describe('Ask SPS to attach the schema to its response'),
	pretty: z.boolean().optional().describe('Request pretty-printed JSON'),
	pendingChange: z.boolean().optional().describe('Retrieve upcoming retailer requirements')
})
export const spsTemplateSchema = z.looseObject({
	id: z.string(),
	name: z.string(),
	canRender: z.boolean(),
	description: z.string().nullable().optional(),
	ownerID: z.string().optional(),
	ownerName: z.string().optional(),
	type: z.string().optional()
})
export const spsListTemplatesOutputSchema = z.looseObject({
	status: z.string(),
	templates: z.array(spsTemplateSchema).nullable()
})
const perPage = z
	.union([z.literal(1), z.literal(4)])
	.optional()
	.describe('One or four labels per page')
const pendingChange = z.boolean().optional().describe('Use upcoming retailer template requirements')
export const spsSamplePackingSlipBytesInputSchema = spsTemplateInputSchema.extend({
	sample_uid: idSchema.optional().describe('Specific template sample; omitted selects the default sample'),
	pendingChange,
	max_bytes: maxBytesSchema
})
export const spsSampleLabelBytesInputSchema = spsSamplePackingSlipBytesInputSchema.extend({ perPage })
export const spsSamplePackingSlipInputSchema = spsSamplePackingSlipBytesInputSchema.extend({
	destination: destinationSchema
})
export const spsSampleLabelInputSchema = spsSampleLabelBytesInputSchema.extend({ destination: destinationSchema })

const renderData = spsJsonObjectSchema.describe(
	'Exact template-specific JSON. Retrieve the template schema and sample first; SPS validates retailer requirements'
)
const labelControls = {
	perPage,
	pendingChange,
	startPackCount: z.int().min(1).optional().describe('Pack number printed on the first label'),
	totalPackCount: z.int().min(1).optional().describe('Total pack count across the shipment'),
	collate: z.boolean().optional().describe('Collate multiple copies'),
	copies: z.int().min(1).optional().describe('Number of copies'),
	pages: z.array(z.int().min(1)).min(1).optional().describe('One-based pages to include, for example [2,5]')
}
const zplControls = {
	mediaType: z.enum(['T', 'D']).optional().describe('Thermal transfer (T) or direct thermal (D) media'),
	printMode: z
		.enum(['T', 'P', 'R', 'A', 'C', 'D', 'F', 'L', 'U', 'K'])
		.optional()
		.describe('ZPL printer action: tear, peel, rewind, applicator, cutter, delayed cutter, RFID, reserved, or kiosk'),
	dpi: z
		.union([z.literal(152), z.literal(203), z.literal(300), z.literal(600)])
		.optional()
		.describe('Printer DPI; 600 requires DY'),
	zplCommand: z.enum(['DG', 'DY', 'GFA']).optional().describe('ZPL graphics algorithm supported by the printer')
}
export const spsRenderLabelPdfBytesInputSchema = spsTemplateInputSchema.extend({
	data: renderData,
	...labelControls,
	max_bytes: maxBytesSchema
})
export const spsRenderLabelZplBytesInputSchema = spsRenderLabelPdfBytesInputSchema.extend(zplControls)
export const spsRenderPackingSlipPdfBytesInputSchema = spsTemplateInputSchema.extend({
	data: renderData,
	pendingChange,
	max_bytes: maxBytesSchema
})
export const spsRenderLabelPdfInputSchema = spsRenderLabelPdfBytesInputSchema.extend({ destination: destinationSchema })
export const spsRenderLabelZplInputSchema = spsRenderLabelZplBytesInputSchema.extend({ destination: destinationSchema })
export const spsRenderPackingSlipPdfInputSchema = spsRenderPackingSlipPdfBytesInputSchema.extend({
	destination: destinationSchema
})
export const spsCreateLabelPdfBatchInputSchema = spsTemplateInputSchema.extend({
	data: renderData,
	...labelControls,
	asyncValidation: z.boolean().optional().describe('Validate asynchronously; acceptance is not successful completion')
})
export const spsCreateLabelZplBatchInputSchema = spsCreateLabelPdfBatchInputSchema.extend(zplControls)
export const spsLabelBatchInputSchema = z.strictObject({ batch_id: idSchema.describe('Label render batch identifier') })
export const spsLabelBatchBytesInputSchema = spsLabelBatchInputSchema.extend({ max_bytes: maxBytesSchema })
export const spsLabelBatchResultInputSchema = spsLabelBatchBytesInputSchema.extend({ destination: destinationSchema })
export const spsCreateLabelBatchOutputSchema = z.looseObject({ batchId: z.string().min(1), statusURL: z.string() })
export const spsLabelBatchStatusSchema = z.looseObject({
	batchId: z.string().min(1),
	status: z.enum(['In Progress', 'Completed', 'Failed']),
	ownerName: z.string().nullish(),
	responseType: z.string().nullish(),
	resultURL: z.string().nullish(),
	failureDescription: z.string().nullish(),
	validationErrors: z.array(z.json()).nullish()
})
/** Model-safe status excludes expiring, signed document access URLs. */
export const spsLabelBatchStatusOutputSchema = z.object({
	batchId: z.string(),
	status: z.enum(['In Progress', 'Completed', 'Failed']),
	ownerName: z.string().nullish(),
	responseType: z.string().nullish(),
	failureDescription: z.string().nullish(),
	validationErrors: z.array(z.json()).nullish()
})
export const spsZplDataSchema = z.object({ zplData: z.array(z.string()) })
export const spsListSubmissionFormsInputSchema = z.strictObject({
	limit: z.int().min(1).max(50).optional().describe('Forms per page; SPS defaults to 1'),
	offset: z.int().min(0).optional().describe('Number of forms to skip; SPS defaults to 0')
})
export const spsSubmissionFormInputSchema = z.strictObject({ id: idSchema.describe('Submission form identifier') })

export type SpsListTransactionsInput = z.infer<typeof spsListTransactionsInputSchema>
export type SpsTransactionFileInput = z.infer<typeof spsTransactionFileInputSchema>
export type SpsReadTransactionBytesInput = z.infer<typeof spsReadTransactionBytesInputSchema>
export type SpsReadTransactionInput = z.infer<typeof spsReadTransactionInputSchema>
export type SpsUploadTransactionInput = z.infer<typeof spsUploadTransactionInputSchema>
export type SpsUploadTransactionBytesInput = z.infer<typeof spsUploadTransactionBytesInputSchema>
export type SpsTransactionHistoryInput = z.infer<typeof spsTransactionHistoryInputSchema>
export type SpsListTemplatesInput = z.infer<typeof spsListTemplatesInputSchema>
export type SpsTemplateInput = z.infer<typeof spsTemplateInputSchema>
export type SpsTemplateSchemaInput = z.infer<typeof spsTemplateSchemaInputSchema>
export type SpsSampleLabelBytesInput = z.infer<typeof spsSampleLabelBytesInputSchema>
export type SpsSampleLabelInput = z.infer<typeof spsSampleLabelInputSchema>
export type SpsSamplePackingSlipBytesInput = z.infer<typeof spsSamplePackingSlipBytesInputSchema>
export type SpsSamplePackingSlipInput = z.infer<typeof spsSamplePackingSlipInputSchema>
export type SpsRenderLabelPdfBytesInput = z.infer<typeof spsRenderLabelPdfBytesInputSchema>
export type SpsRenderLabelPdfInput = z.infer<typeof spsRenderLabelPdfInputSchema>
export type SpsRenderLabelZplBytesInput = z.infer<typeof spsRenderLabelZplBytesInputSchema>
export type SpsRenderLabelZplInput = z.infer<typeof spsRenderLabelZplInputSchema>
export type SpsRenderPackingSlipPdfBytesInput = z.infer<typeof spsRenderPackingSlipPdfBytesInputSchema>
export type SpsRenderPackingSlipPdfInput = z.infer<typeof spsRenderPackingSlipPdfInputSchema>
export type SpsCreateLabelPdfBatchInput = z.infer<typeof spsCreateLabelPdfBatchInputSchema>
export type SpsCreateLabelZplBatchInput = z.infer<typeof spsCreateLabelZplBatchInputSchema>
export type SpsLabelBatchInput = z.infer<typeof spsLabelBatchInputSchema>
export type SpsLabelBatchBytesInput = z.infer<typeof spsLabelBatchBytesInputSchema>
export type SpsLabelBatchResultInput = z.infer<typeof spsLabelBatchResultInputSchema>
export type SpsListSubmissionFormsInput = z.infer<typeof spsListSubmissionFormsInputSchema>
export type SpsSubmissionFormInput = z.infer<typeof spsSubmissionFormInputSchema>

// Community Submission API 1.0.0: full nested public OpenAPI contracts.
const contactEmail = z
	.string()
	.min(5)
	.max(254)
	.regex(/^[a-zA-Z0-9+._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+$/)
export const spsAgreementContactSchema = z.strictObject({
	firstName: z.string().min(1).max(50).describe('Business contact first name'),
	lastName: z.string().min(1).max(75).describe('Business contact last name'),
	email: contactEmail.describe('Business contact email address'),
	phone: z.string().min(1).max(40).nullish().describe('Business contact telephone number'),
	title: z.string().min(1).max(254).nullish().describe('Business contact job title')
})
export const spsThirdPartyContactSchema = z.strictObject({
	tpInvolvementType: z.enum(['Broker', "Agent/Manufacturer's Rep"]).nullish().describe('Third-party involvement type'),
	tpInvolvementFirstName: z
		.string()
		.min(1)
		.max(50)
		.nullable()
		.describe('Third-party first name; required but nullable'),
	tpInvolvementLastName: z.string().min(1).max(75).describe('Third-party last name'),
	tpInvolvementEmail: contactEmail.nullish().describe('Third-party email'),
	tpInvolvementPhone: z.string().min(1).max(40).nullish().describe('Third-party telephone number'),
	tpInvolvementCompanyName: z.string().min(1).max(75).nullish().describe('Third-party company name')
})
export const spsTradingPartnerLocationSchema = z.strictObject({
	address: z.string().min(1).max(255).nullish().describe('Trading partner street address'),
	city: z.string().min(1).max(40).nullish().describe('Trading partner city'),
	state: z.string().min(1).max(50).nullish().describe('Trading partner state or province'),
	zipCode: z.string().min(5).max(25).nullish().describe('Trading partner postal code')
})
export const spsIncludedDataExchangesSchema = z
	.strictObject({
		salesData: z.boolean().nullish().describe('Include sales data exchange supported by the chosen form'),
		item: z.boolean().nullish().describe('Include item exchange supported by the chosen form'),
		order: z.boolean().nullish().describe('Include order exchange supported by the chosen form'),
		itemAndOrder: z
			.boolean()
			.nullish()
			.describe('Include combined item and order exchange supported by the chosen form')
	})
	.refine((value) => Object.values(value).some((included) => included === true), 'Select at least one data exchange')
export const spsFulfillmentModelSchema = z.enum([
	'Consignment',
	'Direct Store Delivery',
	'Imports',
	'Scan-Based Trading',
	'Scan Based Trading/Concessions',
	'Ship Direct to Business',
	'Ship Direct to Customer',
	'Ship to DC',
	'Ship to DC - Cross Dock',
	'Ship to DC/Store',
	'Ship to DC/Store - Blanket and Release',
	'Ship to Multiple Stores',
	'Ship to Store',
	'Ship to Facility',
	'Ship to Facility - Blanket and Release',
	'Supplier Direct to Business',
	'Supplier Direct to Customer (Dropship)',
	'Third Party Marketplace',
	'Transportation - North America Collect',
	'Transportation - North America Prepaid',
	'Vendor Managed Inventory',
	'Vendor Managed Inventory (VMI)',
	'Ship to 3PL'
])
export const spsFulfillmentModelsSchema = z.strictObject({
	consignmentDocs: z.array(z.string()).nullish().describe('Consignment documents enabled by the chosen form'),
	directStoreDeliveryDocs: z
		.array(z.string())
		.nullish()
		.describe('Direct Store Delivery documents enabled by the chosen form'),
	importsDocs: z.array(z.string()).nullish().describe('Imports documents enabled by the chosen form'),
	scanBasedTradingDocs: z
		.array(z.string())
		.nullish()
		.describe('Scan-Based Trading documents enabled by the chosen form'),
	scanBasedTradingConcessionsDocs: z
		.array(z.string())
		.nullish()
		.describe('Scan Based Trading/Concessions documents enabled by the chosen form'),
	shipDirectToBusinessDocs: z
		.array(z.string())
		.nullish()
		.describe('Ship Direct to Business documents enabled by the chosen form'),
	shipDirectToConsumerDocs: z
		.array(z.string())
		.nullish()
		.describe('Ship Direct to Customer documents enabled by the chosen form'),
	shipToDcDocs: z.array(z.string()).nullish().describe('Ship to DC documents enabled by the chosen form'),
	shipToDcCrossDockDocs: z
		.array(z.string())
		.nullish()
		.describe('Ship to DC - Cross Dock documents enabled by the chosen form'),
	shipToDcStoreDocs: z.array(z.string()).nullish().describe('Ship to DC/Store documents enabled by the chosen form'),
	shipToDcStoreBlanketAndReleaseDocs: z
		.array(z.string())
		.nullish()
		.describe('Ship to DC/Store - Blanket and Release documents enabled by the chosen form'),
	shipToMultipleStoresDocs: z
		.array(z.string())
		.nullish()
		.describe('Ship to Multiple Stores documents enabled by the chosen form'),
	shipToStoreDocs: z.array(z.string()).nullish().describe('Ship to Store documents enabled by the chosen form'),
	shipToFacilityDocs: z.array(z.string()).nullish().describe('Ship to Facility documents enabled by the chosen form'),
	shipToFacilityBlanketAndReleaseDocs: z
		.array(z.string())
		.nullish()
		.describe('Ship to Facility - Blanket and Release documents enabled by the chosen form'),
	supplierDirectToBusinessDocs: z
		.array(z.string())
		.nullish()
		.describe('Supplier Direct to Business documents enabled by the chosen form'),
	supplierDirectToCustomerDropshipDocs: z
		.array(z.string())
		.nullish()
		.describe('Supplier Direct to Customer (Dropship) documents enabled by the chosen form'),
	thirdPartyMarketplaceDocs: z
		.array(z.string())
		.nullish()
		.describe('Third Party Marketplace documents enabled by the chosen form'),
	transportationNorthAmericaCollectDocs: z
		.array(z.string())
		.nullish()
		.describe('Transportation - North America Collect documents enabled by the chosen form'),
	transportationNorthAmericaPrepaidDocs: z
		.array(z.string())
		.nullish()
		.describe('Transportation - North America Prepaid documents enabled by the chosen form'),
	vendorManagementInventoryDocs: z
		.array(z.string())
		.nullish()
		.describe('Vendor Managed Inventory documents enabled by the chosen form'),
	vendorManagementInventoryVmiDocs: z
		.array(z.string())
		.nullish()
		.describe('Vendor Managed Inventory (VMI) documents enabled by the chosen form'),
	shipTo3PLDocs: z.array(z.string()).nullish().describe('Ship to 3PL documents enabled by the chosen form'),
	exemptDocuments: z.string().nullish().describe('Exempt documents enabled by the chosen form'),
	exemptedFulfillmentModels: z
		.array(spsFulfillmentModelSchema)
		.nullish()
		.describe('Exempt fulfillment models enabled by the chosen form')
})
export const spsCreateTradingPartnersInputSchema = z.strictObject({
	submissionFormId: z.string().min(1).max(15).describe('Chosen submission form identifier'),
	tradingPartnerName: z.string().min(1).max(75).describe('Trading partner company name'),
	tradingPartnerId: z.string().min(1).max(75).describe('Primary trading partner identifier'),
	country: z.string().length(3).describe('ISO 3166 alpha-3 country code'),
	businessContact: spsAgreementContactSchema.describe('Primary business contact'),
	tpInvolvementContact: spsThirdPartyContactSchema.nullish().describe('Optional third-party contact'),
	tradingPartnerId2: z.string().min(1).max(75).nullish().describe('Additional trading partner identifier 2'),
	tradingPartnerId3: z.string().min(1).max(75).nullish().describe('Additional trading partner identifier 3'),
	tradingPartnerId4: z.string().min(1).nullish().describe('Additional trading partner identifier 4'),
	tradingPartnerId5: z.string().min(1).max(75).nullish().describe('Additional trading partner identifier 5'),
	tradingPartnerId6: z.string().min(1).max(75).nullish().describe('Additional trading partner identifier 6'),
	tradingPartnerId7: z.string().min(1).max(75).nullish().describe('Additional trading partner identifier 7'),
	tradingPartnerId8: z.string().min(1).max(75).nullish().describe('Additional trading partner identifier 8'),
	tradingPartnerId9: z.string().min(1).max(75).nullish().describe('Additional trading partner identifier 9'),
	tradingPartnerId10: z.string().min(1).max(75).nullish().describe('Additional trading partner identifier 10'),
	purchaseOrderDollars: z.number().min(0).nullish().describe('purchaseOrderDollars'),
	purchaseOrderCount: z.int().min(0).nullish().describe('purchaseOrderCount'),
	existingActiveItemSkuCount: z.int().min(0).nullish().describe('existingActiveItemSkuCount'),
	newItemSetupSkuCount: z.int().min(0).nullish().describe('newItemSetupSkuCount'),
	buyerName: z.string().min(1).max(75).nullish().describe('Buyer full name'),
	buyerEmail: contactEmail.nullish().describe('Buyer email address'),
	brandDivision: z.string().min(1).max(255).nullish().describe('Trading partner brand or division'),
	tradingPartnerLocation: spsTradingPartnerLocationSchema.nullish().describe('Trading partner address'),
	anticipatedFirstOrderDate: z.iso.date().nullish().describe('Anticipated first order date, YYYY-MM-DD'),
	commitmentDeadlineDate: z.iso.date().nullish().describe('Commitment deadline, YYYY-MM-DD'),
	productionReadyDeadlineDate: z.iso.date().nullish().describe('Production readiness deadline, YYYY-MM-DD'),
	carrierService: z.boolean().nullish().describe('Whether additional carrier service is required'),
	implementationNotes: z.string().min(1).max(32000).nullish().describe('Plain-text implementation notes'),
	generalNotes: z.string().min(1).max(32000).nullish().describe('Plain-text general notes'),
	includedDataExchanges: spsIncludedDataExchangesSchema.describe('Data exchanges enabled by the chosen form'),
	fulfillmentModels: spsFulfillmentModelsSchema
		.optional()
		.describe('Fulfillment options and documents enabled by the chosen form'),
	vendorSourcedBySps: z.boolean().nullish().describe('Whether the vendor was sourced by SPS'),
	uniqueSupplierGroups: z.array(z.string()).nullish().describe('Unique supplier group values'),
	sponsoredSolution: z.boolean().nullish().describe('Whether this is a retailer-sponsored solution')
})
export type SpsCreateTradingPartnersInput = z.infer<typeof spsCreateTradingPartnersInputSchema>
export const spsCreateTradingPartnersOutputSchema = z.object({
	tradingPartnerName: z.string(),
	createdTradingPartners: z.array(z.object({ solution: z.string(), id: z.string() }))
})
export const spsAvailableSubmissionFormFieldsSchema = z.looseObject({
	purchaseOrderDollars: z.boolean(),
	purchaseOrderCount: z.boolean(),
	existingActiveItemSkuCount: z.boolean(),
	newItemSetupSkuCount: z.boolean(),
	brandDivision: z.boolean(),
	anticipatedFirstOrderDate: z.boolean(),
	commitmentDeadlineDate: z.boolean(),
	productionReadyDeadlineDate: z.boolean(),
	carrierService: z.boolean(),
	implementationNotes: z.boolean(),
	generalNotes: z.boolean(),
	vendorSourcedBySps: z.boolean(),
	consignment: z.boolean(),
	consignmentDocs: z.array(z.string()),
	directStoreDelivery: z.boolean(),
	directStoreDeliveryDocs: z.array(z.string()),
	imports: z.boolean(),
	importsDocs: z.array(z.string()),
	scanBasedTrading: z.boolean(),
	scanBasedTradingDocs: z.array(z.string()),
	scanBasedTradingConcessions: z.boolean(),
	scanBasedTradingConcessionsDocs: z.array(z.string()),
	shipDirectToBusiness: z.boolean(),
	shipDirectToBusinessDocs: z.array(z.string()),
	shipDirectToConsumer: z.boolean(),
	shipDirectToConsumerDocs: z.array(z.string()),
	shipToDc: z.boolean(),
	shipToDcDocs: z.array(z.string()),
	shipToDcCrossDock: z.boolean(),
	shipToDcCrossDockDocs: z.array(z.string()),
	shipToDcStore: z.boolean(),
	shipToDcStoreDocs: z.array(z.string()),
	shipToDcStoreBlanketAndRelease: z.boolean(),
	shipToDcStoreBlanketAndReleaseDocs: z.array(z.string()),
	shipToMultipleStores: z.boolean(),
	shipToMultipleStoresDocs: z.array(z.string()),
	shipToStore: z.boolean(),
	shipToStoreDocs: z.array(z.string()),
	shipToFacility: z.boolean(),
	shipToFacilityDocs: z.array(z.string()),
	shipToFacilityBlanketAndRelease: z.boolean(),
	shipToFacilityBlanketAndReleaseDocs: z.array(z.string()),
	supplierDirectToBusiness: z.boolean(),
	supplierDirectToBusinessDocs: z.array(z.string()),
	supplierDirectToCustomerDropship: z.boolean(),
	supplierDirectToCustomerDropshipDocs: z.array(z.string()),
	thirdPartyMarketplace: z.boolean(),
	thirdPartyMarketplaceDocs: z.array(z.string()),
	transportationNorthAmericaCollect: z.boolean(),
	transportationNorthAmericaCollectDocs: z.array(z.string()),
	transportationNorthAmericaPrepaid: z.boolean(),
	transportationNorthAmericaPrepaidDocs: z.array(z.string()),
	vendorManagementInventory: z.boolean(),
	vendorManagementInventoryDocs: z.array(z.string()),
	vendorManagementInventoryVmi: z.boolean(),
	vendorManagementInventoryVmiDocs: z.array(z.string()),
	shipTo3PL: z.boolean(),
	shipTo3PLDocs: z.array(z.string()),
	exemptedDocuments: z.boolean(),
	exemptedFulfillmentModels: z.boolean(),
	uniqueSupplierGroups: z.boolean()
})
export const spsSubmissionFormSchema = z.looseObject({
	id: z.string(),
	name: z.string(),
	description: z.string().nullable(),
	retailerInstructions: z.string().nullable(),
	createdDateTime: z.iso.datetime({ offset: true }),
	modifiedDateTime: z.iso.datetime({ offset: true }).nullable(),
	availableFields: spsAvailableSubmissionFormFieldsSchema,
	includedSalesDataDataExchange: z.boolean(),
	salesDataCampaignId: z.string().nullable(),
	salesDataCampaignName: z.string().nullable(),
	salesDataTradingPartnerSource: z.string().nullable(),
	salesDataDefaultSelection: z.boolean(),
	includedItemDataExchange: z.boolean(),
	itemCampaignId: z.string().nullable(),
	itemCampaignName: z.string().nullable(),
	itemTradingPartnerSource: z.string().nullable(),
	itemDefaultSelection: z.boolean(),
	includedOrderDataExchange: z.boolean(),
	orderCampaignId: z.string().nullable(),
	orderCampaignName: z.string().nullable(),
	orderTradingPartnerSource: z.string().nullable(),
	orderDefaultSelection: z.boolean(),
	includedItemAndOrderDataExchange: z.boolean(),
	itemAndOrderCampaignId: z.string().nullable(),
	itemAndOrderCampaignName: z.string().nullable(),
	itemAndOrderTradingPartnerSource: z.string().nullable(),
	itemAndOrderDefaultSelection: z.boolean(),
	sponsoredSolution: z.boolean(),
	sponsoredSolutionDefaultSelection: z.boolean()
})
export const spsListSubmissionFormsOutputSchema = z.object({
	results: z.array(spsSubmissionFormSchema),
	paging: z.object({ totalCount: z.int(), limit: z.int(), offset: z.int() })
})
