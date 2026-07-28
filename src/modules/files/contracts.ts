import { z } from 'zod'

import { artifactRefSchema } from '../../shared/artifact'
import { s3AuthSchema } from '../../vendors/s3'

/** Max bytes for a single range read through files tools. */
export const MAX_FILES_RANGE_BYTES = 8 * 1024 * 1024
/** Max lines for files-read-lines. */
export const MAX_FILES_READ_LINES = 2_000
/** Max UTF-8 bytes scanned for line reads. */
export const MAX_FILES_LINES_SCAN_BYTES = 2 * 1024 * 1024

export const filesAuthSchema = z.object({
	root_prefix: z
		.string()
		.min(1)
		.describe('Object key prefix for this workspace, for example orgs/acme/files/ (no leading slash)'),
	storage: s3AuthSchema.describe(
		'S3-compatible object storage credentials (AWS S3, R2 S3 endpoint, MinIO, …) for this workspace'
	)
})

export type FilesAuth = z.infer<typeof filesAuthSchema>

export const fileItemSchema = z.object({
	path: z.string().describe('Path relative to the bound root_prefix'),
	kind: z.enum(['file', 'folder']).describe('Object file or common-prefix folder'),
	size: z.number().optional().describe('Byte size when kind is file and known'),
	last_modified: z.string().optional().describe('Last-modified timestamp when known'),
	etag: z.string().optional().describe('ETag when known'),
	media_type: z.string().optional().describe('Content-Type when known from head')
})

export const filesListInputSchema = z.object({
	path: z.string().optional().describe('Relative folder path under root (no leading slash). Omit for workspace root'),
	cursor: z.string().min(1).optional().describe('Pagination cursor from a prior list call'),
	limit: z.int().min(1).max(1000).optional().describe('Maximum items to return (1-1000)')
})

export const filesListOutputSchema = z.object({
	items: z.array(fileItemSchema),
	next_cursor: z.string().optional().describe('Pass as cursor for the next page'),
	truncated: z.boolean()
})

export const filesSearchInputSchema = z.object({
	query: z
		.string()
		.min(1)
		.max(200)
		.describe('Literal name fragment to match against the last path segment (not full-text content)'),
	path: z
		.string()
		.optional()
		.describe('Optional relative folder to search under. Omit to search the whole root prefix'),
	cursor: z.string().min(1).optional().describe('Pagination cursor from a prior search call'),
	limit: z.int().min(1).max(1000).optional().describe('Maximum items to scan/return (1-1000)')
})

export const filesSearchOutputSchema = z.object({
	items: z.array(fileItemSchema),
	next_cursor: z.string().optional(),
	truncated: z.boolean()
})

export const filesStatInputSchema = z.object({
	path: z.string().min(1).describe('Relative file path under root (no leading slash)')
})

export const filesStatOutputSchema = z.object({
	exists: z.boolean(),
	item: fileItemSchema.optional()
})

export const filesGetInputSchema = z.object({
	path: z.string().min(1).describe('Relative file path under root'),
	encoding: z.enum(['base64', 'utf8']).optional().describe('Body encoding. Defaults to base64')
})

export const filesGetOutputSchema = z.object({
	path: z.string(),
	body: z.string().describe('File body encoded per encoding'),
	encoding: z.enum(['base64', 'utf8']),
	content_type: z.string().optional(),
	content_length: z.number().optional()
})

export const filesGetRangeInputSchema = z.object({
	path: z.string().min(1).describe('Relative file path under root'),
	start_byte: z.int().min(0).describe('Inclusive start byte offset'),
	end_byte: z.int().min(0).describe(`Inclusive end byte offset (range size max ${MAX_FILES_RANGE_BYTES} bytes)`),
	encoding: z.enum(['base64', 'utf8']).optional().describe('Body encoding. Defaults to base64')
})

export const filesGetRangeOutputSchema = z.object({
	path: z.string(),
	body: z.string().describe('Range body encoded per encoding'),
	encoding: z.enum(['base64', 'utf8']),
	start_byte: z.number().int().nonnegative(),
	end_byte: z.number().int().nonnegative(),
	total_bytes: z.number().int().nonnegative().optional().describe('Full object size when known'),
	content_type: z.string().optional()
})

export const filesReadLinesInputSchema = z.object({
	path: z.string().min(1).describe('Relative file path under root (UTF-8 text)'),
	start_line: z.int().min(1).optional().describe('1-based start line (default 1)'),
	max_lines: z
		.int()
		.min(1)
		.max(MAX_FILES_READ_LINES)
		.optional()
		.describe(`Max lines to return (default 200, max ${MAX_FILES_READ_LINES})`)
})

export const filesReadLinesOutputSchema = z.object({
	path: z.string(),
	start_line: z.number().int().positive(),
	lines: z.array(z.string()),
	truncated: z.boolean().describe('True when more lines may exist after this page'),
	next_start_line: z.number().int().positive().optional().describe('Pass as start_line for the next page')
})

export const filesCreateArtifactInputSchema = z.object({
	path: z.string().min(1).describe('Relative file path under root to expose as ArtifactRef'),
	filename: z.string().min(1).optional().describe('Display filename on the ArtifactRef'),
	media_type: z.string().min(1).optional().describe('MIME type override (defaults from head when known)')
})

export const filesCreateArtifactOutputSchema = z.object({
	path: z.string(),
	artifact: artifactRefSchema.describe(
		'Object-store ArtifactRef for the same object (logical key under storage key_prefix + root_prefix)'
	)
})

