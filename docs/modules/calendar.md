# Calendar

| | |
| --- | --- |
| **Import** | `@harryy/ai-tools/calendar` |
| **Kind** | pure capability module |
| **Engine** | `ical.js` |

| Tool | Purpose |
| --- | --- |
| `calendar-build-ics` | Build RFC 5545 iCalendar text from timed or all-day events |
| `calendar-parse-ics` | Parse iCalendar text into basic event fields |

The v1 contract covers event id, title, start, exclusive end, all-day status, description, location, and organizer. It does not claim CalDAV transport or recurrence expansion.
