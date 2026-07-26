import { defineModule, defineTool } from '../../core/define'
import { EventBridgeSchedulerClient } from './client'
import {
	eventBridgeSchedulerAuthSchema,
	scheduleCreateInputSchema,
	scheduleDeleteOutputSchema,
	scheduleGetOutputSchema,
	scheduleListInputSchema,
	scheduleListOutputSchema,
	scheduleNameInputSchema,
	scheduleUpdateInputSchema,
	scheduleWriteOutputSchema
} from './contracts'

export const eventBridgeSchedulerCreateTool = defineTool({
	id: 'eventbridge-scheduler-create',
	name: 'eventBridgeSchedulerCreate',
	description:
		'Create an EventBridge Scheduler schedule for the configured target. Provide schedule name, schedule_expression (at/rate/cron), and task_ref (opaque task definition reference).',
	inputSchema: scheduleCreateInputSchema,
	outputSchema: scheduleWriteOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => EventBridgeSchedulerClient.fromContext(ctx).create(input)
})

export const eventBridgeSchedulerUpdateTool = defineTool({
	id: 'eventbridge-scheduler-update',
	name: 'eventBridgeSchedulerUpdate',
	description:
		'Replace an EventBridge Scheduler schedule (AWS full update). Same fields as create: name, schedule_expression, task_ref, optional timezone/state/description.',
	inputSchema: scheduleUpdateInputSchema,
	outputSchema: scheduleWriteOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => EventBridgeSchedulerClient.fromContext(ctx).update(input)
})

export const eventBridgeSchedulerGetTool = defineTool({
	id: 'eventbridge-scheduler-get',
	name: 'eventBridgeSchedulerGet',
	description: 'Get one EventBridge Scheduler schedule by name, including task_ref when present in target input.',
	inputSchema: scheduleNameInputSchema,
	outputSchema: scheduleGetOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => EventBridgeSchedulerClient.fromContext(ctx).get(input)
})

export const eventBridgeSchedulerListTool = defineTool({
	id: 'eventbridge-scheduler-list',
	name: 'eventBridgeSchedulerList',
	description: 'List EventBridge Scheduler schedules with optional name prefix, state filter, and pagination token.',
	inputSchema: scheduleListInputSchema,
	outputSchema: scheduleListOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => EventBridgeSchedulerClient.fromContext(ctx).list(input)
})

export const eventBridgeSchedulerDeleteTool = defineTool({
	id: 'eventbridge-scheduler-delete',
	name: 'eventBridgeSchedulerDelete',
	description: 'Delete an EventBridge Scheduler schedule by name.',
	inputSchema: scheduleNameInputSchema,
	outputSchema: scheduleDeleteOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => EventBridgeSchedulerClient.fromContext(ctx).delete(input)
})

export const eventBridgeSchedulerModule = defineModule({
	id: 'eventbridge-scheduler',
	title: 'EventBridge Scheduler',
	description:
		'Amazon EventBridge Scheduler vendor pack: create, fully update, get, list, and delete schedules for a configured target.',
	runtime: 'both',
	auth: { type: 'custom', schema: eventBridgeSchedulerAuthSchema },
	tools: [
		eventBridgeSchedulerCreateTool,
		eventBridgeSchedulerUpdateTool,
		eventBridgeSchedulerGetTool,
		eventBridgeSchedulerListTool,
		eventBridgeSchedulerDeleteTool
	]
})
