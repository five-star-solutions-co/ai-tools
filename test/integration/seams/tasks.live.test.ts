import { describe, expect, test } from 'bun:test'

import { TasksClient } from '../../../src/modules/tasks'
import type { TaskDefinition, TasksOps } from '../../../src/modules/tasks'

describe('live seam tasks host binding', () => {
	test('create get list update delete', async () => {
		const stored = new Map<string, TaskDefinition>()
		const backend: TasksOps = {
			create: async (input) => {
				const task: TaskDefinition = { task_ref: 'task-live-1', ...input }
				stored.set(task.task_ref, task)
				return { task }
			},
			get: async ({ task_ref }) => {
				const task = stored.get(task_ref)
				if (!task) throw new Error('missing task')
				return { task }
			},
			list: async () => ({
				tasks: [...stored.values()].map(({ task_ref, title, tags }) => ({
					task_ref,
					title,
					...(tags && { tags })
				}))
			}),
			update: async (input) => {
				const current = stored.get(input.task_ref)
				if (!current) throw new Error('missing task')
				const task: TaskDefinition = {
					...current,
					...(input.title && { title: input.title }),
					...(input.instructions && { instructions: input.instructions }),
					...(input.payload && { payload: input.payload }),
					...(input.tags && { tags: input.tags })
				}
				stored.set(task.task_ref, task)
				return { task }
			},
			delete: async ({ task_ref }) => {
				stored.delete(task_ref)
				return { task_ref, deleted: true }
			}
		}
		const client = TasksClient.fromAuth({ provider: 'host', backend })

		const created = await client.create({
			title: 'Live task',
			instructions: 'Exercise the host task backend.'
		})
		expect((await client.get({ task_ref: created.task.task_ref })).task.title).toBe('Live task')
		expect((await client.list()).tasks).toHaveLength(1)
		expect((await client.update({ task_ref: created.task.task_ref, title: 'Updated live task' })).task.title).toBe(
			'Updated live task'
		)
		expect(await client.delete({ task_ref: created.task.task_ref })).toEqual({
			task_ref: 'task-live-1',
			deleted: true
		})
	})
})
