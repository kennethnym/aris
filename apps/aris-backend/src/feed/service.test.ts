import { describe, expect, mock, test } from "bun:test"

import { LocationService } from "../location/service.ts"
import { FeedEngineService } from "./service.ts"

describe("FeedEngineService", () => {
	test("engineForUser creates engine on first call", () => {
		const locationService = new LocationService()
		const service = new FeedEngineService([locationService])

		const engine = service.engineForUser("user-1")

		expect(engine).toBeDefined()
	})

	test("engineForUser returns same engine for same user", () => {
		const locationService = new LocationService()
		const service = new FeedEngineService([locationService])

		const engine1 = service.engineForUser("user-1")
		const engine2 = service.engineForUser("user-1")

		expect(engine1).toBe(engine2)
	})

	test("engineForUser returns different engines for different users", () => {
		const locationService = new LocationService()
		const service = new FeedEngineService([locationService])

		const engine1 = service.engineForUser("user-1")
		const engine2 = service.engineForUser("user-2")

		expect(engine1).not.toBe(engine2)
	})

	test("engineForUser registers sources from all providers", async () => {
		const locationService = new LocationService()
		const service = new FeedEngineService([locationService])

		const engine = service.engineForUser("user-1")
		const result = await engine.refresh()

		expect(result.errors).toHaveLength(0)
	})

	test("engineForUser works with empty providers array", async () => {
		const service = new FeedEngineService([])

		const engine = service.engineForUser("user-1")
		const result = await engine.refresh()

		expect(result.errors).toHaveLength(0)
		expect(result.items).toHaveLength(0)
	})

	test("refresh returns feed result", async () => {
		const locationService = new LocationService()
		const service = new FeedEngineService([locationService])

		const result = await service.refresh("user-1")

		expect(result).toHaveProperty("context")
		expect(result).toHaveProperty("items")
		expect(result).toHaveProperty("errors")
		expect(result.context.time).toBeInstanceOf(Date)
	})

	test("refresh uses location from LocationService", async () => {
		const locationService = new LocationService()
		const service = new FeedEngineService([locationService])
		const location = {
			lat: 51.5074,
			lng: -0.1278,
			accuracy: 10,
			timestamp: new Date(),
		}

		// Create engine first, then update location
		service.engineForUser("user-1")
		locationService.updateUserLocation("user-1", location)

		const result = await service.refresh("user-1")

		expect(result.context.location).toEqual(location)
	})

	test("subscribe receives updates", async () => {
		const locationService = new LocationService()
		const service = new FeedEngineService([locationService])
		const callback = mock()

		service.subscribe("user-1", callback)

		// Push location to trigger update
		locationService.updateUserLocation("user-1", {
			lat: 51.5074,
			lng: -0.1278,
			accuracy: 10,
			timestamp: new Date(),
		})

		// Wait for async update propagation
		await new Promise((resolve) => setTimeout(resolve, 10))

		expect(callback).toHaveBeenCalled()
	})

	test("subscribe returns unsubscribe function", async () => {
		const locationService = new LocationService()
		const service = new FeedEngineService([locationService])
		const callback = mock()

		const unsubscribe = service.subscribe("user-1", callback)

		unsubscribe()

		locationService.updateUserLocation("user-1", {
			lat: 51.5074,
			lng: -0.1278,
			accuracy: 10,
			timestamp: new Date(),
		})

		await new Promise((resolve) => setTimeout(resolve, 10))

		expect(callback).not.toHaveBeenCalled()
	})

	test("removeUser stops engine and removes it", async () => {
		const locationService = new LocationService()
		const service = new FeedEngineService([locationService])
		const callback = mock()

		service.subscribe("user-1", callback)

		service.removeUser("user-1")

		// Push location - should not trigger update since engine is stopped
		locationService.feedSourceForUser("user-1")
		locationService.updateUserLocation("user-1", {
			lat: 51.5074,
			lng: -0.1278,
			accuracy: 10,
			timestamp: new Date(),
		})

		await new Promise((resolve) => setTimeout(resolve, 10))

		expect(callback).not.toHaveBeenCalled()
	})

	test("removeUser allows new engine to be created", () => {
		const locationService = new LocationService()
		const service = new FeedEngineService([locationService])

		const engine1 = service.engineForUser("user-1")
		service.removeUser("user-1")
		const engine2 = service.engineForUser("user-1")

		expect(engine1).not.toBe(engine2)
	})
})
