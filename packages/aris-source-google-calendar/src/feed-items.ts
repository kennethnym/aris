import type { FeedItem } from "@aris/core"

import type { CalendarEventData } from "./types"

export const CalendarFeedItemType = {
	event: "calendar-event",
	allDay: "calendar-all-day",
} as const

export type CalendarFeedItemType = (typeof CalendarFeedItemType)[keyof typeof CalendarFeedItemType]

export interface CalendarEventFeedItem extends FeedItem<
	typeof CalendarFeedItemType.event,
	CalendarEventData
> {}

export interface CalendarAllDayFeedItem extends FeedItem<
	typeof CalendarFeedItemType.allDay,
	CalendarEventData
> {}

export type CalendarFeedItem = CalendarEventFeedItem | CalendarAllDayFeedItem
