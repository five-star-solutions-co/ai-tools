/**
 * Portable task-definition contracts.
 * Persistence, tenancy, execution, and authorization stay on the host backend.
 */

import { z } from 'zod'

export const MAX_TASK_REF = 512
export const MAX_TASK_INSTRUCTIONS_CHARS = 100_000
export const MAX_TASK_LIST_RESULTS = 100

const taskRef = z.string().min(1).max(MAX_TASK_REF).describe('Opaque task definition reference')
const taskTags = z.array(z.string().min(1).max(64)).max(50)
const taskPayload = z.record(z.string(), z.unknown())

export const taskDefinitionSchema = z.object({
	task_ref: taskRef,
	title: z.string().min(1).max(200).describe('Short task title'),
	instructions: z
		.string()
		.min(1)
		.max(MAX_TASK_INSTRUCTIONS_CHARS)
		.describe('Instructions the host should execute when this task is invoked'),
	payload: taskPayload.optional().describe('Default JSON payload for the task'),
	tags: taskTags.optional().describe('Searchable task tags'),
	created_at: z.string().min(1).optional().describe('Creation timestamp when supplied by the host'),
	updated_at: z.string().min(1).optional().describe('Last update timestamp when supplied by the host')
})

export const taskSummarySchema = taskDefinitionSchema.pick({
	task_ref: true,
	title: true,
	tags: true,
	created_at: true,
	updated_at: true
})

export const tasksCreateInputSchema = taskDefinitionSchema.pick({
	title: true,
	instructions: true,
	payload: true,
	tags: true
})

export const tasksCreateOutputSchema = z.object({
	task: taskDefinitionSchema
})

export const tasksGetInputSchema = z.object({
	task_ref: taskRef
})

export const tasksGetOutputSchema = tasksCreateOutputSchema

export const tasksUpdateInputSchema = z
	.object({
		task_ref: taskRef,
		title: z.string().min(1).max(200).optional().describe('Replacement title'),
		instructions: z.string().min(1).max(MAX_TASK_INSTRUCTIONS_CHARS).optional().describe('Replacement instructions'),
		payload: taskPayload.optional().describe('Replacement default payload'),
		tags: taskTags.optional().describe('Replacement task tags')
	})
	.refine(
		(input) =>
			input.title !== undefined ||
			input.instructions !== undefined ||
			input.payload !== undefined ||
			input.tags !== undefined,
		{ message: 'Provide at least one task field to update' }
	)

export const tasksUpdateOutputSchema = tasksCreateOutputSchema

export const tasksListInputSchema = z.object({
	query: z.string().min(1).max(500).optional().describe('Optional host-defined text search'),
	tags: z.array(z.string().min(1).max(64)).max(20).optional().describe('Optional required tags'),
	limit: z.int().min(1).max(MAX_TASK_LIST_RESULTS).optional().describe('Maximum tasks to return'),
	cursor: z.string().min(1).optional().describe('Pagination cursor from a prior list call')
})

export const tasksListOutputSchema = z.object({
	tasks: z.array(taskSummarySchema),
	next_cursor: z.string().optional().describe('Pagination cursor when more tasks are available')
})

export const tasksDeleteOutputSchema = z.object({
	task_ref: taskRef,
	deleted: z.literal(true)
})

export type TaskDefinition = z.infer<typeof taskDefinitionSchema>
export type TaskSummary = z.infer<typeof taskSummarySchema>
export type TasksCreateInput = z.infer<typeof tasksCreateInputSchema>
export type TasksCreateOutput = z.infer<typeof tasksCreateOutputSchema>
export type TasksGetInput = z.infer<typeof tasksGetInputSchema>
export type TasksGetOutput = z.infer<typeof tasksGetOutputSchema>
export type TasksUpdateInput = z.infer<typeof tasksUpdateInputSchema>
export type TasksUpdateOutput = z.infer<typeof tasksUpdateOutputSchema>
export type TasksListInput = z.infer<typeof tasksListInputSchema>
export type TasksListOutput = z.infer<typeof tasksListOutputSchema>
export type TasksDeleteOutput = z.infer<typeof tasksDeleteOutputSchema>

export type TasksOps = {
	create(input: TasksCreateInput): Promise<TasksCreateOutput>
	get(input: TasksGetInput): Promise<TasksGetOutput>
	list(input?: TasksListInput): Promise<TasksListOutput>
	update(input: TasksUpdateInput): Promise<TasksUpdateOutput>
	delete(input: TasksGetInput): Promise<TasksDeleteOutput>
}

export const tasksBackendSchema = z.object({
	create: z.custom<TasksOps['create']>((value) => typeof value === 'function', 'create must be a function'),
	get: z.custom<TasksOps['get']>((value) => typeof value === 'function', 'get must be a function'),
	list: z.custom<TasksOps['list']>((value) => typeof value === 'function', 'list must be a function'),
	update: z.custom<TasksOps['update']>((value) => typeof value === 'function', 'update must be a function'),
	delete: z.custom<TasksOps['delete']>((value) => typeof value === 'function', 'delete must be a function')
})

export const hostTasksAuthSchema = z.object({
	provider: z.literal('host'),
	backend: tasksBackendSchema.describe('Host task-definition backend')
})

export const tasksAuthSchema = hostTasksAuthSchema

export type HostTasksAuth = z.infer<typeof hostTasksAuthSchema>
export type TasksAuth = z.infer<typeof tasksAuthSchema>
