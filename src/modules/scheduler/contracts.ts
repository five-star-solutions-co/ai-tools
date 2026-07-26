/**
 * Provider-neutral scheduler seam contracts.
 * Schedule shapes are reused from the EventBridge vendor until another provider
 * requires a broader shared contract.
 */

import { z } from 'zod'

import {
	eventBridgeSchedulerAuthSchema,
	scheduleCreateInputSchema,
	scheduleDeleteOutputSchema,
	scheduleDetailSchema,
	scheduleGetOutputSchema,
	scheduleListInputSchema,
	scheduleListOutputSchema,
	scheduleNameInputSchema,
	scheduleStateSchema,
	scheduleSummarySchema,
	scheduleUpdateInputSchema,
	scheduleWriteOutputSchema
} from '../../vendors/eventbridge-scheduler'
import type {
	ScheduleCreateInput,
	ScheduleDeleteOutput,
	ScheduleGetOutput,
	ScheduleListInput,
	ScheduleListOutput,
	ScheduleNameInput,
	ScheduleUpdateInput,
	ScheduleWriteOutput
} from '../../vendors/eventbridge-scheduler'

export {
	scheduleCreateInputSchema,
	scheduleDeleteOutputSchema,
	scheduleDetailSchema,
	scheduleGetOutputSchema,
	scheduleListInputSchema,
	scheduleListOutputSchema,
	scheduleNameInputSchema,
	scheduleStateSchema,
	scheduleSummarySchema,
	scheduleUpdateInputSchema,
	scheduleWriteOutputSchema
}
export type {
	ScheduleCreateInput,
	ScheduleDeleteOutput,
	ScheduleDetail,
	ScheduleGetOutput,
	ScheduleListInput,
	ScheduleListOutput,
	ScheduleNameInput,
	ScheduleState,
	ScheduleSummary,
	ScheduleUpdateInput,
	ScheduleWriteOutput
} from '../../vendors/eventbridge-scheduler'

export const eventBridgeSchedulerSeamAuthSchema = eventBridgeSchedulerAuthSchema.extend({
	provider: z.literal('eventbridge')
})

export const schedulerAuthSchema = eventBridgeSchedulerSeamAuthSchema

export type EventBridgeSchedulerSeamAuth = z.infer<typeof eventBridgeSchedulerSeamAuthSchema>
export type SchedulerAuth = z.infer<typeof schedulerAuthSchema>

export type SchedulerOps = {
	create(input: ScheduleCreateInput): Promise<ScheduleWriteOutput>
	update(input: ScheduleUpdateInput): Promise<ScheduleWriteOutput>
	get(input: ScheduleNameInput): Promise<ScheduleGetOutput>
	list(input?: ScheduleListInput): Promise<ScheduleListOutput>
	delete(input: ScheduleNameInput): Promise<ScheduleDeleteOutput>
}
