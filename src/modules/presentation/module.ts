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
	description:
		'Read an existing PPTX ArtifactRef for understanding, including slide text, notes, and tables. Use before answering about or editing a supplied deck. This does not create a new presentation.',
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
	description:
		'Create a new PPTX deliverable from structured slides. Use whenever the user asks to build a presentation or deck. Prefer this purpose-built builder over generating PPTX in a general code sandbox. Returns the final ArtifactRef; no export or edit step is needed.',
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
	description:
		'Edit an existing PPTX ArtifactRef with layout-preserving text replacements and return a new ArtifactRef. Use only when changing a supplied deck. For a new deck, use presentation-build; do not call this merely to make a built ArtifactRef deliverable.',
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
	description:
		'Purpose-built tools to read existing PPTX files, build final presentation deliverables, and edit supplied decks. Prefer these tools over general sandbox file generation.',
	runtime: 'node',
	auth: { type: 'custom', schema: presentationAuthSchema },
	categories: ['documents', 'office'],
	classification: 'pii',
	tags: ['pptx'],
	tools: [presentationReadTool, presentationBuildTool, presentationEditTool]
})
