import { defineModule, defineTool } from '../../core/define'
import {
	calendarBuildInputSchema,
	calendarBuildOutputSchema,
	calendarParseInputSchema,
	calendarParseOutputSchema
} from './contracts'
import { buildCalendar, parseCalendar } from './domain'

export const calendarBuildTool = defineTool({
	id: 'calendar-build-ics',
	name: 'buildCalendar',
	description: 'Build an iCalendar file from one or more timed or all-day events.',
	inputSchema: calendarBuildInputSchema,
	outputSchema: calendarBuildOutputSchema,
	sideEffect: 'none',
	runtime: 'both',
	execute: async (input) => buildCalendar(input)
})

export const calendarParseTool = defineTool({
	id: 'calendar-parse-ics',
	name: 'parseCalendar',
	description: 'Parse iCalendar text into basic event fields including title, time range, location, and organizer.',
	inputSchema: calendarParseInputSchema,
	outputSchema: calendarParseOutputSchema,
	sideEffect: 'none',
	runtime: 'both',
	execute: async (input) => parseCalendar(input.ics)
})

export const calendarModule = defineModule({
	id: 'calendar',
	title: 'Calendar',
	description: 'Build and parse iCalendar event data.',
	runtime: 'both',
	auth: { type: 'none' },
	categories: ['calendar', 'productivity'],
	classification: 'pii',
	tags: ['ics'],
	tools: [calendarBuildTool, calendarParseTool]
})
