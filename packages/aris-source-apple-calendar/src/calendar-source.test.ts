import type { Context } from "@aris/core"

import { contextValue } from "@aris/core"
import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import type {
	CalendarCredentialProvider,
	CalendarCredentials,
	CalendarDAVCalendar,
	CalendarDAVClient,
	CalendarDAVObject,
	CalendarEventData,
} from "./types.ts"

import { CalendarKey } from "./calendar-context.ts"
import { CalendarSource, computePriority } from "./calendar-source.ts"

function loadFixture(name: string): string {
	return readFileSync(join(import.meta.dir, "..", "fixtures", name), "utf-8")
}

function createContext(time: Date): Context {
	return { time }
}

const mockCredentials: CalendarCredentials = {
	accessToken: "mock-access-token",
	refreshToken: "mock-refresh-token",
	expiresAt: Date.now() + 3600000,
	tokenUrl: "https://appleid.apple.com/auth/token",
	clientId: "com.example.aris",
	clientSecret: "mock-secret",
}

class NullCredentialProvider implements CalendarCredentialProvider {
	async fetchCredentials(_userId: string): Promise<CalendarCredentials | null> {
		return null
	}
}

class MockCredentialProvider implements CalendarCredentialProvider {
	async fetchCredentials(_userId: string): Promise<CalendarCredentials | null> {
		return mockCredentials
	}
}

class MockDAVClient implements CalendarDAVClient {
	credentials: Record<string, unknown> = {}
	fetchCalendarsCallCount = 0
	private calendars: CalendarDAVCalendar[]
	private objectsByCalendarUrl: Record<string, CalendarDAVObject[]>

	constructor(
		calendars: CalendarDAVCalendar[],
		objectsByCalendarUrl: Record<string, CalendarDAVObject[]>,
	) {
		this.calendars = calendars
		this.objectsByCalendarUrl = objectsByCalendarUrl
	}

	async login(): Promise<void> {}

	async fetchCalendars(): Promise<CalendarDAVCalendar[]> {
		this.fetchCalendarsCallCount++
		return this.calendars
	}

	async fetchCalendarObjects(params: {
		calendar: CalendarDAVCalendar
		timeRange: { start: string; end: string }
	}): Promise<CalendarDAVObject[]> {
		return this.objectsByCalendarUrl[params.calendar.url] ?? []
	}
}

