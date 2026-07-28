/**
 * Object-vector vertical kit for vendor packs only.
 * Not published — directory name `_vector` is skipped by surface codegen.
 * Schemas only (same shape as `_storage`). Domain helpers: `./domain`.
 */

export {
	MAX_TOP_K,
	MAX_VECTOR_BATCH,
	MAX_VECTOR_DIMENSIONS,
	deleteVectorsInputSchema,
	deleteVectorsOutputSchema,
	queryVectorsInputSchema,
	queryVectorsOutputSchema,
	upsertVectorsInputSchema,
	upsertVectorsOutputSchema,
	vectorDefaultFilterSchema,
	vectorMatchSchema,
	vectorMetadataSchema,
	vectorMetadataValueSchema,
	vectorPointSchema
} from './schemas'
export type {
	DeleteVectorsInput,
	DeleteVectorsOutput,
	QueryVectorsInput,
	QueryVectorsOutput,
	UpsertVectorsInput,
	UpsertVectorsOutput,
	VectorDefaultFilter,
	VectorMatch,
	VectorMetadata,
	VectorMetadataValue,
	VectorPoint
} from './schemas'
