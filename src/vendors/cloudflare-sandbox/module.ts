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
	healthOutputSchema,
	readFileInputSchema,
	readFileOutputSchema,
	readFilesInputSchema,
	readFilesOutputSchema,
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
	description: 'Write a utf-8 file under the sandbox workspace.',
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
	description: 'Read a utf-8 file from the sandbox workspace.',
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
	description: 'Write multiple utf-8 files under the sandbox workspace.',
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
	description: 'Read multiple utf-8 files from the sandbox workspace.',
	inputSchema: readFilesInputSchema,
	outputSchema: readFilesOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	network: true,
	execute: async (input, ctx) => CloudflareSandboxClient.fromContext(ctx).readFiles(input)
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
		'Cloudflare Sandbox bridge: create isolated containers, run commands, execute code, and read or write workspace files.',
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
		cloudflareSandboxCreateSessionTool,
		cloudflareSandboxDeleteSessionTool
	]
})
