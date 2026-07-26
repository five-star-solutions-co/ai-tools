import { describe, expect, test } from 'bun:test'

import { createTypingPulse } from '../../src/vendors/_messaging'

describe('createTypingPulse', () => {
	test('start sends once then waits interval before the next pulse', async () => {
		const sends: number[] = []
		let now = 0
		const sleepResolvers: Array<() => void> = []

		const pulse = createTypingPulse({
			intervalMs: 100,
			send: async () => {
				sends.push(now)
			},
			sleep: () =>
				new Promise<void>((resolve) => {
					sleepResolvers.push(() => {
						now += 100
						resolve()
					})
				})
		})

		await pulse.start()
		expect(sends).toEqual([0])
		expect(sleepResolvers).toHaveLength(1)

		// First renew after interval.
		sleepResolvers[0]?.()
		await Promise.resolve()
		await Promise.resolve()
		expect(sends).toEqual([0, 100])

		pulse.stop()
		// Interrupt any in-flight wait so the loop can exit.
		sleepResolvers[1]?.()
		await Promise.resolve()
	})

	test('start is idempotent while active', async () => {
		let count = 0
		const pulse = createTypingPulse({
			intervalMs: 50_000,
			send: async () => {
				count += 1
			},
			sleep: () => new Promise(() => {})
		})

		await pulse.start()
		await pulse.start()
		expect(count).toBe(1)
		pulse.stop()
		await Promise.resolve()
	})

	test('stop then immediate start does not double-pulse from the old loop', async () => {
		const sends: number[] = []
		const sleepResolvers: Array<() => void> = []

		const pulse = createTypingPulse({
			intervalMs: 100,
			send: async () => {
				sends.push(sends.length)
			},
			sleep: () =>
				new Promise<void>((resolve) => {
					sleepResolvers.push(resolve)
				})
		})

		await pulse.start()
		expect(sends).toHaveLength(1)
		expect(sleepResolvers).toHaveLength(1)

		pulse.stop()
		await pulse.start()
		// Initial + restart only (stale loop must not pulse after stop).
		expect(sends).toHaveLength(2)

		// Completing the interrupted wait must not fire a third send from the dead loop.
		sleepResolvers[0]?.()
		await Promise.resolve()
		await Promise.resolve()
		expect(sends).toHaveLength(2)

		pulse.stop()
		sleepResolvers[1]?.()
		await Promise.resolve()
	})
})
