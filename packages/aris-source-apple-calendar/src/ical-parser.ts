import ICAL from "ical.js"

import {
	AttendeeRole,
	AttendeeStatus,
	CalendarEventStatus,
	type CalendarAlarm,
	type CalendarAttendee,
	type CalendarEventData,
} from "./types.ts"

/**
 * Parses a raw iCalendar string and extracts all VEVENT components
 * into CalendarEventData objects.
 *
 * @param icsData - Raw iCalendar string from a CalDAV response
 * @param calendarName - Display name of the calendar this event belongs to
 */
export function parseICalEvents(icsData: string, calendarName: string | null): CalendarEventData[] {
	const jcal = ICAL.parse(icsData)
	const comp = new ICAL.Component(jcal)
	const vevents = comp.getAllSubcomponents("vevent")

	return vevents.map((vevent: InstanceType<typeof ICAL.Component>) =>
		parseVEvent(vevent, calendarName),
	)
}

function parseVEvent(
	vevent: InstanceType<typeof ICAL.Component>,
	calendarName: string | null,
): CalendarEventData {
	const event = new ICAL.Event(vevent)

	return {
		uid: event.uid ?? "",
		title: event.summary ?? "",
		startDate: event.startDate?.toJSDate() ?? new Date(0),
		endDate: event.endDate?.toJSDate() ?? new Date(0),
		isAllDay: event.startDate?.isDate ?? false,
		location: event.location ?? null,
		description: event.description ?? null,
		calendarName,
		status: parseStatus(asStringOrNull(vevent.getFirstPropertyValue("status"))),
		url: asStringOrNull(vevent.getFirstPropertyValue("url")),
		organizer: parseOrganizer(asStringOrNull(event.organizer), vevent),
		attendees: parseAttendees(Array.isArray(event.attendees) ? event.attendees : []),
		alarms: parseAlarms(vevent),
		recurrenceId: event.recurrenceId ? event.recurrenceId.toString() : null,
	}
}

function parseStatus(raw: string | null): CalendarEventStatus | null {
	if (!raw) return null
	switch (raw.toLowerCase()) {
		case "confirmed":
			return CalendarEventStatus.Confirmed
		case "tentative":
			return CalendarEventStatus.Tentative
		case "cancelled":
			return CalendarEventStatus.Cancelled
		default:
			return null
	}
}

function parseOrganizer(
	value: string | null,
	vevent: InstanceType<typeof ICAL.Component>,
): string | null {
	if (!value) return null

	// Try CN parameter first
	const prop = vevent.getFirstProperty("organizer")
	if (prop) {
		const cn = prop.getParameter("cn") as string | undefined
		if (cn) return cn
	}

	// Fall back to mailto: value
	return value.replace(/^mailto:/i, "")
}

function parseAttendees(properties: unknown[]): CalendarAttendee[] {
	if (properties.length === 0) return []

	return properties.map((prop) => {
		const p = prop as InstanceType<typeof ICAL.Property>
		const value = asStringOrNull(p.getFirstValue())
		const cn = asStringOrNull(p.getParameter("cn"))
		const role = asStringOrNull(p.getParameter("role"))
		const partstat = asStringOrNull(p.getParameter("partstat"))

		return {
			name: cn,
			email: value ? value.replace(/^mailto:/i, "") : null,
			role: parseAttendeeRole(role),
			status: parseAttendeeStatus(partstat),
		}
	})
}

function parseAttendeeRole(raw: string | null): AttendeeRole | null {
	if (!raw) return null
	switch (raw.toUpperCase()) {
		case "CHAIR":
			return AttendeeRole.Chair
		case "REQ-PARTICIPANT":
			return AttendeeRole.Required
		case "OPT-PARTICIPANT":
			return AttendeeRole.Optional
		default:
			return null
	}
}

function parseAttendeeStatus(raw: string | null): AttendeeStatus | null {
	if (!raw) return null
	switch (raw.toUpperCase()) {
		case "ACCEPTED":
			return AttendeeStatus.Accepted
		case "DECLINED":
			return AttendeeStatus.Declined
		case "TENTATIVE":
			return AttendeeStatus.Tentative
		case "NEEDS-ACTION":
			return AttendeeStatus.NeedsAction
		default:
			return null
	}
}

function parseAlarms(vevent: InstanceType<typeof ICAL.Component>): CalendarAlarm[] {
	const valarms = vevent.getAllSubcomponents("valarm")
	if (!valarms || valarms.length === 0) return []

	return valarms.map((valarm: InstanceType<typeof ICAL.Component>) => {
		const trigger = valarm.getFirstPropertyValue("trigger")
		const action = asStringOrNull(valarm.getFirstPropertyValue("action"))

		return {
			trigger: trigger ? trigger.toString() : "",
			action: action ?? "DISPLAY",
		}
	})
}

function asStringOrNull(value: unknown): string | null {
	return typeof value === "string" ? value : null
}
