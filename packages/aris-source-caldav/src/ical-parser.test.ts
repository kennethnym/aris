import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { parseICalEvents } from "./ical-parser.ts"

function loadFixture(name: string): string {
	return readFileSync(join(import.meta.dir, "..", "fixtures", name), "utf-8")
}

describe("parseICalEvents", () => {
	test("parses a full event with all fields", () => {
		const events = parseICalEvents(loadFixture("single-event.ics"), "Work")

		expect(events).toHaveLength(1)
		const event = events[0]!

		expect(event.uid).toBe("single-event-001@test")
		expect(event.title).toBe("Team Standup")
		expect(event.startDate).toEqual(new Date("2026-01-15T14:00:00Z"))
		expect(event.endDate).toEqual(new Date("2026-01-15T15:00:00Z"))
		expect(event.isAllDay).toBe(false)
		expect(event.location).toBe("Conference Room A")
		expect(event.description).toBe("Daily standup meeting")
		expect(event.calendarName).toBe("Work")
		expect(event.status).toBe("confirmed")
		expect(event.url).toBe("https://example.com/meeting/123")
		expect(event.organizer).toBe("Alice Smith")
		expect(event.recurrenceId).toBeNull()

		expect(event.attendees).toHaveLength(2)
		expect(event.attendees[0]).toEqual({
			name: "Bob Jones",
			email: "bob@example.com",
			role: "required",
			status: "accepted",
		})
		expect(event.attendees[1]).toEqual({
			name: "Carol White",
			email: "carol@example.com",
			role: "optional",
			status: "tentative",
		})

		expect(event.alarms).toHaveLength(2)
		expect(event.alarms[0]).toEqual({ trigger: "-PT15M", action: "DISPLAY" })
		expect(event.alarms[1]).toEqual({ trigger: "-PT5M", action: "AUDIO" })
	})

	test("parses an all-day event with optional fields as null", () => {
		const events = parseICalEvents(loadFixture("all-day-event.ics"), null)

		expect(events).toHaveLength(1)
		const event = events[0]!

		expect(event.isAllDay).toBe(true)
		expect(event.title).toBe("Company Holiday")
		expect(event.calendarName).toBeNull()
		expect(event.location).toBeNull()
		expect(event.description).toBeNull()
		expect(event.url).toBeNull()
		expect(event.organizer).toBeNull()
		expect(event.attendees).toEqual([])
		expect(event.alarms).toEqual([])
	})

	test("parses recurring event with exception", () => {
		const events = parseICalEvents(loadFixture("recurring-event.ics"), "Team")

		expect(events).toHaveLength(2)
		expect(events[0]!.uid).toBe("recurring-001@test")
		expect(events[1]!.uid).toBe("recurring-001@test")

		const base = events.find((e) => e.title === "Weekly Sync")
		expect(base).toBeDefined()
		expect(base!.recurrenceId).toBeNull()

		const exception = events.find((e) => e.title === "Weekly Sync (moved)")
		expect(exception).toBeDefined()
		expect(exception!.recurrenceId).not.toBeNull()
	})

	test("parses minimal event with defaults", () => {
		const events = parseICalEvents(loadFixture("minimal-event.ics"), null)

		expect(events).toHaveLength(1)
		const event = events[0]!

		expect(event.uid).toBe("minimal-001@test")
		expect(event.title).toBe("Quick Chat")
		expect(event.startDate).toEqual(new Date("2026-01-15T18:00:00Z"))
		expect(event.endDate).toEqual(new Date("2026-01-15T19:00:00Z"))
		expect(event.location).toBeNull()
		expect(event.description).toBeNull()
		expect(event.status).toBeNull()
		expect(event.url).toBeNull()
		expect(event.organizer).toBeNull()
		expect(event.attendees).toEqual([])
		expect(event.alarms).toEqual([])
		expect(event.recurrenceId).toBeNull()
	})

	test("parses cancelled status", () => {
		const events = parseICalEvents(loadFixture("cancelled-event.ics"), null)
		expect(events[0]!.status).toBe("cancelled")
	})
})
