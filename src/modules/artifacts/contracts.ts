/**
 * ArtifactRef creation and bounded read contracts.
 * Host-mapped and object-store backends share the same model-facing verbs.
 */

import { z } from 'zod'

import { artifactRefSchema } from '../../shared/artifact'
import { MAX_OBJECT_BYTES, s3AuthSchema } from '../../vendors/s3'

export const MAX_ARTIFACT_READ_BYTES = MAX_OBJECT_BYTES
export const MAX_ARTIFACT_CREATE_BYTES = MAX_OBJECT_BYTES
export const MAX_ARTIFACT_INLINE_CHARS = Math.ceil((MAX_ARTIFACT_CREATE_BYTES * 4) / 3) + 4

export const artifactsCreateInputSchema = z.object({
	key: z.string().min(1).max(1_024).describe('Destination key for the new artifact'),
	body: z.string().max(MAX_ARTIFACT_INLINE_CHARS).describe('Artifact body encoded as specified by encoding'),
	encoding: z.enum(['utf8', 'base64']).describe('How body is encoded'),
	media_type: z.string().min(1).max(200).optional().describe('MIME type when known'),
	filename: z.string().min(1).max(512).optional().describe('Display filename when different from the key')
})

export const artifactsCreateOutputSchema = z.object({
	artifact: artifactRefSchema.describe('Reference to the created artifact')
})

export const artifactsReadRangeInputSchema = z
	.object({
		source: artifactRefSchema.describe('Artifact to read'),
		start_byte: z.int().min(0).describe('Inclusive zero-based start byte'),
		end_byte: z.int().min(0).describe('Inclusive zero-based end byte')
	})
	.superRefine((input, ctx) => {
		const byteLength = input.end_byte - input.start_byte + 1
		if (byteLength < 1) {
			ctx.addIssue({
				code: 'custom',
				path: ['end_byte'],
				message: 'end_byte must be greater than or equal to start_byte'
			})
		}
		if (byteLength > MAX_ARTIFACT_READ_BYTES) {
			ctx.addIssue({
				code: 'custom',
				path: ['end_byte'],
				message: `Byte range cannot exceed ${MAX_ARTIFACT_READ_BYTES} bytes`
			})
		}
	})

export const artifactsReadRangeOutputSchema = z.object({
	source: artifactRefSchema,
	body_base64: z.string().describe('Requested bytes encoded as base64'),
	start_byte: z.int().min(0),
	end_byte: z.int().min(0),
	total_bytes: z.int().min(0).optional(),
	media_type: z.string().optional()
})

export const artifactsReadLinesInputSchema = z
	.object({
		source: artifactRefSchema.describe('UTF-8 text artifact to read'),
		start_line: z.int().min(1).describe('Inclusive one-based start line'),
		end_line: z.int().min(1).describe('Inclusive one-based end line')
	})
	.refine((input) => input.end_line >= input.start_line, {
		path: ['end_line'],
		message: 'end_line must be greater than or equal to start_line'
	})

export const artifactsReadLinesOutputSchema = z.object({
	source: artifactRefSchema,
	text: z.string().describe('Selected UTF-8 lines'),
	start_line: z.int().min(1),
	end_line: z.int().min(1),
	total_lines: z.int().min(0)
})

export type ArtifactsCreateInput = z.infer<typeof artifactsCreateInputSchema>
export type ArtifactsCreateOutput = z.infer<typeof artifactsCreateOutputSchema>
export type ArtifactsReadRangeInput = z.infer<typeof artifactsReadRangeInputSchema>
export type ArtifactsReadRangeOutput = z.infer<typeof artifactsReadRangeOutputSchema>
export type ArtifactsReadLinesInput = z.infer<typeof artifactsReadLinesInputSchema>
export type ArtifactsReadLinesOutput = z.infer<typeof artifactsReadLinesOutputSchema>

export type ArtifactsOps = {
	create(input: ArtifactsCreateInput): Promise<ArtifactsCreateOutput>
	readRange(input: ArtifactsReadRangeInput): Promise<ArtifactsReadRangeOutput>
	readLines(input: ArtifactsReadLinesInput): Promise<ArtifactsReadLinesOutput>
}

export const artifactsBackendSchema = z.object({
	create: z.custom<ArtifactsOps['create']>((value) => typeof value === 'function', 'create must be a function'),
	readRange: z.custom<ArtifactsOps['readRange']>(
		(value) => typeof value === 'function',
		'readRange must be a function'
	),
	readLines: z.custom<ArtifactsOps['readLines']>((value) => typeof value === 'function', 'readLines must be a function')
})

export const objectArtifactsAuthSchema = z.object({
	provider: z.literal('object'),
	storage: s3AuthSchema.describe('S3-compatible object storage for ArtifactRef bytes')
})

export const hostArtifactsAuthSchema = z.object({
	provider: z.literal('host'),
	backend: artifactsBackendSchema.describe('Host artifact operations for host-mapped ArtifactRefs')
})

export const artifactsAuthSchema = z.discriminatedUnion('provider', [
	objectArtifactsAuthSchema,
	hostArtifactsAuthSchema
])

export type ArtifactsAuth = z.infer<typeof artifactsAuthSchema>
export type ObjectArtifactsAuth = z.infer<typeof objectArtifactsAuthSchema>
export type HostArtifactsAuth = z.infer<typeof hostArtifactsAuthSchema>
