import { z } from 'zod'

import { defineModule, defineTool } from '../../core/define'
import { CloudflareSandboxClient } from './client'
import {
	cloudflareSandboxAuthSchema,
	createBridgeSessionOutputSchema,
	createSandboxOutputSchema,
	deleteBridgeSessionInputSchema,
	deleteBridgeSessionOutputSchema,
	destroySandboxOutputSchema,
	execInputSchema,
	execOutputSchema,
	executeCodeInputSchema,
	exportArtifactInputSchema,
	exportArtifactOutputSchema,
	healthOutputSchema,
	importArtifactInputSchema,
	importArtifactOutputSchema,
	listFilesInputSchema,
	listFilesOutputSchema,
	readFileInputSchema,
	readFileOutputSchema,
	readFilesInputSchema,
	readFilesOutputSchema,
	removeFilesInputSchema,
	removeFilesOutputSchema,
	runningOutputSchema,
	sandboxIdInputSchema,
	writeFileInputSchema,
	writeFileOutputSchema,
	writeFilesInputSchema,
	writeFilesOutputSchema
} from './contracts'

const id = 'cloudflare-sandbox'
const emptyInputSchema = z.object({})

export const cloudflareSandboxHealthTool = defineTool({
	id: `${id}-health`,
	name: 'cloudflareSandboxHealth',
	description: 'Check that the bound Cloudflare Sandbox bridge is reachable.',
	inputSchema: emptyInputSchema,
	outputSchema: healthOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	network: true,
	execute: async (_input, ctx) => CloudflareSandboxClient.fromContext(ctx).health()
})

export const cloudflareSandboxCreateTool = defineTool({
	id: `${id}-create`,
	name: 'cloudflareSandboxCreate',
	description: 'Create an isolated sandbox container and return its sandbox_id for later exec and file tools.',
	inputSchema: emptyInputSchema,
	outputSchema: createSandboxOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	network: true,
	execute: async (_input, ctx) => CloudflareSandboxClient.fromContext(ctx).create()
})

export const cloudflareSandboxDestroyTool = defineTool({
	id: `${id}-destroy`,
	name: 'cloudflareSandboxDestroy',
	description: 'Destroy a sandbox container by sandbox_id and free its resources.',
	inputSchema: sandboxIdInputSchema,
	outputSchema: destroySandboxOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	network: true,
	execute: async (input, ctx) => CloudflareSandboxClient.fromContext(ctx).destroy(input)
})

export const cloudflareSandboxRunningTool = defineTool({
	id: `${id}-running`,
	name: 'cloudflareSandboxRunning',
	description: 'Check whether a sandbox container is currently running.',
	inputSchema: sandboxIdInputSchema,
	outputSchema: runningOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	network: true,
	execute: async (input, ctx) => CloudflareSandboxClient.fromContext(ctx).running(input)
})

export const cloudflareSandboxExecTool = defineTool({
	id: `${id}-exec`,
	name: 'cloudflareSandboxExec',
	description:
		'Run a command in a sandbox as an argv array (not a shell string). Returns stdout, stderr, and exit_code.',
	inputSchema: execInputSchema,
	outputSchema: execOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	network: true,
	execute: async (input, ctx) => CloudflareSandboxClient.fromContext(ctx).exec(input)
})

export const cloudflareSandboxExecuteCodeTool = defineTool({
	id: `${id}-execute-code`,
	name: 'cloudflareSandboxExecuteCode',
	description:
		'Execute source code in a sandbox (python, javascript, or shell). Uses the container runtime (for example python3 -c).',
	inputSchema: executeCodeInputSchema,
	outputSchema: execOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	network: true,
	execute: async (input, ctx) => CloudflareSandboxClient.fromContext(ctx).executeCode(input)
})

export const cloudflareSandboxWriteFileTool = defineTool({
	id: `${id}-write-file`,
	name: 'cloudflareSandboxWriteFile',
	description:
		'Write a file under the sandbox workspace. Provide text (utf-8) or body_base64 (binary). Max 32 MiB decoded.',
	inputSchema: writeFileInputSchema,
	outputSchema: writeFileOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	network: true,
	execute: async (input, ctx) => CloudflareSandboxClient.fromContext(ctx).writeFile(input)
})

export const cloudflareSandboxReadFileTool = defineTool({
	id: `${id}-read-file`,
	name: 'cloudflareSandboxReadFile',
	description: 'Read a file from the sandbox workspace. Default encoding utf8 (text); use base64 for binary content.',
	inputSchema: readFileInputSchema,
	outputSchema: readFileOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	network: true,
	execute: async (input, ctx) => CloudflareSandboxClient.fromContext(ctx).readFile(input)
})