describe("CalendarSource", () => {
	test("has correct id", () => {
		const source = new CalendarSource(new NullCredentialProvider(), "user-1")
		expect(source.id).toBe("apple-calendar")
	})

	test("returns empty array when credentials are null", async () => {
		const source = new CalendarSource(new NullCredentialProvider(), "user-1")
		const items = await source.fetchItems(createContext(new Date("2026-01-15T12:00:00Z")))
		expect(items).toEqual([])
	})

	test("returns empty array when no calendars exist", async () => {
		const client = new MockDAVClient([], {})
		const source = new CalendarSource(new MockCredentialProvider(), "user-1", {
			davClient: client,
		})
		const items = await source.fetchItems(createContext(new Date("2026-01-15T12:00:00Z")))
		expect(items).toEqual([])
	})

	test("returns feed items from a single calendar", async () => {
		const objects: Record<string, CalendarDAVObject[]> = {
			"/cal/work": [{ url: "/cal/work/event1.ics", data: loadFixture("single-event.ics") }],
		}
		const client = new MockDAVClient([{ url: "/cal/work", displayName: "Work" }], objects)
		const source = new CalendarSource(new MockCredentialProvider(), "user-1", {
			davClient: client,
		})

		const items = await source.fetchItems(createContext(new Date("2026-01-15T12:00:00Z")))

		expect(items).toHaveLength(1)
		expect(items[0]!.type).toBe("calendar-event")
		expect(items[0]!.id).toBe("calendar-event-single-event-001@test")
		expect(items[0]!.data.title).toBe("Team Standup")
		expect(items[0]!.data.location).toBe("Conference Room A")
		expect(items[0]!.data.calendarName).toBe("Work")
		expect(items[0]!.data.attendees).toHaveLength(2)
		expect(items[0]!.data.alarms).toHaveLength(2)
	})

	test("returns feed items from multiple calendars", async () => {
		const objects: Record<string, CalendarDAVObject[]> = {
			"/cal/work": [{ url: "/cal/work/event1.ics", data: loadFixture("single-event.ics") }],
			"/cal/personal": [
				{ url: "/cal/personal/event2.ics", data: loadFixture("all-day-event.ics") },
			],
		}
		const client = new MockDAVClient(
			[
				{ url: "/cal/work", displayName: "Work" },
				{ url: "/cal/personal", displayName: "Personal" },
			],
			objects,
		)
		const source = new CalendarSource(new MockCredentialProvider(), "user-1", {
			davClient: client,
		})

		const items = await source.fetchItems(createContext(new Date("2026-01-15T12:00:00Z")))

		expect(items).toHaveLength(2)

		const standup = items.find((i) => i.data.title === "Team Standup")
		const holiday = items.find((i) => i.data.title === "Company Holiday")

		expect(standup).toBeDefined()
		expect(standup!.data.calendarName).toBe("Work")

		expect(holiday).toBeDefined()
		expect(holiday!.data.calendarName).toBe("Personal")
		expect(holiday!.data.isAllDay).toBe(true)
	})

	test("skips objects with non-string data", async () => {
		const objects: Record<string, CalendarDAVObject[]> = {
			"/cal/work": [
				{ url: "/cal/work/event1.ics", data: loadFixture("single-event.ics") },
				{ url: "/cal/work/bad.ics", data: 12345 },
				{ url: "/cal/work/empty.ics" },
			],
		}
		const client = new MockDAVClient([{ url: "/cal/work", displayName: "Work" }], objects)
		const source = new CalendarSource(new MockCredentialProvider(), "user-1", {
			davClient: client,
		})

		const items = await source.fetchItems(createContext(new Date("2026-01-15T12:00:00Z")))
		expect(items).toHaveLength(1)
		expect(items[0]!.data.title).toBe("Team Standup")
	})

	test("uses context time as feed item timestamp", async () => {
		const objects: Record<string, CalendarDAVObject[]> = {
			"/cal/work": [{ url: "/cal/work/event1.ics", data: loadFixture("single-event.ics") }],
		}
		const client = new MockDAVClient([{ url: "/cal/work", displayName: "Work" }], objects)
		const source = new CalendarSource(new MockCredentialProvider(), "user-1", {
			davClient: client,
		})

		const now = new Date("2026-01-15T12:00:00Z")
		const items = await source.fetchItems(createContext(now))
		expect(items[0]!.timestamp).toEqual(now)
	})

	test("assigns priority based on event proximity", async () => {
		const objects: Record<string, CalendarDAVObject[]> = {
			"/cal/work": [
				{ url: "/cal/work/event1.ics", data: loadFixture("single-event.ics") },
				{ url: "/cal/work/allday.ics", data: loadFixture("all-day-event.ics") },
			],
		}
		const client = new MockDAVClient([{ url: "/cal/work", displayName: "Work" }], objects)
		const source = new CalendarSource(new MockCredentialProvider(), "user-1", {
			davClient: client,
		})

		// 2 hours before the event at 14:00
		const items = await source.fetchItems(createContext(new Date("2026-01-15T12:00:00Z")))

		const standup = items.find((i) => i.data.title === "Team Standup")
		const holiday = items.find((i) => i.data.title === "Company Holiday")

		expect(standup!.priority).toBe(0.7) // within 2 hours
		expect(holiday!.priority).toBe(0.3) // all-day
	})

	test("handles calendar with non-string displayName", async () => {
		const objects: Record<string, CalendarDAVObject[]> = {
			"/cal/weird": [{ url: "/cal/weird/event1.ics", data: loadFixture("minimal-event.ics") }],
		}
		const client = new MockDAVClient(
			[{ url: "/cal/weird", displayName: { _cdata: "Weird Calendar" } }],
			objects,
		)
		const source = new CalendarSource(new MockCredentialProvider(), "user-1", {
			davClient: client,
		})

		const items = await source.fetchItems(createContext(new Date("2026-01-15T12:00:00Z")))
		expect(items[0]!.data.calendarName).toBeNull()
	})

	test("handles recurring events with exceptions", async () => {
		const objects: Record<string, CalendarDAVObject[]> = {
			"/cal/work": [{ url: "/cal/work/recurring.ics", data: loadFixture("recurring-event.ics") }],
		}
		const client = new MockDAVClient([{ url: "/cal/work", displayName: "Work" }], objects)
		const source = new CalendarSource(new MockCredentialProvider(), "user-1", {
			davClient: client,
		})

		const items = await source.fetchItems(createContext(new Date("2026-01-15T08:00:00Z")))

		expect(items).toHaveLength(2)

		const base = items.find((i) => i.data.title === "Weekly Sync")
		const exception = items.find((i) => i.data.title === "Weekly Sync (moved)")

		expect(base).toBeDefined()
		expect(base!.data.recurrenceId).toBeNull()

		expect(exception).toBeDefined()
		expect(exception!.data.recurrenceId).not.toBeNull()
		expect(exception!.id).toContain("-")
	})

	test("caches events within the same refresh cycle", async () => {
		const objects: Record<string, CalendarDAVObject[]> = {
			"/cal/work": [{ url: "/cal/work/event1.ics", data: loadFixture("single-event.ics") }],
		}
		const client = new MockDAVClient([{ url: "/cal/work", displayName: "Work" }], objects)
		const source = new CalendarSource(new MockCredentialProvider(), "user-1", {
			davClient: client,
		})

		const context = createContext(new Date("2026-01-15T12:00:00Z"))

		await source.fetchContext(context)
		await source.fetchItems(context)

		// Same context.time reference — fetchEvents should only hit the client once
		expect(client.fetchCalendarsCallCount).toBe(1)
	})

	test("refetches events for a different context time", async () => {
		const objects: Record<string, CalendarDAVObject[]> = {
			"/cal/work": [{ url: "/cal/work/event1.ics", data: loadFixture("single-event.ics") }],
		}
		const client = new MockDAVClient([{ url: "/cal/work", displayName: "Work" }], objects)
		const source = new CalendarSource(new MockCredentialProvider(), "user-1", {
			davClient: client,
		})

		await source.fetchItems(createContext(new Date("2026-01-15T12:00:00Z")))
		await source.fetchItems(createContext(new Date("2026-01-15T13:00:00Z")))

		// Different context.time references — should fetch twice
		expect(client.fetchCalendarsCallCount).toBe(2)
	})
})

