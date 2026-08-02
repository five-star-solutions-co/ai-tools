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
	description:
		'Check whether the Cloudflare Sandbox bridge is reachable. Use only for explicit availability diagnostics; ordinary sandbox work should begin with cloudflare-sandbox-create.',
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
	description:
		'Create an isolated Cloudflare sandbox and return sandbox_id. Use only when arbitrary code, commands, or temporary files are required and no purpose-built tool covers the task. Do not create a sandbox to build or edit supported deliverables.',
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
	description:
		'Destroy a Cloudflare sandbox by sandbox_id and release its temporary files and resources. Call after the sandbox workflow is complete and any required output file has been exported.',
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
	description:
		'Check whether a Cloudflare sandbox is currently running. Use before continuing work on an existing sandbox_id; this does not execute code or inspect files.',
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
		'One-shot argv exec in a Cloudflare sandbox (stdout/stderr/exit_code). Prefer a host workspace agent for multi-step shell; use tools for workflow one-shots. Optional env when the bridge supports it.',
	inputSchema: execInputSchema,
	outputSchema: execOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	network: true,
	tags: ['exec', 'one-shot', 'compute'],
	execute: async (input, ctx) => CloudflareSandboxClient.fromContext(ctx).exec(input)
})

export const cloudflareSandboxExecuteCodeTool = defineTool({
	id: `${id}-execute-code`,
	name: 'cloudflareSandboxExecuteCode',
	description:
		'Execute Python, JavaScript, or shell source in a Cloudflare sandbox. Use as a fallback for computation or automation with no dedicated tool. Do not generate or edit supported documents, spreadsheets, presentations, PDFs, or images here when a purpose-built tool is available.',
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
		'Write one temporary file under the Cloudflare sandbox workspace from UTF-8 text or base64 bytes, up to 32 MiB decoded. Use for sandbox intermediates. This is not durable delivery; export a genuinely sandbox-produced final file with cloudflare-sandbox-export-artifact.',
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
	description:
		'Read one temporary file from the Cloudflare sandbox workspace as UTF-8 or base64. Use for sandbox intermediates; use format-aware readers for supported ArtifactRefs.',
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
	description:
		'Write multiple temporary files under the Cloudflare sandbox workspace from text or base64. Use for sandbox intermediates, not final document generation. Export only a final file that the sandbox genuinely had to produce.',
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
	description:
		'Read multiple temporary files from the Cloudflare sandbox workspace as UTF-8 or base64. Use only within an active sandbox workflow; use format-aware readers for supported ArtifactRefs.',
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
	description:
		'List temporary files under a Cloudflare sandbox directory, defaulting to /workspace. Use to locate sandbox intermediates, not durable workspace files or ArtifactRefs.',
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
	description:
		'Remove temporary files from the Cloudflare sandbox workspace by path. Use only for sandbox cleanup; this does not delete durable workspace files or ArtifactRefs.',
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
		'Copy an existing object-store ArtifactRef into a Cloudflare sandbox workspace. Use only when arbitrary sandbox computation must consume that file. Do not import a supported document merely to read or edit it with general code.',
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
		'Persist a final file that was genuinely created inside the Cloudflare sandbox and return its ArtifactRef for delivery. Use only after sandbox work. Do not call for files returned by document, presentation, PDF, image, render, or conversion tools; those ArtifactRefs are already final.',
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
		'Create an isolated execution session inside an existing Cloudflare sandbox and return session_id. Use only when separate working directories or runtime state are needed; pass the id to later command and file calls.',
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
	description:
		'Delete an isolated execution session inside a Cloudflare sandbox. Use after session-specific work is complete; this does not destroy the parent sandbox.',
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
		'Cloudflare sandbox bridge: one-shot exec/files/sessions for workflows. Prefer a host workspace agent for multi-step shell. Client export remains first-class for Workspace hybrids. Prefer purpose-built document tools over sandbox for office formats.',
	runtime: 'both',
	auth: { type: 'custom', schema: cloudflareSandboxAuthSchema },
	categories: ['compute', 'sandbox', 'cloudflare'],
	classification: 'standard',
	tags: ['exec', 'workspace', 'bridge'],
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
