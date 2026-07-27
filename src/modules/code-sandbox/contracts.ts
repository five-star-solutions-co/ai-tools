/**
 * Code sandbox capability seam — execute code and commands in an isolated sandbox.
 * Providers: cloudflare-sandbox (bridge), bedrock-agentcore.
 */

import { z } from 'zod'

import {
	bedrockAgentCoreCodeInterpreterAuthSchema,
	MAX_CODE_CHARS,
	MAX_COMMAND_CHARS,
	MAX_FILE_PATHS,
	MAX_FILE_TEXT,
	MAX_WRITE_FILES
} from '../../vendors/bedrock-agentcore-code-interpreter'
import { cloudflareSandboxAuthSchema } from '../../vendors/cloudflare-sandbox'

export const MAX_SEAM_CODE_CHARS = MAX_CODE_CHARS
export const MAX_SEAM_COMMAND_CHARS = MAX_COMMAND_CHARS

/** Bridge host credentials; provider id matches email/browser gold (`cloudflare`). */
export const cloudflareCodeSandboxAuthSchema = cloudflareSandboxAuthSchema.extend({
	provider: z.literal('cloudflare')
})

export const agentCoreCodeSandboxAuthSchema = bedrockAgentCoreCodeInterpreterAuthSchema.extend({
	provider: z.literal('bedrock-agentcore')
})

export const codeSandboxAuthSchema = z.discriminatedUnion('provider', [
	cloudflareCodeSandboxAuthSchema,
	agentCoreCodeSandboxAuthSchema
])

export type CloudflareCodeSandboxAuth = z.infer<typeof cloudflareCodeSandboxAuthSchema>
export type AgentCoreCodeSandboxAuth = z.infer<typeof agentCoreCodeSandboxAuthSchema>
export type CodeSandboxAuth = z.infer<typeof codeSandboxAuthSchema>

const sessionId = z.string().min(1).max(200).describe('Sandbox session id from start-session')

export const codeSandboxStartSessionInputSchema = z.object({
	name: z.string().min(1).max(100).optional().describe('Optional session name when the bound provider supports it'),
	session_timeout_seconds: z
		.int()
		.min(1)
		.max(28_800)
		.optional()
		.describe('Session TTL in seconds when the bound provider supports it')
})

export const codeSandboxSessionIdInputSchema = z.object({
	session_id: sessionId
})

export const codeSandboxSessionOutputSchema = z.object({
	session_id: z.string().describe('Sandbox session id'),
	status: z.string().optional().describe('Provider session status when available'),
	running: z.boolean().optional().describe('Whether the sandbox is running when reported')
})

export const codeSandboxExecuteCodeInputSchema = z.object({
	session_id: sessionId,
	code: z.string().min(1).max(MAX_SEAM_CODE_CHARS).describe('Source code to execute'),
	language: z.string().min(1).max(40).optional().describe('Language when supported (default python)')
})

export const codeSandboxExecuteCommandInputSchema = z.object({
	session_id: sessionId,
	command: z.string().min(1).max(MAX_SEAM_COMMAND_CHARS).describe('Shell command to run')
})

export const codeSandboxExecResultSchema = z.object({
	session_id: z.string(),
	stdout: z.string().optional().describe('Standard output when available'),
	stderr: z.string().optional().describe('Standard error when available'),
	exit_code: z.number().int().optional().describe('Process exit code when available'),
	success: z.boolean().optional().describe('True when the run completed successfully'),
	result: z.unknown().optional().describe('Provider-specific result payload when structured')
})

export const codeSandboxWriteFilesInputSchema = z.object({
	session_id: sessionId,
	files: z
		.array(
			z.object({
				path: z.string().min(1).max(1024).describe('Path to write'),
				text: z.string().max(MAX_FILE_TEXT).describe('Utf8 file contents')
			})
		)
		.min(1)
		.max(MAX_WRITE_FILES)
		.describe('Files to write in the sandbox')
})

