import { describe, expect, test } from "bun:test"

import type { ActionDefinition, Context, ContextKey, FeedItem, FeedSource } from "./index"

import { FeedEngine } from "./feed-engine"
import { UnknownActionError, contextKey, contextValue } from "./index"

// No-op action methods for test sources
const noActions = {
	async listActions(): Promise<Record<string, ActionDefinition>> {
		return {}
	},
	async executeAction(actionId: string): Promise<void> {
		throw new UnknownActionError(actionId)
	},
}

// =============================================================================
// CONTEXT KEYS
// =============================================================================

interface Location {
	lat: number
	lng: number
}

interface Weather {
	temperature: number
	condition: string
}

const LocationKey: ContextKey<Location> = contextKey("location")
const WeatherKey: ContextKey<Weather> = contextKey("weather")

// =============================================================================
// FEED ITEMS
// =============================================================================

type WeatherFeedItem = FeedItem<"weather", { temperature: number; condition: string }>
type AlertFeedItem = FeedItem<"alert", { message: string }>

// =============================================================================
// TEST HELPERS
// =============================================================================

interface SimulatedLocationSource extends FeedSource {
	simulateUpdate(location: Location): void
}

function createLocationSource(): SimulatedLocationSource {
	let callback: ((update: Partial<Context>) => void) | null = null
	let currentLocation: Location = { lat: 0, lng: 0 }

	return {
		id: "location",
		...noActions,

		onContextUpdate(cb) {
			callback = cb
			return () => {
				callback = null
			}
		},

		async fetchContext() {
			return { [LocationKey]: currentLocation }
		},

		simulateUpdate(location: Location) {
			currentLocation = location
			callback?.({ [LocationKey]: location })
		},
	}
}

function createWeatherSource(
	fetchWeather: (location: Location) => Promise<Weather> = async () => ({
		temperature: 20,
		condition: "sunny",
	}),
): FeedSource<WeatherFeedItem> {
	return {
		id: "weather",
		dependencies: ["location"],
		...noActions,

		async fetchContext(context) {
			const location = contextValue(context, LocationKey)
			if (!location) return null

			const weather = await fetchWeather(location)
			return { [WeatherKey]: weather }
		},

		async fetchItems(context) {
			const weather = contextValue(context, WeatherKey)
			if (!weather) return []

			return [
				{
					id: `weather-${Date.now()}`,
					type: "weather",
					priority: 0.5,
					timestamp: new Date(),
					data: {
						temperature: weather.temperature,
						condition: weather.condition,
					},
				},
			]
		},
	}
}

function createAlertSource(): FeedSource<AlertFeedItem> {
	return {
		id: "alert",
		dependencies: ["weather"],
		...noActions,

		async fetchContext() {
			return null
		},

		async fetchItems(context) {
			const weather = contextValue(context, WeatherKey)
			if (!weather) return []

			if (weather.condition === "storm") {
				return [
					{
						id: "alert-storm",
						type: "alert",
						priority: 1.0,
						timestamp: new Date(),
						data: { message: "Storm warning!" },
					},
				]
			}

			return []
		},
	}
}

// =============================================================================
// TESTS
// =============================================================================

