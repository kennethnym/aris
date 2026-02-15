import type { Context } from "@aris/core"
import type { ITflApi, StationLocation, TflLineId, TflLineStatus } from "@aris/source-tfl"

import { describe, expect, test } from "bun:test"

import { UserNotFoundError } from "../lib/error.ts"
import { TflService } from "./service.ts"

class StubTflApi implements ITflApi {
	private statuses: TflLineStatus[]

	constructor(statuses: TflLineStatus[] = []) {
		this.statuses = statuses
	}

	async fetchLineStatuses(lines?: TflLineId[]): Promise<TflLineStatus[]> {
		if (lines) {
			return this.statuses.filter((s) => lines.includes(s.lineId))
		}
		return this.statuses
	}

	async fetchStations(): Promise<StationLocation[]> {
		return [
			{
				id: "940GZZLUKSX",
				name: "King's Cross",
				lat: 51.5308,
				lng: -0.1238,
				lines: ["northern", "victoria"],
			},
		]
	}
}

function createContext(): Context {
	return { time: new Date("2026-01-15T12:00:00Z") }
}

const sampleStatuses: TflLineStatus[] = [
	{
		lineId: "northern",
		lineName: "Northern",
		severity: "minor-delays",
		description: "Minor delays on the Northern line",
	},
	{
		lineId: "victoria",
		lineName: "Victoria",
		severity: "major-delays",
		description: "Severe delays on the Victoria line",
	},
	{
		lineId: "central",
		lineName: "Central",
		severity: "closure",
		description: "Central line suspended",
	},
]

describe("TflService", () => {
	test("feedSourceForUser creates source on first call", () => {
		const service = new TflService(new StubTflApi())
		const source = service.feedSourceForUser("user-1")

		expect(source).toBeDefined()
		expect(source.id).toBe("aris.tfl")
	})

	test("feedSourceForUser returns same source for same user", () => {
		const service = new TflService(new StubTflApi())
		const source1 = service.feedSourceForUser("user-1")
		const source2 = service.feedSourceForUser("user-1")

		expect(source1).toBe(source2)
	})

	test("feedSourceForUser returns different sources for different users", () => {
		const service = new TflService(new StubTflApi())
		const source1 = service.feedSourceForUser("user-1")
		const source2 = service.feedSourceForUser("user-2")

		expect(source1).not.toBe(source2)
	})

	test("updateLinesOfInterest mutates the existing source in place", () => {
		const service = new TflService(new StubTflApi())
		const original = service.feedSourceForUser("user-1")

		service.updateLinesOfInterest("user-1", ["northern", "victoria"])
		const after = service.feedSourceForUser("user-1")

		expect(after).toBe(original)
	})

	test("updateLinesOfInterest throws if source does not exist", () => {
		const service = new TflService(new StubTflApi())

		expect(() => service.updateLinesOfInterest("user-1", ["northern"])).toThrow(UserNotFoundError)
	})

	test("removeUser removes the source", () => {
		const service = new TflService(new StubTflApi())
		const source1 = service.feedSourceForUser("user-1")

		service.removeUser("user-1")
		const source2 = service.feedSourceForUser("user-1")

		expect(source1).not.toBe(source2)
	})

	test("removeUser clears line configuration", async () => {
		const api = new StubTflApi(sampleStatuses)
		const service = new TflService(api)
		service.feedSourceForUser("user-1")
		service.updateLinesOfInterest("user-1", ["northern"])

		service.removeUser("user-1")
		const items = await service.feedSourceForUser("user-1").fetchItems(createContext())

		expect(items.length).toBe(3)
	})

	test("shares single api instance across users", () => {
		const api = new StubTflApi()
		const service = new TflService(api)

		service.feedSourceForUser("user-1")
		service.feedSourceForUser("user-2")

		expect(service.feedSourceForUser("user-1").id).toBe("aris.tfl")
		expect(service.feedSourceForUser("user-2").id).toBe("aris.tfl")
	})

	describe("returned source fetches items", () => {
		test("source returns feed items from api", async () => {
			const api = new StubTflApi(sampleStatuses)
			const service = new TflService(api)
			const source = service.feedSourceForUser("user-1")

			const items = await source.fetchItems(createContext())

			expect(items.length).toBe(3)
			for (const item of items) {
				expect(item.type).toBe("tfl-alert")
				expect(item.id).toMatch(/^tfl-alert-/)
				expect(typeof item.priority).toBe("number")
				expect(item.timestamp).toBeInstanceOf(Date)
			}
		})

		test("source returns items sorted by priority descending", async () => {
			const api = new StubTflApi(sampleStatuses)
			const service = new TflService(api)
			const source = service.feedSourceForUser("user-1")

			const items = await source.fetchItems(createContext())

			for (let i = 1; i < items.length; i++) {
				expect(items[i - 1]!.priority).toBeGreaterThanOrEqual(items[i]!.priority)
			}
		})

		test("source returns empty array when no disruptions", async () => {
			const api = new StubTflApi([])
			const service = new TflService(api)
			const source = service.feedSourceForUser("user-1")

			const items = await source.fetchItems(createContext())

			expect(items).toEqual([])
		})

		test("updateLinesOfInterest filters items to configured lines", async () => {
			const api = new StubTflApi(sampleStatuses)
			const service = new TflService(api)

			const before = await service.feedSourceForUser("user-1").fetchItems(createContext())
			expect(before.length).toBe(3)

			service.updateLinesOfInterest("user-1", ["northern"])
			const after = await service.feedSourceForUser("user-1").fetchItems(createContext())

			expect(after.length).toBe(1)
			expect(after[0]!.data.line).toBe("northern")
		})

		test("different users get independent line configs", async () => {
			const api = new StubTflApi(sampleStatuses)
			const service = new TflService(api)
			service.feedSourceForUser("user-1")
			service.feedSourceForUser("user-2")

			service.updateLinesOfInterest("user-1", ["northern"])
			service.updateLinesOfInterest("user-2", ["central"])

			const items1 = await service.feedSourceForUser("user-1").fetchItems(createContext())
			const items2 = await service.feedSourceForUser("user-2").fetchItems(createContext())

			expect(items1.length).toBe(1)
			expect(items1[0]!.data.line).toBe("northern")
			expect(items2.length).toBe(1)
			expect(items2[0]!.data.line).toBe("central")
		})
	})
})
