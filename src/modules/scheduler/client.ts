import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import type {
	ScheduleCreateInput,
	ScheduleListInput,
	ScheduleNameInput,
	ScheduleUpdateInput,
	SchedulerAuth,
	SchedulerOps
} from './contracts'
import { schedulerAuthSchema } from './contracts'
import { EventBridgeSchedulerProvider } from './providers/eventbridge'

function transportOptions(ctx: ToolContext) {
	return {
		...(ctx.fetch && { fetch: ctx.fetch }),
		...(ctx.signal && { signal: ctx.signal })
	}
}

function providerFor(auth: SchedulerAuth, ctx: ToolContext): SchedulerOps {
	switch (auth.provider) {
		case 'eventbridge':
			return new EventBridgeSchedulerProvider(auth, transportOptions(ctx))
	}
}

export class SchedulerClient implements SchedulerOps {
	readonly #ops: SchedulerOps

	constructor(ops: SchedulerOps) {
		this.#ops = ops
	}

	static fromContext(ctx: ToolContext): SchedulerClient {
		const auth = requireAuth(ctx, schedulerAuthSchema)
		return new SchedulerClient(providerFor(auth, ctx))
	}

	static fromAuth(auth: SchedulerAuth, ctx: ToolContext = {}): SchedulerClient {
		return new SchedulerClient(providerFor(auth, ctx))
	}

	create(input: ScheduleCreateInput) {
		return this.#ops.create(input)
	}

	update(input: ScheduleUpdateInput) {
		return this.#ops.update(input)
	}

	get(input: ScheduleNameInput) {
		return this.#ops.get(input)
	}

	list(input: ScheduleListInput = {}) {
		return this.#ops.list(input)
	}

	delete(input: ScheduleNameInput) {
		return this.#ops.delete(input)
	}
}
