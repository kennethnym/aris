import { afterEach, describe, expect, test } from "bun:test"

import type { ContextKey, ContextProvider, DataSource, FeedItem } from "./index"

import { contextKey, contextValue, ContextBridge, FeedController } from "./index"

// =============================================================================
// CONTEXT KEYS
// =============================================================================

interface Location {
	lat: number
	lng: number
	accuracy: number
}

interface CurrentTrack {
	trackId: string
	title: string
	artist: string
	startedAt: Date
}

const LocationKey: ContextKey<Location> = contextKey("location")
const CurrentTrackKey: ContextKey<CurrentTrack> = contextKey("currentTrack")

// =============================================================================
// DATA SOURCES
// =============================================================================

type WeatherItem = FeedItem<"weather", { temp: number; condition: string }>

function createWeatherSource(): DataSource<WeatherItem> {
	return {
		type: "weather",
		async query(context) {
			const location = contextValue(context, LocationKey)
			if (!location) return []
			return [
				{
					id: `weather-${Date.now()}`,
					type: "weather",
					priority: 0.5,
					timestamp: context.time,
					data: { temp: 18, condition: "cloudy" },
				},
			]
		},
	}
}

type TflItem = FeedItem<"tfl-alert", { line: string; status: string }>

function createTflSource(): DataSource<TflItem> {
	return {
		type: "tfl-alert",
		async query(context) {
			const location = contextValue(context, LocationKey)
			if (!location) return []
			return [
				{
					id: "tfl-victoria-delays",
					type: "tfl-alert",
					priority: 0.8,
					timestamp: context.time,
					data: { line: "Victoria", status: "Minor delays" },
				},
			]
		},
	}
}

type MusicContextItem = FeedItem<"music-context", { suggestion: string }>

function createMusicContextSource(): DataSource<MusicContextItem> {
	return {
		type: "music-context",
		async query(context) {
			const track = contextValue(context, CurrentTrackKey)
			if (!track) return []
			return [
				{
					id: `music-ctx-${track.trackId}`,
					type: "music-context",
					priority: 0.3,
					timestamp: context.time,
					data: { suggestion: `You might also like similar artists to ${track.artist}` },
				},
			]
		},
	}
}

// =============================================================================
// CONTEXT PROVIDERS
// =============================================================================

interface SimulatedLocationProvider extends ContextProvider<Location> {
	simulateUpdate(location: Location): void
}

function createLocationProvider(): SimulatedLocationProvider {
	let callback: ((value: Location) => void) | null = null
	let currentLocation: Location = { lat: 0, lng: 0, accuracy: 0 }

	return {
		key: LocationKey,
		onUpdate(cb) {
			callback = cb
			return () => {
				callback = null
			}
		},
		async fetchCurrentValue() {
			return currentLocation
		},
		simulateUpdate(location: Location) {
			currentLocation = location
			callback?.(location)
		},
	}
}

// =============================================================================
// HELPERS
// =============================================================================

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

type AppFeedItem = WeatherItem | TflItem | MusicContextItem

// =============================================================================
// TESTS
// =============================================================================

