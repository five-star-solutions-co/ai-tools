import { SqsClient } from '../../../vendors/sqs'
import type { SqsClientOptions } from '../../../vendors/sqs'
import type {
	QueueEnqueueInput,
	QueueExtendVisibilityInput,
	QueueReceiptInput,
	QueueReceiveInput,
	QueueSeamOps,
	SqsQueueAuth
} from '../contracts'

export type SqsQueueProviderOptions = SqsClientOptions

export class SqsQueueProvider implements QueueSeamOps {
	readonly #client: SqsClient

	constructor(auth: SqsQueueAuth, options: SqsQueueProviderOptions = {}) {
		const { provider: _provider, ...vendorAuth } = auth
		this.#client = new SqsClient(vendorAuth, options)
	}

	enqueue(input: QueueEnqueueInput) {
		return this.#client.enqueue(input)
	}

	receive(input: QueueReceiveInput = {}) {
		return this.#client.receive(input)
	}

	acknowledge(input: QueueReceiptInput) {
		return this.#client.acknowledge(input)
	}

	extendVisibility(input: QueueExtendVisibilityInput) {
		return this.#client.extendVisibility(input)
	}
}
