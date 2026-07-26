import { describe, expect, test } from 'bun:test'

import { EventBridgeSchedulerClient } from '../../../src/vendors/eventbridge-scheduler'
import { awsCredentialsFromEnv, env, uniqueId } from '../env'

const aws = awsCredentialsFromEnv({ regionEnv: 'AI_TOOLS_EVENTBRIDGE_SCHEDULER_REGION' })
const targetArn = env('AI_TOOLS_EVENTBRIDGE_SCHEDULER_TARGET_ARN')
const roleArn = env('AI_TOOLS_EVENTBRIDGE_SCHEDULER_ROLE_ARN')
const groupName = env('AI_TOOLS_EVENTBRIDGE_SCHEDULER_GROUP_NAME')
const run = aws && targetArn && roleArn ? describe : describe.skip

function client() {
	return new EventBridgeSchedulerClient({
		access_key_id: aws!.access_key_id,
		secret_access_key: aws!.secret_access_key,
		region: aws!.region,
		target_arn: targetArn!,
		role_arn: roleArn!,
		...(aws!.session_token && { session_token: aws!.session_token }),
		...(groupName && { group_name: groupName })
	})
}

run('live vendor eventbridge-scheduler', () => {
	test(
		'create get list update delete schedule',
		async () => {
			const c = client()
			const name = uniqueId('aitools').replaceAll('_', '-').slice(0, 64)
			try {
				const created = await c.create({
					name,
					schedule_expression: 'rate(1 day)',
					task_ref: 'ai-tools.integration.smoke',
					description: 'ai-tools live IT schedule',
					state: 'DISABLED'
				})
				expect(created.name).toBe(name)

				const got = await c.get({ name })
				expect(got.schedule.name).toBe(name)

				const listed = await c.list({ name_prefix: name.slice(0, 12), max_results: 20 })
				expect(listed.schedules.some((s) => s.name === name)).toBe(true)

				const updated = await c.update({
					name,
					schedule_expression: 'rate(2 days)',
					task_ref: 'ai-tools.integration.smoke',
					state: 'DISABLED'
				})
				expect(updated.name).toBe(name)
			} finally {
				await c.delete({ name }).catch(() => undefined)
			}
		},
		{ timeout: 60_000 }
	)
})
