import { defineModule, defineTool } from '../../core/define'
import { BedrockAgentCoreCodeInterpreterClient } from './client'
import {
	bedrockAgentCoreCodeInterpreterAuthSchema,
	executeCodeInputSchema,
	executeCommandInputSchema,
	invokeResultSchema,
	listFilesInputSchema,
	readFilesInputSchema,
	removeFilesInputSchema,
	sessionIdInputSchema,
	sessionOutputSchema,
	startCommandInputSchema,
	startSessionInputSchema,
	taskIdInputSchema,
	writeFilesInputSchema
} from './contracts'

const id = 'bedrock-agentcore-code-interpreter'

export const bedrockAgentCoreCodeInterpreterStartSessionTool = defineTool({
	id: `${id}-start-session`,
	name: 'bedrockAgentCoreCodeInterpreterStartSession',
	description:
		'Start a Bedrock AgentCore code interpreter session and return session_id. Use only when arbitrary code, commands, or temporary files are required and no purpose-built tool covers the task. Do not start it to build or edit supported deliverables.',
	inputSchema: startSessionInputSchema,
	outputSchema: sessionOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => BedrockAgentCoreCodeInterpreterClient.fromContext(ctx).startSession(input)
})

export const bedrockAgentCoreCodeInterpreterStopSessionTool = defineTool({
	id: `${id}-stop-session`,
	name: 'bedrockAgentCoreCodeInterpreterStopSession',
	description:
		'Stop a Bedrock AgentCore code interpreter session by session_id and release temporary resources. Call after interpreter work is complete.',
	inputSchema: sessionIdInputSchema,
	outputSchema: sessionOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => BedrockAgentCoreCodeInterpreterClient.fromContext(ctx).stopSession(input)
})

export const bedrockAgentCoreCodeInterpreterGetSessionTool = defineTool({
	id: `${id}-get-session`,
	name: 'bedrockAgentCoreCodeInterpreterGetSession',
	description:
		'Get status and metadata for a Bedrock AgentCore code interpreter session. Use before continuing work on an existing session; this does not execute code.',
	inputSchema: sessionIdInputSchema,
	outputSchema: sessionOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => BedrockAgentCoreCodeInterpreterClient.fromContext(ctx).getSession(input)
})

export const bedrockAgentCoreCodeInterpreterExecuteCodeTool = defineTool({
	id: `${id}-execute-code`,
	name: 'bedrockAgentCoreCodeInterpreterExecuteCode',
	description:
		'Execute code in an active Bedrock AgentCore session. Use as a fallback for computation or automation with no dedicated tool. Do not replace purpose-built document, spreadsheet, presentation, PDF, image, render, or conversion tools.',
	inputSchema: executeCodeInputSchema,
	outputSchema: invokeResultSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => BedrockAgentCoreCodeInterpreterClient.fromContext(ctx).executeCode(input)
})

export const bedrockAgentCoreCodeInterpreterExecuteCommandTool = defineTool({
	id: `${id}-execute-command`,
	name: 'bedrockAgentCoreCodeInterpreterExecuteCommand',
	description:
		'Run a shell command in an active Bedrock AgentCore session. Use as a fallback for command-line work with no dedicated tool. Do not generate supported deliverables with command-line libraries when a purpose-built tool exists.',
	inputSchema: executeCommandInputSchema,
	outputSchema: invokeResultSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => BedrockAgentCoreCodeInterpreterClient.fromContext(ctx).executeCommand(input)
})

export const bedrockAgentCoreCodeInterpreterStartCommandTool = defineTool({
	id: `${id}-start-command`,
	name: 'bedrockAgentCoreCodeInterpreterStartCommand',
	description:
		'Start a long-running command in an active Bedrock AgentCore session and return a task id. Use only for fallback command work that exceeds one call; poll with get-task.',
	inputSchema: startCommandInputSchema,
	outputSchema: invokeResultSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => BedrockAgentCoreCodeInterpreterClient.fromContext(ctx).startCommand(input)
})

