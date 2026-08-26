/**
 * Cloudflare Sandbox Bridge HTTP API contracts.
 * Host deploys the bridge Worker; this pack is a Bearer client.
 * @see https://developers.cloudflare.com/sandbox/bridge/http-api/
 */

import { z } from 'zod'

import { s3AuthSchema } from '../s3/contracts'

export const MAX_ARGV = 64
export const MAX_ARG_CHARS = 100_000
export const MAX_FILE_PATH = 1024
export const MAX_FILE_TEXT = 2_000_000
/** Bridge hard cap is 32 MiB; package tool path uses the same bound. */
export const MAX_FILE_BYTES = 32 * 1024 * 1024
export const MAX_WRITE_FILES = 20
export const MAX_READ_PATHS = 50
export const MAX_LIST_FILES = 500
export const DEFAULT_EXEC_TIMEOUT_MS = 30_000
export const MAX_EXEC_TIMEOUT_MS = 600_000

export const cloudflareSandboxAuthSchema = z.object({
	base_url: z
		.string()
		.min(1)
		.describe('Sandbox bridge base URL including any mount prefix, for example https://container.example/sandbox'),
	api_key: z.string().min(1).describe('Bridge SANDBOX_API_KEY Bearer token'),
	storage: s3AuthSchema
		.optional()
		.describe('Optional S3-compatible storage for importArtifact / exportArtifact (ArtifactRef)')
})

export type CloudflareSandboxAuth = z.infer<typeof cloudflareSandboxAuthSchema>

/** Object-store ArtifactRef for sandbox import/export. */
export const sandboxObjectArtifactRefSchema = z.object({
	store: z.literal('object').describe('Object store containing the artifact'),
	key: z.string().min(1).describe('Object key'),
	media_type: z.string().min(1).optional().describe('MIME or format hint when known'),
	filename: z.string().min(1).optional().describe('Original or display file name'),
	byte_length: z.int().min(0).optional().describe('Size in bytes when known')
})

export type SandboxObjectArtifactRef = z.infer<typeof sandboxObjectArtifactRefSchema>

const sandboxId = z.string().min(1).max(200).describe('Sandbox id returned by create')

export const sandboxIdInputSchema = z.object({
	sandbox_id: sandboxId
})

export const createSandboxOutputSchema = z.object({
	sandbox_id: z.string().describe('Created sandbox id')
})

export const destroySandboxOutputSchema = z.object({
	sandbox_id: z.string(),
	destroyed: z.literal(true)
})

export const runningOutputSchema = z.object({
	sandbox_id: z.string(),
	running: z.boolean().describe('Whether the container is live')
})

export const healthOutputSchema = z.object({
	ok: z.boolean()
})

export const execInputSchema = z.object({
	sandbox_id: sandboxId,
	argv: z
		.array(z.string().min(1).max(MAX_ARG_CHARS))
		.min(1)
		.max(MAX_ARGV)
		.describe('Command argv array (not a shell string). Example: ["python3","-c","print(1)"]'),
	timeout_ms: z
		.int()
		.min(1)
		.max(MAX_EXEC_TIMEOUT_MS)
		.optional()
		.describe(`Exec timeout in ms (default ${DEFAULT_EXEC_TIMEOUT_MS})`),
	cwd: z.string().min(1).max(MAX_FILE_PATH).optional().describe('Working directory (default /workspace)'),
	session_id: z
		.string()
		.min(1)
		.max(200)
		.optional()
		.describe('Optional bridge session id for isolated working directory and runtime state'),
	env: z
		.record(z.string().min(1).max(128), z.string().max(8_192))
		.optional()
		.describe('Optional environment variables for the process when the bridge supports env')
})

export const execOutputSchema = z.object({
	sandbox_id: z.string(),
	stdout: z.string().describe('Decoded standard output'),
	stderr: z.string().describe('Decoded standard error'),
	exit_code: z.number().int().optional().describe('Process exit code when the stream ends with exit'),
	success: z.boolean().describe('True when exit_code is 0'),
	error: z.string().optional().describe('Bridge error message when the stream ends with error'),
	error_code: z.string().optional().describe('Bridge error code when present')
})

const filePathField = z
	.string()
	.min(1)
	.max(MAX_FILE_PATH)
	.describe('Path under workspace (with or without /workspace/ prefix)')

const sessionIdField = z.string().min(1).max(200).optional().describe('Optional Session-Id header')

const writeFileBodyFields = {
	text: z.string().max(MAX_FILE_TEXT).optional().describe('Utf-8 file contents (omit when body_base64 is set)'),
	body_base64: z
		.string()
		.min(1)
		.optional()
		.describe('Base64 file bytes for binary content (omit when text is set; max 32 MiB decoded)')
}

