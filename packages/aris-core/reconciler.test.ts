import { describe, expect, test } from "bun:test"

import type { Context } from "./context"
import type { DataSource } from "./data-source"
import type { FeedItem } from "./feed"

import { Reconciler } from "./reconciler"

type WeatherData = { temp: number }
type WeatherItem = FeedItem<"weather", WeatherData>

type CalendarData = { title: string }
type CalendarItem = FeedItem<"calendar", CalendarData>

const createMockContext = (): Context => ({
	time: new Date("2026-01-15T12:00:00Z"),
})

const createWeatherSource = (items: WeatherItem[], delay = 0): DataSource<WeatherItem> => ({
	type: "weather",
	async query() {
		if (delay > 0) {
			await new Promise((resolve) => setTimeout(resolve, delay))
		}
		return items
	},
})

const createCalendarSource = (items: CalendarItem[]): DataSource<CalendarItem> => ({
	type: "calendar",
	async query() {
		return items
	},
})

const createFailingSource = (type: string, error: Error): DataSource<FeedItem> => ({
	type,
	async query() {
		throw error
	},
})

describe("Reconciler", () => {
	test("returns empty result when no sources registered", async () => {
		const reconciler = new Reconciler()
		const result = await reconciler.reconcile(createMockContext())

		expect(result.items).toEqual([])
		expect(result.errors).toEqual([])
	})

	test("collects items from single source", async () => {
		const items: WeatherItem[] = [
			{
				id: "weather-1",
				type: "weather",
				priority: 0.5,
				timestamp: new Date(),
				data: { temp: 20 },
			},
		]

		const reconciler = new Reconciler().register(createWeatherSource(items))
		const result = await reconciler.reconcile(createMockContext())

		expect(result.items).toEqual(items)
		expect(result.errors).toEqual([])
	})

	test("collects items from multiple sources", async () => {
		const weatherItems: WeatherItem[] = [
			{
				id: "weather-1",
				type: "weather",
				priority: 0.5,
				timestamp: new Date(),
				data: { temp: 20 },
			},
		]

		const calendarItems: CalendarItem[] = [
			{
				id: "calendar-1",
				type: "calendar",
				priority: 0.8,
				timestamp: new Date(),
				data: { title: "Meeting" },
			},
		]

		const reconciler = new Reconciler()
			.register(createWeatherSource(weatherItems))
			.register(createCalendarSource(calendarItems))

		const result = await reconciler.reconcile(createMockContext())

		expect(result.items).toHaveLength(2)
		expect(result.errors).toEqual([])
	})

	test("sorts items by priority descending", async () => {
		const weatherItems: WeatherItem[] = [
			{
				id: "weather-1",
				type: "weather",
				priority: 0.2,
				timestamp: new Date(),
				data: { temp: 20 },
			},
		]

		const calendarItems: CalendarItem[] = [
			{
				id: "calendar-1",
				type: "calendar",
				priority: 0.9,
				timestamp: new Date(),
				data: { title: "Meeting" },
			},
		]

		const reconciler = new Reconciler()
			.register(createWeatherSource(weatherItems))
			.register(createCalendarSource(calendarItems))

		const result = await reconciler.reconcile(createMockContext())

		expect(result.items[0]?.id).toBe("calendar-1")
		expect(result.items[1]?.id).toBe("weather-1")
	})

	test("captures errors from failing sources", async () => {
		const error = new Error("Source failed")

		const reconciler = new Reconciler().register(createFailingSource("failing", error))

		const result = await reconciler.reconcile(createMockContext())

		expect(result.items).toEqual([])
		expect(result.errors).toHaveLength(1)
		expect(result.errors[0]?.sourceType).toBe("failing")
		expect(result.errors[0]?.error.message).toBe("Source failed")
	})

	test("returns partial results when some sources fail", async () => {
		const items: WeatherItem[] = [
			{
				id: "weather-1",
				type: "weather",
				priority: 0.5,
				timestamp: new Date(),
				data: { temp: 20 },
			},
		]

		const reconciler = new Reconciler()
			.register(createWeatherSource(items))
			.register(createFailingSource("failing", new Error("Failed")))

		const result = await reconciler.reconcile(createMockContext())

		expect(result.items).toHaveLength(1)
		expect(result.errors).toHaveLength(1)
	})

	test("times out slow sources", async () => {
		const items: WeatherItem[] = [
			{
				id: "weather-1",
				type: "weather",
				priority: 0.5,
				timestamp: new Date(),
				data: { temp: 20 },
			},
		]

		const reconciler = new Reconciler({ timeout: 50 }).register(createWeatherSource(items, 100))

		const result = await reconciler.reconcile(createMockContext())

		expect(result.items).toEqual([])
		expect(result.errors).toHaveLength(1)
		expect(result.errors[0]?.sourceType).toBe("weather")
		expect(result.errors[0]?.error.message).toContain("timed out")
	})

	test("unregister removes source", async () => {
		const items: WeatherItem[] = [
			{
				id: "weather-1",
				type: "weather",
				priority: 0.5,
				timestamp: new Date(),
				data: { temp: 20 },
			},
		]

		const reconciler = new Reconciler().register(createWeatherSource(items)).unregister("weather")

		const result = await reconciler.reconcile(createMockContext())
		expect(result.items).toEqual([])
	})

	test("infers discriminated union type from chained registers", async () => {
		const weatherItems: WeatherItem[] = [
			{
				id: "weather-1",
				type: "weather",
				priority: 0.5,
				timestamp: new Date(),
				data: { temp: 20 },
			},
		]

		const calendarItems: CalendarItem[] = [
			{
				id: "calendar-1",
				type: "calendar",
				priority: 0.8,
				timestamp: new Date(),
				data: { title: "Meeting" },
			},
		]

		const reconciler = new Reconciler()
			.register(createWeatherSource(weatherItems))
			.register(createCalendarSource(calendarItems))

		const { items } = await reconciler.reconcile(createMockContext())

		// Type narrowing should work
		for (const item of items) {
			if (item.type === "weather") {
				expect(typeof item.data.temp).toBe("number")
			} else if (item.type === "calendar") {
				expect(typeof item.data.title).toBe("string")
			}
		}
	})
})