export const codeSandboxWriteFilesOutputSchema = z.object({
	session_id: z.string(),
	paths: z.array(z.string()),
	ok: z.literal(true)
})

export const codeSandboxReadFilesInputSchema = z.object({
	session_id: sessionId,
	paths: z.array(z.string().min(1).max(1024)).min(1).max(MAX_FILE_PATHS).describe('Paths to read')
})

export const codeSandboxReadFilesOutputSchema = z.object({
	session_id: z.string(),
	files: z.array(
		z.object({
			path: z.string(),
			text: z.string()
		})
	)
})

export const codeSandboxListFilesInputSchema = z.object({
	session_id: sessionId,
	directory_path: z.string().max(1024).optional().describe('Directory to list (default sandbox root)')
})

export const codeSandboxListFilesOutputSchema = z.object({
	session_id: z.string(),
	paths: z.array(z.string()).describe('Relative paths found'),
	raw: z.unknown().optional().describe('Provider listing payload when available')
})

export const codeSandboxRemoveFilesInputSchema = z.object({
	session_id: sessionId,
	paths: z.array(z.string().min(1).max(1024)).min(1).max(MAX_FILE_PATHS).describe('Paths to remove')
})

export const codeSandboxRemoveFilesOutputSchema = z.object({
	session_id: z.string(),
	paths: z.array(z.string()),
	ok: z.literal(true)
})

export type CodeSandboxStartSessionInput = z.infer<typeof codeSandboxStartSessionInputSchema>
export type CodeSandboxSessionIdInput = z.infer<typeof codeSandboxSessionIdInputSchema>
export type CodeSandboxSessionOutput = z.infer<typeof codeSandboxSessionOutputSchema>
export type CodeSandboxExecuteCodeInput = z.infer<typeof codeSandboxExecuteCodeInputSchema>
export type CodeSandboxExecuteCommandInput = z.infer<typeof codeSandboxExecuteCommandInputSchema>
export type CodeSandboxExecResult = z.infer<typeof codeSandboxExecResultSchema>
export type CodeSandboxWriteFilesInput = z.infer<typeof codeSandboxWriteFilesInputSchema>
export type CodeSandboxWriteFilesOutput = z.infer<typeof codeSandboxWriteFilesOutputSchema>
export type CodeSandboxReadFilesInput = z.infer<typeof codeSandboxReadFilesInputSchema>
export type CodeSandboxReadFilesOutput = z.infer<typeof codeSandboxReadFilesOutputSchema>
export type CodeSandboxListFilesInput = z.infer<typeof codeSandboxListFilesInputSchema>
export type CodeSandboxListFilesOutput = z.infer<typeof codeSandboxListFilesOutputSchema>
export type CodeSandboxRemoveFilesInput = z.infer<typeof codeSandboxRemoveFilesInputSchema>
export type CodeSandboxRemoveFilesOutput = z.infer<typeof codeSandboxRemoveFilesOutputSchema>

export type CodeSandboxOps = {
	startSession(input?: CodeSandboxStartSessionInput): Promise<CodeSandboxSessionOutput>
	getSession(input: CodeSandboxSessionIdInput): Promise<CodeSandboxSessionOutput>
	stopSession(input: CodeSandboxSessionIdInput): Promise<CodeSandboxSessionOutput>
	executeCode(input: CodeSandboxExecuteCodeInput): Promise<CodeSandboxExecResult>
	executeCommand(input: CodeSandboxExecuteCommandInput): Promise<CodeSandboxExecResult>
	writeFiles(input: CodeSandboxWriteFilesInput): Promise<CodeSandboxWriteFilesOutput>
	readFiles(input: CodeSandboxReadFilesInput): Promise<CodeSandboxReadFilesOutput>
	listFiles(input: CodeSandboxListFilesInput): Promise<CodeSandboxListFilesOutput>
	removeFiles(input: CodeSandboxRemoveFilesInput): Promise<CodeSandboxRemoveFilesOutput>
}
