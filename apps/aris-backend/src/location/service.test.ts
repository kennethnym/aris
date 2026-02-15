import { describe, expect, test } from "bun:test"

import { UserNotFoundError } from "../lib/error.ts"
import { LocationService } from "./service.ts"

describe("LocationService", () => {
	test("feedSourceForUser creates source on first call", () => {
		const service = new LocationService()
		const source = service.feedSourceForUser("user-1")

		expect(source).toBeDefined()
		expect(source.id).toBe("aris.location")
	})

	test("feedSourceForUser returns same source for same user", () => {
		const service = new LocationService()
		const source1 = service.feedSourceForUser("user-1")
		const source2 = service.feedSourceForUser("user-1")

		expect(source1).toBe(source2)
	})

	test("feedSourceForUser returns different sources for different users", () => {
		const service = new LocationService()
		const source1 = service.feedSourceForUser("user-1")
		const source2 = service.feedSourceForUser("user-2")

		expect(source1).not.toBe(source2)
	})

	test("updateUserLocation updates the source", () => {
		const service = new LocationService()
		const source = service.feedSourceForUser("user-1")
		const location = {
			lat: 51.5074,
			lng: -0.1278,
			accuracy: 10,
			timestamp: new Date(),
		}

		service.updateUserLocation("user-1", location)

		expect(source.lastLocation).toEqual(location)
	})

	test("updateUserLocation throws if source does not exist", () => {
		const service = new LocationService()
		const location = {
			lat: 51.5074,
			lng: -0.1278,
			accuracy: 10,
			timestamp: new Date(),
		}

		expect(() => service.updateUserLocation("user-1", location)).toThrow(UserNotFoundError)
	})

	test("lastUserLocation returns null for unknown user", () => {
		const service = new LocationService()

		expect(service.lastUserLocation("unknown")).toBeNull()
	})

	test("lastUserLocation returns last location", () => {
		const service = new LocationService()
		service.feedSourceForUser("user-1")
		const location1 = {
			lat: 51.5074,
			lng: -0.1278,
			accuracy: 10,
			timestamp: new Date(),
		}
		const location2 = {
			lat: 52.0,
			lng: -0.2,
			accuracy: 5,
			timestamp: new Date(),
		}

		service.updateUserLocation("user-1", location1)
		service.updateUserLocation("user-1", location2)

		expect(service.lastUserLocation("user-1")).toEqual(location2)
	})

	test("removeUser removes the source", () => {
		const service = new LocationService()
		service.feedSourceForUser("user-1")
		const location = {
			lat: 51.5074,
			lng: -0.1278,
			accuracy: 10,
			timestamp: new Date(),
		}

		service.updateUserLocation("user-1", location)
		service.removeUser("user-1")

		expect(service.lastUserLocation("user-1")).toBeNull()
	})

	test("removeUser allows new source to be created", () => {
		const service = new LocationService()
		const source1 = service.feedSourceForUser("user-1")

		service.removeUser("user-1")
		const source2 = service.feedSourceForUser("user-1")

		expect(source1).not.toBe(source2)
	})
})
