/**
 * Amazon EventBridge Scheduler vendor client (AwsService SigV4).
 * Host: `new EventBridgeSchedulerClient(auth)`. Agent: `fromContext(ctx)`.
 */

import { isPlainObject, isString } from 'es-toolkit'
import { isArray } from 'es-toolkit/compat'

import { ToolError } from '../../core/errors'
import { requireAuth } from '../../core/provider'
import type { ToolContext } from '../../core/types'
import { AwsService } from '../../transport/aws-service'
import type { AwsServiceOptions } from '../../transport/aws-service'
import type { HttpServiceOptions } from '../../transport/http-service'
import type {
	EventBridgeSchedulerAuth,
	ScheduleCreateInput,
	ScheduleDeleteOutput,
	ScheduleGetOutput,
	ScheduleListInput,
	ScheduleListOutput,
	ScheduleNameInput,
	ScheduleUpdateInput,
	ScheduleWriteOutput
} from './contracts'
import { eventBridgeSchedulerAuthSchema } from './contracts'
import { buildCreateBody, mapScheduleDetail, mapScheduleSummary, newClientToken } from './domain'

export type EventBridgeSchedulerClientOptions = Pick<HttpServiceOptions, 'fetch' | 'signal'>

export class EventBridgeSchedulerClient {
	readonly #auth: EventBridgeSchedulerAuth
	readonly #aws: AwsService

	constructor(auth: EventBridgeSchedulerAuth, options: EventBridgeSchedulerClientOptions = {}) {
		const parsed = eventBridgeSchedulerAuthSchema.safeParse(auth)
		if (!parsed.success) {
			throw new ToolError('Invalid EventBridge Scheduler auth credentials', {
				code: 'bad_auth',
				details: { issues: parsed.error.issues.map((issue) => issue.message) }
			})
		}
		this.#auth = parsed.data
		const awsOptions: AwsServiceOptions = {
			accessKeyId: this.#auth.access_key_id,
			secretAccessKey: this.#auth.secret_access_key,
			region: this.#auth.region,
			service: 'scheduler',
			baseURL: `https://scheduler.${this.#auth.region}.amazonaws.com`,
			label: 'EventBridge Scheduler'
		}
		if (options.fetch) awsOptions.fetch = options.fetch
		if (options.signal) awsOptions.signal = options.signal
		if (this.#auth.session_token) awsOptions.sessionToken = this.#auth.session_token
		this.#aws = new AwsService(awsOptions)
	}

	static fromContext(ctx: ToolContext): EventBridgeSchedulerClient {
		const auth = requireAuth(ctx, eventBridgeSchedulerAuthSchema)
		const options: EventBridgeSchedulerClientOptions = {}
		if (ctx.fetch) options.fetch = ctx.fetch
		if (ctx.signal) options.signal = ctx.signal
		return new EventBridgeSchedulerClient(auth, options)
	}

	async create(input: ScheduleCreateInput): Promise<ScheduleWriteOutput> {
		const body = buildCreateBody(this.#auth, input)
		const { data } = await this.#aws.post(`/schedules/${encodeURIComponent(input.name)}`, body)
		return this.#writeResult(input.name, data)
	}

	async update(input: ScheduleUpdateInput): Promise<ScheduleWriteOutput> {
		const body = buildCreateBody(this.#auth, input)
		const { data } = await this.#aws.put(`/schedules/${encodeURIComponent(input.name)}`, body)
		return this.#writeResult(input.name, data)
	}

	async get(input: ScheduleNameInput): Promise<ScheduleGetOutput> {
		const path = `/schedules/${encodeURIComponent(input.name)}${this.#scheduleQuery()}`
		const { data } = await this.#aws.get(path)
		if (!isPlainObject(data)) {
			throw new ToolError('Unexpected GetSchedule response', { code: 'upstream' })
		}
		return { schedule: mapScheduleDetail(data) }
	}

	async list(input: ScheduleListInput = {}): Promise<ScheduleListOutput> {
		const params = new URLSearchParams()
		if (input.name_prefix) params.set('NamePrefix', input.name_prefix)
		if (input.state) params.set('State', input.state)
		if (input.max_results !== undefined) params.set('MaxResults', String(input.max_results))
		if (input.next_token) params.set('NextToken', input.next_token)
		if (this.#auth.group_name) params.set('ScheduleGroup', this.#auth.group_name)
		const qs = params.toString()
		const { data } = await this.#aws.get(`/schedules${qs ? `?${qs}` : ''}`)
		if (!isPlainObject(data)) {
			throw new ToolError('Unexpected ListSchedules response', { code: 'upstream' })
		}
		const items = data['Schedules']
		const schedules = isArray(items) ? items.filter(isPlainObject).map((row) => mapScheduleSummary(row)) : []
		const out: ScheduleListOutput = { schedules }
		if (isString(data['NextToken'])) out.next_token = data['NextToken']
		return out
	}

	async delete(input: ScheduleNameInput): Promise<ScheduleDeleteOutput> {
		// DeleteSchedule takes clientToken as a query param; empty/missing fails live API.
		const path = `/schedules/${encodeURIComponent(input.name)}${this.#scheduleQuery({ clientToken: newClientToken() })}`
		await this.#aws.delete(path)
		return { name: input.name, deleted: true }
	}

	#scheduleQuery(extra: Record<string, string> = {}): string {
		const params = new URLSearchParams(extra)
		if (this.#auth.group_name) params.set('groupName', this.#auth.group_name)
		const qs = params.toString()
		return qs ? `?${qs}` : ''
	}

	#writeResult(name: string, raw: unknown): ScheduleWriteOutput {
		const out: ScheduleWriteOutput = { name }
		if (isPlainObject(raw) && isString(raw['ScheduleArn'])) out.arn = raw['ScheduleArn']
		return out
	}
}