function refineExactlyOneBody(
	val: { text?: string | undefined; body_base64?: string | undefined },
	ctx: z.RefinementCtx
): void {
	const hasText = val.text !== undefined
	const hasB64 = val.body_base64 !== undefined
	if (hasText === hasB64) {
		ctx.addIssue({
			code: 'custom',
			message: 'Provide exactly one of text or body_base64'
		})
	}
}

export const writeFileInputSchema = z
	.object({
		sandbox_id: sandboxId,
		path: filePathField,
		...writeFileBodyFields,
		session_id: sessionIdField
	})
	.superRefine(refineExactlyOneBody)

export const writeFileOutputSchema = z.object({
	sandbox_id: z.string(),
	path: z.string(),
	ok: z.literal(true),
	byte_length: z.number().int().nonnegative().optional().describe('Decoded byte length written when known')
})

export const readFileInputSchema = z.object({
	sandbox_id: sandboxId,
	path: filePathField,
	encoding: z
		.enum(['utf8', 'base64'])
		.optional()
		.describe('Response encoding (default utf8 for text; use base64 for binary)'),
	session_id: sessionIdField
})

export const readFileOutputSchema = z.object({
	sandbox_id: z.string(),
	path: z.string(),
	text: z.string().optional().describe('Utf-8 contents when encoding is utf8 (default)'),
	body_base64: z.string().optional().describe('Base64 contents when encoding is base64'),
	byte_length: z.number().int().nonnegative().optional().describe('Decoded byte length')
})

export const writeFilesInputSchema = z.object({
	sandbox_id: sandboxId,
	files: z
		.array(
			z
				.object({
					path: z.string().min(1).max(MAX_FILE_PATH).describe('Path under workspace'),
					...writeFileBodyFields
				})
				.superRefine(refineExactlyOneBody)
		)
		.min(1)
		.max(MAX_WRITE_FILES)
		.describe('Files to write under workspace (text or body_base64 each)'),
	session_id: sessionIdField
})

export const writeFilesOutputSchema = z.object({
	sandbox_id: z.string(),
	paths: z.array(z.string()),
	ok: z.literal(true)
})

export const readFilesInputSchema = z.object({
	sandbox_id: sandboxId,
	paths: z
		.array(z.string().min(1).max(MAX_FILE_PATH).describe('Path under workspace'))
		.min(1)
		.max(MAX_READ_PATHS)
		.describe('Paths to read under workspace'),
	encoding: z.enum(['utf8', 'base64']).optional().describe('Response encoding for all files (default utf8)'),
	session_id: sessionIdField
})

export const readFilesOutputSchema = z.object({
	sandbox_id: z.string(),
	files: z.array(
		z.object({
			path: z.string(),
			text: z.string().optional(),
			body_base64: z.string().optional(),
			byte_length: z.number().int().nonnegative().optional()
		})
	)
})

export const listFilesInputSchema = z.object({
	sandbox_id: sandboxId,
	directory_path: z.string().max(MAX_FILE_PATH).optional().describe('Directory to list (default /workspace)'),
	session_id: sessionIdField
})

export const listFilesOutputSchema = z.object({
	sandbox_id: z.string(),
	paths: z.array(z.string()).describe('Absolute or workspace-relative file paths found'),
	raw: z.unknown().optional().describe('Provider listing payload when available')
})

export const removeFilesInputSchema = z.object({
	sandbox_id: sandboxId,
	paths: z
		.array(z.string().min(1).max(MAX_FILE_PATH))
		.min(1)
		.max(MAX_READ_PATHS)
		.describe('Paths to remove under workspace'),
	session_id: sessionIdField
})

export const removeFilesOutputSchema = z.object({
	sandbox_id: z.string(),
	paths: z.array(z.string()),
	ok: z.literal(true)
})

export const importArtifactInputSchema = z.object({
	sandbox_id: sandboxId,
	path: filePathField,
	source: sandboxObjectArtifactRefSchema.describe('Object-store ArtifactRef to copy into the sandbox'),
	session_id: sessionIdField
})

export const importArtifactOutputSchema = z.object({
	sandbox_id: z.string(),
	path: z.string(),
	ok: z.literal(true),
	byte_length: z.number().int().nonnegative()
})

export const exportArtifactInputSchema = z.object({
	sandbox_id: sandboxId,
	path: filePathField,
	destination_key: z.string().min(1).describe('Object key to write under bound storage'),
	session_id: sessionIdField
})

export const exportArtifactOutputSchema = z.object({
	sandbox_id: z.string(),
	path: z.string(),
	artifact: sandboxObjectArtifactRefSchema
})

export const createBridgeSessionOutputSchema = z.object({
	sandbox_id: z.string(),
	session_id: z.string().describe('Bridge session id for Session-Id header')
})

