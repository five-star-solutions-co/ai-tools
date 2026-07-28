/**
 * S3 / S3-compatible vendor auth + re-exports of shared object-store I/O.
 */

import { z } from 'zod'

export {
	abortMultipartUploadInputSchema,
	abortMultipartUploadOutputSchema,
	completeMultipartUploadInputSchema,
	completeMultipartUploadOutputSchema,
	copyObjectInputSchema,
	copyObjectOutputSchema,
	createMultipartUploadInputSchema,
	createMultipartUploadOutputSchema,
	DEFAULT_SIGNED_URL_SECONDS,
	deleteObjectInputSchema,
	deleteObjectOutputSchema,
	getObjectInputSchema,
	getObjectOutputSchema,
	headObjectInputSchema,
	headObjectOutputSchema,
	listObjectsInputSchema,
	listObjectsOutputSchema,
	listedObjectSchema,
	MAX_MULTIPART_PART_BYTES,
	MAX_OBJECT_BYTES,
	MAX_SIGNED_URL_SECONDS,
	multipartUploadedPartSchema,
	putObjectInputSchema,
	putObjectOutputSchema,
	signedUrlInputSchema,
	signedUrlOutputSchema,
	uploadPartInputSchema,
	uploadPartOutputSchema
} from '../_storage'
export type {
	AbortMultipartUploadInput,
	AbortMultipartUploadOutput,
	CompleteMultipartUploadInput,
	CompleteMultipartUploadOutput,
	CopyObjectInput,
	CopyObjectOutput,
	CreateMultipartUploadInput,
	CreateMultipartUploadOutput,
	DeleteObjectInput,
	DeleteObjectOutput,
	GetObjectInput,
	GetObjectOutput,
	HeadObjectInput,
	HeadObjectOutput,
	ListObjectsInput,
	ListObjectsOutput,
	PutObjectInput,
	PutObjectOutput,
	SignedUrlInput,
	SignedUrlOutput,
	UploadPartInput,
	UploadPartOutput
} from '../_storage'

export const s3AuthSchema = z.object({
	access_key_id: z.string().min(1).describe('S3 access key id'),
	secret_access_key: z.string().min(1).describe('S3 secret access key'),
	region: z.string().min(1).describe('AWS region, or auto / us-east-1 for R2 S3 endpoint'),
	bucket: z.string().min(1).describe('Default bucket name'),
	endpoint: z
		.url()
		.optional()
		.describe('S3-compatible endpoint when not AWS (R2: https://<account_id>.r2.cloudflarestorage.com, MinIO, …)'),
	session_token: z.string().min(1).optional().describe('Optional session token for temporary credentials'),
	key_prefix: z
		.string()
		.min(1)
		.optional()
		.describe(
			'Optional object-key root for this binding (no leading slash). Logical keys are relative to this prefix; wire keys include it. Host tenant scoping binds once here.'
		)
})

export type S3Auth = z.infer<typeof s3AuthSchema>
