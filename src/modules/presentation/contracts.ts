/**
 * Presentation contracts for reading, building, and editing PPTX artifacts.
 * Auth: nested object storage for ArtifactRef IO.
 */

import { z } from 'zod'

import { artifactRefSchema } from '../../shared/artifact'
import {
	MAX_REPLACEMENTS,
	documentAuthSchema,
	documentBuildOutputSchema,
	documentTableSchema
} from '../document/contracts'

export const MAX_SLIDES = 50

export const presentationAuthSchema = documentAuthSchema
export const presentationBuildOutputSchema = documentBuildOutputSchema

export const presentationSourceSchema = z
	.object({
		artifact: artifactRefSchema.optional().describe('Object-store PPTX artifact to read (store must be object)'),
		body_base64: z.string().min(1).optional().describe('Inline PPTX bytes as base64 (small files only)'),
		filename: z.string().min(1).optional().describe('PPTX filename'),
		media_type: z.string().min(1).optional().describe('PPTX MIME type')
	})
	.superRefine((value, context) => {
		if ((value.artifact === undefined) === (value.body_base64 === undefined)) {
			context.addIssue({
				code: 'custom',
				message: 'Provide exactly one of artifact or body_base64'
			})
		}
	})

export const presentationSlideSchema = z.object({
	title: z.string().max(500).optional().describe('Slide title'),
	bullets: z.array(z.string().max(2_000)).max(40).optional().describe('Bullet lines'),
	notes: z.string().max(5_000).optional().describe('Speaker notes')
})

export const presentationReplacementSchema = z.object({
	find: z.string().min(1).max(20_000).describe('Exact existing text to find'),
	replace: z.string().max(20_000).describe('Replacement text')
})

export const presentationReadInputSchema = z.object({
	source: presentationSourceSchema.describe(
		'PPTX presentation to read. For an ArtifactRef, pass { artifact: <ArtifactRef> }; do not pass the reference directly.'
	)
})

export const presentationReadOutputSchema = z.object({
	format: z.literal('pptx'),
	text: z.string().optional().describe('Extracted plain text'),
	slides: z.array(presentationSlideSchema).describe('Structured presentation slides'),
	tables: z.array(documentTableSchema).optional().describe('Tables extracted from slides'),
	filename: z.string().optional(),
	media_type: z.string().optional(),
	byte_length: z.int().nonnegative()
})

export const presentationBuildInputSchema = z.object({
	title: z.string().max(500).optional().describe('Presentation title metadata'),
	slides: z.array(presentationSlideSchema).min(1).max(MAX_SLIDES).describe('Slides to create'),
	output_key: z.string().min(1).describe('Object key for the .pptx artifact'),
	filename: z.string().min(1).optional().describe('Display filename (defaults to deck.pptx)')
})

export const presentationEditInputSchema = z.object({
	source: presentationSourceSchema.describe(
		'Existing PPTX presentation. For an ArtifactRef, pass { artifact: <ArtifactRef> }; do not pass the reference directly.'
	),
	replacements: z
		.array(presentationReplacementSchema)
		.min(1)
		.max(MAX_REPLACEMENTS)
		.describe('Layout-preserving global text replacements'),
	output_key: z.string().min(1).describe('Object key for the written .pptx artifact'),
	filename: z.string().min(1).optional().describe('Display filename')
})

export type PresentationAuth = z.infer<typeof presentationAuthSchema>
export type PresentationSlide = z.infer<typeof presentationSlideSchema>
export type PresentationReplacement = z.infer<typeof presentationReplacementSchema>
export type PresentationReadInput = z.infer<typeof presentationReadInputSchema>
export type PresentationReadOutput = z.infer<typeof presentationReadOutputSchema>
export type PresentationBuildInput = z.infer<typeof presentationBuildInputSchema>
export type PresentationEditInput = z.infer<typeof presentationEditInputSchema>