export const deleteBridgeSessionInputSchema = z.object({
	sandbox_id: sandboxId,
	session_id: z.string().min(1).max(200).describe('Bridge session id to delete')
})

export const deleteBridgeSessionOutputSchema = z.object({
	sandbox_id: z.string(),
	session_id: z.string(),
	deleted: z.literal(true)
})

const interpreterLanguageSchema = z.enum(['python', 'javascript', 'typescript'])

export const executeCodeInputSchema = z.object({
	sandbox_id: sandboxId,
	code: z.string().min(1).max(MAX_ARG_CHARS).describe('Source code to run'),
	language: interpreterLanguageSchema.optional().describe('Interpreter language (default python)'),
	timeout_ms: z
		.int()
		.min(1)
		.max(MAX_EXEC_TIMEOUT_MS)
		.optional()
		.describe(`Exec timeout in ms (default ${DEFAULT_EXEC_TIMEOUT_MS})`),
	context_id: z
		.string()
		.min(1)
		.max(200)
		.optional()
		.describe('Optional interpreter context id; omit to reuse the sandbox language context')
})

export const createCodeContextInputSchema = z.object({
	sandbox_id: sandboxId,
	language: interpreterLanguageSchema.optional().describe('Interpreter language (default python)'),
	cwd: z.string().min(1).max(MAX_FILE_PATH).optional().describe('Working directory (default /workspace)'),
	env: z
		.record(z.string().min(1).max(128), z.string().max(8_192))
		.optional()
		.describe('Environment variables for the interpreter context'),
	timeout_ms: z
		.int()
		.min(1)
		.max(MAX_EXEC_TIMEOUT_MS)
		.optional()
		.describe(`Context create timeout in ms (default ${DEFAULT_EXEC_TIMEOUT_MS})`)
})

export const createCodeContextOutputSchema = z.object({
	sandbox_id: z.string(),
	context_id: z.string().describe('Persistent interpreter context id'),
	language: interpreterLanguageSchema.optional(),
	cwd: z.string().optional()
})

export const listCodeContextsOutputSchema = z.object({
	sandbox_id: z.string(),
	contexts: z.array(
		z.object({
			context_id: z.string(),
			language: z.string().optional(),
			cwd: z.string().optional()
		})
	)
})

export const deleteCodeContextInputSchema = z.object({
	sandbox_id: sandboxId,
	context_id: z.string().min(1).max(200).describe('Interpreter context id to delete')
})

export const deleteCodeContextOutputSchema = z.object({
	sandbox_id: z.string(),
	context_id: z.string(),
	deleted: z.literal(true)
})

export const runCodeInputSchema = z.object({
	sandbox_id: sandboxId,
	code: z.string().min(1).max(MAX_ARG_CHARS).describe('Source to run in the interpreter context'),
	context_id: z.string().min(1).max(200).optional().describe('Interpreter context id; omit for the language default'),
	language: interpreterLanguageSchema.optional().describe('Interpreter language when creating a default context'),
	timeout_ms: z
		.int()
		.min(1)
		.max(MAX_EXEC_TIMEOUT_MS)
		.optional()
		.describe(`Run timeout in ms (default ${DEFAULT_EXEC_TIMEOUT_MS})`)
})

/**
 * Mount an S3-compatible bucket into the sandbox filesystem.
 * @see https://developers.cloudflare.com/sandbox/bridge/http-api/#bucket-mounts
 *
 * Two bridge modes:
 * - **R2 binding:** omit `endpoint`; `bucket` is the Worker R2 binding name.
 * - **Remote S3/R2/GCS:** set `endpoint` (+ optional credentials; bridge may use Worker secrets).
 */
export const mountBucketInputSchema = z.object({
	sandbox_id: sandboxId,
	bucket: z
		.string()
		.min(1)
		.max(256)
		.describe(
			'R2 Worker binding name when endpoint is omitted; otherwise the remote bucket name (e.g. for S3/R2 endpoint mounts)'
		),
	mount_path: z
		.string()
		.min(1)
		.max(MAX_FILE_PATH)
		.refine((p) => p.startsWith('/'), { message: 'mount_path must be an absolute path (start with /)' })
		.describe('Absolute path inside the sandbox to mount at (e.g. /data or /mnt/workspace)'),
	endpoint: z
		.url()
		.optional()
		.describe(
			'S3-compatible endpoint URL (e.g. https://s3.amazonaws.com or https://ACCOUNT.r2.cloudflarestorage.com). Omit for Worker R2 binding mounts'
		),
	provider: z
		.enum(['r2', 's3', 'gcs'])
		.optional()
		.describe('Provider hint for s3fs optimizations when using endpoint mounts'),
	read_only: z.boolean().optional().describe('Mount read-only (default false)'),
	prefix: z
		.string()
		.min(1)
		.max(MAX_FILE_PATH)
		.optional()
		.describe('Bucket prefix/subdirectory to expose at the mount (must start with / when set)'),
	access_key_id: z
		.string()
		.min(1)
		.optional()
		.describe('Access key for endpoint mounts (maps to bridge credentials.accessKeyId)'),
	secret_access_key: z
		.string()
		.min(1)
		.optional()
		.describe('Secret key for endpoint mounts (maps to bridge credentials.secretAccessKey)'),
	credential_proxy: z
		.boolean()
		.optional()
		.describe(
			'When true, bridge keeps credentials out of the container (egress signing). Endpoint mounts only; requires ContainerProxy on the bridge Worker'
		),
	local_bucket: z
		.boolean()
		.optional()
		.describe('When true, use local R2 binding sync (wrangler dev). Mutually exclusive with endpoint'),
	s3fs_options: z
		.array(z.string().min(1).max(256))
		.max(32)
		.optional()
		.describe('Advanced s3fs mount flags (e.g. use_cache=/tmp/cache)')
})

