/**
 * Shared vector I/O schemas for vector vendor packs and the vector-store seam.
 * Codegen skips `_vector` (vertical kit). No helpers here — see domain.ts.
 */

import { z } from 'zod'

export const MAX_VECTOR_BATCH = 100
export const MAX_TOP_K = 100
export const MAX_VECTOR_DIMENSIONS = 4096

export const vectorMetadataValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()])
export const vectorMetadataSchema = z
	.record(z.string(), vectorMetadataValueSchema)
	.describe('Flat metadata map (string / number / boolean / null values)')

export const vectorPointSchema = z.object({
	id: z.string().min(1).describe('Stable point id'),
	values: z.array(z.number()).min(1).max(MAX_VECTOR_DIMENSIONS).describe('Embedding values'),
	metadata: vectorMetadataSchema.optional().describe('Optional flat metadata')
})

export const vectorMatchSchema = z.object({
	id: z.string(),
	score: z.number().describe('Similarity score (higher is better; provider scale may differ)'),
	values: z.array(z.number()).optional(),
	metadata: vectorMetadataSchema.optional()
})

export const upsertVectorsInputSchema = z.object({
	collection: z.string().min(1).optional().describe('Collection, table, or index name when no default is configured'),
	namespace: z
		.string()
		.min(1)
		.optional()
		.describe('Optional namespace when supported; a configured fixed namespace takes precedence'),
	vectors: z.array(vectorPointSchema).min(1).max(MAX_VECTOR_BATCH).describe(`1–${MAX_VECTOR_BATCH} vectors to upsert`)
})

export const upsertVectorsOutputSchema = z.object({
	upserted: z.number().int().nonnegative().describe('Number of points upserted'),
	collection: z.string().optional()
})

export const queryVectorsInputSchema = z.object({
	collection: z.string().min(1).optional().describe('Collection, table, or index name when no default is configured'),
	namespace: z
		.string()
		.min(1)
		.optional()
		.describe('Optional namespace when supported; a configured fixed namespace takes precedence'),
	vector: z.array(z.number()).min(1).max(MAX_VECTOR_DIMENSIONS).describe('Query embedding'),
	top_k: z
		.number()
		.int()
		.min(1)
		.max(MAX_TOP_K)
		.optional()
		.describe(`Number of nearest neighbors (default 8, max ${MAX_TOP_K})`),
	include_values: z.boolean().optional().describe('Include embedding values in matches'),
	include_metadata: z.boolean().optional().describe('Include metadata in matches (default true)'),
	filter: z
		.record(z.string(), z.unknown())
		.optional()
		.describe(
			'Optional provider-native metadata filter; merged with host-bound default_filter when set (host keys win)'
		)
})

export const queryVectorsOutputSchema = z.object({
	matches: z.array(vectorMatchSchema),
	collection: z.string().optional()
})

export const deleteVectorsInputSchema = z.object({
	collection: z.string().min(1).optional().describe('Collection, table, or index name when no default is configured'),
	namespace: z.string().min(1).optional().describe('Optional namespace when the store supports it'),
	ids: z.array(z.string().min(1)).min(1).max(MAX_VECTOR_BATCH).describe(`1–${MAX_VECTOR_BATCH} point ids to delete`)
})

export const deleteVectorsOutputSchema = z.object({
	deleted: z.number().int().nonnegative().describe('Number of ids requested for delete'),
	collection: z.string().optional()
})

/** Host-bound filter bag (opaque provider dialect or flat equality metadata). */
export const vectorDefaultFilterSchema = z
	.record(z.string(), z.unknown())
	.describe(
		'Host-bound metadata filter always applied on query (tool filter merged; host keys win). Flat equality keys are stamped onto upsert metadata.'
	)

export type VectorMetadata = z.infer<typeof vectorMetadataSchema>
export type VectorMetadataValue = z.infer<typeof vectorMetadataValueSchema>
export type VectorPoint = z.infer<typeof vectorPointSchema>
export type VectorMatch = z.infer<typeof vectorMatchSchema>
export type VectorDefaultFilter = z.infer<typeof vectorDefaultFilterSchema>
export type UpsertVectorsInput = z.infer<typeof upsertVectorsInputSchema>
export type UpsertVectorsOutput = z.infer<typeof upsertVectorsOutputSchema>
export type QueryVectorsInput = z.infer<typeof queryVectorsInputSchema>
export type QueryVectorsOutput = z.infer<typeof queryVectorsOutputSchema>
export type DeleteVectorsInput = z.infer<typeof deleteVectorsInputSchema>
export type DeleteVectorsOutput = z.infer<typeof deleteVectorsOutputSchema>
