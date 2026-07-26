/**
 * Amazon EventBridge Scheduler vendor contracts.
 * Host auth holds target ARN / role ARN; tools schedule task_ref only.
 */

import { z } from 'zod'

export const MAX_SCHEDULE_NAME = 64
export const MAX_TASK_REF = 512
export const MAX_PAYLOAD_JSON = 8_000
export const MAX_LIST = 100

const scheduleName = z
	.string()
	.min(1)
	.max(MAX_SCHEDULE_NAME)
	.regex(/^[0-9a-zA-Z-_.]+$/, 'Schedule name must match [0-9a-zA-Z-_.]+')

export const eventBridgeSchedulerAuthSchema = z.object({
	access_key_id: z.string().min(1).describe('AWS access key id'),
	secret_access_key: z.string().min(1).describe('AWS secret access key'),
	region: z.string().min(1).describe('AWS region for EventBridge Scheduler'),
	session_token: z.string().min(1).optional().describe('Optional session token'),
	target_arn: z.string().min(1).describe('Host-bound target ARN (Lambda, SQS, etc.)'),
	role_arn: z.string().min(1).describe('Host-bound IAM role ARN for the scheduler target'),
	group_name: z.string().min(1).max(64).optional().describe('Schedule group name (default group when omitted)'),
	flexible_window_minutes: z
		.int()
		.min(1)
		.max(1440)
		.optional()
		.describe('When set, FlexibleTimeWindow Mode=FLEXIBLE with this window; otherwise Mode=OFF'),
	dead_letter_arn: z.string().min(1).optional().describe('Optional DLQ ARN'),
	max_retry_attempts: z.int().min(0).max(185).optional().describe('Target retry MaximumRetryAttempts'),
	max_event_age_seconds: z.int().min(60).max(86400).optional().describe('Target retry MaximumEventAgeInSeconds')
})

export type EventBridgeSchedulerAuth = z.infer<typeof eventBridgeSchedulerAuthSchema>

export const scheduleStateSchema = z.enum(['ENABLED', 'DISABLED'])

export type ScheduleState = z.infer<typeof scheduleStateSchema>

export const scheduleCreateInputSchema = z.object({
	name: scheduleName.describe('Schedule name'),
	schedule_expression: z.string().min(1).max(256).describe('When to run: at(...), rate(...), or cron(...) expression'),
	task_ref: z
		.string()
		.min(1)
		.max(MAX_TASK_REF)
		.describe('Opaque task definition reference. Not an ARN or infrastructure id'),
	payload: z
		.record(z.string(), z.unknown())
		.optional()
		.describe('Optional small JSON payload merged into the target input with task_ref'),
	timezone: z.string().min(1).max(50).optional().describe('Timezone for the schedule expression'),
	description: z.string().max(512).optional().describe('Human description'),
	state: scheduleStateSchema.optional().describe('ENABLED or DISABLED (default ENABLED)'),
	start_at: z.string().min(1).optional().describe('ISO-8601 start time (UTC) when the schedule may begin'),
	end_at: z.string().min(1).optional().describe('ISO-8601 end time (UTC) when the schedule may stop'),
	action_after_completion: z
		.enum(['NONE', 'DELETE'])
		.optional()
		.describe('What to do after a one-time schedule completes')
})

export const scheduleUpdateInputSchema = scheduleCreateInputSchema

export const scheduleNameInputSchema = z.object({
	name: scheduleName.describe('Schedule name')
})

export const scheduleListInputSchema = z.object({
	name_prefix: z.string().min(1).max(64).optional().describe('Filter by name prefix'),
	state: scheduleStateSchema.optional().describe('Filter by state'),
	max_results: z.int().min(1).max(MAX_LIST).optional().describe('Page size (default 100)'),
	next_token: z.string().min(1).optional().describe('Pagination token from a prior list call')
})

export const scheduleSummarySchema = z.object({
	name: z.string().describe('Schedule name'),
	group_name: z.string().optional().describe('Schedule group'),
	state: scheduleStateSchema.optional().describe('ENABLED or DISABLED'),
	schedule_expression: z.string().optional().describe('Schedule expression when known'),
	arn: z.string().optional().describe('Schedule ARN when returned by the provider')
})

export const scheduleDetailSchema = scheduleSummarySchema.extend({
	description: z.string().optional(),
	timezone: z.string().optional(),
	task_ref: z.string().optional().describe('task_ref parsed from target input when present'),
	creation_date: z.string().optional(),
	last_modification_date: z.string().optional()
})

export const scheduleWriteOutputSchema = z.object({
	name: z.string().describe('Schedule name'),
	arn: z.string().optional().describe('Schedule ARN when returned')
})

export const scheduleGetOutputSchema = z.object({
	schedule: scheduleDetailSchema
})

export const scheduleListOutputSchema = z.object({
	schedules: z.array(scheduleSummarySchema),
	next_token: z.string().optional().describe('Pagination token when more results exist')
})

export const scheduleDeleteOutputSchema = z.object({
	name: z.string().describe('Deleted schedule name'),
	deleted: z.literal(true)
})

export type ScheduleCreateInput = z.infer<typeof scheduleCreateInputSchema>
export type ScheduleUpdateInput = z.infer<typeof scheduleUpdateInputSchema>
export type ScheduleNameInput = z.infer<typeof scheduleNameInputSchema>
export type ScheduleListInput = z.infer<typeof scheduleListInputSchema>
export type ScheduleSummary = z.infer<typeof scheduleSummarySchema>
export type ScheduleDetail = z.infer<typeof scheduleDetailSchema>
export type ScheduleWriteOutput = z.infer<typeof scheduleWriteOutputSchema>
export type ScheduleGetOutput = z.infer<typeof scheduleGetOutputSchema>
export type ScheduleListOutput = z.infer<typeof scheduleListOutputSchema>
export type ScheduleDeleteOutput = z.infer<typeof scheduleDeleteOutputSchema>