export const mountBucketOutputSchema = z.object({
	sandbox_id: z.string(),
	bucket: z.string(),
	mount_path: z.string(),
	ok: z.literal(true)
})

export const unmountBucketInputSchema = z.object({
	sandbox_id: sandboxId,
	mount_path: z
		.string()
		.min(1)
		.max(MAX_FILE_PATH)
		.refine((p) => p.startsWith('/'), { message: 'mount_path must be an absolute path (start with /)' })
		.describe('Absolute mount path previously passed to mount')
})

export const unmountBucketOutputSchema = z.object({
	sandbox_id: z.string(),
	mount_path: z.string(),
	ok: z.literal(true)
})

export type SandboxIdInput = z.infer<typeof sandboxIdInputSchema>
export type CreateSandboxOutput = z.infer<typeof createSandboxOutputSchema>
export type DestroySandboxOutput = z.infer<typeof destroySandboxOutputSchema>
export type RunningOutput = z.infer<typeof runningOutputSchema>
export type HealthOutput = z.infer<typeof healthOutputSchema>
export type ExecInput = z.infer<typeof execInputSchema>
export type ExecOutput = z.infer<typeof execOutputSchema>
export type WriteFileInput = z.infer<typeof writeFileInputSchema>
export type WriteFileOutput = z.infer<typeof writeFileOutputSchema>
export type ReadFileInput = z.infer<typeof readFileInputSchema>
export type ReadFileOutput = z.infer<typeof readFileOutputSchema>
export type WriteFilesInput = z.infer<typeof writeFilesInputSchema>
export type WriteFilesOutput = z.infer<typeof writeFilesOutputSchema>
export type ReadFilesInput = z.infer<typeof readFilesInputSchema>
export type ReadFilesOutput = z.infer<typeof readFilesOutputSchema>
export type ListFilesInput = z.infer<typeof listFilesInputSchema>
export type ListFilesOutput = z.infer<typeof listFilesOutputSchema>
export type RemoveFilesInput = z.infer<typeof removeFilesInputSchema>
export type RemoveFilesOutput = z.infer<typeof removeFilesOutputSchema>
export type ImportArtifactInput = z.infer<typeof importArtifactInputSchema>
export type ImportArtifactOutput = z.infer<typeof importArtifactOutputSchema>
export type ExportArtifactInput = z.infer<typeof exportArtifactInputSchema>
export type ExportArtifactOutput = z.infer<typeof exportArtifactOutputSchema>
export type CreateBridgeSessionOutput = z.infer<typeof createBridgeSessionOutputSchema>
export type DeleteBridgeSessionInput = z.infer<typeof deleteBridgeSessionInputSchema>
export type DeleteBridgeSessionOutput = z.infer<typeof deleteBridgeSessionOutputSchema>
export type ExecuteCodeInput = z.infer<typeof executeCodeInputSchema>
export type CreateCodeContextInput = z.infer<typeof createCodeContextInputSchema>
export type CreateCodeContextOutput = z.infer<typeof createCodeContextOutputSchema>
export type ListCodeContextsOutput = z.infer<typeof listCodeContextsOutputSchema>
export type DeleteCodeContextInput = z.infer<typeof deleteCodeContextInputSchema>
export type DeleteCodeContextOutput = z.infer<typeof deleteCodeContextOutputSchema>
export type RunCodeInput = z.infer<typeof runCodeInputSchema>
export type MountBucketInput = z.infer<typeof mountBucketInputSchema>
export type MountBucketOutput = z.infer<typeof mountBucketOutputSchema>
export type UnmountBucketInput = z.infer<typeof unmountBucketInputSchema>
export type UnmountBucketOutput = z.infer<typeof unmountBucketOutputSchema>
