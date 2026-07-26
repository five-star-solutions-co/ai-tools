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
	description: 'Start a Bedrock AgentCore code interpreter session. Returns session_id for later execute/file tools.',
	inputSchema: startSessionInputSchema,
	outputSchema: sessionOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => BedrockAgentCoreCodeInterpreterClient.fromContext(ctx).startSession(input)
})

export const bedrockAgentCoreCodeInterpreterStopSessionTool = defineTool({
	id: `${id}-stop-session`,
	name: 'bedrockAgentCoreCodeInterpreterStopSession',
	description: 'Stop a Bedrock AgentCore code interpreter session by session_id.',
	inputSchema: sessionIdInputSchema,
	outputSchema: sessionOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => BedrockAgentCoreCodeInterpreterClient.fromContext(ctx).stopSession(input)
})

export const bedrockAgentCoreCodeInterpreterGetSessionTool = defineTool({
	id: `${id}-get-session`,
	name: 'bedrockAgentCoreCodeInterpreterGetSession',
	description: 'Get status/metadata for a Bedrock AgentCore code interpreter session.',
	inputSchema: sessionIdInputSchema,
	outputSchema: sessionOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => BedrockAgentCoreCodeInterpreterClient.fromContext(ctx).getSession(input)
})

export const bedrockAgentCoreCodeInterpreterExecuteCodeTool = defineTool({
	id: `${id}-execute-code`,
	name: 'bedrockAgentCoreCodeInterpreterExecuteCode',
	description: 'Execute code in an active Bedrock AgentCore code interpreter session (default language python).',
	inputSchema: executeCodeInputSchema,
	outputSchema: invokeResultSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => BedrockAgentCoreCodeInterpreterClient.fromContext(ctx).executeCode(input)
})

export const bedrockAgentCoreCodeInterpreterExecuteCommandTool = defineTool({
	id: `${id}-execute-command`,
	name: 'bedrockAgentCoreCodeInterpreterExecuteCommand',
	description: 'Run a shell command in an active Bedrock AgentCore code interpreter session.',
	inputSchema: executeCommandInputSchema,
	outputSchema: invokeResultSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => BedrockAgentCoreCodeInterpreterClient.fromContext(ctx).executeCommand(input)
})

export const bedrockAgentCoreCodeInterpreterStartCommandTool = defineTool({
	id: `${id}-start-command`,
	name: 'bedrockAgentCoreCodeInterpreterStartCommand',
	description: 'Start a long-running command in the code interpreter session; poll with get-task.',
	inputSchema: startCommandInputSchema,
	outputSchema: invokeResultSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => BedrockAgentCoreCodeInterpreterClient.fromContext(ctx).startCommand(input)
})

export const bedrockAgentCoreCodeInterpreterGetTaskTool = defineTool({
	id: `${id}-get-task`,
	name: 'bedrockAgentCoreCodeInterpreterGetTask',
	description: 'Get status/result of an async command task in a code interpreter session.',
	inputSchema: taskIdInputSchema,
	outputSchema: invokeResultSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => BedrockAgentCoreCodeInterpreterClient.fromContext(ctx).getTask(input)
})

export const bedrockAgentCoreCodeInterpreterStopTaskTool = defineTool({
	id: `${id}-stop-task`,
	name: 'bedrockAgentCoreCodeInterpreterStopTask',
	description: 'Stop an async command task in a code interpreter session.',
	inputSchema: taskIdInputSchema,
	outputSchema: invokeResultSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => BedrockAgentCoreCodeInterpreterClient.fromContext(ctx).stopTask(input)
})

export const bedrockAgentCoreCodeInterpreterListFilesTool = defineTool({
	id: `${id}-list-files`,
	name: 'bedrockAgentCoreCodeInterpreterListFiles',
	description: 'List files in a code interpreter session directory.',
	inputSchema: listFilesInputSchema,
	outputSchema: invokeResultSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => BedrockAgentCoreCodeInterpreterClient.fromContext(ctx).listFiles(input)
})

export const bedrockAgentCoreCodeInterpreterReadFilesTool = defineTool({
	id: `${id}-read-files`,
	name: 'bedrockAgentCoreCodeInterpreterReadFiles',
	description: 'Read files from a code interpreter session by path.',
	inputSchema: readFilesInputSchema,
	outputSchema: invokeResultSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => BedrockAgentCoreCodeInterpreterClient.fromContext(ctx).readFiles(input)
})

export const bedrockAgentCoreCodeInterpreterWriteFilesTool = defineTool({
	id: `${id}-write-files`,
	name: 'bedrockAgentCoreCodeInterpreterWriteFiles',
	description: 'Write text files into a code interpreter session.',
	inputSchema: writeFilesInputSchema,
	outputSchema: invokeResultSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => BedrockAgentCoreCodeInterpreterClient.fromContext(ctx).writeFiles(input)
})

export const bedrockAgentCoreCodeInterpreterRemoveFilesTool = defineTool({
	id: `${id}-remove-files`,
	name: 'bedrockAgentCoreCodeInterpreterRemoveFiles',
	description: 'Remove files from a code interpreter session by path.',
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
		'Amazon Bedrock AgentCore Code Interpreter: start/stop/get sessions, execute code and commands, manage session files.',
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
