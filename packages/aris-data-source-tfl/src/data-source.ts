import type { Context, DataSource } from "@aris/core"

import type {
	StationLocation,
	TflAlertData,
	TflAlertFeedItem,
	TflAlertSeverity,
	TflDataSourceConfig,
	TflDataSourceOptions,
	TflLineId,
} from "./types.ts"

import { TflApi, type ITflApi } from "./tfl-api.ts"

const SEVERITY_PRIORITY: Record<TflAlertSeverity, number> = {
	closure: 100,
	"major-delays": 80,
	"minor-delays": 60,
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

export class TflDataSource implements DataSource<TflAlertFeedItem, TflDataSourceConfig> {
	readonly type = "tfl-alert"
	private api: ITflApi

	constructor(options: TflDataSourceOptions)
	constructor(api: ITflApi)
	constructor(optionsOrApi: TflDataSourceOptions | ITflApi) {
		if ("fetchLineStatuses" in optionsOrApi) {
			this.api = optionsOrApi
		} else {
			this.api = new TflApi(optionsOrApi.apiKey)
		}
	}

	async query(context: Context, config: TflDataSourceConfig): Promise<TflAlertFeedItem[]> {
		const [statuses, stations] = await Promise.all([
			this.api.fetchLineStatuses(config.lines),
			this.api.fetchStations(),
		])

		const items: TflAlertFeedItem[] = statuses.map((status) => {
			const closestStationDistance = context.location
				? findClosestStationDistance(
						status.lineId,
						stations,
						context.location.lat,
						context.location.lng,
					)
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
				type: this.type,
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
