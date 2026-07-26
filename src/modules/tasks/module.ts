import { defineModule, defineTool } from '../../core/define'
import { TasksClient } from './client'
import {
	tasksAuthSchema,
	tasksCreateInputSchema,
	tasksCreateOutputSchema,
	tasksDeleteOutputSchema,
	tasksGetInputSchema,
	tasksGetOutputSchema,
	tasksListInputSchema,
	tasksListOutputSchema,
	tasksUpdateInputSchema,
	tasksUpdateOutputSchema
} from './contracts'

export const tasksCreateTool = defineTool({
	id: 'tasks-create',
	name: 'createTask',
	description:
		'Create a reusable task definition in the bound host backend. Returns an opaque task_ref that can be scheduled or invoked by the host.',
	inputSchema: tasksCreateInputSchema,
	outputSchema: tasksCreateOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => TasksClient.fromContext(ctx).create(input)
})

export const tasksGetTool = defineTool({
	id: 'tasks-get',
	name: 'getTask',
	description: 'Load one task definition by its opaque task_ref from the bound host backend.',
	inputSchema: tasksGetInputSchema,
	outputSchema: tasksGetOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => TasksClient.fromContext(ctx).get(input)
})

export const tasksListTool = defineTool({
	id: 'tasks-list',
	name: 'listTasks',
	description: 'List task definitions from the bound host backend with optional text, tag, and pagination filters.',
	inputSchema: tasksListInputSchema,
	outputSchema: tasksListOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => TasksClient.fromContext(ctx).list(input)
})

export const tasksUpdateTool = defineTool({
	id: 'tasks-update',
	name: 'updateTask',
	description: 'Update selected fields of an existing task definition identified by task_ref.',
	inputSchema: tasksUpdateInputSchema,
	outputSchema: tasksUpdateOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => TasksClient.fromContext(ctx).update(input)
})

export const tasksDeleteTool = defineTool({
	id: 'tasks-delete',
	name: 'deleteTask',
	description: 'Delete one task definition by task_ref from the bound host backend.',
	inputSchema: tasksGetInputSchema,
	outputSchema: tasksDeleteOutputSchema,
	sideEffect: 'delete',
	runtime: 'both',
	execute: async (input, ctx) => TasksClient.fromContext(ctx).delete(input)
})

export const tasksModule = defineModule({
	id: 'tasks',
	title: 'Tasks',
	description: 'Create, inspect, list, update, and delete reusable task definitions through a host backend.',
	runtime: 'both',
	auth: { type: 'custom', schema: tasksAuthSchema },
	tools: [tasksCreateTool, tasksGetTool, tasksListTool, tasksUpdateTool, tasksDeleteTool]
})
