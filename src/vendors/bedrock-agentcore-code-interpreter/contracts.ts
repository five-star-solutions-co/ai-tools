/**
 * Amazon Bedrock AgentCore Code Interpreter contracts.
 */

import { z } from 'zod'

export const DEFAULT_CODE_INTERPRETER_ID = 'aws.codeinterpreter.v1'
export const MAX_CODE_CHARS = 200_000
export const MAX_COMMAND_CHARS = 20_000
export const MAX_FILE_PATHS = 50
export const MAX_WRITE_FILES = 20
export const MAX_FILE_TEXT = 500_000

export const bedrockAgentCoreCodeInterpreterAuthSchema = z.object({
	access_key_id: z.string().min(1).describe('AWS access key id'),
	secret_access_key: z.string().min(1).describe('AWS secret access key'),
	region: z.string().min(1).describe('AWS region for Bedrock AgentCore'),
	session_token: z.string().min(1).optional().describe('Optional session token'),
	code_interpreter_id: z
		.string()
		.min(1)
		.optional()
		.describe('Code interpreter resource id (default aws.codeinterpreter.v1)')
})

export type BedrockAgentCoreCodeInterpreterAuth = z.infer<typeof bedrockAgentCoreCodeInterpreterAuthSchema>

const sessionId = z.string().min(1).max(40).describe('Code interpreter session id')

export const startSessionInputSchema = z.object({
	name: z.string().min(1).max(100).optional().describe('Optional session name'),
	session_timeout_seconds: z
		.int()
		.min(1)
		.max(28_800)
		.optional()
		.describe('Session TTL in seconds (default provider-side, max 8 hours)')
})

export const sessionIdInputSchema = z.object({
	session_id: sessionId
})

export const sessionOutputSchema = z.object({
	session_id: z.string().describe('Session id'),
	code_interpreter_id: z.string().optional().describe('Interpreter id'),
	created_at: z.string().optional().describe('Creation timestamp when returned'),
	status: z.string().optional().describe('Session status when returned')
})

export const executeCodeInputSchema = z.object({
	session_id: sessionId,
	code: z.string().min(1).max(MAX_CODE_CHARS).describe('Source code to execute'),
	language: z.string().min(1).max(40).optional().describe('Language (default python)')
})

export const executeCommandInputSchema = z.object({
	session_id: sessionId,
	command: z.string().min(1).max(MAX_COMMAND_CHARS).describe('Shell command to run')
})

export const startCommandInputSchema = executeCommandInputSchema

export const taskIdInputSchema = z.object({
	session_id: sessionId,
	task_id: z.string().min(1).max(200).describe('Async task id from start-command')
})

export const listFilesInputSchema = z.object({
	session_id: sessionId,
	directory_path: z.string().max(1024).optional().describe('Directory path (default session root)')
})

export const readFilesInputSchema = z.object({
	session_id: sessionId,
	paths: z.array(z.string().min(1).max(1024)).min(1).max(MAX_FILE_PATHS).describe('File paths to read')
})

export const writeFilesInputSchema = z.object({
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
		.describe('Files to write')
})

export const removeFilesInputSchema = z.object({
	session_id: sessionId,
	paths: z.array(z.string().min(1).max(1024)).min(1).max(MAX_FILE_PATHS).describe('Paths to remove')
})

export const invokeResultSchema = z.object({
	session_id: z.string(),
	name: z.string().describe('Invoke tool name'),
	result: z.unknown().optional().describe('Provider result payload'),
	raw: z.unknown().optional().describe('Full provider response when useful')
})

export type StartSessionInput = z.infer<typeof startSessionInputSchema>
export type SessionIdInput = z.infer<typeof sessionIdInputSchema>
export type SessionOutput = z.infer<typeof sessionOutputSchema>
export type ExecuteCodeInput = z.infer<typeof executeCodeInputSchema>
export type ExecuteCommandInput = z.infer<typeof executeCommandInputSchema>
export type StartCommandInput = z.infer<typeof startCommandInputSchema>
export type TaskIdInput = z.infer<typeof taskIdInputSchema>
export type ListFilesInput = z.infer<typeof listFilesInputSchema>
export type ReadFilesInput = z.infer<typeof readFilesInputSchema>
export type WriteFilesInput = z.infer<typeof writeFilesInputSchema>
export type RemoveFilesInput = z.infer<typeof removeFilesInputSchema>
export type InvokeResult = z.infer<typeof invokeResultSchema>
