import { describe, expect, test } from 'bun:test'

import { runTool, validateModule } from '../../src/core'
import {
	tasksCreateTool,
	tasksDeleteTool,
	tasksGetTool,
	tasksListTool,
	tasksModule,
	tasksUpdateTool
} from '../../src/modules/tasks'
import type { TaskDefinition, TasksOps } from '../../src/modules/tasks'

describe('tasks', () => {
	test('module contracts and tool ids', () => {
		expect(validateModule(tasksModule).ok).toBe(true)
		expect(tasksModule.tools.map((tool) => tool.id).sort()).toEqual([
			'tasks-create',
			'tasks-delete',
			'tasks-get',
			'tasks-list',
			'tasks-update'
		])
	})

	test('host backend serves every task-definition tool', async () => {
		const tasks = new Map<string, TaskDefinition>()
		let sequence = 0
		const backend: TasksOps = {
			create: async (input) => {
				sequence += 1
				const task: TaskDefinition = {
					task_ref: `task-${sequence}`,
					title: input.title,
					instructions: input.instructions,
					...(input.payload && { payload: input.payload }),
					...(input.tags && { tags: input.tags })
				}
				tasks.set(task.task_ref, task)
				return { task }
			},
			get: async ({ task_ref }) => {
				const task = tasks.get(task_ref)
				if (!task) throw new Error('missing task')
				return { task }
			},
			list: async () => ({
				tasks: [...tasks.values()].map(({ task_ref, title, tags }) => ({
					task_ref,
					title,
					...(tags && { tags })
				}))
			}),
			update: async (input) => {
				const current = tasks.get(input.task_ref)
				if (!current) throw new Error('missing task')
				const task: TaskDefinition = {
					...current,
					...(input.title && { title: input.title }),
					...(input.instructions && { instructions: input.instructions }),
					...(input.payload && { payload: input.payload }),
					...(input.tags && { tags: input.tags })
				}
				tasks.set(task.task_ref, task)
				return { task }
			},
			delete: async ({ task_ref }) => {
				tasks.delete(task_ref)
				return { task_ref, deleted: true }
			}
		}
		const auth = { provider: 'host', backend } as const

		const created = await runTool(
			tasksCreateTool,
			{
				title: 'Nightly report',
				instructions: 'Build and deliver the operations report.',
				tags: ['reports']
			},
			{ auth }
		)
		expect(created.task.task_ref).toBe('task-1')

		const got = await runTool(tasksGetTool, { task_ref: created.task.task_ref }, { auth })
		expect(got.task.title).toBe('Nightly report')

		const listed = await runTool(tasksListTool, {}, { auth })
		expect(listed.tasks).toEqual([{ task_ref: 'task-1', title: 'Nightly report', tags: ['reports'] }])

		const updated = await runTool(tasksUpdateTool, { task_ref: created.task.task_ref, title: 'Daily report' }, { auth })
		expect(updated.task.title).toBe('Daily report')

		const deleted = await runTool(tasksDeleteTool, { task_ref: created.task.task_ref }, { auth })
		expect(deleted).toEqual({ task_ref: 'task-1', deleted: true })
	})

	test('rejects an empty task update before the host backend runs', async () => {
		let called = false
		const backend: TasksOps = {
			create: async () => {
				throw new Error('not used')
			},
			get: async () => {
				throw new Error('not used')
			},
			list: async () => ({ tasks: [] }),
			update: async () => {
				called = true
				throw new Error('not used')
			},
			delete: async ({ task_ref }) => ({ task_ref, deleted: true })
		}

		expect(runTool(tasksUpdateTool, { task_ref: 'task-1' }, { auth: { provider: 'host', backend } })).rejects.toThrow()
		expect(called).toBe(false)
	})
})