describe("CalendarSource.fetchContext", () => {
	test("returns empty context when credentials are null", async () => {
		const source = new CalendarSource(new NullCredentialProvider(), "user-1")
		const ctx = await source.fetchContext(createContext(new Date("2026-01-15T12:00:00Z")))
		const calendar = contextValue(ctx as Context, CalendarKey)

		expect(calendar).toBeDefined()
		expect(calendar!.inProgress).toEqual([])
		expect(calendar!.nextEvent).toBeNull()
		expect(calendar!.hasTodayEvents).toBe(false)
		expect(calendar!.todayEventCount).toBe(0)
	})

	test("identifies in-progress events", async () => {
		const objects: Record<string, CalendarDAVObject[]> = {
			"/cal/work": [{ url: "/cal/work/event1.ics", data: loadFixture("single-event.ics") }],
		}
		const client = new MockDAVClient([{ url: "/cal/work", displayName: "Work" }], objects)
		const source = new CalendarSource(new MockCredentialProvider(), "user-1", {
			davClient: client,
		})

		// 14:30 is during the 14:00-15:00 event
		const ctx = await source.fetchContext(createContext(new Date("2026-01-15T14:30:00Z")))
		const calendar = contextValue(ctx as Context, CalendarKey)

		expect(calendar!.inProgress).toHaveLength(1)
		expect(calendar!.inProgress[0]!.title).toBe("Team Standup")
	})

	test("identifies next upcoming event", async () => {
		const objects: Record<string, CalendarDAVObject[]> = {
			"/cal/work": [{ url: "/cal/work/event1.ics", data: loadFixture("single-event.ics") }],
		}
		const client = new MockDAVClient([{ url: "/cal/work", displayName: "Work" }], objects)
		const source = new CalendarSource(new MockCredentialProvider(), "user-1", {
			davClient: client,
		})

		// 12:00 is before the 14:00 event
		const ctx = await source.fetchContext(createContext(new Date("2026-01-15T12:00:00Z")))
		const calendar = contextValue(ctx as Context, CalendarKey)

		expect(calendar!.inProgress).toHaveLength(0)
		expect(calendar!.nextEvent).not.toBeNull()
		expect(calendar!.nextEvent!.title).toBe("Team Standup")
	})

	test("excludes all-day events from inProgress and nextEvent", async () => {
		const objects: Record<string, CalendarDAVObject[]> = {
			"/cal/work": [{ url: "/cal/work/allday.ics", data: loadFixture("all-day-event.ics") }],
		}
		const client = new MockDAVClient([{ url: "/cal/work", displayName: "Work" }], objects)
		const source = new CalendarSource(new MockCredentialProvider(), "user-1", {
			davClient: client,
		})

		const ctx = await source.fetchContext(createContext(new Date("2026-01-15T12:00:00Z")))
		const calendar = contextValue(ctx as Context, CalendarKey)

		expect(calendar!.inProgress).toHaveLength(0)
		expect(calendar!.nextEvent).toBeNull()
		expect(calendar!.hasTodayEvents).toBe(true)
		expect(calendar!.todayEventCount).toBe(1)
	})

	test("counts all events including all-day in todayEventCount", async () => {
		const objects: Record<string, CalendarDAVObject[]> = {
			"/cal/work": [
				{ url: "/cal/work/event1.ics", data: loadFixture("single-event.ics") },
				{ url: "/cal/work/allday.ics", data: loadFixture("all-day-event.ics") },
			],
		}
		const client = new MockDAVClient([{ url: "/cal/work", displayName: "Work" }], objects)
		const source = new CalendarSource(new MockCredentialProvider(), "user-1", {
			davClient: client,
		})

		const ctx = await source.fetchContext(createContext(new Date("2026-01-15T12:00:00Z")))
		const calendar = contextValue(ctx as Context, CalendarKey)

		expect(calendar!.todayEventCount).toBe(2)
		expect(calendar!.hasTodayEvents).toBe(true)
	})
})

