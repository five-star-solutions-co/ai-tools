import { z } from 'zod'

import { batchResultSchema } from '../../shared/batch'
import {
	gotenbergAuthSchema,
	gotenbergConvertBatchInputSchema,
	gotenbergConvertInputSchema,
	gotenbergConvertOutputSchema
} from '../../vendors/gotenberg'

export const MAX_BATCH_CONVERT = 10

export const gotenbergFileConvertAuthSchema = gotenbergAuthSchema.extend({
	provider: z.literal('gotenberg')
})

export type GotenbergFileConvertAuth = z.infer<typeof gotenbergFileConvertAuthSchema>

export const fileConvertAuthSchema = z.discriminatedUnion('provider', [gotenbergFileConvertAuthSchema])

export type FileConvertAuth = z.infer<typeof fileConvertAuthSchema>

export const convertInputSchema = gotenbergConvertInputSchema
export const convertOutputSchema = gotenbergConvertOutputSchema
export const convertBatchInputSchema = gotenbergConvertBatchInputSchema
export const convertBatchOutputSchema = batchResultSchema(convertOutputSchema)

export type ConvertInput = z.infer<typeof convertInputSchema>
export type ConvertOutput = z.infer<typeof convertOutputSchema>
export type ConvertBatchInput = z.infer<typeof convertBatchInputSchema>
export type ConvertBatchOutput = z.infer<typeof convertBatchOutputSchema>

export type FileConvertOps = {
	convert: (input: ConvertInput) => Promise<ConvertOutput>
	convertBatch: (input: ConvertBatchInput) => Promise<ConvertBatchOutput>
}
