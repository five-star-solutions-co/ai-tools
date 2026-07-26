import type { HttpServiceOptions } from '../../../transport/http-service'
import { EventBridgeSchedulerClient } from '../../../vendors/eventbridge-scheduler'
import type {
	EventBridgeSchedulerSeamAuth,
	ScheduleCreateInput,
	ScheduleListInput,
	ScheduleNameInput,
	ScheduleUpdateInput,
	SchedulerOps
} from '../contracts'

export type EventBridgeSchedulerProviderOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'>

export class EventBridgeSchedulerProvider implements SchedulerOps {
	readonly #client: EventBridgeSchedulerClient

	constructor(auth: EventBridgeSchedulerSeamAuth, options: EventBridgeSchedulerProviderOptions = {}) {
		const { provider: _provider, ...vendorAuth } = auth
		this.#client = new EventBridgeSchedulerClient(vendorAuth, options)
	}

	create(input: ScheduleCreateInput) {
		return this.#client.create(input)
	}

	update(input: ScheduleUpdateInput) {
		return this.#client.update(input)
	}

	get(input: ScheduleNameInput) {
		return this.#client.get(input)
	}

	list(input: ScheduleListInput = {}) {
		return this.#client.list(input)
	}

	delete(input: ScheduleNameInput) {
		return this.#client.delete(input)
	}
}
