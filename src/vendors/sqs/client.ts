import { isPlainObject, isString } from 'es-toolkit'

import { ToolError } from '../../core/errors'
import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import { parseAwsJsonBody } from '../../transport/aws-json'
import { AwsService } from '../../transport/aws-service'
import type { AwsServiceOptions } from '../../transport/aws-service'
import type { HttpServiceOptions } from '../../transport/http-service'
import type {
	QueueAcknowledgeOutput,
	QueueEnqueueInput,
	QueueEnqueueOutput,
	QueueExtendVisibilityInput,
	QueueExtendVisibilityOutput,
	QueueMessage,
	QueueReceiveInput,
	QueueReceiveOutput,
	QueueReceiptInput,
	SqsAuth
} from './contracts'
import { sqsAuthSchema } from './contracts'

export type SqsClientOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'>

const jsonHeaders = (action: string): Record<string, string> => ({
	'content-type': 'application/x-amz-json-1.0',
	'x-amz-target': `AmazonSQS.${action}`
})

function attributes(value: unknown): Record<string, string> | undefined {
	if (!isPlainObject(value)) return undefined
	const result: Record<string, string> = {}
	for (const [key, current] of Object.entries(value)) {
		if (isString(current)) result[key] = current
	}
	return Object.keys(result).length > 0 ? result : undefined
}

function mapMessage(value: unknown): QueueMessage | undefined {
	if (!isPlainObject(value)) return undefined
	const messageId = value['MessageId']
	const receiptHandle = value['ReceiptHandle']
	const body = value['Body']
	if (!isString(messageId) || !isString(receiptHandle) || !isString(body)) return undefined
	const result: QueueMessage = { message_id: messageId, receipt_handle: receiptHandle, body }
	if (isString(value['MD5OfBody'])) result.body_md5 = value['MD5OfBody']
	const mappedAttributes = attributes(value['Attributes'])
	if (mappedAttributes) result.attributes = mappedAttributes
	return result
}

export class SqsClient {
	readonly #auth: SqsAuth
	readonly #aws: AwsService

	constructor(auth: SqsAuth, options: SqsClientOptions = {}) {
		const parsed = sqsAuthSchema.safeParse(auth)
		if (!parsed.success) {
			throw new ToolError('Invalid SQS auth credentials', {
				code: 'bad_auth',
				details: { issues: parsed.error.issues.map((issue) => issue.message) }
			})
		}
		this.#auth = parsed.data
		const awsOptions: AwsServiceOptions = {
			accessKeyId: this.#auth.access_key_id,
			secretAccessKey: this.#auth.secret_access_key,
			region: this.#auth.region,
			service: 'sqs',
			baseURL: `https://sqs.${this.#auth.region}.amazonaws.com`,
			label: 'SQS',
			...(options.fetch && { fetch: options.fetch }),
			...(options.signal && { signal: options.signal }),
			...(this.#auth.session_token && { sessionToken: this.#auth.session_token })
		}
		this.#aws = new AwsService(awsOptions)
	}

	static fromContext(ctx: ToolContext): SqsClient {
		return new SqsClient(requireAuth(ctx, sqsAuthSchema), {
			...(ctx.fetch && { fetch: ctx.fetch }),
			...(ctx.signal && { signal: ctx.signal })
		})
	}

	async enqueue(input: QueueEnqueueInput): Promise<QueueEnqueueOutput> {
		const body: Record<string, unknown> = {
			QueueUrl: this.#auth.queue_url,
			MessageBody: input.body
		}
		if (input.delay_seconds !== undefined) body['DelaySeconds'] = input.delay_seconds
		if (input.message_group_id) body['MessageGroupId'] = input.message_group_id
		if (input.deduplication_id) body['MessageDeduplicationId'] = input.deduplication_id
		const data = await this.#postJson('SendMessage', body)
		if (!isPlainObject(data) || !isString(data['MessageId'])) {
			throw new ToolError('Unexpected SQS SendMessage response', { code: 'upstream' })
		}
		const output: QueueEnqueueOutput = { message_id: data['MessageId'] }
		if (isString(data['MD5OfMessageBody'])) output.body_md5 = data['MD5OfMessageBody']
		if (isString(data['SequenceNumber'])) output.sequence_number = data['SequenceNumber']
		return output
	}

	async receive(input: QueueReceiveInput = {}): Promise<QueueReceiveOutput> {
		const body: Record<string, unknown> = {
			QueueUrl: this.#auth.queue_url,
			MaxNumberOfMessages: input.max_messages ?? 1,
			AttributeNames: ['All']
		}
		if (input.wait_seconds !== undefined) body['WaitTimeSeconds'] = input.wait_seconds
		if (input.visibility_timeout_seconds !== undefined) {
			body['VisibilityTimeout'] = input.visibility_timeout_seconds
		}
		const data = await this.#postJson('ReceiveMessage', body)
		if (!isPlainObject(data)) {
			throw new ToolError('Unexpected SQS ReceiveMessage response', { code: 'upstream' })
		}
		const rawMessages = data['Messages']
		const messages = Array.isArray(rawMessages)
			? rawMessages.map(mapMessage).filter((message) => message !== undefined)
			: []
		return { messages }
	}

	async acknowledge(input: QueueReceiptInput): Promise<QueueAcknowledgeOutput> {
		await this.#postJson('DeleteMessage', {
			QueueUrl: this.#auth.queue_url,
			ReceiptHandle: input.receipt_handle
		})
		return { acknowledged: true }
	}

	async extendVisibility(input: QueueExtendVisibilityInput): Promise<QueueExtendVisibilityOutput> {
		await this.#postJson('ChangeMessageVisibility', {
			QueueUrl: this.#auth.queue_url,
			ReceiptHandle: input.receipt_handle,
			VisibilityTimeout: input.visibility_timeout_seconds
		})
		return { extended: true, visibility_timeout_seconds: input.visibility_timeout_seconds }
	}

	/** SQS uses application/x-amz-json-1.0 — ofetch does not auto-parse that content-type. */
	async #postJson(action: string, body: Record<string, unknown>): Promise<unknown> {
		const { data } = await this.#aws.post('/', body, { headers: jsonHeaders(action) })
		return parseAwsJsonBody(data)
	}
}
