import { defineModule, defineTool } from '../../core/define'
import { SpsCommerceClient } from './client'
import * as c from './contracts'

export const spsCommerceListTransactionsTool = defineTool({
	id: 'sps-commerce-list-transactions',
	name: 'spsCommerceListTransactions',
	description:
		'List one page of SPS transaction files and directories. Preserve the cursor for the next page; no deletion.',
	inputSchema: c.spsListTransactionsInputSchema,
	outputSchema: c.spsListTransactionsOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	network: true,
	supportsCancel: true,
	idempotent: true,
	requiresConfirmation: false,
	artifacts: false,
	execute: async (input, ctx) => SpsCommerceClient.fromContext(ctx).listTransactions(input)
})

export const spsCommerceUploadTransactionTool = defineTool({
	id: 'sps-commerce-upload-transaction',
	name: 'spsCommerceUploadTransaction',
	description:
		'Upload exact artifact bytes to SPS. The same file path overwrites existing data; never automatically replay an uncertain upload.',
	inputSchema: c.spsUploadTransactionInputSchema,
	outputSchema: c.spsUploadTransactionOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	network: true,
	supportsCancel: true,
	idempotent: false,
	requiresConfirmation: true,
	artifacts: true,
	execute: async (input, ctx) => SpsCommerceClient.fromContext(ctx).uploadTransaction(input)
})

export const spsCommerceReadTransactionTool = defineTool({
	id: 'sps-commerce-read-transaction',
	name: 'spsCommerceReadTransaction',
	description:
		'Read one SPS transaction into an artifact within the requested byte limit. Does not delete the file or accept a business order.',
	inputSchema: c.spsReadTransactionInputSchema,
	outputSchema: c.spsArtifactOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	network: true,
	supportsCancel: true,
	idempotent: false,
	requiresConfirmation: false,
	artifacts: true,
	execute: async (input, ctx) => SpsCommerceClient.fromContext(ctx).readTransaction(input)
})

export const spsCommerceDeleteTransactionTool = defineTool({
	id: 'sps-commerce-delete-transaction',
	name: 'spsCommerceDeleteTransaction',
	description:
		'Explicitly delete an SPS transaction file after successful processing. This removes the remote file, not a business-order acceptance.',
	inputSchema: c.spsTransactionFileInputSchema,
	outputSchema: c.spsDeleteTransactionOutputSchema,
	sideEffect: 'delete',
	runtime: 'both',
	network: true,
	supportsCancel: true,
	idempotent: false,
	requiresConfirmation: true,
	artifacts: false,
	execute: async (input, ctx) => SpsCommerceClient.fromContext(ctx).deleteTransaction(input)
})

export const spsCommerceListTransactionHistoryTool = defineTool({
	id: 'sps-commerce-list-transaction-history',
	name: 'spsCommerceListTransactionHistory',
	description:
		'Read one page of SPS file processing history. Reports may lag transfers by five minutes; preserve native paging links.',
	inputSchema: c.spsTransactionHistoryInputSchema,
	outputSchema: c.spsTransactionHistoryOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	network: true,
	supportsCancel: true,
	idempotent: true,
	requiresConfirmation: false,
	artifacts: false,
	execute: async (input, ctx) => SpsCommerceClient.fromContext(ctx).listTransactionHistory(input)
})

export const spsCommerceListLabelsTool = defineTool({
	id: 'sps-commerce-list-labels',
	name: 'spsCommerceListLabels',
	description:
		'List one page of SPS shipping-label templates, optionally filtering names, owners, or rendering permission.',
	inputSchema: c.spsListTemplatesInputSchema,
	outputSchema: c.spsListTemplatesOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	network: true,
	supportsCancel: true,
	idempotent: true,
	requiresConfirmation: false,
	artifacts: false,
	execute: async (input, ctx) => SpsCommerceClient.fromContext(ctx).listLabels(input)
})

export const spsCommerceGetLabelTool = defineTool({
	id: 'sps-commerce-get-label',
	name: 'spsCommerceGetLabel',
	description: 'Read an SPS shipping-label template, including rendering permission and native version metadata.',
	inputSchema: c.spsTemplateInputSchema,
	outputSchema: c.spsTemplateSchema,
	sideEffect: 'read',
	runtime: 'both',
	network: true,
	supportsCancel: true,
	idempotent: true,
	requiresConfirmation: false,
	artifacts: false,
	execute: async (input, ctx) => SpsCommerceClient.fromContext(ctx).getLabel(input)
})

