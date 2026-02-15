import type { Context } from "@aris/core"

import { LocationKey } from "@aris/source-location"
import {
	Units,
	WeatherFeedItemType,
	type WeatherKitClient,
	type WeatherKitResponse,
} from "@aris/source-weatherkit"
import { describe, expect, test } from "bun:test"

import fixture from "../../../../packages/aris-source-weatherkit/fixtures/san-francisco.json"
import { WeatherService } from "./service.ts"

const mockClient = createMockClient(fixture.response as WeatherKitResponse)

function createMockClient(response: WeatherKitResponse): WeatherKitClient {
	return {
		fetch: async () => response,
	}
}

function createMockContext(location?: { lat: number; lng: number }): Context {
	const ctx: Context = { time: new Date("2026-01-17T00:00:00Z") }
	if (location) {
		ctx[LocationKey] = { ...location, accuracy: 10, timestamp: new Date() }
	}
	return ctx
}

describe("WeatherService", () => {
	test("feedSourceForUser creates source on first call", () => {
		const service = new WeatherService({ client: mockClient })
		const source = service.feedSourceForUser("user-1")

		expect(source).toBeDefined()
		expect(source.id).toBe("aris.weather")
	})

	test("feedSourceForUser returns same source for same user", () => {
		const service = new WeatherService({ client: mockClient })
		const source1 = service.feedSourceForUser("user-1")
		const source2 = service.feedSourceForUser("user-1")

		expect(source1).toBe(source2)
	})

	test("feedSourceForUser returns different sources for different users", () => {
		const service = new WeatherService({ client: mockClient })
		const source1 = service.feedSourceForUser("user-1")
		const source2 = service.feedSourceForUser("user-2")

		expect(source1).not.toBe(source2)
	})

	test("feedSourceForUser applies hourly and daily limits", async () => {
		const service = new WeatherService({
			client: mockClient,
			hourlyLimit: 3,
			dailyLimit: 2,
		})
		const source = service.feedSourceForUser("user-1")
		const context = createMockContext({ lat: 37.7749, lng: -122.4194 })

		const items = await source.fetchItems(context)

		const hourly = items.filter((i) => i.type === WeatherFeedItemType.hourly)
		const daily = items.filter((i) => i.type === WeatherFeedItemType.daily)

		expect(hourly).toHaveLength(3)
		expect(daily).toHaveLength(2)
	})

	test("feedSourceForUser applies units", async () => {
		const service = new WeatherService({
			client: mockClient,
			units: Units.imperial,
		})
		const source = service.feedSourceForUser("user-1")
		const context = createMockContext({ lat: 37.7749, lng: -122.4194 })

		const items = await source.fetchItems(context)
		const current = items.find((i) => i.type === WeatherFeedItemType.current)

		expect(current).toBeDefined()
		// Fixture has ~15.87°C, imperial should be ~60.6°F
		expect(current!.data.temperature).toBeGreaterThan(50)
	})

	test("removeUser removes the source", () => {
		const service = new WeatherService({ client: mockClient })
		service.feedSourceForUser("user-1")

		service.removeUser("user-1")

		// After removal, feedSourceForUser should create a new instance
		const source2 = service.feedSourceForUser("user-1")
		expect(source2).toBeDefined()
	})

	test("removeUser allows new source to be created", () => {
		const service = new WeatherService({ client: mockClient })
		const source1 = service.feedSourceForUser("user-1")

		service.removeUser("user-1")
		const source2 = service.feedSourceForUser("user-1")

		expect(source1).not.toBe(source2)
	})

	test("removeUser is no-op for unknown user", () => {
		const service = new WeatherService({ client: mockClient })

		expect(() => service.removeUser("unknown")).not.toThrow()
	})
})
