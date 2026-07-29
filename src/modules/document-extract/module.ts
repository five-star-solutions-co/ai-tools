import { defineModule, defineTool } from '../../core/define'
import { DocumentExtractClient } from './client'
import {
	documentExtractAuthSchema,
	extractResultSchema,
	extractTextBatchInputSchema,
	extractTextBatchOutputSchema,
	extractTextInputSchema,
	statusInputSchema
} from './contracts'

export type { DocumentExtractAuth } from './contracts'
export { documentExtractAuthSchema }

export const documentExtractTextTool = defineTool({
	id: 'document-extract-text',
	name: 'extractDocumentText',
	description:
		'Extract text from a document ArtifactRef in object storage. Polls until done or timeout. Optional output: inline (default; fails if over size limit), artifact (write text to object storage), or chunks (split for RAG). If still running after the wait budget, returns pending and job_id for document-extract-status.',
	inputSchema: extractTextInputSchema,
	outputSchema: extractResultSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => DocumentExtractClient.fromContext(ctx).extractText(input)
})

export const documentExtractStatusTool = defineTool({
	id: 'document-extract-status',
	name: 'getDocumentExtractStatus',
	description:
		'Check a text-extraction job by job_id from document-extract-text. Same optional output modes as extract (inline, artifact, chunks). Does not start a new job.',
	inputSchema: statusInputSchema,
	outputSchema: extractResultSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => DocumentExtractClient.fromContext(ctx).getStatus(input)
})

export const documentExtractTextBatchTool = defineTool({
	id: 'document-extract-text-batch',
	name: 'extractDocumentTextBatch',
	description:
		'Extract text from up to 10 document ArtifactRefs with optional output modes (inline, artifact, chunks). Returns per-item status without aborting the whole batch.',
	inputSchema: extractTextBatchInputSchema,
	outputSchema: extractTextBatchOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => DocumentExtractClient.fromContext(ctx).extractTextBatch(input)
})

export const documentExtractModule = defineModule({
	id: 'document-extract',
	title: 'Document Extract',
	description:
		'Extract text from scanned or extraction-dependent documents. Choose inline text, a text ArtifactRef, or retrieval chunks. Extraction polls within the initial call; use the status tool only when a job_id is returned as pending.',
	runtime: 'both',
	auth: { type: 'custom', schema: documentExtractAuthSchema },
	tools: [documentExtractTextTool, documentExtractStatusTool, documentExtractTextBatchTool]
})
