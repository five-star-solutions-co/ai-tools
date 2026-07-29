import { defineModule, defineTool } from '../../core/define'
import { ArtifactsClient } from './client'
import {
	artifactsAuthSchema,
	artifactsCreateInputSchema,
	artifactsCreateOutputSchema,
	artifactsReadLinesInputSchema,
	artifactsReadLinesOutputSchema,
	artifactsReadRangeInputSchema,
	artifactsReadRangeOutputSchema
} from './contracts'

export const artifactsCreateTool = defineTool({
	id: 'artifacts-create',
	name: 'createArtifact',
	description:
		'Persist small, already-serialized UTF-8 or base64 content and return its ArtifactRef. Use for raw bytes or text when no structured builder is required. Do not use this to invent DOCX, XLSX, PPTX, PDF, or image formats.',
	inputSchema: artifactsCreateInputSchema,
	outputSchema: artifactsCreateOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => ArtifactsClient.fromContext(ctx).create(input)
})

export const artifactsReadRangeTool = defineTool({
	id: 'artifacts-read-range',
	name: 'readArtifactRange',
	description:
		'Read an explicit inclusive byte range from an existing ArtifactRef as base64. Use for bounded binary inspection or chunked transfer, not for understanding a supported document when a format-aware reader is available.',
	inputSchema: artifactsReadRangeInputSchema,
	outputSchema: artifactsReadRangeOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => ArtifactsClient.fromContext(ctx).readRange(input)
})

export const artifactsReadLinesTool = defineTool({
	id: 'artifacts-read-lines',
	name: 'readArtifactLines',
	description:
		'Read an explicit inclusive line range from a UTF-8 text artifact. Use for bounded inspection instead of loading the whole file into context.',
	inputSchema: artifactsReadLinesInputSchema,
	outputSchema: artifactsReadLinesOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => ArtifactsClient.fromContext(ctx).readLines(input)
})

export const artifactsModule = defineModule({
	id: 'artifacts',
	title: 'Artifacts',
	description:
		'Persist small serialized content and inspect bounded byte or text ranges. ArtifactRef is the handoff between tools; structured document creation belongs to purpose-built builders.',
	runtime: 'both',
	auth: { type: 'custom', schema: artifactsAuthSchema },
	tools: [artifactsCreateTool, artifactsReadRangeTool, artifactsReadLinesTool]
})
