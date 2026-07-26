import type {
	HostTasksAuth,
	TasksCreateInput,
	TasksDeleteOutput,
	TasksGetInput,
	TasksGetOutput,
	TasksListInput,
	TasksListOutput,
	TasksOps,
	TasksUpdateInput,
	TasksUpdateOutput
} from '../contracts'
import {
	tasksCreateOutputSchema,
	tasksDeleteOutputSchema,
	tasksGetOutputSchema,
	tasksListOutputSchema,
	tasksUpdateOutputSchema
} from '../contracts'

export class HostTasksProvider implements TasksOps {
	readonly #backend: TasksOps

	constructor(auth: HostTasksAuth) {
		this.#backend = auth.backend
	}

	async create(input: TasksCreateInput): Promise<TasksGetOutput> {
		return tasksCreateOutputSchema.parse(await this.#backend.create(input))
	}

	async get(input: TasksGetInput): Promise<TasksGetOutput> {
		return tasksGetOutputSchema.parse(await this.#backend.get(input))
	}

	async list(input: TasksListInput = {}): Promise<TasksListOutput> {
		return tasksListOutputSchema.parse(await this.#backend.list(input))
	}

	async update(input: TasksUpdateInput): Promise<TasksUpdateOutput> {
		return tasksUpdateOutputSchema.parse(await this.#backend.update(input))
	}

	async delete(input: TasksGetInput): Promise<TasksDeleteOutput> {
		return tasksDeleteOutputSchema.parse(await this.#backend.delete(input))
	}
}
