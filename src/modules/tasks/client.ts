import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import type {
	TasksAuth,
	TasksCreateInput,
	TasksGetInput,
	TasksListInput,
	TasksOps,
	TasksUpdateInput
} from './contracts'
import { tasksAuthSchema } from './contracts'
import { HostTasksProvider } from './providers/host'

function providerFor(auth: TasksAuth): TasksOps {
	switch (auth.provider) {
		case 'host':
			return new HostTasksProvider(auth)
	}
}

export class TasksClient implements TasksOps {
	readonly #ops: TasksOps

	constructor(ops: TasksOps) {
		this.#ops = ops
	}

	static fromContext(ctx: ToolContext): TasksClient {
		const auth = requireAuth(ctx, tasksAuthSchema)
		return new TasksClient(providerFor(auth))
	}

	static fromAuth(auth: TasksAuth): TasksClient {
		return new TasksClient(providerFor(auth))
	}

	create(input: TasksCreateInput) {
		return this.#ops.create(input)
	}

	get(input: TasksGetInput) {
		return this.#ops.get(input)
	}

	list(input: TasksListInput = {}) {
		return this.#ops.list(input)
	}

	update(input: TasksUpdateInput) {
		return this.#ops.update(input)
	}

	delete(input: TasksGetInput) {
		return this.#ops.delete(input)
	}
}
