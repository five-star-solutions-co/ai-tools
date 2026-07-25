/**
 * Shared object-store I/O schemas for the s3 vendor pack (and nested S3 bindings).
 * Not published — `_storage` is skipped by codegen.
 */

import { z } from 'zod'

import { batchResultSchema } from '../../shared/batch'

export const MAX_OBJECT_BYTES = 5 * 1024 * 1024
export const DEFAULT_SIGNED_URL_SECONDS = 3600
export const MAX_SIGNED_URL_SECONDS = 7 * 24 * 3600
export const MAX_BATCH_ITEMS = 25
export const MAX_MULTIPART_PART_BYTES = 25 * 1024 * 1024

export const listedObjectSchema = z.object({
	key: z.string(),
	size: z.number().optional(),
	last_modified: z.string().optional(),
	etag: z.string().optional()
})

export const listObjectsInputSchema = z.object({
	prefix: z.string().optional().describe('Key prefix filter'),
	delimiter: z.string().optional().describe('Delimiter for common prefixes (folders), for example /'),
	cursor: z.string().min(1).optional().describe('Pagination cursor from a prior list call'),
	limit: z.int().min(1).max(1000).optional().describe('Maximum keys to return (1-1000)')
})

export const listObjectsOutputSchema = z.object({
	keys: z.array(z.string()).describe('Object keys (convenience list)'),
	items: z.array(listedObjectSchema).describe('Objects with size, last_modified, and etag when present'),
	common_prefixes: z.array(z.string()).optional().describe('Common prefixes when delimiter is set'),
	next_cursor: z.string().optional().describe('Pass as cursor to fetch the next page'),
	truncated: z.boolean().describe('Whether more results exist')
})

export const getObjectInputSchema = z.object({
	key: z.string().min(1).describe('Object key to download'),
	encoding: z.enum(['base64', 'utf8']).optional().describe('Body encoding. Defaults to base64 for binary safety')
})

export const getObjectOutputSchema = z.object({
	key: z.string(),
	content_type: z.string().optional(),
	content_length: z.number().optional(),
	body: z.string().describe('Object body encoded per encoding input'),
	encoding: z.enum(['base64', 'utf8'])
})

export const putObjectInputSchema = z.object({
	key: z.string().min(1).describe('Object key to write'),
	body: z.string().describe('Object body as utf8 text or base64 (see body_encoding)'),
	body_encoding: z.enum(['utf8', 'base64']).optional().describe('How to interpret body. Defaults to utf8'),
	content_type: z.string().optional().describe('Content-Type header to store')
})

export const putObjectOutputSchema = z.object({
	key: z.string(),
	etag: z.string().optional(),
	content_length: z.number().describe('Decoded body byte length uploaded')
})

export const deleteObjectInputSchema = z.object({
	key: z.string().min(1).describe('Object key to delete')
})

export const deleteObjectOutputSchema = z.object({
	key: z.string(),
	deleted: z.boolean()
})

export const headObjectInputSchema = z.object({
	key: z.string().min(1).describe('Object key to inspect')
})

export const headObjectOutputSchema = z.object({
	key: z.string(),
	exists: z.boolean(),
	content_type: z.string().optional(),
	content_length: z.number().optional(),
	etag: z.string().optional()
})

export const copyObjectInputSchema = z.object({
	source_key: z.string().min(1).describe('Source object key to copy from'),
	destination_key: z.string().min(1).describe('Destination object key to copy to'),
	source_bucket: z
		.string()
		.min(1)
		.optional()
		.describe('Optional source bucket when different from the configured default bucket')
})

export const copyObjectOutputSchema = z.object({
	source_key: z.string(),
	destination_key: z.string(),
	etag: z.string().optional()
})

export const signedUrlInputSchema = z.object({
	key: z.string().min(1).describe('Object key to sign'),
	method: z
		.enum(['GET', 'PUT', 'HEAD', 'DELETE'])
		.optional()
		.describe('HTTP method the URL authorizes. Defaults to GET'),
	expires_in: z
		.int()
		.min(1)
		.max(MAX_SIGNED_URL_SECONDS)
		.optional()
		.describe('URL lifetime in seconds (1 to 604800). Defaults to 3600')
})

export const signedUrlOutputSchema = z.object({
	url: z.url().describe('Presigned URL'),
	method: z.enum(['GET', 'PUT', 'HEAD', 'DELETE']),
	expires_in: z.int().describe('Lifetime in seconds used when signing')
})

export const createMultipartUploadInputSchema = z.object({
	key: z.string().min(1).describe('Object key to create via multipart upload'),
	content_type: z.string().optional().describe('Content-Type stored on the completed object')
})

export const createMultipartUploadOutputSchema = z.object({
	key: z.string(),
	upload_id: z.string().min(1).describe('Upload id required for subsequent part/complete/abort calls')
})

