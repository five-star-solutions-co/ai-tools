import { describe, expect, test } from 'bun:test'
import { isPlainObject } from 'es-toolkit'

import { runTool, validateModule } from '../../src/core'
import {
	schedulerCreateTool,
	schedulerDeleteTool,
	schedulerGetTool,
	schedulerListTool,
	schedulerModule,
	schedulerUpdateTool
} from '../../src/modules/scheduler'

function asRecord(value: unknown): Record<string, unknown> {
	if (!isPlainObject(value)) throw new Error('expected object')
	return value
}

function asRequest(input: RequestInfo | URL, init?: RequestInit): Request {
	return input instanceof Request ? input : new Request(input, init)
}

const auth = {
	provider: 'eventbridge',
	access_key_id: 'AKIAtest',
	secret_access_key: 'secret',
	region: 'us-east-1',
	target_arn: 'arn:aws:lambda:us-east-1:123:function:runner',
	role_arn: 'arn:aws:iam::123:role/scheduler',
	group_name: 'default'
} as const

describe('scheduler', () => {
	test('module contracts and capability tool ids', () => {
		expect(validateModule(schedulerModule).ok).toBe(true)
		expect(schedulerModule.tools.map((tool) => tool.id).sort()).toEqual([
			'scheduler-create',
			'scheduler-delete',
			'scheduler-get',
			'scheduler-list',
			'scheduler-update'
		])
	})

	test('EventBridge provider serves every scheduler tool', async () => {
		const seen: string[] = []
		const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
			const request = asRequest(input, init)
			const url = new URL(request.url)
			seen.push(`${request.method} ${url.pathname}`)

			if (request.method === 'POST') {
				const body = asRecord(JSON.parse(await request.text()))
				const target = asRecord(body['Target'])
				expect(String(target['Input'])).toContain('task-1')
				return Response.json({ ScheduleArn: 'arn:schedule/report' })
			}
			if (request.method === 'PUT') {
				const body = asRecord(JSON.parse(await request.text()))
				expect(body['ScheduleExpression']).toBe('rate(2 days)')
				return Response.json({ ScheduleArn: 'arn:schedule/report' })
			}
			if (request.method === 'GET' && url.pathname === '/schedules') {
				return Response.json({
					Schedules: [{ Name: 'report', State: 'ENABLED', ScheduleExpression: 'rate(2 days)' }]
				})
			}
			if (request.method === 'GET') {
				return Response.json({
					Name: 'report',
					State: 'ENABLED',
					ScheduleExpression: 'rate(2 days)',
					Target: { Input: JSON.stringify({ task_ref: 'task-1' }) }
				})
			}
			if (request.method === 'DELETE') return new Response(null, { status: 204 })
			return new Response('unexpected request', { status: 500 })
		}
		const ctx = { auth, fetch }
		const createInput = {
			name: 'report',
			schedule_expression: 'rate(1 day)',
			task_ref: 'task-1'
		}

		expect((await runTool(schedulerCreateTool, createInput, ctx)).name).toBe('report')
		expect(
			(await runTool(schedulerUpdateTool, { ...createInput, schedule_expression: 'rate(2 days)' }, ctx)).name
		).toBe('report')
		expect((await runTool(schedulerGetTool, { name: 'report' }, ctx)).schedule.task_ref).toBe('task-1')
		expect((await runTool(schedulerListTool, {}, ctx)).schedules).toHaveLength(1)
		expect(await runTool(schedulerDeleteTool, { name: 'report' }, ctx)).toEqual({
			name: 'report',
			deleted: true
		})
		expect(seen).toEqual([
			'POST /schedules/report',
			'PUT /schedules/report',
			'GET /schedules/report',
			'GET /schedules',
			'DELETE /schedules/report'
		])
	})
})
