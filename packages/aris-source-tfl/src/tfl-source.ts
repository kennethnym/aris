import type { Context, FeedSource } from "@aris/core"

import { contextValue } from "@aris/core"
import { LocationKey } from "@aris/source-location"

import type {
	ITflApi,
	StationLocation,
	TflAlertData,
	TflAlertFeedItem,
	TflAlertSeverity,
	TflLineId,
	TflSourceOptions,
} from "./types.ts"

import { TflApi } from "./tfl-api.ts"

const SEVERITY_PRIORITY: Record<TflAlertSeverity, number> = {
	closure: 1.0,
	"major-delays": 0.8,
	"minor-delays": 0.6,
}

/**
 * A FeedSource that provides TfL (Transport for London) service alerts.
 *
 * Depends on location source for proximity-based sorting. Produces feed items
 * for tube, overground, and Elizabeth line disruptions.
 *
 * @example
 * ```ts
 * const tflSource = new TflSource({
 *   apiKey: process.env.TFL_API_KEY!,
 *   lines: ["northern", "victoria", "jubilee"],
 * })
 *
 * const engine = new FeedEngine()
 *   .register(locationSource)
 *   .register(tflSource)
 *
 * const { items } = await engine.refresh()
 * ```
 */
export class TflSource implements FeedSource<TflAlertFeedItem> {
	static readonly DEFAULT_LINES_OF_INTEREST: readonly TflLineId[] = [
		"bakerloo",
		"central",
		"circle",
		"district",
		"hammersmith-city",
		"jubilee",
		"metropolitan",
		"northern",
		"piccadilly",
		"victoria",
		"waterloo-city",
		"lioness",
		"mildmay",
		"windrush",
		"weaver",
		"suffragette",
		"liberty",
		"elizabeth",
	]

	readonly id = "tfl"
	readonly dependencies = ["location"]

	private readonly client: ITflApi
	private lines: TflLineId[]

	constructor(options: TflSourceOptions) {
		if (!options.client && !options.apiKey) {
			throw new Error("Either client or apiKey must be provided")
		}
		this.client = options.client ?? new TflApi(options.apiKey!)
		this.lines = options.lines ?? [...TflSource.DEFAULT_LINES_OF_INTEREST]
	}

	async fetchContext(): Promise<null> {
		return null
	}

	/**
	 * Update the set of monitored lines. Takes effect on the next fetchItems call.
	 */
	setLinesOfInterest(lines: TflLineId[]): void {
		this.lines = lines
	}

	async fetchItems(context: Context): Promise<TflAlertFeedItem[]> {
		const [statuses, stations] = await Promise.all([
			this.client.fetchLineStatuses(this.lines),
			this.client.fetchStations(),
		])

		const location = contextValue(context, LocationKey)

		const items: TflAlertFeedItem[] = statuses.map((status) => {
			const closestStationDistance = location
				? findClosestStationDistance(status.lineId, stations, location.lat, location.lng)
				: null

			const data: TflAlertData = {
				line: status.lineId,
				lineName: status.lineName,
				severity: status.severity,
				description: status.description,
				closestStationDistance,
			}

			return {
				id: `tfl-alert-${status.lineId}-${status.severity}`,
				type: "tfl-alert",
				priority: SEVERITY_PRIORITY[status.severity],
				timestamp: context.time,
				data,
			}
		})

		// Sort by severity (desc), then by proximity (asc) if location available
		items.sort((a, b) => {
			if (b.priority !== a.priority) {
				return b.priority - a.priority
			}
			if (a.data.closestStationDistance !== null && b.data.closestStationDistance !== null) {
				return a.data.closestStationDistance - b.data.closestStationDistance
			}
			return 0
		})

		return items
	}
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
	const R = 6371 // Earth's radius in km
	const dLat = ((lat2 - lat1) * Math.PI) / 180
	const dLng = ((lng2 - lng1) * Math.PI) / 180
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos((lat1 * Math.PI) / 180) *
			Math.cos((lat2 * Math.PI) / 180) *
			Math.sin(dLng / 2) *
			Math.sin(dLng / 2)
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
	return R * c
}

function findClosestStationDistance(
	lineId: TflLineId,
	stations: StationLocation[],
	userLat: number,
	userLng: number,
): number | null {
	const lineStations = stations.filter((s) => s.lines.includes(lineId))
	if (lineStations.length === 0) return null

	let minDistance = Infinity
	for (const station of lineStations) {
		const distance = haversineDistance(userLat, userLng, station.lat, station.lng)
		if (distance < minDistance) {
			minDistance = distance
		}
	}

	return minDistance
}
