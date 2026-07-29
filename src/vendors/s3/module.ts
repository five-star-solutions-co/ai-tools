import { defineModule, defineTool } from '../../core/define'
import { S3Client } from './client'
import {
	abortMultipartUploadInputSchema,
	abortMultipartUploadOutputSchema,
	completeMultipartUploadInputSchema,
	completeMultipartUploadOutputSchema,
	copyObjectInputSchema,
	copyObjectOutputSchema,
	createMultipartUploadInputSchema,
	createMultipartUploadOutputSchema,
	deleteObjectInputSchema,
	deleteObjectOutputSchema,
	getObjectInputSchema,
	getObjectOutputSchema,
	headObjectInputSchema,
	headObjectOutputSchema,
	listObjectsInputSchema,
	listObjectsOutputSchema,
	putObjectInputSchema,
	putObjectOutputSchema,
	s3AuthSchema,
	signedUrlInputSchema,
	signedUrlOutputSchema,
	uploadPartInputSchema,
	uploadPartOutputSchema
} from './contracts'

export const s3ListObjectsTool = defineTool({
	id: 's3-list-objects',
	name: 's3ListObjects',
	description:
		'List objects in the bound S3 bucket. Use prefix, delimiter, cursor, and limit for filtered pagination. Returns keys, items with metadata, next_cursor, and truncated.',
	inputSchema: listObjectsInputSchema,
	outputSchema: listObjectsOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => S3Client.fromContext(ctx).list(input)
})

export const s3GetObjectTool = defineTool({
	id: 's3-get-object',
	name: 's3GetObject',
	description:
		'Download one object by key from S3. Bodies larger than 5 MiB fail. Returns body as base64 by default or utf8 when requested.',
	inputSchema: getObjectInputSchema,
	outputSchema: getObjectOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => S3Client.fromContext(ctx).get(input)
})

export const s3PutObjectTool = defineTool({
	id: 's3-put-object',
	name: 's3PutObject',
	description:
		'Upload or replace one object by key in S3. Provide utf8 text or base64 body. Bodies larger than 5 MiB fail.',
	inputSchema: putObjectInputSchema,
	outputSchema: putObjectOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => S3Client.fromContext(ctx).put(input)
})

export const s3DeleteObjectTool = defineTool({
	id: 's3-delete-object',
	name: 's3DeleteObject',
	description: 'Delete one object by key in S3. Idempotent for missing keys (404 treated as success).',
	inputSchema: deleteObjectInputSchema,
	outputSchema: deleteObjectOutputSchema,
	sideEffect: 'delete',
	runtime: 'both',
	execute: async (input, ctx) => S3Client.fromContext(ctx).delete(input)
})

export const s3HeadObjectTool = defineTool({
	id: 's3-head-object',
	name: 's3HeadObject',
	description:
		'Inspect S3 object metadata by key without downloading the body. Returns exists flag plus content type, length, and ETag when present.',
	inputSchema: headObjectInputSchema,
	outputSchema: headObjectOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => S3Client.fromContext(ctx).head(input)
})

export const s3CopyObjectTool = defineTool({
	id: 's3-copy-object',
	name: 's3CopyObject',
	description:
		'Copy one S3 object to a new key. Set source_bucket only for an allowed cross-bucket copy; otherwise the configured bucket is used.',
	inputSchema: copyObjectInputSchema,
	outputSchema: copyObjectOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => S3Client.fromContext(ctx).copy(input)
})

export const s3CreateSignedUrlTool = defineTool({
	id: 's3-create-signed-url',
	name: 's3CreateSignedUrl',
	description: 'Create a time-limited presigned S3 URL for one object key. Defaults to GET for 3600 seconds.',
	inputSchema: signedUrlInputSchema,
	outputSchema: signedUrlOutputSchema,
	sideEffect: 'none',
	runtime: 'both',
	execute: async (input, ctx) => S3Client.fromContext(ctx).createSignedUrl(input)
})

export const s3CreateMultipartUploadTool = defineTool({
	id: 's3-create-multipart-upload',
	name: 's3CreateMultipartUpload',
	description:
		'Start an S3 multipart upload for one object key. Returns upload_id for uploadPart/complete/abort. Use for objects larger than the single put limit.',
	inputSchema: createMultipartUploadInputSchema,
	outputSchema: createMultipartUploadOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => S3Client.fromContext(ctx).createMultipartUpload(input)
})

export const s3UploadPartTool = defineTool({
	id: 's3-upload-part',
	name: 's3UploadPart',
	description:
		'Upload one part of an in-progress S3 multipart upload. Part bodies up to 25 MiB. S3 requires each part except the last to be at least 5 MiB. Returns etag required for completeMultipartUpload.',
	inputSchema: uploadPartInputSchema,
	outputSchema: uploadPartOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => S3Client.fromContext(ctx).uploadPart(input)
})

export const s3CompleteMultipartUploadTool = defineTool({
	id: 's3-complete-multipart-upload',
	name: 's3CompleteMultipartUpload',
	description:
		'Finish an S3 multipart upload by assembling uploaded parts (part_number + etag). Parts may be supplied in any order; they are sorted by part_number before complete.',
	inputSchema: completeMultipartUploadInputSchema,
	outputSchema: completeMultipartUploadOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => S3Client.fromContext(ctx).completeMultipartUpload(input)
})

export const s3AbortMultipartUploadTool = defineTool({
	id: 's3-abort-multipart-upload',
	name: 's3AbortMultipartUpload',
	description: 'Abort an in-progress S3 multipart upload and discard uploaded parts for that upload_id.',
	inputSchema: abortMultipartUploadInputSchema,
	outputSchema: abortMultipartUploadOutputSchema,
	sideEffect: 'delete',
	runtime: 'both',
	execute: async (input, ctx) => S3Client.fromContext(ctx).abortMultipartUpload(input)
})

export const s3Module = defineModule({
	id: 's3',
	title: 'S3 / S3-compatible',
	description:
		'Store and retrieve objects with S3-compatible storage. Use for object listing, reads, writes, metadata, copies, deletion, signed URLs, and multipart uploads.',
	runtime: 'both',
	auth: { type: 'custom', schema: s3AuthSchema },
	tools: [
		s3ListObjectsTool,
		s3GetObjectTool,
		s3PutObjectTool,
		s3DeleteObjectTool,
		s3HeadObjectTool,
		s3CopyObjectTool,
		s3CreateSignedUrlTool,
		s3CreateMultipartUploadTool,
		s3UploadPartTool,
		s3CompleteMultipartUploadTool,
		s3AbortMultipartUploadTool
	]
})
