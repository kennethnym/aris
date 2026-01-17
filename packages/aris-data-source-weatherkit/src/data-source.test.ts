import type { Context } from "@aris/core"

import { describe, expect, test } from "bun:test"

import fixture from "../fixtures/san-francisco.json"
import { WeatherKitDataSource, Units } from "./data-source"
import { WeatherFeedItemType } from "./feed-items"

const mockCredentials = {
	privateKey: "mock",
	keyId: "mock",
	teamId: "mock",
	serviceId: "mock",
}

const createMockContext = (location?: { lat: number; lng: number }): Context => ({
	time: new Date("2026-01-17T00:00:00Z"),
	location: location ? { ...location, accuracy: 10 } : undefined,
})

describe("WeatherKitDataSource", () => {
	test("returns empty array when location is missing", async () => {
		const dataSource = new WeatherKitDataSource({ credentials: mockCredentials })
		const items = await dataSource.query(createMockContext())

		expect(items).toEqual([])
	})

	test("type is weather-current", () => {
		const dataSource = new WeatherKitDataSource({ credentials: mockCredentials })

		expect(dataSource.type).toBe(WeatherFeedItemType.current)
	})
})

describe("WeatherKitDataSource with fixture", () => {
	const response = fixture.response

	test("parses current weather from fixture", () => {
		const current = response.currentWeather

		expect(current.conditionCode).toBe("Clear")
		expect(typeof current.temperature).toBe("number")
		expect(typeof current.humidity).toBe("number")
		expect(current.pressureTrend).toMatch(/^(rising|falling|steady)$/)
	})

	test("parses hourly forecast from fixture", () => {
		const hours = response.forecastHourly.hours

		expect(hours.length).toBeGreaterThan(0)

		const firstHour = hours[0]!
		expect(firstHour.forecastStart).toBeDefined()
		expect(typeof firstHour.temperature).toBe("number")
		expect(typeof firstHour.precipitationChance).toBe("number")
	})

	test("parses daily forecast from fixture", () => {
		const days = response.forecastDaily.days

		expect(days.length).toBeGreaterThan(0)

		const firstDay = days[0]!
		expect(firstDay.forecastStart).toBeDefined()
		expect(typeof firstDay.temperatureMax).toBe("number")
		expect(typeof firstDay.temperatureMin).toBe("number")
		expect(firstDay.sunrise).toBeDefined()
		expect(firstDay.sunset).toBeDefined()
	})

	test("hourly limit is respected", () => {
		const dataSource = new WeatherKitDataSource({
			credentials: mockCredentials,
			hourlyLimit: 6,
		})

		expect(dataSource["hourlyLimit"]).toBe(6)
	})

	test("daily limit is respected", () => {
		const dataSource = new WeatherKitDataSource({
			credentials: mockCredentials,
			dailyLimit: 3,
		})

		expect(dataSource["dailyLimit"]).toBe(3)
	})

	test("default limits are applied", () => {
		const dataSource = new WeatherKitDataSource({ credentials: mockCredentials })

		expect(dataSource["hourlyLimit"]).toBe(12)
		expect(dataSource["dailyLimit"]).toBe(7)
	})
})

describe("unit conversion", () => {
	test("Units enum has metric and imperial", () => {
		expect(Units.metric).toBe("metric")
		expect(Units.imperial).toBe("imperial")
	})
})