export const filesPutInputSchema = z.object({
	path: z.string().min(1).describe('Relative file path under root to write or replace'),
	body: z.string().describe('File body as utf8 text or base64 (see body_encoding)'),
	body_encoding: z.enum(['utf8', 'base64']).optional().describe('How to interpret body. Defaults to utf8'),
	content_type: z.string().optional().describe('Content-Type to store')
})

export const filesPutOutputSchema = z.object({
	path: z.string(),
	content_length: z.number(),
	etag: z.string().optional()
})

export const filesDeleteInputSchema = z.object({
	path: z.string().min(1).describe('Relative file path under root to delete')
})

export const filesDeleteOutputSchema = z.object({
	path: z.string(),
	deleted: z.boolean()
})

export const filesCopyInputSchema = z.object({
	source_path: z.string().min(1).describe('Relative source path under root'),
	destination_path: z.string().min(1).describe('Relative destination path under root')
})

export const filesCopyOutputSchema = z.object({
	source_path: z.string(),
	destination_path: z.string(),
	etag: z.string().optional()
})

export const filesMkdirInputSchema = z.object({
	path: z.string().min(1).describe('Relative folder path under root. Creates a marker object so the prefix is listable')
})

export const filesMkdirOutputSchema = z.object({
	path: z.string(),
	created: z.boolean()
})

export const filesMoveInputSchema = z.object({
	source_path: z.string().min(1).describe('Relative source path under root to move from'),
	destination_path: z.string().min(1).describe('Relative destination path under root to move to')
})

export const filesMoveOutputSchema = z.object({
	source_path: z.string(),
	destination_path: z.string(),
	etag: z.string().optional().describe('ETag of the destination object after copy')
})

export const filesMultipartStartInputSchema = z.object({
	path: z.string().min(1).describe('Relative file path under root for the multipart upload'),
	content_type: z.string().optional().describe('Content-Type stored on the completed object')
})

export const filesMultipartStartOutputSchema = z.object({
	path: z.string(),
	upload_id: z.string().min(1).describe('Upload id for subsequent part/complete/abort calls')
})

export const filesMultipartUploadPartInputSchema = z.object({
	path: z.string().min(1).describe('Relative file path under root for the in-progress multipart upload'),
	upload_id: z.string().min(1).describe('Upload id from files-multipart-start'),
	part_number: z.int().min(1).max(10_000).describe('Part number (1-10000)'),
	body: z.string().describe('Part body as utf8 text or base64 (see body_encoding)'),
	body_encoding: z.enum(['utf8', 'base64']).optional().describe('How to interpret body. Defaults to utf8')
})

export const filesMultipartUploadPartOutputSchema = z.object({
	path: z.string(),
	upload_id: z.string(),
	part_number: z.int(),
	etag: z.string().min(1).describe('Part ETag required when completing the multipart upload'),
	content_length: z.number()
})

export const filesMultipartPartSchema = z.object({
	part_number: z.int().min(1).max(10_000),
	etag: z.string().min(1)
})

export const filesMultipartCompleteInputSchema = z.object({
	path: z.string().min(1).describe('Relative file path under root for the in-progress multipart upload'),
	upload_id: z.string().min(1).describe('Upload id from files-multipart-start'),
	parts: z
		.array(filesMultipartPartSchema)
		.min(1)
		.max(10_000)
		.describe('Uploaded parts with part_number and etag (any order; sorted before complete)')
})

export const filesMultipartCompleteOutputSchema = z.object({
	path: z.string(),
	upload_id: z.string(),
	etag: z.string().optional()
})

export const filesMultipartAbortInputSchema = z.object({
	path: z.string().min(1).describe('Relative file path under root for the in-progress multipart upload'),
	upload_id: z.string().min(1).describe('Upload id from files-multipart-start')
})

export const filesMultipartAbortOutputSchema = z.object({
	path: z.string(),
	upload_id: z.string(),
	aborted: z.boolean()
})

export type FilesListInput = z.infer<typeof filesListInputSchema>
export type FilesListOutput = z.infer<typeof filesListOutputSchema>
export type FilesSearchInput = z.infer<typeof filesSearchInputSchema>
export type FilesSearchOutput = z.infer<typeof filesSearchOutputSchema>
export type FilesStatInput = z.infer<typeof filesStatInputSchema>
export type FilesStatOutput = z.infer<typeof filesStatOutputSchema>
export type FilesGetInput = z.infer<typeof filesGetInputSchema>
export type FilesGetRangeInput = z.infer<typeof filesGetRangeInputSchema>
export type FilesReadLinesInput = z.infer<typeof filesReadLinesInputSchema>
export type FilesCreateArtifactInput = z.infer<typeof filesCreateArtifactInputSchema>
export type FilesPutInput = z.infer<typeof filesPutInputSchema>
export type FilesDeleteInput = z.infer<typeof filesDeleteInputSchema>
export type FilesCopyInput = z.infer<typeof filesCopyInputSchema>
export type FilesMkdirInput = z.infer<typeof filesMkdirInputSchema>
export type FilesMoveInput = z.infer<typeof filesMoveInputSchema>
export type FilesMultipartStartInput = z.infer<typeof filesMultipartStartInputSchema>
export type FilesMultipartUploadPartInput = z.infer<typeof filesMultipartUploadPartInputSchema>
export type FilesMultipartCompleteInput = z.infer<typeof filesMultipartCompleteInputSchema>
export type FilesMultipartAbortInput = z.infer<typeof filesMultipartAbortInputSchema>
export type FileItem = z.infer<typeof fileItemSchema>
