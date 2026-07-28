import { z } from 'zod'

import { vectorDefaultFilterSchema } from '../_vector'

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
	vectorMatchSchema,
	vectorMetadataSchema,
	vectorPointSchema
} from '../_vector'
export type {
	DeleteVectorsInput,
	DeleteVectorsOutput,
	QueryVectorsInput,
	QueryVectorsOutput,
	UpsertVectorsInput,
	UpsertVectorsOutput,
	VectorMatch,
	VectorMetadata,
	VectorPoint
} from '../_vector'

export const pineconeAuthSchema = z.object({
	api_key: z.string().min(1).describe('Pinecone API key'),
	base_url: z.string().url().describe('Pinecone index data-plane origin, for example https://xxxx.svc.….pinecone.io'),
	default_namespace: z
		.string()
		.min(1)
		.optional()
		.describe('Locked Pinecone namespace for all calls when set (tool cannot switch away)'),
	default_filter: vectorDefaultFilterSchema
		.optional()
		.describe('Host-bound metadata filter always applied on query; flat keys stamped on upsert')
})

export type PineconeAuth = z.infer<typeof pineconeAuthSchema>
