import type { FeedItem } from "@aris/core"

import type { TflLineId } from "./tfl-api.ts"

export type { TflLineId } from "./tfl-api.ts"

export type TflAlertSeverity = "minor-delays" | "major-delays" | "closure"

export interface TflAlertData extends Record<string, unknown> {
	line: TflLineId
	lineName: string
	severity: TflAlertSeverity
	description: string
	closestStationDistance: number | null
}

export type TflAlertFeedItem = FeedItem<"tfl-alert", TflAlertData>

export interface TflDataSourceConfig {
	lines?: TflLineId[]
}

export interface TflDataSourceOptions {
	apiKey: string
}

export interface StationLocation {
	id: string
	name: string
	lat: number
	lng: number
	lines: TflLineId[]
}
