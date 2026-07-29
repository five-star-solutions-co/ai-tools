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
	description:
		'Start an isolated sandbox session and return session_id. Use only when the task requires arbitrary code, shell commands, or temporary files that no purpose-built tool covers. Do not start a sandbox to build or edit supported documents, spreadsheets, presentations, PDFs, or images.',
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
	description:
		'Get status for a sandbox session created by code-sandbox-start-session. Use when execution may still be running or session availability must be checked; this does not execute work.',
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
	description:
		'Stop a sandbox session created by code-sandbox-start-session and release its temporary resources. Call after sandbox work is complete when the session is no longer needed.',
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
	description:
		'Execute source code in an active sandbox session. Use as a fallback for computation or automation that no purpose-built tool covers. Do not use to build or edit supported documents, spreadsheets, presentations, PDFs, or images.',
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
	description:
		'Run a shell command in an active sandbox session. Use as a fallback for command-line work that no purpose-built tool covers. Do not use command-line libraries to replace dedicated document, spreadsheet, presentation, PDF, or image tools.',
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
	description:
		'Write one or more UTF-8 files into an active sandbox session for intermediate computation. Sandbox files are temporary and this tool does not return ArtifactRefs. Use a purpose-built builder for final deliverables.',
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
	description:
		'Read one or more UTF-8 files from an active sandbox session. Use only for files produced or imported during the same sandbox workflow; use a format-aware reader for supported user artifacts.',
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
	description:
		'List temporary files in an active sandbox directory when supported. Use to locate sandbox intermediates, not to discover files in the durable workspace or artifact store.',
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
	description:
		'Remove temporary files from an active sandbox session. Use only for sandbox cleanup; this does not delete durable workspace files or ArtifactRefs.',
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
		'General-purpose fallback for arbitrary code, commands, and temporary files when no dedicated tool covers the task. Do not use it instead of purpose-built document, spreadsheet, presentation, PDF, image, or render tools.',
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
