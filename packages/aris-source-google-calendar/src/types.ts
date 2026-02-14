/**
 * Provider interface for Google OAuth credentials.
 * Consumers implement this to supply tokens from their auth storage/flow.
 * The source never stores or manages tokens itself.
 */
export interface GoogleOAuthProvider {
	/** Return a valid access token, refreshing internally if necessary. */
	fetchAccessToken(): Promise<string>
	/** Force a token refresh and return the new access token. */
	refresh(): Promise<string>
	/** Revoke the current credentials. */
	revoke(): Promise<void>
}

export const EventStatus = {
	Confirmed: "confirmed",
	Tentative: "tentative",
	Cancelled: "cancelled",
} as const

export type EventStatus = (typeof EventStatus)[keyof typeof EventStatus]

/** Google Calendar API event datetime object. Exactly one of dateTime or date is present. */
export interface ApiEventDateTime {
	dateTime?: string
	date?: string
	timeZone?: string
}

/** Google Calendar API event resource shape. */
export interface ApiCalendarEvent {
	id: string
	status: EventStatus
	htmlLink: string
	summary?: string
	description?: string
	location?: string
	start: ApiEventDateTime
	end: ApiEventDateTime
}

export type CalendarEventData = {
	eventId: string
	calendarId: string
	title: string
	description: string | null
	location: string | null
	startTime: Date
	endTime: Date
	isAllDay: boolean
	status: EventStatus
	htmlLink: string
}

export interface ListEventsOptions {
	calendarId: string
	timeMin: Date
	timeMax: Date
}

/**
 * Abstraction over the Google Calendar REST API.
 * Inject a mock for testing.
 */
export interface GoogleCalendarClient {
	/** List all calendar IDs accessible by the user. */
	listCalendarIds(): Promise<string[]>
	/** List events matching the given options. Returns raw API event objects. */
	listEvents(options: ListEventsOptions): Promise<ApiCalendarEvent[]>
}

interface GoogleCalendarSourceBaseOptions {
	/** Calendar IDs to fetch. Defaults to all user calendars. */
	calendarIds?: string[]
	/** How far ahead to look for events, in hours. Default: 24 */
	lookaheadHours?: number
}

interface GoogleCalendarSourceWithProvider extends GoogleCalendarSourceBaseOptions {
	/** OAuth provider for authenticating with Google Calendar API */
	oauthProvider: GoogleOAuthProvider
	client?: never
}

interface GoogleCalendarSourceWithClient extends GoogleCalendarSourceBaseOptions {
	oauthProvider?: never
	/** Injectable API client (for testing) */
	client: GoogleCalendarClient
}

export type GoogleCalendarSourceOptions =
	| GoogleCalendarSourceWithProvider
	| GoogleCalendarSourceWithClient
