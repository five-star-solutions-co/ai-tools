import { defineModule, defineTool } from '../../core/define'
import { PresentationClient } from './client'
import {
	presentationAuthSchema,
	presentationBuildInputSchema,
	presentationBuildOutputSchema,
	presentationEditInputSchema,
	presentationReadInputSchema,
	presentationReadOutputSchema
} from './contracts'

export const presentationReadTool = defineTool({
	id: 'presentation-read',
	name: 'readPresentation',
	description: 'Read text, slides, notes, and tables from a PPTX presentation artifact.',
	inputSchema: presentationReadInputSchema,
	outputSchema: presentationReadOutputSchema,
	sideEffect: 'read',
	runtime: 'node',
	artifacts: true,
	execute: async (input, ctx) => PresentationClient.fromContext(ctx).read(input)
})

export const presentationBuildTool = defineTool({
	id: 'presentation-build',
	name: 'buildPresentation',
	description: 'Build a PPTX presentation artifact from structured slides.',
	inputSchema: presentationBuildInputSchema,
	outputSchema: presentationBuildOutputSchema,
	sideEffect: 'write',
	runtime: 'node',
	artifacts: true,
	execute: async (input, ctx) => PresentationClient.fromContext(ctx).build(input)
})

export const presentationEditTool = defineTool({
	id: 'presentation-edit',
	name: 'editPresentation',
	description: 'Apply layout-preserving text replacements to a PPTX presentation artifact.',
	inputSchema: presentationEditInputSchema,
	outputSchema: presentationBuildOutputSchema,
	sideEffect: 'write',
	runtime: 'node',
	artifacts: true,
	execute: async (input, ctx) => PresentationClient.fromContext(ctx).edit(input)
})

export const presentationModule = defineModule({
	id: 'presentation',
	title: 'Presentation',
	description: 'Read, build, and edit PPTX presentation artifacts.',
	runtime: 'node',
	auth: { type: 'custom', schema: presentationAuthSchema },
	tools: [presentationReadTool, presentationBuildTool, presentationEditTool]
})