export const spsCommerceGetLabelSchemaTool = defineTool({
	id: 'sps-commerce-get-label-schema',
	name: 'spsCommerceGetLabelSchema',
	description:
		'Retrieve the JSON schema for an SPS label template before preparing render data. Upcoming requirement changes can be requested.',
	inputSchema: c.spsTemplateSchemaInputSchema,
	outputSchema: c.spsJsonObjectSchema,
	sideEffect: 'read',
	runtime: 'both',
	network: true,
	supportsCancel: true,
	idempotent: true,
	requiresConfirmation: false,
	artifacts: false,
	execute: async (input, ctx) => SpsCommerceClient.fromContext(ctx).getLabelSchema(input)
})

export const spsCommerceGetLabelSampleTool = defineTool({
	id: 'sps-commerce-get-label-sample',
	name: 'spsCommerceGetLabelSample',
	description:
		'Retrieve sample JSON for an SPS shipping-label template. Adapt it to the retrieved schema and actual shipment.',
	inputSchema: c.spsTemplateInputSchema,
	outputSchema: c.spsJsonObjectSchema,
	sideEffect: 'read',
	runtime: 'both',
	network: true,
	supportsCancel: true,
	idempotent: true,
	requiresConfirmation: false,
	artifacts: false,
	execute: async (input, ctx) => SpsCommerceClient.fromContext(ctx).getLabelSample(input)
})

export const spsCommerceGetLabelSamplePdfTool = defineTool({
	id: 'sps-commerce-get-label-sample-pdf',
	name: 'spsCommerceGetLabelSamplePdf',
	description:
		'Store a bounded SPS sample-label PDF as an artifact. Select the default sample or a specific sample UID.',
	inputSchema: c.spsSampleLabelInputSchema,
	outputSchema: c.spsArtifactOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	network: true,
	supportsCancel: true,
	idempotent: false,
	requiresConfirmation: false,
	artifacts: true,
	execute: async (input, ctx) => SpsCommerceClient.fromContext(ctx).getLabelSamplePdf(input)
})

export const spsCommerceRenderLabelPdfTool = defineTool({
	id: 'sps-commerce-render-label-pdf',
	name: 'spsCommerceRenderLabelPdf',
	description:
		'Render template-specific shipment JSON into an SPS label PDF artifact. Supports page selection, pack counts, copies, and collation.',
	inputSchema: c.spsRenderLabelPdfInputSchema,
	outputSchema: c.spsArtifactOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	network: true,
	supportsCancel: true,
	idempotent: false,
	requiresConfirmation: false,
	artifacts: true,
	execute: async (input, ctx) => SpsCommerceClient.fromContext(ctx).renderLabelPdf(input)
})

export const spsCommerceRenderLabelZplTool = defineTool({
	id: 'sps-commerce-render-label-zpl',
	name: 'spsCommerceRenderLabelZpl',
	description:
		'Render SPS labels to an artifact containing the native JSON zplData array. Each array element retains its printer commands; no flattening.',
	inputSchema: c.spsRenderLabelZplInputSchema,
	outputSchema: c.spsArtifactOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	network: true,
	supportsCancel: true,
	idempotent: false,
	requiresConfirmation: false,
	artifacts: true,
	execute: async (input, ctx) => SpsCommerceClient.fromContext(ctx).renderLabelZpl(input)
})

export const spsCommerceCreateLabelPdfBatchTool = defineTool({
	id: 'sps-commerce-create-label-pdf-batch',
	name: 'spsCommerceCreateLabelPdfBatch',
	description:
		'Submit an asynchronous SPS PDF label batch. The returned batch identifier means acceptance, not completion; check status separately.',
	inputSchema: c.spsCreateLabelPdfBatchInputSchema,
	outputSchema: c.spsCreateLabelBatchOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	network: true,
	supportsCancel: true,
	idempotent: false,
	requiresConfirmation: false,
	artifacts: false,
	execute: async (input, ctx) => SpsCommerceClient.fromContext(ctx).createLabelPdfBatch(input)
})

export const spsCommerceCreateLabelZplBatchTool = defineTool({
	id: 'sps-commerce-create-label-zpl-batch',
	name: 'spsCommerceCreateLabelZplBatch',
	description:
		'Submit an asynchronous SPS ZPL label batch. Validation may occur later; check the batch status before retrieving results.',
	inputSchema: c.spsCreateLabelZplBatchInputSchema,
	outputSchema: c.spsCreateLabelBatchOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	network: true,
	supportsCancel: true,
	idempotent: false,
	requiresConfirmation: false,
	artifacts: false,
	execute: async (input, ctx) => SpsCommerceClient.fromContext(ctx).createLabelZplBatch(input)
})

