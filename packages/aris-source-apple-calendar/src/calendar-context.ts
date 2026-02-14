import type { ContextKey } from "@aris/core"

import { contextKey } from "@aris/core"

import type { CalendarEventData } from "./types.ts"

/**
 * Calendar context for downstream sources.
 *
 * Provides a snapshot of the user's upcoming events so other sources
 * can adapt (e.g. a commute source checking if there's a meeting soon).
 */
export interface CalendarContext {
	/** Events happening right now */
	inProgress: CalendarEventData[]
	/** Next upcoming event, if any */
	nextEvent: CalendarEventData | null
	/** Whether the user has any events today */
	hasTodayEvents: boolean
	/** Total number of events today */
	todayEventCount: number
}

export const CalendarKey: ContextKey<CalendarContext> = contextKey("calendar")
