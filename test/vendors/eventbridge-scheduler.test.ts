import { describe, expect, test } from 'bun:test'
import { isPlainObject } from 'es-toolkit'

import { validateModule } from '../../src/core'
import { EventBridgeSchedulerClient, eventBridgeSchedulerModule } from '../../src/vendors/eventbridge-scheduler'

function asRecord(value: unknown): Record<string, unknown> {
	if (!isPlainObject(value)) throw new Error('expected object')
	return value
}

function asRequest(input: RequestInfo | URL, init?: RequestInit): Request {
	return input instanceof Request ? input : new Request(input, init)
}

function mockFetch(handler: (input: RequestInfo | URL, init?: RequestInit) => Response | Promise<Response>) {
	const original = globalThis.fetch
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) =>
		handler(input, init)) as typeof globalThis.fetch
	return () => {
		globalThis.fetch = original
	}
}

const auth = {
	access_key_id: 'AKIAtest',
	secret_access_key: 'secret',
	region: 'us-east-1',
	target_arn: 'arn:aws:lambda:us-east-1:123:function:runner',
	role_arn: 'arn:aws:iam::123:role/scheduler',
	group_name: 'default'
} as const

describe('eventbridge-scheduler', () => {
	test('module contracts and tool ids', () => {
		expect(validateModule(eventBridgeSchedulerModule).ok).toBe(true)
		expect(eventBridgeSchedulerModule.tools.map((t) => t.id).sort()).toEqual([
			'eventbridge-scheduler-create',
			'eventbridge-scheduler-delete',
			'eventbridge-scheduler-get',
			'eventbridge-scheduler-list',
			'eventbridge-scheduler-update'
		])
	})

	test('create posts schedule with host target and task_ref input', async () => {
		const restore = mockFetch(async (input, init) => {
			const req = asRequest(input, init)
			expect(req.url).toContain('/schedules/nightly-report')
			expect(req.method.toUpperCase()).toBe('POST')
			const body = asRecord(JSON.parse(await req.text()))
			expect(body['ScheduleExpression']).toBe('rate(1 day)')
			const target = asRecord(body['Target'])
			expect(target['Arn']).toBe(auth.target_arn)
			expect(target['RoleArn']).toBe(auth.role_arn)
			expect(String(target['Input'])).toContain('task_ref')
			expect(String(target['Input'])).toContain('ops.nightly')
			return new Response(
				JSON.stringify({ ScheduleArn: 'arn:aws:scheduler:us-east-1:123:schedule/default/nightly-report' }),
				{ status: 200, headers: { 'content-type': 'application/json' } }
			)
		})
		try {
			const client = new EventBridgeSchedulerClient(auth)
			const out = await client.create({
				name: 'nightly-report',
				schedule_expression: 'rate(1 day)',
				task_ref: 'ops.nightly'
			})
			expect(out.name).toBe('nightly-report')
			expect(out.arn).toContain('nightly-report')
		} finally {
			restore()
		}
	})

	test('get maps task_ref from target input', async () => {
		const restore = mockFetch(async (input, init) => {
			const request = asRequest(input, init)
			const url = new URL(request.url)
			expect(url.searchParams.get('groupName')).toBe('default')
			expect(url.searchParams.has('GroupName')).toBe(false)
			return new Response(
				JSON.stringify({
					Name: 'nightly-report',
					GroupName: 'default',
					State: 'ENABLED',
					ScheduleExpression: 'rate(1 day)',
					Target: {
						Arn: auth.target_arn,
						RoleArn: auth.role_arn,
						Input: JSON.stringify({ task_ref: 'ops.nightly' })
					}
				}),
				{ status: 200, headers: { 'content-type': 'application/json' } }
			)
		})
		try {
			const client = new EventBridgeSchedulerClient(auth)
			const out = await client.get({ name: 'nightly-report' })
			expect(out.schedule.task_ref).toBe('ops.nightly')
			expect(out.schedule.state).toBe('ENABLED')
		} finally {
			restore()
		}
	})

	test('list returns summaries', async () => {
		const restore = mockFetch(async () => {
			return new Response(
				JSON.stringify({
					Schedules: [{ Name: 'a', State: 'ENABLED', ScheduleExpression: 'rate(1 hour)' }],
					NextToken: 'n1'
				}),
				{ status: 200, headers: { 'content-type': 'application/json' } }
			)
		})
		try {
			const client = new EventBridgeSchedulerClient(auth)
			const out = await client.list({})
			expect(out.schedules).toHaveLength(1)
			expect(out.next_token).toBe('n1')
		} finally {
			restore()
		}
	})

	test('update puts schedule body', async () => {
		const restore = mockFetch(async (input, init) => {
			const req = asRequest(input, init)
			expect(req.method.toUpperCase()).toBe('PUT')
			expect(req.url).toContain('/schedules/nightly-report')
			const body = asRecord(JSON.parse(await req.text()))
			expect(body['ScheduleExpression']).toBe('rate(2 days)')
			return new Response(
				JSON.stringify({ ScheduleArn: 'arn:aws:scheduler:us-east-1:123:schedule/default/nightly-report' }),
				{ status: 200, headers: { 'content-type': 'application/json' } }
			)
		})
		try {
			const client = new EventBridgeSchedulerClient(auth)
			const out = await client.update({
				name: 'nightly-report',
				schedule_expression: 'rate(2 days)',
				task_ref: 'ops.nightly'
			})
			expect(out.name).toBe('nightly-report')
		} finally {
			restore()
		}
	})

	test('delete hits schedule path with group', async () => {
		const restore = mockFetch(async (input, init) => {
			const req = asRequest(input, init)
			expect(req.method.toUpperCase()).toBe('DELETE')
			const url = new URL(req.url)
			expect(url.pathname).toContain('/schedules/nightly-report')
			expect(url.searchParams.get('groupName')).toBe('default')
			return new Response(null, { status: 200 })
		})
		try {
			const client = new EventBridgeSchedulerClient(auth)
			const out = await client.delete({ name: 'nightly-report' })
			expect(out).toEqual({ name: 'nightly-report', deleted: true })
		} finally {
			restore()
		}
	})
})
