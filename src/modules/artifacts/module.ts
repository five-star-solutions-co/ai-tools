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
		'Create a small artifact in the bound artifact store from UTF-8 or base64 content and return its ArtifactRef.',
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
		'Read an explicit inclusive byte range from an existing artifact. Returns only the requested bounded bytes as base64.',
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
	description: 'Create artifacts and read bounded byte or text ranges from the bound artifact store.',
	runtime: 'both',
	auth: { type: 'custom', schema: artifactsAuthSchema },
	tools: [artifactsCreateTool, artifactsReadRangeTool, artifactsReadLinesTool]
})
