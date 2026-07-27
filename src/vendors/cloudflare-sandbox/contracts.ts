/**
 * Cloudflare Sandbox Bridge HTTP API contracts.
 * Host deploys the bridge Worker; this pack is a Bearer client.
 * @see https://developers.cloudflare.com/sandbox/bridge/http-api/
 */

import { z } from 'zod'

export const MAX_ARGV = 64
export const MAX_ARG_CHARS = 100_000
export const MAX_FILE_PATH = 1024
export const MAX_FILE_TEXT = 2_000_000
export const MAX_WRITE_FILES = 20
export const MAX_READ_PATHS = 50
export const DEFAULT_EXEC_TIMEOUT_MS = 30_000
export const MAX_EXEC_TIMEOUT_MS = 600_000

export const cloudflareSandboxAuthSchema = z.object({
	base_url: z
		.string()
		.min(1)
		.describe('Sandbox bridge Worker origin, for example https://sandbox-bridge.example.workers.dev'),
	api_key: z.string().min(1).describe('Bridge SANDBOX_API_KEY Bearer token')
})

export type CloudflareSandboxAuth = z.infer<typeof cloudflareSandboxAuthSchema>

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
		.describe('Optional bridge session id (Session-Id header) for isolated cwd/env')
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

export const writeFileInputSchema = z.object({
	sandbox_id: sandboxId,
	path: z.string().min(1).max(MAX_FILE_PATH).describe('Path under workspace (with or without /workspace/ prefix)'),
	text: z.string().max(MAX_FILE_TEXT).describe('Utf-8 file contents'),
	session_id: z.string().min(1).max(200).optional().describe('Optional Session-Id header')
})

export const writeFileOutputSchema = z.object({
	sandbox_id: z.string(),
	path: z.string(),
	ok: z.literal(true)
})

export const readFileInputSchema = z.object({
	sandbox_id: sandboxId,
	path: z.string().min(1).max(MAX_FILE_PATH).describe('Path under workspace (with or without /workspace/ prefix)'),
	session_id: z.string().min(1).max(200).optional().describe('Optional Session-Id header')
})

export const readFileOutputSchema = z.object({
	sandbox_id: z.string(),
	path: z.string(),
	text: z.string().describe('Utf-8 file contents')
})

export const writeFilesInputSchema = z.object({
	sandbox_id: sandboxId,
	files: z
		.array(
			z.object({
				path: z.string().min(1).max(MAX_FILE_PATH).describe('Path under workspace'),
				text: z.string().max(MAX_FILE_TEXT).describe('Utf-8 file contents')
			})
		)
		.min(1)
		.max(MAX_WRITE_FILES)
		.describe('Files to write under workspace'),
	session_id: z.string().min(1).max(200).optional().describe('Optional bridge session id (Session-Id header)')
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
	session_id: z.string().min(1).max(200).optional().describe('Optional bridge session id (Session-Id header)')
})

export const readFilesOutputSchema = z.object({
	sandbox_id: z.string(),
	files: z.array(
		z.object({
			path: z.string(),
			text: z.string()
		})
	)
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

export const executeCodeInputSchema = z.object({
	sandbox_id: sandboxId,
	code: z.string().min(1).max(MAX_ARG_CHARS).describe('Source code to run'),
	language: z
		.enum(['python', 'javascript', 'typescript', 'shell'])
		.optional()
		.describe('Runtime language (default python)'),
	timeout_ms: z
		.int()
		.min(1)
		.max(MAX_EXEC_TIMEOUT_MS)
		.optional()
		.describe(`Exec timeout in ms (default ${DEFAULT_EXEC_TIMEOUT_MS})`),
	session_id: z
		.string()
		.min(1)
		.max(200)
		.optional()
		.describe('Optional bridge session id (Session-Id header) for isolated cwd/env')
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
export type CreateBridgeSessionOutput = z.infer<typeof createBridgeSessionOutputSchema>
export type DeleteBridgeSessionInput = z.infer<typeof deleteBridgeSessionInputSchema>
export type DeleteBridgeSessionOutput = z.infer<typeof deleteBridgeSessionOutputSchema>
export type ExecuteCodeInput = z.infer<typeof executeCodeInputSchema>
