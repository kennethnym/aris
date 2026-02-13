import type { FeedItem } from "@aris/core"

// -- Credential provider --

export interface CalendarCredentials {
	accessToken: string
	refreshToken: string
	/** Unix timestamp in milliseconds when the access token expires */
	expiresAt: number
	tokenUrl: string
	clientId: string
	clientSecret: string
}

export interface CalendarCredentialProvider {
	fetchCredentials(userId: string): Promise<CalendarCredentials | null>
}

// -- Feed item types --

export const CalendarEventStatus = {
	Confirmed: "confirmed",
	Tentative: "tentative",
	Cancelled: "cancelled",
} as const

export type CalendarEventStatus = (typeof CalendarEventStatus)[keyof typeof CalendarEventStatus]

export const AttendeeRole = {
	Chair: "chair",
	Required: "required",
	Optional: "optional",
} as const

export type AttendeeRole = (typeof AttendeeRole)[keyof typeof AttendeeRole]

export const AttendeeStatus = {
	Accepted: "accepted",
	Declined: "declined",
	Tentative: "tentative",
	NeedsAction: "needs-action",
} as const

export type AttendeeStatus = (typeof AttendeeStatus)[keyof typeof AttendeeStatus]

export interface CalendarAttendee {
	name: string | null
	email: string | null
	role: AttendeeRole | null
	status: AttendeeStatus | null
}

export interface CalendarAlarm {
	/** ISO 8601 duration relative to event start, e.g. "-PT15M" */
	trigger: string
	/** e.g. "DISPLAY", "AUDIO" */
	action: string
}

export interface CalendarEventData extends Record<string, unknown> {
	uid: string
	title: string
	startDate: Date
	endDate: Date
	isAllDay: boolean
	location: string | null
	description: string | null
	calendarName: string | null
	status: CalendarEventStatus | null
	url: string | null
	organizer: string | null
	attendees: CalendarAttendee[]
	alarms: CalendarAlarm[]
	recurrenceId: string | null
}

export type CalendarFeedItem = FeedItem<"calendar-event", CalendarEventData>

// -- DAV client interface --

export interface CalendarDAVObject {
	data?: unknown
	etag?: string
	url: string
}

export interface CalendarDAVCalendar {
	displayName?: string | Record<string, unknown>
	url: string
}

/** Subset of DAVClient used by CalendarSource. */
export interface CalendarDAVClient {
	login(): Promise<void>
	fetchCalendars(): Promise<CalendarDAVCalendar[]>
	fetchCalendarObjects(params: {
		calendar: CalendarDAVCalendar
		timeRange: { start: string; end: string }
	}): Promise<CalendarDAVObject[]>
	credentials: Record<string, unknown>
}

// -- Source options --

export interface CalendarSourceOptions {
	/** Number of additional days beyond today to fetch. Default: 0 (today only). */
	lookAheadDays?: number
	/** Optional DAVClient instance for testing. Uses tsdav DAVClient by default. */
	davClient?: CalendarDAVClient
}
