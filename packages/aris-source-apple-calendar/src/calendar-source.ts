import type { Context, FeedSource } from "@aris/core"

import { DAVClient } from "tsdav"

import type {
	CalendarCredentialProvider,
	CalendarCredentials,
	CalendarDAVClient,
	CalendarEventData,
	CalendarFeedItem,
} from "./types.ts"

export interface CalendarSourceOptions {
	/** Number of additional days beyond today to fetch. Default: 0 (today only). */
	lookAheadDays?: number
	/** Optional DAVClient instance for testing. Uses tsdav DAVClient by default. */
	davClient?: CalendarDAVClient
}

import { CalendarKey, type CalendarContext } from "./calendar-context.ts"
import { parseICalEvents } from "./ical-parser.ts"

const ICLOUD_CALDAV_URL = "https://caldav.icloud.com"
const DEFAULT_LOOK_AHEAD_DAYS = 0

/**
 * A FeedSource that fetches Apple Calendar events via CalDAV.
 *
 * Credentials are provided by an injected CalendarCredentialProvider.
 * The server is responsible for managing OAuth tokens and storage.
 *
 * @example
 * ```ts
 * const source = new CalendarSource(credentialProvider, "user-123")
 * const engine = new FeedEngine()
 * engine.register(source)
 * ```
 */
export class CalendarSource implements FeedSource<CalendarFeedItem> {
	readonly id = "apple-calendar"

	private readonly credentialProvider: CalendarCredentialProvider
	private readonly userId: string
	private readonly lookAheadDays: number
	private readonly injectedClient: CalendarDAVClient | null
	private davClient: CalendarDAVClient | null = null
	private lastAccessToken: string | null = null

	constructor(
		credentialProvider: CalendarCredentialProvider,
		userId: string,
		options?: CalendarSourceOptions,
	) {
		this.credentialProvider = credentialProvider
		this.userId = userId
		this.lookAheadDays = options?.lookAheadDays ?? DEFAULT_LOOK_AHEAD_DAYS
		this.injectedClient = options?.davClient ?? null
	}

	async fetchContext(context: Context): Promise<Partial<Context>> {
		const events = await this.fetchEvents(context)
		if (events.length === 0) {
			return {
				[CalendarKey]: {
					inProgress: [],
					nextEvent: null,
					hasTodayEvents: false,
					todayEventCount: 0,
				},
			}
		}

		const now = context.time
		const inProgress = events.filter((e) => !e.isAllDay && e.startDate <= now && e.endDate > now)

		const upcoming = events
			.filter((e) => !e.isAllDay && e.startDate > now)
			.sort((a, b) => a.startDate.getTime() - b.startDate.getTime())

		const calendarContext: CalendarContext = {
			inProgress,
			nextEvent: upcoming[0] ?? null,
			hasTodayEvents: events.length > 0,
			todayEventCount: events.length,
		}

		return { [CalendarKey]: calendarContext }
	}

	async fetchItems(context: Context): Promise<CalendarFeedItem[]> {
		const now = context.time
		const events = await this.fetchEvents(context)
		return events.map((event) => createFeedItem(event, now))
	}

	private async fetchEvents(context: Context): Promise<CalendarEventData[]> {
		const credentials = await this.credentialProvider.fetchCredentials(this.userId)
		if (!credentials) {
			return []
		}

		const client = await this.connectClient(credentials)
		const calendars = await client.fetchCalendars()

		const { start, end } = computeTimeRange(context.time, this.lookAheadDays)

		const results = await Promise.allSettled(
			calendars.map(async (calendar) => {
				const objects = await client.fetchCalendarObjects({
					calendar,
					timeRange: {
						start: start.toISOString(),
						end: end.toISOString(),
					},
				})
				// tsdav types displayName as string | Record<string, unknown> | undefined
				// because the XML parser can return an object for some responses
				const calendarName = typeof calendar.displayName === "string" ? calendar.displayName : null
				return { objects, calendarName }
			}),
		)

		const allEvents: CalendarEventData[] = []
		for (const result of results) {
			if (result.status !== "fulfilled") continue
			const { objects, calendarName } = result.value
			for (const obj of objects) {
				if (typeof obj.data !== "string") continue

				const events = parseICalEvents(obj.data, calendarName)
				for (const event of events) {
					allEvents.push(event)
				}
			}
		}

		return allEvents
	}

	/**
	 * Returns a ready-to-use DAVClient. Creates and logs in a new client
	 * on first call; reuses the existing one on subsequent calls, updating
	 * credentials if the access token has changed.
	 */
	private async connectClient(credentials: CalendarCredentials): Promise<CalendarDAVClient> {
		if (this.injectedClient) {
			return this.injectedClient
		}

		const davCredentials = {
			tokenUrl: credentials.tokenUrl,
			refreshToken: credentials.refreshToken,
			accessToken: credentials.accessToken,
			expiration: credentials.expiresAt,
			clientId: credentials.clientId,
			clientSecret: credentials.clientSecret,
		}

		if (!this.davClient) {
			this.davClient = new DAVClient({
				serverUrl: ICLOUD_CALDAV_URL,
				credentials: davCredentials,
				authMethod: "Oauth",
				defaultAccountType: "caldav",
			})
			await this.davClient.login()
			this.lastAccessToken = credentials.accessToken
			return this.davClient
		}

		if (credentials.accessToken !== this.lastAccessToken) {
			this.davClient.credentials = davCredentials
			this.lastAccessToken = credentials.accessToken
		}

		return this.davClient
	}
}

function computeTimeRange(now: Date, lookAheadDays: number): { start: Date; end: Date } {
	const start = new Date(now)
	start.setUTCHours(0, 0, 0, 0)

	const end = new Date(start)
	end.setUTCDate(end.getUTCDate() + 1 + lookAheadDays)

	return { start, end }
}

export function computePriority(event: CalendarEventData, now: Date): number {
	if (event.isAllDay) {
		return 0.3
	}

	const msUntilStart = event.startDate.getTime() - now.getTime()

	// Event already started
	if (msUntilStart < 0) {
		const isInProgress = now.getTime() < event.endDate.getTime()
		// Currently happening events are high priority; fully past events are low
		return isInProgress ? 0.8 : 0.2
	}

	// Starting within 30 minutes
	if (msUntilStart <= 30 * 60 * 1000) {
		return 0.9
	}

	// Starting within 2 hours
	if (msUntilStart <= 2 * 60 * 60 * 1000) {
		return 0.7
	}

	// Later today (within 24 hours from start of day)
	const startOfDay = new Date(now)
	startOfDay.setUTCHours(0, 0, 0, 0)
	const endOfDay = new Date(startOfDay)
	endOfDay.setUTCDate(endOfDay.getUTCDate() + 1)

	if (event.startDate.getTime() < endOfDay.getTime()) {
		return 0.5
	}

	// Future days
	return 0.2
}

function createFeedItem(event: CalendarEventData, now: Date): CalendarFeedItem {
	return {
		id: `calendar-event-${event.uid}${event.recurrenceId ? `-${event.recurrenceId}` : ""}`,
		type: "calendar-event",
		priority: computePriority(event, now),
		timestamp: now,
		data: event,
	}
}
