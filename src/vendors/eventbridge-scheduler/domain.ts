/**
 * EventBridge Scheduler pure helpers (no HTTP).
 */

import { isPlainObject, isString } from 'es-toolkit'

import { ToolError } from '../../core/errors'
import type { EventBridgeSchedulerAuth, ScheduleCreateInput, ScheduleDetail, ScheduleSummary } from './contracts'
import { MAX_PAYLOAD_JSON } from './contracts'

export function buildTargetInput(taskRef: string, payload?: Record<string, unknown>): string {
	const body: Record<string, unknown> = { task_ref: taskRef }
	if (payload !== undefined) {
		for (const [key, value] of Object.entries(payload)) {
			if (key === 'task_ref') continue
			body[key] = value
		}
	}
	const json = JSON.stringify(body)
	if (json.length > MAX_PAYLOAD_JSON) {
		throw new ToolError('Schedule target payload is too large', {
			code: 'too_large',
			details: { max_chars: MAX_PAYLOAD_JSON, length: json.length }
		})
	}
	return json
}

export function parseTaskRefFromInput(input: unknown): string | undefined {
	if (!isString(input) || input.length === 0) return undefined
	try {
		const parsed: unknown = JSON.parse(input)
		if (!isPlainObject(parsed)) return undefined
		const ref = parsed['task_ref']
		return isString(ref) ? ref : undefined
	} catch {
		return undefined
	}
}

export function flexibleTimeWindow(auth: EventBridgeSchedulerAuth): {
	Mode: 'OFF' | 'FLEXIBLE'
	MaximumWindowInMinutes?: number
} {
	if (auth.flexible_window_minutes !== undefined) {
		return { Mode: 'FLEXIBLE', MaximumWindowInMinutes: auth.flexible_window_minutes }
	}
	return { Mode: 'OFF' }
}

export function isoToUnixSeconds(iso: string, field: string): number {
	const ms = Date.parse(iso)
	if (!Number.isFinite(ms)) {
		throw new ToolError(`Invalid ${field} timestamp`, { code: 'bad_input', details: { field, value: iso } })
	}
	return Math.floor(ms / 1000)
}

/**
 * EventBridge Scheduler rejects empty ClientToken on the raw HTTP API even when
 * docs mark it optional (SDKs / CLI always send one).
 * Pattern: [a-zA-Z0-9-_]+, max 64.
 */
export function newClientToken(): string {
	return crypto.randomUUID().replaceAll('-', '')
}

export function buildCreateBody(auth: EventBridgeSchedulerAuth, input: ScheduleCreateInput): Record<string, unknown> {
	const target: Record<string, unknown> = {
		Arn: auth.target_arn,
		RoleArn: auth.role_arn,
		Input: buildTargetInput(input.task_ref, input.payload)
	}
	if (auth.dead_letter_arn) {
		target['DeadLetterConfig'] = { Arn: auth.dead_letter_arn }
	}
	if (auth.max_retry_attempts !== undefined || auth.max_event_age_seconds !== undefined) {
		const retry: Record<string, number> = {}
		if (auth.max_retry_attempts !== undefined) retry['MaximumRetryAttempts'] = auth.max_retry_attempts
		if (auth.max_event_age_seconds !== undefined) retry['MaximumEventAgeInSeconds'] = auth.max_event_age_seconds
		target['RetryPolicy'] = retry
	}

	const body: Record<string, unknown> = {
		ClientToken: newClientToken(),
		ScheduleExpression: input.schedule_expression,
		FlexibleTimeWindow: flexibleTimeWindow(auth),
		Target: target,
		State: input.state ?? 'ENABLED'
	}
	if (auth.group_name) body['GroupName'] = auth.group_name
	if (input.timezone) body['ScheduleExpressionTimezone'] = input.timezone
	if (input.description) body['Description'] = input.description
	if (input.action_after_completion) body['ActionAfterCompletion'] = input.action_after_completion
	if (input.start_at) body['StartDate'] = isoToUnixSeconds(input.start_at, 'start_at')
	if (input.end_at) body['EndDate'] = isoToUnixSeconds(input.end_at, 'end_at')
	return body
}

export function mapScheduleSummary(raw: Record<string, unknown>): ScheduleSummary {
	const out: ScheduleSummary = {
		name: isString(raw['Name']) ? raw['Name'] : ''
	}
	if (isString(raw['GroupName'])) out.group_name = raw['GroupName']
	if (raw['State'] === 'ENABLED' || raw['State'] === 'DISABLED') out.state = raw['State']
	if (isString(raw['ScheduleExpression'])) out.schedule_expression = raw['ScheduleExpression']
	if (isString(raw['Arn'])) out.arn = raw['Arn']
	return out
}

export function mapScheduleDetail(raw: Record<string, unknown>): ScheduleDetail {
	const base = mapScheduleSummary(raw)
	const target = isPlainObject(raw['Target']) ? raw['Target'] : undefined
	const taskRef = target ? parseTaskRefFromInput(target['Input']) : undefined
	const out: ScheduleDetail = { ...base }
	if (isString(raw['Description'])) out.description = raw['Description']
	if (isString(raw['ScheduleExpressionTimezone'])) out.timezone = raw['ScheduleExpressionTimezone']
	if (taskRef !== undefined) out.task_ref = taskRef
	if (isString(raw['CreationDate'])) out.creation_date = raw['CreationDate']
	if (isString(raw['LastModificationDate'])) out.last_modification_date = raw['LastModificationDate']
	// AWS may return timestamps as numbers
	if (typeof raw['CreationDate'] === 'number') out.creation_date = new Date(raw['CreationDate'] * 1000).toISOString()
	if (typeof raw['LastModificationDate'] === 'number') {
		out.last_modification_date = new Date(raw['LastModificationDate'] * 1000).toISOString()
	}
	return out
}