export const spsCommerceGetLabelBatchStatusTool = defineTool({
	id: 'sps-commerce-get-label-batch-status',
	name: 'spsCommerceGetLabelBatchStatus',
	description:
		'Read SPS label batch state: In Progress, Completed, or Failed. Preserves validation failures without exposing temporary document links.',
	inputSchema: c.spsLabelBatchInputSchema,
	outputSchema: c.spsLabelBatchStatusOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	network: true,
	supportsCancel: true,
	idempotent: true,
	requiresConfirmation: false,
	artifacts: false,
	execute: async (input, ctx) => SpsCommerceClient.fromContext(ctx).getLabelBatchStatus(input)
})

export const spsCommerceGetLabelBatchResultTool = defineTool({
	id: 'sps-commerce-get-label-batch-result',
	name: 'spsCommerceGetLabelBatchResult',
	description:
		'Store a completed SPS label batch document as a bounded artifact. In-progress or failed batches are not downloadable.',
	inputSchema: c.spsLabelBatchResultInputSchema,
	outputSchema: c.spsArtifactOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	network: true,
	supportsCancel: true,
	idempotent: false,
	requiresConfirmation: false,
	artifacts: true,
	execute: async (input, ctx) => SpsCommerceClient.fromContext(ctx).getLabelBatchResult(input)
})

export const spsCommerceListPackingSlipsTool = defineTool({
	id: 'sps-commerce-list-packing-slips',
	name: 'spsCommerceListPackingSlips',
	description:
		'List one page of SPS packing-slip templates with optional name, owner, and rendering-permission filters.',
	inputSchema: c.spsListTemplatesInputSchema,
	outputSchema: c.spsListTemplatesOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	network: true,
	supportsCancel: true,
	idempotent: true,
	requiresConfirmation: false,
	artifacts: false,
	execute: async (input, ctx) => SpsCommerceClient.fromContext(ctx).listPackingSlips(input)
})

export const spsCommerceGetPackingSlipTool = defineTool({
	id: 'sps-commerce-get-packing-slip',
	name: 'spsCommerceGetPackingSlip',
	description: 'Read an SPS packing-slip template and its native version and rendering-permission metadata.',
	inputSchema: c.spsTemplateInputSchema,
	outputSchema: c.spsTemplateSchema,
	sideEffect: 'read',
	runtime: 'both',
	network: true,
	supportsCancel: true,
	idempotent: true,
	requiresConfirmation: false,
	artifacts: false,
	execute: async (input, ctx) => SpsCommerceClient.fromContext(ctx).getPackingSlip(input)
})

export const spsCommerceGetPackingSlipSchemaTool = defineTool({
	id: 'sps-commerce-get-packing-slip-schema',
	name: 'spsCommerceGetPackingSlipSchema',
	description: 'Retrieve the JSON schema for an SPS packing-slip template before preparing render data.',
	inputSchema: c.spsTemplateSchemaInputSchema,
	outputSchema: c.spsJsonObjectSchema,
	sideEffect: 'read',
	runtime: 'both',
	network: true,
	supportsCancel: true,
	idempotent: true,
	requiresConfirmation: false,
	artifacts: false,
	execute: async (input, ctx) => SpsCommerceClient.fromContext(ctx).getPackingSlipSchema(input)
})

export const spsCommerceGetPackingSlipSampleTool = defineTool({
	id: 'sps-commerce-get-packing-slip-sample',
	name: 'spsCommerceGetPackingSlipSample',
	description:
		'Retrieve sample JSON for an SPS packing-slip template. Use its schema for retailer-specific requirements.',
	inputSchema: c.spsTemplateInputSchema,
	outputSchema: c.spsJsonObjectSchema,
	sideEffect: 'read',
	runtime: 'both',
	network: true,
	supportsCancel: true,
	idempotent: true,
	requiresConfirmation: false,
	artifacts: false,
	execute: async (input, ctx) => SpsCommerceClient.fromContext(ctx).getPackingSlipSample(input)
})

export const spsCommerceGetPackingSlipSamplePdfTool = defineTool({
	id: 'sps-commerce-get-packing-slip-sample-pdf',
	name: 'spsCommerceGetPackingSlipSamplePdf',
	description:
		'Store a bounded SPS sample packing-slip PDF as an artifact, using the default sample or a specific sample UID.',
	inputSchema: c.spsSamplePackingSlipInputSchema,
	outputSchema: c.spsArtifactOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	network: true,
	supportsCancel: true,
	idempotent: false,
	requiresConfirmation: false,
	artifacts: true,
	execute: async (input, ctx) => SpsCommerceClient.fromContext(ctx).getPackingSlipSamplePdf(input)
})