describe("FeedEngine", () => {
	describe("registration", () => {
		test("registers sources", () => {
			const engine = new FeedEngine()
			const location = createLocationSource()

			engine.register(location)

			// Can refresh without error
			expect(engine.refresh()).resolves.toBeDefined()
		})

		test("unregisters sources", async () => {
			const engine = new FeedEngine()
			const location = createLocationSource()

			engine.register(location)
			engine.unregister("location")

			const result = await engine.refresh()
			expect(result.items).toHaveLength(0)
		})

		test("allows chained registration", () => {
			const engine = new FeedEngine()
				.register(createLocationSource())
				.register(createWeatherSource())
				.register(createAlertSource())

			expect(engine.refresh()).resolves.toBeDefined()
		})
	})

	describe("graph validation", () => {
		test("throws on missing dependency", async () => {
			const engine = new FeedEngine()
			const orphan: FeedSource = {
				id: "orphan",
				dependencies: ["nonexistent"],
				...noActions,
				async fetchContext() {
					return null
				},
			}

			engine.register(orphan)

			await expect(engine.refresh()).rejects.toThrow(
				'Source "orphan" depends on "nonexistent" which is not registered',
			)
		})

		test("throws on circular dependency", async () => {
			const engine = new FeedEngine()
			const a: FeedSource = {
				id: "a",
				dependencies: ["b"],
				...noActions,
				async fetchContext() {
					return null
				},
			}
			const b: FeedSource = {
				id: "b",
				dependencies: ["a"],
				...noActions,
				async fetchContext() {
					return null
				},
			}

			engine.register(a).register(b)

			await expect(engine.refresh()).rejects.toThrow("Circular dependency detected: a → b → a")
		})

		test("throws on longer cycles", async () => {
			const engine = new FeedEngine()
			const a: FeedSource = {
				id: "a",
				dependencies: ["c"],
				...noActions,
				async fetchContext() {
					return null
				},
			}
			const b: FeedSource = {
				id: "b",
				dependencies: ["a"],
				...noActions,
				async fetchContext() {
					return null
				},
			}
			const c: FeedSource = {
				id: "c",
				dependencies: ["b"],
				...noActions,
				async fetchContext() {
					return null
				},
			}

			engine.register(a).register(b).register(c)

			await expect(engine.refresh()).rejects.toThrow("Circular dependency detected")
		})
	})

	describe("refresh", () => {
		test("runs fetchContext in dependency order", async () => {
			const order: string[] = []

			const location: FeedSource = {
				id: "location",
				...noActions,
				async fetchContext() {
					order.push("location")
					return { [LocationKey]: { lat: 51.5, lng: -0.1 } }
				},
			}

			const weather: FeedSource = {
				id: "weather",
				dependencies: ["location"],
				...noActions,
				async fetchContext(ctx) {
					order.push("weather")
					const loc = contextValue(ctx, LocationKey)
					expect(loc).toBeDefined()
					return { [WeatherKey]: { temperature: 20, condition: "sunny" } }
				},
			}

			const engine = new FeedEngine().register(weather).register(location)

			await engine.refresh()

			expect(order).toEqual(["location", "weather"])
		})

		test("accumulates context across sources", async () => {
			const location = createLocationSource()
			location.simulateUpdate({ lat: 51.5, lng: -0.1 })

			const weather = createWeatherSource()

			const engine = new FeedEngine().register(location).register(weather)

			const { context } = await engine.refresh()

			expect(contextValue(context, LocationKey)).toEqual({
				lat: 51.5,
				lng: -0.1,
			})
			expect(contextValue(context, WeatherKey)).toEqual({
				temperature: 20,
				condition: "sunny",
			})
		})

		test("collects items from all sources", async () => {
			const location = createLocationSource()
			location.simulateUpdate({ lat: 51.5, lng: -0.1 })

			const weather = createWeatherSource()

			const engine = new FeedEngine().register(location).register(weather)

			const { items } = await engine.refresh()

			expect(items).toHaveLength(1)
			expect(items[0]!.type).toBe("weather")
		})

		test("sorts items by priority descending", async () => {
			const location = createLocationSource()
			location.simulateUpdate({ lat: 51.5, lng: -0.1 })

			const weather = createWeatherSource(async () => ({
				temperature: 15,
				condition: "storm",
			}))

			const alert = createAlertSource()

			const engine = new FeedEngine().register(location).register(weather).register(alert)

			const { items } = await engine.refresh()

			expect(items).toHaveLength(2)
			expect(items[0]!.type).toBe("alert") // priority 1.0
			expect(items[1]!.type).toBe("weather") // priority 0.5
		})

		test("handles missing upstream context gracefully", async () => {
			const location: FeedSource = {
				id: "location",
				...noActions,
				async fetchContext() {
					return null // No location available
				},
			}

			const weather = createWeatherSource()

			const engine = new FeedEngine().register(location).register(weather)

			const { context, items } = await engine.refresh()

			expect(contextValue(context, WeatherKey)).toBeUndefined()
			expect(items).toHaveLength(0)
		})

		test("captures errors from fetchContext", async () => {
			const failing: FeedSource = {
				id: "failing",
				...noActions,
				async fetchContext() {
					throw new Error("Context fetch failed")
				},
			}

			const engine = new FeedEngine().register(failing)

			const { errors } = await engine.refresh()

			expect(errors).toHaveLength(1)
			expect(errors[0]!.sourceId).toBe("failing")
			expect(errors[0]!.error.message).toBe("Context fetch failed")
		})

		test("captures errors from fetchItems", async () => {
			const failing: FeedSource = {
				id: "failing",
				...noActions,
				async fetchContext() {
					return null
				},
				async fetchItems() {
					throw new Error("Items fetch failed")
				},
			}

			const engine = new FeedEngine().register(failing)

			const { errors } = await engine.refresh()

			expect(errors).toHaveLength(1)
			expect(errors[0]!.sourceId).toBe("failing")
			expect(errors[0]!.error.message).toBe("Items fetch failed")
		})

		test("continues after source error", async () => {
			const failing: FeedSource = {
				id: "failing",
				...noActions,
				async fetchContext() {
					throw new Error("Failed")
				},
			}

			const working: FeedSource = {
				id: "working",
				...noActions,
				async fetchContext() {
					return null
				},
				async fetchItems() {
					return [
						{
							id: "item-1",
							type: "test",
							priority: 0.5,
							timestamp: new Date(),
							data: {},
						},
					]
				},
			}

			const engine = new FeedEngine().register(failing).register(working)

			const { items, errors } = await engine.refresh()

			expect(errors).toHaveLength(1)
			expect(items).toHaveLength(1)
		})
	})

	describe("currentContext", () => {
		test("returns initial context before refresh", () => {
			const engine = new FeedEngine()

			const context = engine.currentContext()

			expect(context.time).toBeInstanceOf(Date)
		})

		test("returns accumulated context after refresh", async () => {
			const location = createLocationSource()
			location.simulateUpdate({ lat: 51.5, lng: -0.1 })

			const engine = new FeedEngine().register(location)

			await engine.refresh()

			const context = engine.currentContext()
			expect(contextValue(context, LocationKey)).toEqual({
				lat: 51.5,
				lng: -0.1,
			})
		})
	})

	describe("subscribe", () => {
		test("returns unsubscribe function", () => {
			const engine = new FeedEngine()
			let callCount = 0

			const unsubscribe = engine.subscribe(() => {
				callCount++
			})

			unsubscribe()

			// Subscriber should not be called after unsubscribe
			expect(callCount).toBe(0)
		})
	})

	describe("reactive updates", () => {
		test("start subscribes to onContextUpdate", async () => {
			const location = createLocationSource()
			const weather = createWeatherSource()

			const engine = new FeedEngine().register(location).register(weather)

			const results: Array<{ items: FeedItem[] }> = []
			engine.subscribe((result) => {
				results.push({ items: result.items })
			})

			engine.start()

			// Simulate location update
			location.simulateUpdate({ lat: 51.5, lng: -0.1 })

			// Wait for async refresh
			await new Promise((resolve) => setTimeout(resolve, 50))

			expect(results.length).toBeGreaterThan(0)
			expect(results[0]!.items[0]!.type).toBe("weather")
		})

		test("stop unsubscribes from all sources", async () => {
			const location = createLocationSource()

			const engine = new FeedEngine().register(location)

			let callCount = 0
			engine.subscribe(() => {
				callCount++
			})

			engine.start()
			engine.stop()

			// Simulate update after stop
			location.simulateUpdate({ lat: 1, lng: 1 })

			await new Promise((resolve) => setTimeout(resolve, 50))

			expect(callCount).toBe(0)
		})

		test("start is idempotent", () => {
			const location = createLocationSource()
			const engine = new FeedEngine().register(location)

			// Should not throw or double-subscribe
			engine.start()
			engine.start()
			engine.stop()
		})
	})

	describe("executeAction", () => {
		test("routes action to correct source", async () => {
			let receivedAction = ""
			let receivedParams: unknown = {}

			const source: FeedSource = {
				id: "test-source",
				async listActions() {
					return {
						"do-thing": { id: "do-thing" },
					}
				},
				async executeAction(actionId, params) {
					receivedAction = actionId
					receivedParams = params
				},
				async fetchContext() {
					return null
				},
			}

			const engine = new FeedEngine().register(source)
			await engine.executeAction("test-source", "do-thing", { key: "value" })

			expect(receivedAction).toBe("do-thing")
			expect(receivedParams).toEqual({ key: "value" })
		})

		test("throws for unknown source", async () => {
			const engine = new FeedEngine()

			await expect(engine.executeAction("nonexistent", "action", {})).rejects.toThrow(
				"Source not found: nonexistent",
			)
		})

		test("throws for unknown action on source", async () => {
			const source: FeedSource = {
				id: "test-source",
				...noActions,
				async fetchContext() {
					return null
				},
			}

			const engine = new FeedEngine().register(source)

			await expect(engine.executeAction("test-source", "nonexistent", {})).rejects.toThrow(
				'Action "nonexistent" not found on source "test-source"',
			)
		})
	})

	describe("listActions", () => {
		test("returns actions for a specific source", async () => {
			const source: FeedSource = {
				id: "test-source",
				async listActions() {
					return {
						"action-1": { id: "action-1" },
						"action-2": { id: "action-2" },
					}
				},
				async executeAction() {},
				async fetchContext() {
					return null
				},
			}

			const engine = new FeedEngine().register(source)
			const actions = await engine.listActions("test-source")

			expect(Object.keys(actions)).toEqual(["action-1", "action-2"])
		})

		test("throws for unknown source", async () => {
			const engine = new FeedEngine()

			await expect(engine.listActions("nonexistent")).rejects.toThrow(
				"Source not found: nonexistent",
			)
		})

		test("throws on mismatched action ID", async () => {
			const source: FeedSource = {
				id: "bad-source",
				async listActions() {
					return {
						"correct-key": { id: "wrong-id" },
					}
				},
				async executeAction() {},
				async fetchContext() {
					return null
				},
			}

			const engine = new FeedEngine().register(source)

			await expect(engine.listActions("bad-source")).rejects.toThrow(
				'Action ID mismatch on source "bad-source"',
			)
		})
	})
})
