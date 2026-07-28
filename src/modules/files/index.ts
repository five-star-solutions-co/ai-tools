/**
 * Public files surface.
 * Internals: client + path helpers.
 */

export { FilesClient } from './client'
export {
	filesAuthSchema,
	filesCopyTool,
	filesCreateArtifactTool,
	filesDeleteTool,
	filesGetRangeTool,
	filesGetTool,
	filesListTool,
	filesMkdirTool,
	filesModule,
	filesMoveTool,
	filesMultipartAbortTool,
	filesMultipartCompleteTool,
	filesMultipartStartTool,
	filesMultipartUploadPartTool,
	filesPutTool,
	filesReadLinesTool,
	filesSearchTool,
	filesStatTool
} from './module'
export type { FilesAuth } from './module'
export type { FileItem, FilesListInput, FilesSearchInput, FilesStatInput } from './contracts'
export { normalizeRootPrefix, resolveUnderRoot, toRelativeKey } from './path'