export const spsCommerceRenderPackingSlipPdfTool = defineTool({
	id: 'sps-commerce-render-packing-slip-pdf',
	name: 'spsCommerceRenderPackingSlipPdf',
	description:
		'Render template-specific JSON to an SPS packing-slip PDF artifact. Optional pendingChange uses upcoming retailer requirements.',
	inputSchema: c.spsRenderPackingSlipPdfInputSchema,
	outputSchema: c.spsArtifactOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	network: true,
	supportsCancel: true,
	idempotent: false,
	requiresConfirmation: false,
	artifacts: true,
	execute: async (input, ctx) => SpsCommerceClient.fromContext(ctx).renderPackingSlipPdf(input)
})

export const spsCommerceListSubmissionFormsTool = defineTool({
	id: 'sps-commerce-list-submission-forms',
	name: 'spsCommerceListSubmissionForms',
	description:
		'List one page of SPS Community submission forms, including enabled data exchanges and fulfillment options. Maximum 50 forms per page.',
	inputSchema: c.spsListSubmissionFormsInputSchema,
	outputSchema: c.spsListSubmissionFormsOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	network: true,
	supportsCancel: true,
	idempotent: true,
	requiresConfirmation: false,
	artifacts: false,
	execute: async (input, ctx) => SpsCommerceClient.fromContext(ctx).listSubmissionForms(input)
})

export const spsCommerceGetSubmissionFormTool = defineTool({
	id: 'sps-commerce-get-submission-form',
	name: 'spsCommerceGetSubmissionForm',
	description:
		'Read an SPS Community submission form before selecting data exchanges, fulfillment models, and required supplier details.',
	inputSchema: c.spsSubmissionFormInputSchema,
	outputSchema: c.spsSubmissionFormSchema,
	sideEffect: 'read',
	runtime: 'both',
	network: true,
	supportsCancel: true,
	idempotent: true,
	requiresConfirmation: false,
	artifacts: false,
	execute: async (input, ctx) => SpsCommerceClient.fromContext(ctx).getSubmissionForm(input)
})

export const spsCommerceCreateTradingPartnersTool = defineTool({
	id: 'sps-commerce-create-trading-partners',
	name: 'spsCommerceCreateTradingPartners',
	description:
		'Create trading partners for SPS Community onboarding using a submission form. Include only exchanges and documents enabled by that form; creates remote records.',
	inputSchema: c.spsCreateTradingPartnersInputSchema,
	outputSchema: c.spsCreateTradingPartnersOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	network: true,
	supportsCancel: true,
	idempotent: false,
	requiresConfirmation: true,
	artifacts: false,
	execute: async (input, ctx) => SpsCommerceClient.fromContext(ctx).createTradingPartners(input)
})

export const spsCommerceModule = defineModule({
	id: 'sps-commerce',
	title: 'SPS Commerce',
	description: 'SPS Commerce transaction exchange, shipping labels, packing slips, and Community partner submissions.',
	runtime: 'both',
	auth: { type: 'custom', schema: c.spsCommerceAuthSchema },
	categories: ['commerce', 'documents'],
	classification: 'pii',
	tags: ['edi', 'shipping', 'onboarding'],
	tools: [
		spsCommerceListTransactionsTool,
		spsCommerceUploadTransactionTool,
		spsCommerceReadTransactionTool,
		spsCommerceDeleteTransactionTool,
		spsCommerceListTransactionHistoryTool,
		spsCommerceListLabelsTool,
		spsCommerceGetLabelTool,
		spsCommerceGetLabelSchemaTool,
		spsCommerceGetLabelSampleTool,
		spsCommerceGetLabelSamplePdfTool,
		spsCommerceRenderLabelPdfTool,
		spsCommerceRenderLabelZplTool,
		spsCommerceCreateLabelPdfBatchTool,
		spsCommerceCreateLabelZplBatchTool,
		spsCommerceGetLabelBatchStatusTool,
		spsCommerceGetLabelBatchResultTool,
		spsCommerceListPackingSlipsTool,
		spsCommerceGetPackingSlipTool,
		spsCommerceGetPackingSlipSchemaTool,
		spsCommerceGetPackingSlipSampleTool,
		spsCommerceGetPackingSlipSamplePdfTool,
		spsCommerceRenderPackingSlipPdfTool,
		spsCommerceListSubmissionFormsTool,
		spsCommerceGetSubmissionFormTool,
		spsCommerceCreateTradingPartnersTool
	]
})
