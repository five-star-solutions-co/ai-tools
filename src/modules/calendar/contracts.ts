import { z } from 'zod'

const calendarDateTimeSchema = z.union([
	z.iso.date().describe('Calendar date in YYYY-MM-DD form'),
	z.iso.datetime({ offset: true }).describe('Timestamp with an explicit UTC offset')
])

export const calendarEventSchema = z
	.object({
		uid: z.string().min(1).max(255).optional().describe('Stable event id; generated when omitted while building'),
		title: z.string().min(1).max(1_000).describe('Event title'),
		start: calendarDateTimeSchema.describe('Event start'),
		end: calendarDateTimeSchema.describe('Exclusive event end'),
		all_day: z.boolean().optional().describe('Whether start and end are dates rather than timestamps'),
		description: z.string().max(20_000).optional().describe('Event description or notes'),
		location: z.string().max(2_000).optional().describe('Event location'),
		organizer: z.string().max(2_000).optional().describe('Organizer URI, commonly a mailto URI')
	})
	.superRefine((event, ctx) => {
		const dateOnly = /^\d{4}-\d{2}-\d{2}$/
		const bothDates = dateOnly.test(event.start) && dateOnly.test(event.end)
		if (event.all_day === true && !bothDates) {
			ctx.addIssue({ code: 'custom', path: ['all_day'], message: 'All-day events require date-only start and end' })
		}
		if (event.all_day !== true && bothDates) {
			ctx.addIssue({ code: 'custom', path: ['all_day'], message: 'Date-only events require all_day true' })
		}
	})

export const calendarBuildInputSchema = z.object({
	events: z.array(calendarEventSchema).min(1).max(500).describe('Events to include in the calendar'),
	name: z.string().min(1).max(500).optional().describe('Calendar display name'),
	product_id: z.string().min(1).max(500).optional().describe('iCalendar product identifier')
})

export const calendarBuildOutputSchema = z.object({
	ics: z.string().describe('RFC 5545 iCalendar text'),
	event_count: z.int().min(0)
})

export const calendarParseInputSchema = z.object({
	ics: z.string().min(1).max(5_000_000).describe('RFC 5545 iCalendar text')
})

export const calendarParseOutputSchema = z.object({
	events: z.array(calendarEventSchema)
})

export type CalendarEvent = z.infer<typeof calendarEventSchema>
export type CalendarBuildInput = z.infer<typeof calendarBuildInputSchema>
export type CalendarBuildOutput = z.infer<typeof calendarBuildOutputSchema>
export type CalendarParseInput = z.infer<typeof calendarParseInputSchema>
export type CalendarParseOutput = z.infer<typeof calendarParseOutputSchema>