describe("Integration", () => {
	let controller: FeedController<AppFeedItem>
	let bridge: ContextBridge
	let locationProvider: SimulatedLocationProvider

	afterEach(() => {
		bridge?.stop()
		controller?.stop()
	})

	test("location update triggers feed with location-dependent sources", async () => {
		controller = new FeedController<AppFeedItem>({ debounceMs: 10 })
			.addDataSource(createWeatherSource())
			.addDataSource(createTflSource())
			.addDataSource(createMusicContextSource())

		locationProvider = createLocationProvider()
		bridge = new ContextBridge(controller).addProvider(locationProvider)

		const results: Array<{ items: AppFeedItem[] }> = []
		controller.subscribe((result) => {
			results.push({ items: [...result.items] })
		})

		locationProvider.simulateUpdate({ lat: 51.5074, lng: -0.1278, accuracy: 10 })
		await delay(50)

		expect(results).toHaveLength(1)
		expect(results[0]!.items).toHaveLength(2) // weather + tfl, no music
		expect(results[0]!.items.map((i) => i.type).sort()).toEqual(["tfl-alert", "weather"])
	})

	test("music change triggers feed with music-dependent source", async () => {
		controller = new FeedController<AppFeedItem>({ debounceMs: 10 })
			.addDataSource(createWeatherSource())
			.addDataSource(createTflSource())
			.addDataSource(createMusicContextSource())

		locationProvider = createLocationProvider()
		bridge = new ContextBridge(controller).addProvider(locationProvider)

		// Set initial location
		locationProvider.simulateUpdate({ lat: 51.5074, lng: -0.1278, accuracy: 10 })
		await delay(50)

		const results: Array<{ items: AppFeedItem[] }> = []
		controller.subscribe((result) => {
			results.push({ items: [...result.items] })
		})

		// Push music change directly to controller
		controller.pushContextUpdate({
			[CurrentTrackKey]: {
				trackId: "track-456",
				title: "Bohemian Rhapsody",
				artist: "Queen",
				startedAt: new Date(),
			},
		})
		await delay(50)

		expect(results).toHaveLength(1)
		expect(results[0]!.items).toHaveLength(3) // weather + tfl + music
		expect(results[0]!.items.map((i) => i.type).sort()).toEqual([
			"music-context",
			"tfl-alert",
			"weather",
		])

		const musicItem = results[0]!.items.find((i) => i.type === "music-context") as MusicContextItem
		expect(musicItem.data.suggestion).toContain("Queen")
	})

	test("manual refresh gathers from all providers and reconciles", async () => {
		controller = new FeedController<AppFeedItem>({ debounceMs: 10 })
			.addDataSource(createWeatherSource())
			.addDataSource(createTflSource())

		locationProvider = createLocationProvider()
		// Set location without triggering update
		locationProvider.simulateUpdate({ lat: 40.7128, lng: -74.006, accuracy: 5 })

		// Clear the callback so simulateUpdate doesn't trigger reconcile
		const originalOnUpdate = locationProvider.onUpdate
		locationProvider.onUpdate = (cb) => {
			return originalOnUpdate(cb)
		}

		bridge = new ContextBridge(controller).addProvider(locationProvider)

		const results: Array<{ items: AppFeedItem[] }> = []
		controller.subscribe((result) => {
			results.push({ items: [...result.items] })
		})

		// Manual refresh should gather current location and reconcile
		await bridge.refresh()
		await delay(50)

		expect(results).toHaveLength(1)
		expect(results[0]!.items).toHaveLength(2)

		const ctx = controller.getContext()
		expect(contextValue(ctx, LocationKey)).toEqual({ lat: 40.7128, lng: -74.006, accuracy: 5 })
	})

	test("context accumulates across multiple updates", async () => {
		controller = new FeedController<AppFeedItem>({ debounceMs: 10 })
			.addDataSource(createWeatherSource())
			.addDataSource(createMusicContextSource())

		locationProvider = createLocationProvider()
		bridge = new ContextBridge(controller).addProvider(locationProvider)

		// Location update
		locationProvider.simulateUpdate({ lat: 51.5074, lng: -0.1278, accuracy: 10 })
		await delay(50)

		// Music update
		controller.pushContextUpdate({
			[CurrentTrackKey]: {
				trackId: "track-789",
				title: "Stairway to Heaven",
				artist: "Led Zeppelin",
				startedAt: new Date(),
			},
		})
		await delay(50)

		const ctx = controller.getContext()
		expect(contextValue(ctx, LocationKey)).toEqual({ lat: 51.5074, lng: -0.1278, accuracy: 10 })
		expect(contextValue(ctx, CurrentTrackKey)?.artist).toBe("Led Zeppelin")
	})

	test("items are sorted by priority descending", async () => {
		controller = new FeedController<AppFeedItem>({ debounceMs: 10 })
			.addDataSource(createWeatherSource()) // priority 0.5
			.addDataSource(createTflSource()) // priority 0.8
			.addDataSource(createMusicContextSource()) // priority 0.3

		locationProvider = createLocationProvider()
		bridge = new ContextBridge(controller).addProvider(locationProvider)

		locationProvider.simulateUpdate({ lat: 51.5074, lng: -0.1278, accuracy: 10 })

		controller.pushContextUpdate({
			[CurrentTrackKey]: {
				trackId: "track-1",
				title: "Test",
				artist: "Test",
				startedAt: new Date(),
			},
		})
		await delay(50)

		const result = await controller.reconcile()

		expect(result.items[0]!.type).toBe("tfl-alert") // 0.8
		expect(result.items[1]!.type).toBe("weather") // 0.5
		expect(result.items[2]!.type).toBe("music-context") // 0.3
	})

	test("cleanup stops providers and pending reconciles", async () => {
		let queryCount = 0
		const trackingSource: DataSource<WeatherItem> = {
			type: "weather",
			async query(context) {
				queryCount++
				const location = contextValue(context, LocationKey)
				if (!location) return []
				return [
					{
						id: "weather-1",
						type: "weather",
						priority: 0.5,
						timestamp: context.time,
						data: { temp: 20, condition: "sunny" },
					},
				]
			},
		}

		const ctrl = new FeedController<WeatherItem>({ debounceMs: 100 }).addDataSource(trackingSource)
		locationProvider = createLocationProvider()
		const br = new ContextBridge(ctrl).addProvider(locationProvider)

		ctrl.subscribe(() => {})

		// Trigger update but stop before debounce flushes
		locationProvider.simulateUpdate({ lat: 51.5, lng: -0.1, accuracy: 10 })

		br.stop()
		ctrl.stop()

		await delay(150)

		expect(queryCount).toBe(0)
	})
})
