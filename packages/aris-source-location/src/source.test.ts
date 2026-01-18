import { contextValue } from "@aris/core"
import { describe, expect, mock, test } from "bun:test"

import { LocationKey } from "./location"
import { createLocationSource, type GeolocationProvider } from "./source"

function createMockGeolocation(): GeolocationProvider & {
	simulatePosition(position: GeolocationPosition): void
	simulateError(error: GeolocationPositionError): void
	lastWatchId: number
	watchCallbacks: Map<number, (position: GeolocationPosition) => void>
} {
	let nextWatchId = 1
	const watchCallbacks = new Map<number, (position: GeolocationPosition) => void>()
	let getCurrentPositionResolve: ((position: GeolocationPosition) => void) | null = null
	let getCurrentPositionReject: ((error: GeolocationPositionError) => void) | null = null

	return {
		lastWatchId: 0,
		watchCallbacks,

		getCurrentPosition(success, error, _options) {
			getCurrentPositionResolve = success
			getCurrentPositionReject = error
		},

		watchPosition(success, _error, _options) {
			const id = nextWatchId++
			this.lastWatchId = id
			watchCallbacks.set(id, success)
			return id
		},

		clearWatch(watchId) {
			watchCallbacks.delete(watchId)
		},

		simulatePosition(position: GeolocationPosition) {
			getCurrentPositionResolve?.(position)
			for (const callback of watchCallbacks.values()) {
				callback(position)
			}
		},

		simulateError(error: GeolocationPositionError) {
			getCurrentPositionReject?.(error)
		},
	}
}

function createPosition(lat: number, lng: number, accuracy: number): GeolocationPosition {
	return {
		coords: {
			latitude: lat,
			longitude: lng,
			accuracy,
			altitude: null,
			altitudeAccuracy: null,
			heading: null,
			speed: null,
		},
		timestamp: Date.now(),
	}
}

function createPositionError(code: number, message: string): GeolocationPositionError {
	return {
		code,
		message,
		PERMISSION_DENIED: 1,
		POSITION_UNAVAILABLE: 2,
		TIMEOUT: 3,
	}
}

describe("LocationSource", () => {
	describe("fetchContext", () => {
		test("returns location from geolocation API", async () => {
			const geo = createMockGeolocation()
			const source = createLocationSource(geo)

			const promise = source.fetchContext!({ time: new Date() })
			geo.simulatePosition(createPosition(51.5074, -0.1278, 10))

			const result = await promise
			const location = contextValue(result, LocationKey)

			expect(location).toEqual({
				lat: 51.5074,
				lng: -0.1278,
				accuracy: 10,
			})
		})

		test("rejects on geolocation error", async () => {
			const geo = createMockGeolocation()
			const source = createLocationSource(geo)

			const promise = source.fetchContext!({ time: new Date() })
			geo.simulateError(createPositionError(1, "User denied geolocation"))

			await expect(promise).rejects.toThrow("Geolocation error: User denied geolocation")
		})
	})

	describe("onContextUpdate", () => {
		test("subscribes to position updates", () => {
			const geo = createMockGeolocation()
			const source = createLocationSource(geo)

			const updates: unknown[] = []
			source.onContextUpdate!(
				(update) => updates.push(update),
				() => ({ time: new Date() }),
			)

			geo.simulatePosition(createPosition(51.5074, -0.1278, 10))

			expect(updates).toHaveLength(1)
			expect(contextValue(updates[0] as Record<string, unknown>, LocationKey)).toEqual({
				lat: 51.5074,
				lng: -0.1278,
				accuracy: 10,
			})
		})

		test("receives multiple updates", () => {
			const geo = createMockGeolocation()
			const source = createLocationSource(geo)

			const updates: unknown[] = []
			source.onContextUpdate!(
				(update) => updates.push(update),
				() => ({ time: new Date() }),
			)

			geo.simulatePosition(createPosition(51.5074, -0.1278, 10))
			geo.simulatePosition(createPosition(40.7128, -74.006, 15))

			expect(updates).toHaveLength(2)
			expect(contextValue(updates[1] as Record<string, unknown>, LocationKey)).toEqual({
				lat: 40.7128,
				lng: -74.006,
				accuracy: 15,
			})
		})

		test("cleanup stops watching", () => {
			const geo = createMockGeolocation()
			const source = createLocationSource(geo)

			const updates: unknown[] = []
			const cleanup = source.onContextUpdate!(
				(update) => updates.push(update),
				() => ({ time: new Date() }),
			)

			geo.simulatePosition(createPosition(51.5074, -0.1278, 10))
			expect(updates).toHaveLength(1)

			cleanup()

			geo.simulatePosition(createPosition(40.7128, -74.006, 15))
			expect(updates).toHaveLength(1) // no new updates after cleanup
		})

		test("clears correct watch ID", () => {
			const geo = createMockGeolocation()
			const source = createLocationSource(geo)

			const cleanup = source.onContextUpdate!(
				() => {},
				() => ({ time: new Date() }),
			)
			const watchId = geo.lastWatchId

			expect(geo.watchCallbacks.has(watchId)).toBe(true)

			cleanup()

			expect(geo.watchCallbacks.has(watchId)).toBe(false)
		})
	})

	describe("options", () => {
		test("passes options to geolocation API", () => {
			const getCurrentPosition = mock(() => {})
			const watchPosition = mock(() => 1)
			const clearWatch = mock(() => {})

			const geo: GeolocationProvider = {
				getCurrentPosition,
				watchPosition,
				clearWatch,
			}

			const source = createLocationSource(geo, {
				enableHighAccuracy: true,
				maximumAge: 30000,
				timeout: 5000,
			})

			source.fetchContext!({ time: new Date() })
			source.onContextUpdate!(
				() => {},
				() => ({ time: new Date() }),
			)

			const expectedOptions = {
				enableHighAccuracy: true,
				maximumAge: 30000,
				timeout: 5000,
			}

			expect(getCurrentPosition).toHaveBeenCalledWith(
				expect.any(Function),
				expect.any(Function),
				expectedOptions,
			)
			expect(watchPosition).toHaveBeenCalledWith(
				expect.any(Function),
				expect.any(Function),
				expectedOptions,
			)
		})
	})

	describe("source properties", () => {
		test("has correct id", () => {
			const geo = createMockGeolocation()
			const source = createLocationSource(geo)

			expect(source.id).toBe("location")
		})

		test("has no dependencies", () => {
			const geo = createMockGeolocation()
			const source = createLocationSource(geo)

			expect(source.dependencies).toBeUndefined()
		})

		test("does not produce feed items", () => {
			const geo = createMockGeolocation()
			const source = createLocationSource(geo)

			expect(source.fetchItems).toBeUndefined()
			expect(source.onItemsUpdate).toBeUndefined()
		})
	})
})
