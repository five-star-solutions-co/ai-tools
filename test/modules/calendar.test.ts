import { describe, expect, test } from 'bun:test'

import { runTool, validateModule } from '../../src/core'
import { calendarBuildTool, calendarModule, calendarParseTool, parseCalendar } from '../../src/modules/calendar'

describe('calendar', () => {
	test('module contracts and tool ids', () => {
		expect(validateModule(calendarModule).ok).toBe(true)
		expect(calendarModule.tools.map((tool) => tool.id).sort()).toEqual(['calendar-build-ics', 'calendar-parse-ics'])
	})

	test('builds and parses timed and all-day events through ical.js', async () => {
		const built = await runTool(
			calendarBuildTool,
			{
				name: 'Product',
				events: [
					{
						uid: 'timed-1',
						title: 'Planning',
						start: '2026-07-26T08:00:00+00:00',
						end: '2026-07-26T09:00:00+00:00',
						location: 'Room 1'
					},
					{
						uid: 'day-1',
						title: 'Launch day',
						start: '2026-07-27',
						end: '2026-07-28',
						all_day: true
					}
				]
			},
			{}
		)
		expect(built.event_count).toBe(2)
		expect(built.ics).toContain('BEGIN:VCALENDAR')

		const parsed = await runTool(calendarParseTool, { ics: built.ics }, {})
		expect(parsed.events).toHaveLength(2)
		expect(parsed.events[0]).toMatchObject({
			uid: 'timed-1',
			title: 'Planning',
			start: '2026-07-26T08:00:00.000Z',
			location: 'Room 1'
		})
		expect(parsed.events[1]).toMatchObject({
			uid: 'day-1',
			start: '2026-07-27',
			end: '2026-07-28',
			all_day: true
		})
	})

	test('rejects invalid iCalendar input', () => {
		expect(() => parseCalendar('not a calendar')).toThrow()
	})
})