describe("computePriority", () => {
	const now = new Date("2026-01-15T12:00:00Z")

	function makeEvent(overrides: Partial<CalendarEventData>): CalendarEventData {
		return {
			uid: "test-uid",
			title: "Test",
			startDate: new Date("2026-01-15T14:00:00Z"),
			endDate: new Date("2026-01-15T15:00:00Z"),
			isAllDay: false,
			location: null,
			description: null,
			calendarName: null,
			status: null,
			url: null,
			organizer: null,
			attendees: [],
			alarms: [],
			recurrenceId: null,
			...overrides,
		}
	}

	test("all-day events get priority 0.3", () => {
		const event = makeEvent({ isAllDay: true })
		expect(computePriority(event, now)).toBe(0.3)
	})

	test("events starting within 30 minutes get priority 0.9", () => {
		const event = makeEvent({
			startDate: new Date("2026-01-15T12:20:00Z"),
		})
		expect(computePriority(event, now)).toBe(0.9)
	})

	test("events starting exactly at 30 minutes get priority 0.9", () => {
		const event = makeEvent({
			startDate: new Date("2026-01-15T12:30:00Z"),
		})
		expect(computePriority(event, now)).toBe(0.9)
	})

	test("events starting within 2 hours get priority 0.7", () => {
		const event = makeEvent({
			startDate: new Date("2026-01-15T13:00:00Z"),
		})
		expect(computePriority(event, now)).toBe(0.7)
	})

	test("events later today get priority 0.5", () => {
		const event = makeEvent({
			startDate: new Date("2026-01-15T20:00:00Z"),
		})
		expect(computePriority(event, now)).toBe(0.5)
	})

	test("in-progress events get priority 0.8", () => {
		const event = makeEvent({
			startDate: new Date("2026-01-15T11:00:00Z"),
			endDate: new Date("2026-01-15T13:00:00Z"),
		})
		expect(computePriority(event, now)).toBe(0.8)
	})

	test("fully past events get priority 0.2", () => {
		const event = makeEvent({
			startDate: new Date("2026-01-15T09:00:00Z"),
			endDate: new Date("2026-01-15T10:00:00Z"),
		})
		expect(computePriority(event, now)).toBe(0.2)
	})

	test("events on future days get priority 0.2", () => {
		const event = makeEvent({
			startDate: new Date("2026-01-16T10:00:00Z"),
		})
		expect(computePriority(event, now)).toBe(0.2)
	})

	test("priority boundaries are correct", () => {
		// 31 minutes from now should be 0.7 (within 2 hours, not within 30 min)
		const event31min = makeEvent({
			startDate: new Date("2026-01-15T12:31:00Z"),
		})
		expect(computePriority(event31min, now)).toBe(0.7)

		// 2 hours 1 minute from now should be 0.5 (later today, not within 2 hours)
		const event2h1m = makeEvent({
			startDate: new Date("2026-01-15T14:01:00Z"),
		})
		expect(computePriority(event2h1m, now)).toBe(0.5)
	})
})
