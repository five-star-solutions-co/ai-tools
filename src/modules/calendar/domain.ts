import ICAL from 'ical.js'

import { ToolError } from '../../core/errors'
import type { CalendarBuildInput, CalendarBuildOutput, CalendarEvent, CalendarParseOutput } from './contracts'
import { calendarBuildOutputSchema, calendarParseOutputSchema } from './contracts'

function calendarTime(value: string, allDay: boolean): InstanceType<typeof ICAL.Time> {
	return allDay ? ICAL.Time.fromDateString(value) : ICAL.Time.fromJSDate(new Date(value), true)
}

function displayTime(value: InstanceType<typeof ICAL.Time>): string {
	return value.isDate ? value.toString() : value.toJSDate().toISOString()
}

export function buildCalendar(input: CalendarBuildInput): CalendarBuildOutput {
	const calendar = new ICAL.Component('vcalendar')
	calendar.addPropertyWithValue('version', '2.0')
	calendar.addPropertyWithValue('prodid', input.product_id ?? '-//harryy.ai//ai-tools//EN')
	if (input.name) calendar.addPropertyWithValue('x-wr-calname', input.name)

	for (const item of input.events) {
		const component = new ICAL.Component('vevent')
		const event = new ICAL.Event(component)
		event.uid = item.uid ?? crypto.randomUUID()
		event.summary = item.title
		event.startDate = calendarTime(item.start, item.all_day === true)
		event.endDate = calendarTime(item.end, item.all_day === true)
		if (item.description) event.description = item.description
		if (item.location) event.location = item.location
		if (item.organizer) event.organizer = item.organizer
		calendar.addSubcomponent(component)
	}

	return calendarBuildOutputSchema.parse({ ics: calendar.toString(), event_count: input.events.length })
}

export function parseCalendar(ics: string): CalendarParseOutput {
	try {
		const calendar = new ICAL.Component(ICAL.parse(ics))
		const events: CalendarEvent[] = calendar.getAllSubcomponents('vevent').map((component) => {
			const event = new ICAL.Event(component)
			const out: CalendarEvent = {
				uid: event.uid,
				title: event.summary,
				start: displayTime(event.startDate),
				end: displayTime(event.endDate),
				...(event.startDate.isDate && { all_day: true })
			}
			if (event.description) out.description = event.description
			if (event.location) out.location = event.location
			if (event.organizer) out.organizer = event.organizer
			return out
		})
		return calendarParseOutputSchema.parse({ events })
	} catch (error) {
		throw new ToolError('Failed to parse iCalendar data', { code: 'bad_input', cause: error })
	}
}