export const uploadPartInputSchema = z.object({
	key: z.string().min(1).describe('Object key for the in-progress multipart upload'),
	upload_id: z.string().min(1).describe('Upload id from createMultipartUpload'),
	part_number: z.int().min(1).max(10_000).describe('Part number (1-10000). Must be unique within the upload'),
	body: z.string().describe('Part body as utf8 text or base64 (see body_encoding)'),
	body_encoding: z.enum(['utf8', 'base64']).optional().describe('How to interpret body. Defaults to utf8')
})

export const uploadPartOutputSchema = z.object({
	key: z.string(),
	upload_id: z.string(),
	part_number: z.int(),
	etag: z.string().min(1).describe('Part ETag required when completing the multipart upload'),
	content_length: z.number().describe('Decoded part byte length uploaded')
})

export const multipartUploadedPartSchema = z.object({
	part_number: z.int().min(1).max(10_000),
	etag: z.string().min(1).describe('ETag returned by uploadPart (with or without surrounding quotes)')
})

export const completeMultipartUploadInputSchema = z.object({
	key: z.string().min(1).describe('Object key for the in-progress multipart upload'),
	upload_id: z.string().min(1).describe('Upload id from createMultipartUpload'),
	parts: z
		.array(multipartUploadedPartSchema)
		.min(1)
		.max(10_000)
		.describe('Uploaded parts with part_number and etag, in any order (sorted before complete)')
})

export const completeMultipartUploadOutputSchema = z.object({
	key: z.string(),
	upload_id: z.string(),
	etag: z.string().optional().describe('Final object ETag when the store returns one')
})

export const abortMultipartUploadInputSchema = z.object({
	key: z.string().min(1).describe('Object key for the in-progress multipart upload'),
	upload_id: z.string().min(1).describe('Upload id from createMultipartUpload')
})

export const abortMultipartUploadOutputSchema = z.object({
	key: z.string(),
	upload_id: z.string(),
	aborted: z.boolean()
})

export const getObjectsInputSchema = z.object({
	keys: z.array(z.string().min(1)).min(1).max(MAX_BATCH_ITEMS).describe('Object keys to download'),
	encoding: z.enum(['base64', 'utf8']).optional().describe('Body encoding for each item. Defaults to base64')
})

export const putObjectsInputSchema = z.object({
	objects: z.array(putObjectInputSchema).min(1).max(MAX_BATCH_ITEMS).describe('Objects to upload')
})

export const deleteObjectsInputSchema = z.object({
	keys: z.array(z.string().min(1)).min(1).max(MAX_BATCH_ITEMS).describe('Object keys to delete')
})

export const getObjectsOutputSchema = batchResultSchema(getObjectOutputSchema)
export const putObjectsOutputSchema = batchResultSchema(putObjectOutputSchema)
export const deleteObjectsOutputSchema = batchResultSchema(deleteObjectOutputSchema)

export type ListObjectsInput = z.infer<typeof listObjectsInputSchema>
export type ListObjectsOutput = z.infer<typeof listObjectsOutputSchema>
export type GetObjectInput = z.infer<typeof getObjectInputSchema>
export type GetObjectOutput = z.infer<typeof getObjectOutputSchema>
export type PutObjectInput = z.infer<typeof putObjectInputSchema>
export type PutObjectOutput = z.infer<typeof putObjectOutputSchema>
export type DeleteObjectInput = z.infer<typeof deleteObjectInputSchema>
export type DeleteObjectOutput = z.infer<typeof deleteObjectOutputSchema>
export type HeadObjectInput = z.infer<typeof headObjectInputSchema>
export type HeadObjectOutput = z.infer<typeof headObjectOutputSchema>
export type CopyObjectInput = z.infer<typeof copyObjectInputSchema>
export type CopyObjectOutput = z.infer<typeof copyObjectOutputSchema>
export type SignedUrlInput = z.infer<typeof signedUrlInputSchema>
export type SignedUrlOutput = z.infer<typeof signedUrlOutputSchema>
export type CreateMultipartUploadInput = z.infer<typeof createMultipartUploadInputSchema>
export type CreateMultipartUploadOutput = z.infer<typeof createMultipartUploadOutputSchema>
export type UploadPartInput = z.infer<typeof uploadPartInputSchema>
export type UploadPartOutput = z.infer<typeof uploadPartOutputSchema>
export type CompleteMultipartUploadInput = z.infer<typeof completeMultipartUploadInputSchema>
export type CompleteMultipartUploadOutput = z.infer<typeof completeMultipartUploadOutputSchema>
export type AbortMultipartUploadInput = z.infer<typeof abortMultipartUploadInputSchema>
export type AbortMultipartUploadOutput = z.infer<typeof abortMultipartUploadOutputSchema>
