import { defineModule, defineTool } from '../../core/define'
import { FilesClient } from './client'
import {
	filesAuthSchema,
	filesCopyInputSchema,
	filesCopyOutputSchema,
	filesDeleteInputSchema,
	filesDeleteOutputSchema,
	filesGetInputSchema,
	filesGetOutputSchema,
	filesListInputSchema,
	filesListOutputSchema,
	filesMkdirInputSchema,
	filesMkdirOutputSchema,
	filesMoveInputSchema,
	filesMoveOutputSchema,
	filesMultipartAbortInputSchema,
	filesMultipartAbortOutputSchema,
	filesMultipartCompleteInputSchema,
	filesMultipartCompleteOutputSchema,
	filesMultipartStartInputSchema,
	filesMultipartStartOutputSchema,
	filesMultipartUploadPartInputSchema,
	filesMultipartUploadPartOutputSchema,
	filesPutInputSchema,
	filesPutOutputSchema,
	filesSearchInputSchema,
	filesSearchOutputSchema,
	filesStatInputSchema,
	filesStatOutputSchema
} from './contracts'

export type { FilesAuth } from './contracts'
export { filesAuthSchema }

export const filesListTool = defineTool({
	id: 'files-list',
	name: 'listFiles',
	description:
		'List files and folders under a relative path in the bound workspace root. Paths are relative to the host root prefix. Returns names, kinds, sizes when known, and pagination fields. Does not return file body bytes.',
	inputSchema: filesListInputSchema,
	outputSchema: filesListOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => FilesClient.fromContext(ctx).list(input)
})

export const filesSearchTool = defineTool({
	id: 'files-search',
	name: 'searchFiles',
	description:
		'Search for files and folders by name fragment under the bound workspace root (optional relative folder). Matches the last path segment only; not full-text content search. Returns metadata without file body bytes.',
	inputSchema: filesSearchInputSchema,
	outputSchema: filesSearchOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => FilesClient.fromContext(ctx).search(input)
})

export const filesStatTool = defineTool({
	id: 'files-stat',
	name: 'statFile',
	description:
		'Get metadata for one relative file path under the bound workspace root (exists, size, content type, etag when known). Does not return file body bytes.',
	inputSchema: filesStatInputSchema,
	outputSchema: filesStatOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => FilesClient.fromContext(ctx).stat(input)
})

export const filesGetTool = defineTool({
	id: 'files-get',
	name: 'getFile',
	description:
		'Download one file by relative path under the bound workspace root. Bodies larger than the storage provider limit fail. Returns body as base64 by default or utf8 when requested.',
	inputSchema: filesGetInputSchema,
	outputSchema: filesGetOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => FilesClient.fromContext(ctx).get(input)
})

export const filesPutTool = defineTool({
	id: 'files-put',
	name: 'putFile',
	description:
		'Upload or replace one file at a relative path under the bound workspace root. Provide utf8 text or base64 body. Paths cannot escape the root prefix.',
	inputSchema: filesPutInputSchema,
	outputSchema: filesPutOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => FilesClient.fromContext(ctx).put(input)
})

export const filesDeleteTool = defineTool({
	id: 'files-delete',
	name: 'deleteFile',
	description:
		'Delete one file by relative path under the bound workspace root. Idempotent when the object is already missing.',
	inputSchema: filesDeleteInputSchema,
	outputSchema: filesDeleteOutputSchema,
	sideEffect: 'delete',
	runtime: 'both',
	execute: async (input, ctx) => FilesClient.fromContext(ctx).delete(input)
})

export const filesCopyTool = defineTool({
	id: 'files-copy',
	name: 'copyFile',
	description:
		'Copy one file to a new relative path under the same bound workspace root. Both source and destination must stay inside the root prefix.',
	inputSchema: filesCopyInputSchema,
	outputSchema: filesCopyOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => FilesClient.fromContext(ctx).copy(input)
})

export const filesMkdirTool = defineTool({
	id: 'files-mkdir',
	name: 'makeFileDirectory',
	description:
		'Create a folder marker under the bound workspace root so the prefix is listable. Uses an empty .keep object inside the folder path.',
	inputSchema: filesMkdirInputSchema,
	outputSchema: filesMkdirOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => FilesClient.fromContext(ctx).mkdir(input)
})

export const filesMoveTool = defineTool({
	id: 'files-move',
	name: 'moveFile',
	description:
		'Move one file to a new relative path under the same bound workspace root (copy then delete source). Both paths must stay inside the root prefix. Destination is overwritten if it already exists when the store allows it.',
	inputSchema: filesMoveInputSchema,
	outputSchema: filesMoveOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => FilesClient.fromContext(ctx).move(input)
})

export const filesMultipartStartTool = defineTool({
	id: 'files-multipart-start',
	name: 'startFileMultipartUpload',
	description:
		'Start a multipart upload for a relative path under the bound workspace root. Returns upload_id for part/complete/abort. Use when the file exceeds the single put limit.',
	inputSchema: filesMultipartStartInputSchema,
	outputSchema: filesMultipartStartOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => FilesClient.fromContext(ctx).multipartStart(input)
})

export const filesMultipartUploadPartTool = defineTool({
	id: 'files-multipart-upload-part',
	name: 'uploadFileMultipartPart',
	description:
		'Upload one part of an in-progress multipart upload under the bound workspace root. Part bodies up to 25 MiB. Some object stores require each part except the last to be at least 5 MiB. Returns etag required for complete.',
	inputSchema: filesMultipartUploadPartInputSchema,
	outputSchema: filesMultipartUploadPartOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => FilesClient.fromContext(ctx).multipartUploadPart(input)
})

export const filesMultipartCompleteTool = defineTool({
	id: 'files-multipart-complete',
	name: 'completeFileMultipartUpload',
	description:
		'Complete a multipart upload under the bound workspace root by assembling uploaded parts (part_number + etag). Parts may be in any order.',
	inputSchema: filesMultipartCompleteInputSchema,
	outputSchema: filesMultipartCompleteOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => FilesClient.fromContext(ctx).multipartComplete(input)
})

export const filesMultipartAbortTool = defineTool({
	id: 'files-multipart-abort',
	name: 'abortFileMultipartUpload',
	description:
		'Abort an in-progress multipart upload under the bound workspace root and discard uploaded parts for that upload_id.',
	inputSchema: filesMultipartAbortInputSchema,
	outputSchema: filesMultipartAbortOutputSchema,
	sideEffect: 'delete',
	runtime: 'both',
	execute: async (input, ctx) => FilesClient.fromContext(ctx).multipartAbort(input)
})

export const filesModule = defineModule({
	id: 'files',
	title: 'Files',
	description:
		'Manage files under a host-bound object storage root prefix. Paths are relative to that root. List, search, stat, get, put, delete, copy, move, mkdir, and multipart stay inside the root; host maps tenant to prefix and storage credentials.',
	runtime: 'both',
	auth: { type: 'custom', schema: filesAuthSchema },
	tools: [
		filesListTool,
		filesSearchTool,
		filesStatTool,
		filesGetTool,
		filesPutTool,
		filesDeleteTool,
		filesCopyTool,
		filesMoveTool,
		filesMkdirTool,
		filesMultipartStartTool,
		filesMultipartUploadPartTool,
		filesMultipartCompleteTool,
		filesMultipartAbortTool
	]
})
