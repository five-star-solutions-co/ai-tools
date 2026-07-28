import { defineModule, defineTool } from '../../core/define'
import { TextractClient } from './client'
import {
	textractAuthSchema,
	textractExtractResultSchema,
	textractExtractTextBatchInputSchema,
	textractExtractTextBatchOutputSchema,
	textractExtractTextInputSchema,
	textractStatusInputSchema
} from './contracts'

export const textractExtractTextTool = defineTool({
	id: 'textract-extract-text',
	name: 'textractExtractText',
	description:
		'Extract text from a document ArtifactRef in S3 via Amazon Textract. Polls until done or timeout. Optional output: inline (default; fails if over size limit), artifact (write text to S3), or chunks (split for RAG). If still running after the wait budget, returns status pending and a job_id for textract-get-status. Source store must be object.',
	inputSchema: textractExtractTextInputSchema,
	outputSchema: textractExtractResultSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => TextractClient.fromContext(ctx).extractText(input)
})

export const textractGetStatusTool = defineTool({
	id: 'textract-get-status',
	name: 'textractGetStatus',
	description:
		'Check a Textract text-detection job by job_id from textract-extract-text. Same optional output modes as extract (inline, artifact, chunks). Does not start a new job.',
	inputSchema: textractStatusInputSchema,
	outputSchema: textractExtractResultSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => TextractClient.fromContext(ctx).getStatus(input)
})

export const textractExtractTextBatchTool = defineTool({
	id: 'textract-extract-text-batch',
	name: 'textractExtractTextBatch',
	description:
		'Extract text from up to 10 document ArtifactRefs via Amazon Textract with optional output modes (inline, artifact, chunks). Returns per-item status without aborting the batch.',
	inputSchema: textractExtractTextBatchInputSchema,
	outputSchema: textractExtractTextBatchOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => TextractClient.fromContext(ctx).extractTextBatch(input)
})

export const textractModule = defineModule({
	id: 'textract',
	title: 'Amazon Textract',
	description:
		'Amazon Textract vendor pack: async document text detection from S3 objects with inline, artifact, and chunks output modes (batch supported). Full Textract surface can grow over time.',
	runtime: 'both',
	auth: { type: 'custom', schema: textractAuthSchema },
	tools: [textractExtractTextTool, textractGetStatusTool, textractExtractTextBatchTool]
})
