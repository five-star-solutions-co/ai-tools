import { describe, expect, test } from 'bun:test'

import { runTool } from '../../../src/core'
import { calendarBuildTool, calendarParseTool } from '../../../src/modules/calendar'

/** Pure seam — always runs (no external service). */
describe('live seam calendar', () => {
	test('tools: build and parse iCalendar round trip', async () => {
		const built = await runTool(calendarBuildTool, {
			name: 'AI Tools IT',
			events: [
				{
					uid: 'integration-event',
					title: 'Integration',
					start: '2026-07-26T08:00:00Z',
					end: '2026-07-26T09:00:00Z',
					description: 'Live IT event',
					location: 'Remote'
				},
				{
					uid: 'all-day-event',
					title: 'All day',
					start: '2026-07-27',
					end: '2026-07-28',
					all_day: true
				}
			]
		})
		expect(built.event_count).toBe(2)
		expect(built.ics).toContain('BEGIN:VCALENDAR')
		expect(built.ics).toContain('integration-event')

		const parsed = await runTool(calendarParseTool, { ics: built.ics })
		expect(parsed.events.some((e) => e.uid === 'integration-event')).toBe(true)
		expect(parsed.events.some((e) => e.uid === 'all-day-event' && e.all_day === true)).toBe(true)
	})
})
