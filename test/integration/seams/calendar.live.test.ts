import { describe, expect, test } from 'bun:test'

import { buildCalendar, parseCalendar } from '../../../src/modules/calendar'

describe('integration seam calendar', () => {
	test('ical.js build and parse round trip', () => {
		const built = buildCalendar({
			events: [
				{
					uid: 'integration-event',
					title: 'Integration',
					start: '2026-07-26T08:00:00Z',
					end: '2026-07-26T09:00:00Z'
				}
			]
		})
		expect(parseCalendar(built.ics).events[0]?.uid).toBe('integration-event')
	})
})
