import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import type {
	QueueAuth,
	QueueEnqueueInput,
	QueueExtendVisibilityInput,
	QueueReceiptInput,
	QueueReceiveInput,
	QueueSeamOps
} from './contracts'
import { queueAuthSchema } from './contracts'
import { SqsQueueProvider } from './providers/sqs'

function providerFor(auth: QueueAuth, ctx: ToolContext): QueueSeamOps {
	switch (auth.provider) {
		case 'sqs':
			return new SqsQueueProvider(auth, {
				...(ctx.fetch && { fetch: ctx.fetch }),
				...(ctx.signal && { signal: ctx.signal })
			})
	}
}

export class QueueClient implements QueueSeamOps {
	readonly #ops: QueueSeamOps

	constructor(ops: QueueSeamOps) {
		this.#ops = ops
	}

	static fromContext(ctx: ToolContext): QueueClient {
		return new QueueClient(providerFor(requireAuth(ctx, queueAuthSchema), ctx))
	}

	static fromAuth(auth: QueueAuth, ctx: ToolContext = {}): QueueClient {
		return new QueueClient(providerFor(auth, ctx))
	}

	enqueue(input: QueueEnqueueInput) {
		return this.#ops.enqueue(input)
	}

	receive(input: QueueReceiveInput = {}) {
		return this.#ops.receive(input)
	}

	acknowledge(input: QueueReceiptInput) {
		return this.#ops.acknowledge(input)
	}

	extendVisibility(input: QueueExtendVisibilityInput) {
		return this.#ops.extendVisibility(input)
	}
}
