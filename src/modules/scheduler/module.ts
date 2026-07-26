import { defineModule, defineTool } from '../../core/define'
import { SchedulerClient } from './client'
import {
	scheduleCreateInputSchema,
	scheduleDeleteOutputSchema,
	scheduleGetOutputSchema,
	scheduleListInputSchema,
	scheduleListOutputSchema,
	scheduleNameInputSchema,
	scheduleUpdateInputSchema,
	scheduleWriteOutputSchema,
	schedulerAuthSchema
} from './contracts'

export const schedulerCreateTool = defineTool({
	id: 'scheduler-create',
	name: 'createSchedule',
	description:
		'Create a schedule on the bound provider for an opaque task reference. Supports one-time, recurring, and calendar expressions accepted by that provider.',
	inputSchema: scheduleCreateInputSchema,
	outputSchema: scheduleWriteOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => SchedulerClient.fromContext(ctx).create(input)
})

export const schedulerUpdateTool = defineTool({
	id: 'scheduler-update',
	name: 'updateSchedule',
	description:
		'Replace an existing schedule on the bound provider. Read the schedule first when fields not supplied by this update must be retained.',
	inputSchema: scheduleUpdateInputSchema,
	outputSchema: scheduleWriteOutputSchema,
	sideEffect: 'write',
	runtime: 'both',
	execute: async (input, ctx) => SchedulerClient.fromContext(ctx).update(input)
})

export const schedulerGetTool = defineTool({
	id: 'scheduler-get',
	name: 'getSchedule',
	description: 'Get one schedule by name from the bound provider, including its task reference when available.',
	inputSchema: scheduleNameInputSchema,
	outputSchema: scheduleGetOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => SchedulerClient.fromContext(ctx).get(input)
})

export const schedulerListTool = defineTool({
	id: 'scheduler-list',
	name: 'listSchedules',
	description: 'List schedules from the bound provider with optional name, state, and pagination filters.',
	inputSchema: scheduleListInputSchema,
	outputSchema: scheduleListOutputSchema,
	sideEffect: 'read',
	runtime: 'both',
	execute: async (input, ctx) => SchedulerClient.fromContext(ctx).list(input)
})

export const schedulerDeleteTool = defineTool({
	id: 'scheduler-delete',
	name: 'deleteSchedule',
	description: 'Delete one schedule by name from the bound provider.',
	inputSchema: scheduleNameInputSchema,
	outputSchema: scheduleDeleteOutputSchema,
	sideEffect: 'delete',
	runtime: 'both',
	execute: async (input, ctx) => SchedulerClient.fromContext(ctx).delete(input)
})

export const schedulerModule = defineModule({
	id: 'scheduler',
	title: 'Scheduler',
	description: 'Create, replace, inspect, list, and delete schedules through the bound scheduling provider.',
	runtime: 'both',
	auth: { type: 'custom', schema: schedulerAuthSchema },
	tools: [schedulerCreateTool, schedulerUpdateTool, schedulerGetTool, schedulerListTool, schedulerDeleteTool]
})
