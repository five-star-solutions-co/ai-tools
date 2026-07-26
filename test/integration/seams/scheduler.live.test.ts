import { describe, expect, test } from 'bun:test'

import { SchedulerClient } from '../../../src/modules/scheduler'
import { awsCredentialsFromEnv, env, uniqueId } from '../env'

const aws = awsCredentialsFromEnv({ regionEnv: 'AI_TOOLS_EVENTBRIDGE_SCHEDULER_REGION' })
const targetArn = env('AI_TOOLS_EVENTBRIDGE_SCHEDULER_TARGET_ARN')
const roleArn = env('AI_TOOLS_EVENTBRIDGE_SCHEDULER_ROLE_ARN')
const groupName = env('AI_TOOLS_EVENTBRIDGE_SCHEDULER_GROUP_NAME')
const run = aws && targetArn && roleArn ? describe : describe.skip

run('live seam scheduler', () => {
	test(
		'create get list update delete through EventBridge provider',
		async () => {
			const name = uniqueId('ait-schedule').slice(0, 64)
			const client = SchedulerClient.fromAuth({
				provider: 'eventbridge',
				...aws!,
				target_arn: targetArn!,
				role_arn: roleArn!,
				...(groupName && { group_name: groupName })
			})

			try {
				const created = await client.create({
					name,
					schedule_expression: 'rate(1 day)',
					task_ref: `task:${name}`,
					state: 'DISABLED'
				})
				expect(created.name).toBe(name)

				const got = await client.get({ name })
				expect(got.schedule.task_ref).toBe(`task:${name}`)
				expect(got.schedule.state).toBe('DISABLED')

				const listed = await client.list({ name_prefix: name, max_results: 10 })
				expect(listed.schedules.some((schedule) => schedule.name === name)).toBe(true)

				const updated = await client.update({
					name,
					schedule_expression: 'rate(2 days)',
					task_ref: `task:${name}`,
					state: 'DISABLED'
				})
				expect(updated.name).toBe(name)
			} finally {
				await client.delete({ name }).catch(() => undefined)
			}
		},
		{ timeout: 60_000 }
	)
})
