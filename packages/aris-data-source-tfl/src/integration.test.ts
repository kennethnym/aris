import { describe, expect, test } from "bun:test"

import type { Context } from "@aris/core"
import { TflDataSource } from "./data-source.ts"
import type { ITflApi, TflLineStatus } from "./tfl-api.ts"
import type { StationLocation, TflLineId } from "./types.ts"

import fixtures from "../fixtures/tfl-responses.json"

// Mock API that returns fixture data
class FixtureTflApi implements ITflApi {
	async fetchLineStatuses(_lines?: TflLineId[]): Promise<TflLineStatus[]> {
		const statuses: TflLineStatus[] = []

		for (const line of fixtures.lineStatuses as Record<string, unknown>[]) {
			for (const status of line.lineStatuses as Record<string, unknown>[]) {
				const severityCode = status.statusSeverity as number
				const severity = this.mapSeverity(severityCode)
				if (severity) {
					statuses.push({
						lineId: line.id as TflLineId,
						lineName: line.name as string,
						severity,
						description: (status.reason as string) ?? (status.statusSeverityDescription as string),
					})
				}
			}
		}

		return statuses
	}

	async fetchStations(): Promise<StationLocation[]> {
		const stationMap = new Map<string, StationLocation>()

		for (const [lineId, stops] of Object.entries(fixtures.stopPoints)) {
			for (const stop of stops as Record<string, unknown>[]) {
				const id = stop.naptanId as string
				const existing = stationMap.get(id)
				if (existing) {
					if (!existing.lines.includes(lineId as TflLineId)) {
						existing.lines.push(lineId as TflLineId)
					}
				} else {
					stationMap.set(id, {
						id,
						name: stop.commonName as string,
						lat: stop.lat as number,
						lng: stop.lon as number,
						lines: [lineId as TflLineId],
					})
				}
			}
		}

		return Array.from(stationMap.values())
	}

	private mapSeverity(code: number): "minor-delays" | "major-delays" | "closure" | null {
		const map: Record<number, "minor-delays" | "major-delays" | "closure" | null> = {
			1: "closure",
			2: "closure",
			3: "closure",
			4: "closure",
			5: "closure",
			6: "major-delays",
			7: "major-delays",
			8: "major-delays",
			9: "minor-delays",
			10: null,
		}
		return map[code] ?? null
	}
}

const createContext = (location?: { lat: number; lng: number }): Context => ({
	time: new Date("2026-01-15T12:00:00Z"),
	location: location ? { ...location, accuracy: 10 } : undefined,
})

describe("TfL Feed Items (using fixture data)", () => {
	const api = new FixtureTflApi()

	test("query returns feed items array", async () => {
		const dataSource = new TflDataSource(api)
		const items = await dataSource.query(createContext(), {})
		expect(Array.isArray(items)).toBe(true)
	})

	test("feed items have correct base structure", async () => {
		const dataSource = new TflDataSource(api)
		const items = await dataSource.query(createContext({ lat: 51.5074, lng: -0.1278 }), {})

		for (const item of items) {
			expect(typeof item.id).toBe("string")
			expect(item.id).toMatch(/^tfl-alert-/)
			expect(item.type).toBe("tfl-alert")
			expect(typeof item.priority).toBe("number")
			expect(item.timestamp).toBeInstanceOf(Date)
		}
	})

	test("feed items have correct data structure", async () => {
		const dataSource = new TflDataSource(api)
		const items = await dataSource.query(createContext({ lat: 51.5074, lng: -0.1278 }), {})

		for (const item of items) {
			expect(typeof item.data.line).toBe("string")
			expect(typeof item.data.lineName).toBe("string")
			expect(["minor-delays", "major-delays", "closure"]).toContain(item.data.severity)
			expect(typeof item.data.description).toBe("string")
			expect(item.data.closestStationDistance === null || typeof item.data.closestStationDistance === "number").toBe(
				true,
			)
		}
	})

	test("feed item ids are unique", async () => {
		const dataSource = new TflDataSource(api)
		const items = await dataSource.query(createContext(), {})

		const ids = items.map((item) => item.id)
		const uniqueIds = new Set(ids)
		expect(uniqueIds.size).toBe(ids.length)
	})

	test("feed items are sorted by priority descending", async () => {
		const dataSource = new TflDataSource(api)
		const items = await dataSource.query(createContext(), {})

		for (let i = 1; i < items.length; i++) {
			const prev = items[i - 1]!
			const curr = items[i]!
			expect(prev.priority).toBeGreaterThanOrEqual(curr.priority)
		}
	})

	test("priority values match severity levels", async () => {
		const dataSource = new TflDataSource(api)
		const items = await dataSource.query(createContext(), {})

		const severityPriority: Record<string, number> = {
			closure: 100,
			"major-delays": 80,
			"minor-delays": 60,
		}

		for (const item of items) {
			expect(item.priority).toBe(severityPriority[item.data.severity]!)
		}
	})

	test("closestStationDistance is number when location provided", async () => {
		const dataSource = new TflDataSource(api)
		const items = await dataSource.query(createContext({ lat: 51.5074, lng: -0.1278 }), {})

		for (const item of items) {
			expect(typeof item.data.closestStationDistance).toBe("number")
			expect(item.data.closestStationDistance!).toBeGreaterThan(0)
		}
	})

	test("closestStationDistance is null when no location provided", async () => {
		const dataSource = new TflDataSource(api)
		const items = await dataSource.query(createContext(), {})

		for (const item of items) {
			expect(item.data.closestStationDistance).toBeNull()
		}
	})
})

describe("TfL Fixture Data Shape", () => {
	test("fixtures have expected structure", () => {
		expect(typeof fixtures.fetchedAt).toBe("string")
		expect(Array.isArray(fixtures.lineStatuses)).toBe(true)
		expect(typeof fixtures.stopPoints).toBe("object")
	})

	test("line statuses have required fields", () => {
		for (const line of fixtures.lineStatuses as Record<string, unknown>[]) {
			expect(typeof line.id).toBe("string")
			expect(typeof line.name).toBe("string")
			expect(Array.isArray(line.lineStatuses)).toBe(true)

			for (const status of line.lineStatuses as Record<string, unknown>[]) {
				expect(typeof status.statusSeverity).toBe("number")
				expect(typeof status.statusSeverityDescription).toBe("string")
			}
		}
	})

	test("stop points have required fields", () => {
		for (const [lineId, stops] of Object.entries(fixtures.stopPoints)) {
			expect(typeof lineId).toBe("string")
			expect(Array.isArray(stops)).toBe(true)

			for (const stop of stops as Record<string, unknown>[]) {
				expect(typeof stop.naptanId).toBe("string")
				expect(typeof stop.commonName).toBe("string")
				expect(typeof stop.lat).toBe("number")
				expect(typeof stop.lon).toBe("number")
			}
		}
	})
})