export const cloudflareSandboxWriteFilesTool = defineTool({
	id: `${id}-write-files`,
	name: 'cloudflareSandboxWriteFiles',
	description: 'Write multiple files under the sandbox workspace (text or body_base64 per file).',
	inputSchema: writeFilesInputSchema,
	outputSchema: writeFilesOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	network: true,
	execute: async (input, ctx) => CloudflareSandboxClient.fromContext(ctx).writeFiles(input)
})

export const cloudflareSandboxReadFilesTool = defineTool({
	id: `${id}-read-files`,
	name: 'cloudflareSandboxReadFiles',
	description: 'Read multiple files from the sandbox workspace (utf8 or base64 encoding).',
	inputSchema: readFilesInputSchema,
	outputSchema: readFilesOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	network: true,
	execute: async (input, ctx) => CloudflareSandboxClient.fromContext(ctx).readFiles(input)
})

export const cloudflareSandboxListFilesTool = defineTool({
	id: `${id}-list-files`,
	name: 'cloudflareSandboxListFiles',
	description: 'List files under a sandbox workspace directory (default /workspace).',
	inputSchema: listFilesInputSchema,
	outputSchema: listFilesOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	network: true,
	execute: async (input, ctx) => CloudflareSandboxClient.fromContext(ctx).listFiles(input)
})

export const cloudflareSandboxRemoveFilesTool = defineTool({
	id: `${id}-remove-files`,
	name: 'cloudflareSandboxRemoveFiles',
	description: 'Remove files from the sandbox workspace by path.',
	inputSchema: removeFilesInputSchema,
	outputSchema: removeFilesOutputSchema,
	sideEffect: 'delete',
	runtime: 'both',
	network: true,
	execute: async (input, ctx) => CloudflareSandboxClient.fromContext(ctx).removeFiles(input)
})

export const cloudflareSandboxImportArtifactTool = defineTool({
	id: `${id}-import-artifact`,
	name: 'cloudflareSandboxImportArtifact',
	description:
		'Copy an object-store ArtifactRef into a sandbox workspace path. Requires bound storage credentials on sandbox auth.',
	inputSchema: importArtifactInputSchema,
	outputSchema: importArtifactOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	network: true,
	execute: async (input, ctx) => CloudflareSandboxClient.fromContext(ctx).importArtifact(input)
})

export const cloudflareSandboxExportArtifactTool = defineTool({
	id: `${id}-export-artifact`,
	name: 'cloudflareSandboxExportArtifact',
	description:
		'Copy a sandbox workspace file to object storage and return an ArtifactRef. Requires bound storage credentials on sandbox auth.',
	inputSchema: exportArtifactInputSchema,
	outputSchema: exportArtifactOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	network: true,
	execute: async (input, ctx) => CloudflareSandboxClient.fromContext(ctx).exportArtifact(input)
})

export const cloudflareSandboxCreateSessionTool = defineTool({
	id: `${id}-create-session`,
	name: 'cloudflareSandboxCreateSession',
	description:
		'Create an isolated execution session inside a sandbox (separate cwd/env). Pass session_id on later exec/file calls.',
	inputSchema: sandboxIdInputSchema,
	outputSchema: createBridgeSessionOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	network: true,
	execute: async (input, ctx) => CloudflareSandboxClient.fromContext(ctx).createSession(input)
})

export const cloudflareSandboxDeleteSessionTool = defineTool({
	id: `${id}-delete-session`,
	name: 'cloudflareSandboxDeleteSession',
	description: 'Delete an isolated execution session inside a sandbox.',
	inputSchema: deleteBridgeSessionInputSchema,
	outputSchema: deleteBridgeSessionOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	network: true,
	execute: async (input, ctx) => CloudflareSandboxClient.fromContext(ctx).deleteSession(input)
})

export const cloudflareSandboxModule = defineModule({
	id,
	title: 'Cloudflare Sandbox',
	description:
		'Cloudflare Sandbox bridge: create isolated containers, run commands, execute code, read/write binary workspace files, and import/export object-store artifacts.',
	runtime: 'both',
	auth: { type: 'custom', schema: cloudflareSandboxAuthSchema },
	tools: [
		cloudflareSandboxHealthTool,
		cloudflareSandboxCreateTool,
		cloudflareSandboxDestroyTool,
		cloudflareSandboxRunningTool,
		cloudflareSandboxExecTool,
		cloudflareSandboxExecuteCodeTool,
		cloudflareSandboxWriteFileTool,
		cloudflareSandboxReadFileTool,
		cloudflareSandboxWriteFilesTool,
		cloudflareSandboxReadFilesTool,
		cloudflareSandboxListFilesTool,
		cloudflareSandboxRemoveFilesTool,
		cloudflareSandboxImportArtifactTool,
		cloudflareSandboxExportArtifactTool,
		cloudflareSandboxCreateSessionTool,
		cloudflareSandboxDeleteSessionTool
	]
})
