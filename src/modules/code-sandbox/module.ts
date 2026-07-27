import { defineModule, defineTool } from '../../core/define'
import { CodeSandboxClient } from './client'
import {
	codeSandboxAuthSchema,
	codeSandboxExecResultSchema,
	codeSandboxExecuteCodeInputSchema,
	codeSandboxExecuteCommandInputSchema,
	codeSandboxListFilesInputSchema,
	codeSandboxListFilesOutputSchema,
	codeSandboxReadFilesInputSchema,
	codeSandboxReadFilesOutputSchema,
	codeSandboxRemoveFilesInputSchema,
	codeSandboxRemoveFilesOutputSchema,
	codeSandboxSessionIdInputSchema,
	codeSandboxSessionOutputSchema,
	codeSandboxStartSessionInputSchema,
	codeSandboxWriteFilesInputSchema,
	codeSandboxWriteFilesOutputSchema
} from './contracts'

export const codeSandboxStartSessionTool = defineTool({
	id: 'code-sandbox-start-session',
	name: 'startCodeSandboxSession',
	description: 'Start an isolated code sandbox session on the bound provider and return a session_id.',
	inputSchema: codeSandboxStartSessionInputSchema,
	outputSchema: codeSandboxSessionOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	network: true,
	execute: async (input, ctx) => CodeSandboxClient.fromContext(ctx).startSession(input)
})

export const codeSandboxGetSessionTool = defineTool({
	id: 'code-sandbox-get-session',
	name: 'getCodeSandboxSession',
	description: 'Get status for a code sandbox session on the bound provider.',
	inputSchema: codeSandboxSessionIdInputSchema,
	outputSchema: codeSandboxSessionOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	network: true,
	execute: async (input, ctx) => CodeSandboxClient.fromContext(ctx).getSession(input)
})

export const codeSandboxStopSessionTool = defineTool({
	id: 'code-sandbox-stop-session',
	name: 'stopCodeSandboxSession',
	description: 'Stop a code sandbox session on the bound provider and release resources.',
	inputSchema: codeSandboxSessionIdInputSchema,
	outputSchema: codeSandboxSessionOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	network: true,
	execute: async (input, ctx) => CodeSandboxClient.fromContext(ctx).stopSession(input)
})

export const codeSandboxExecuteCodeTool = defineTool({
	id: 'code-sandbox-execute-code',
	name: 'executeCodeInSandbox',
	description: 'Execute source code in an active code sandbox session (default language python when supported).',
	inputSchema: codeSandboxExecuteCodeInputSchema,
	outputSchema: codeSandboxExecResultSchema,
	sideEffect: 'write',
	runtime: 'both',
	network: true,
	execute: async (input, ctx) => CodeSandboxClient.fromContext(ctx).executeCode(input)
})

export const codeSandboxExecuteCommandTool = defineTool({
	id: 'code-sandbox-execute-command',
	name: 'executeCommandInSandbox',
	description: 'Run a shell command in an active code sandbox session.',
	inputSchema: codeSandboxExecuteCommandInputSchema,
	outputSchema: codeSandboxExecResultSchema,
	sideEffect: 'write',
	runtime: 'both',
	network: true,
	execute: async (input, ctx) => CodeSandboxClient.fromContext(ctx).executeCommand(input)
})

export const codeSandboxWriteFilesTool = defineTool({
	id: 'code-sandbox-write-files',
	name: 'writeSandboxFiles',
	description: 'Write one or more utf-8 files into the sandbox filesystem.',
	inputSchema: codeSandboxWriteFilesInputSchema,
	outputSchema: codeSandboxWriteFilesOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	network: true,
	execute: async (input, ctx) => CodeSandboxClient.fromContext(ctx).writeFiles(input)
})

export const codeSandboxReadFilesTool = defineTool({
	id: 'code-sandbox-read-files',
	name: 'readSandboxFiles',
	description: 'Read one or more utf-8 files from the sandbox filesystem.',
	inputSchema: codeSandboxReadFilesInputSchema,
	outputSchema: codeSandboxReadFilesOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	network: true,
	execute: async (input, ctx) => CodeSandboxClient.fromContext(ctx).readFiles(input)
})

export const codeSandboxListFilesTool = defineTool({
	id: 'code-sandbox-list-files',
	name: 'listSandboxFiles',
	description: 'List files in a sandbox directory when the bound provider supports listing.',
	inputSchema: codeSandboxListFilesInputSchema,
	outputSchema: codeSandboxListFilesOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	network: true,
	execute: async (input, ctx) => CodeSandboxClient.fromContext(ctx).listFiles(input)
})

export const codeSandboxRemoveFilesTool = defineTool({
	id: 'code-sandbox-remove-files',
	name: 'removeSandboxFiles',
	description: 'Remove files from the sandbox filesystem.',
	inputSchema: codeSandboxRemoveFilesInputSchema,
	outputSchema: codeSandboxRemoveFilesOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	network: true,
	execute: async (input, ctx) => CodeSandboxClient.fromContext(ctx).removeFiles(input)
})

export const codeSandboxModule = defineModule({
	id: 'code-sandbox',
	title: 'Code Sandbox',
	description:
		'Start isolated sandbox sessions, execute code or shell commands, and read or write files through the bound provider.',
	runtime: 'both',
	auth: { type: 'custom', schema: codeSandboxAuthSchema },
	tools: [
		codeSandboxStartSessionTool,
		codeSandboxGetSessionTool,
		codeSandboxStopSessionTool,
		codeSandboxExecuteCodeTool,
		codeSandboxExecuteCommandTool,
		codeSandboxWriteFilesTool,
		codeSandboxReadFilesTool,
		codeSandboxListFilesTool,
		codeSandboxRemoveFilesTool
	]
})