export const bedrockAgentCoreCodeInterpreterGetTaskTool = defineTool({
	id: `${id}-get-task`,
	name: 'bedrockAgentCoreCodeInterpreterGetTask',
	description:
		'Get the status or result of an asynchronous Bedrock AgentCore command task. Use only with a task id returned by start-command; this does not start new work.',
	inputSchema: taskIdInputSchema,
	outputSchema: invokeResultSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => BedrockAgentCoreCodeInterpreterClient.fromContext(ctx).getTask(input)
})

export const bedrockAgentCoreCodeInterpreterStopTaskTool = defineTool({
	id: `${id}-stop-task`,
	name: 'bedrockAgentCoreCodeInterpreterStopTask',
	description:
		'Stop an asynchronous Bedrock AgentCore command task. Use only with a task id returned by start-command when the running work should be cancelled.',
	inputSchema: taskIdInputSchema,
	outputSchema: invokeResultSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => BedrockAgentCoreCodeInterpreterClient.fromContext(ctx).stopTask(input)
})

export const bedrockAgentCoreCodeInterpreterListFilesTool = defineTool({
	id: `${id}-list-files`,
	name: 'bedrockAgentCoreCodeInterpreterListFiles',
	description:
		'List temporary files in a Bedrock AgentCore session directory. Use to locate interpreter intermediates, not durable workspace files or ArtifactRefs.',
	inputSchema: listFilesInputSchema,
	outputSchema: invokeResultSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => BedrockAgentCoreCodeInterpreterClient.fromContext(ctx).listFiles(input)
})

export const bedrockAgentCoreCodeInterpreterReadFilesTool = defineTool({
	id: `${id}-read-files`,
	name: 'bedrockAgentCoreCodeInterpreterReadFiles',
	description:
		'Read temporary files from a Bedrock AgentCore session by path. Use only within the interpreter workflow; use format-aware readers for supported ArtifactRefs.',
	inputSchema: readFilesInputSchema,
	outputSchema: invokeResultSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => BedrockAgentCoreCodeInterpreterClient.fromContext(ctx).readFiles(input)
})

export const bedrockAgentCoreCodeInterpreterWriteFilesTool = defineTool({
	id: `${id}-write-files`,
	name: 'bedrockAgentCoreCodeInterpreterWriteFiles',
	description:
		'Write temporary text files into a Bedrock AgentCore session for intermediate computation. Do not use this as a final document builder or durable artifact store.',
	inputSchema: writeFilesInputSchema,
	outputSchema: invokeResultSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => BedrockAgentCoreCodeInterpreterClient.fromContext(ctx).writeFiles(input)
})

export const bedrockAgentCoreCodeInterpreterRemoveFilesTool = defineTool({
	id: `${id}-remove-files`,
	name: 'bedrockAgentCoreCodeInterpreterRemoveFiles',
	description:
		'Remove temporary files from a Bedrock AgentCore session by path. Use only for interpreter cleanup; this does not delete durable workspace files or ArtifactRefs.',
	inputSchema: removeFilesInputSchema,
	outputSchema: invokeResultSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => BedrockAgentCoreCodeInterpreterClient.fromContext(ctx).removeFiles(input)
})

export const bedrockAgentCoreCodeInterpreterModule = defineModule({
	id,
	title: 'Bedrock AgentCore Code Interpreter',
	description:
		'General-purpose Bedrock AgentCore execution fallback for arbitrary code, commands, and temporary files when no purpose-built tool covers the task.',
	runtime: 'both',
	auth: { type: 'custom', schema: bedrockAgentCoreCodeInterpreterAuthSchema },
	tools: [
		bedrockAgentCoreCodeInterpreterStartSessionTool,
		bedrockAgentCoreCodeInterpreterStopSessionTool,
		bedrockAgentCoreCodeInterpreterGetSessionTool,
		bedrockAgentCoreCodeInterpreterExecuteCodeTool,
		bedrockAgentCoreCodeInterpreterExecuteCommandTool,
		bedrockAgentCoreCodeInterpreterStartCommandTool,
		bedrockAgentCoreCodeInterpreterGetTaskTool,
		bedrockAgentCoreCodeInterpreterStopTaskTool,
		bedrockAgentCoreCodeInterpreterListFilesTool,
		bedrockAgentCoreCodeInterpreterReadFilesTool,
		bedrockAgentCoreCodeInterpreterWriteFilesTool,
		bedrockAgentCoreCodeInterpreterRemoveFilesTool
	]
})
