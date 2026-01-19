import type { FeedItem } from "@aris/core"

import type { Certainty, ConditionCode, PrecipitationType, Severity, Urgency } from "./weatherkit"

export const WeatherFeedItemType = {
	current: "weather-current",
	hourly: "weather-hourly",
	daily: "weather-daily",
	alert: "weather-alert",
} as const

export type WeatherFeedItemType = (typeof WeatherFeedItemType)[keyof typeof WeatherFeedItemType]

export type CurrentWeatherData = {
	conditionCode: ConditionCode
	daylight: boolean
	humidity: number
	precipitationIntensity: number
	pressure: number
	pressureTrend: "rising" | "falling" | "steady"
	temperature: number
	temperatureApparent: number
	uvIndex: number
	visibility: number
	windDirection: number
	windGust: number
	windSpeed: number
}

export interface CurrentWeatherFeedItem extends FeedItem<
	typeof WeatherFeedItemType.current,
	CurrentWeatherData
> {}

export type HourlyWeatherData = {
	forecastTime: Date
	conditionCode: ConditionCode
	daylight: boolean
	humidity: number
	precipitationAmount: number
	precipitationChance: number
	precipitationType: PrecipitationType
	temperature: number
	temperatureApparent: number
	uvIndex: number
	windDirection: number
	windGust: number
	windSpeed: number
}

export interface HourlyWeatherFeedItem extends FeedItem<
	typeof WeatherFeedItemType.hourly,
	HourlyWeatherData
> {}

export type DailyWeatherData = {
	forecastDate: Date
	conditionCode: ConditionCode
	maxUvIndex: number
	precipitationAmount: number
	precipitationChance: number
	precipitationType: PrecipitationType
	snowfallAmount: number
	sunrise: Date
	sunset: Date
	temperatureMax: number
	temperatureMin: number
}

export interface DailyWeatherFeedItem extends FeedItem<
	typeof WeatherFeedItemType.daily,
	DailyWeatherData
> {}

export type WeatherAlertData = {
	alertId: string
	areaName: string
	certainty: Certainty
	description: string
	detailsUrl: string
	effectiveTime: Date
	expireTime: Date
	severity: Severity
	source: string
	urgency: Urgency
}

export interface WeatherAlertFeedItem extends FeedItem<
	typeof WeatherFeedItemType.alert,
	WeatherAlertData
> {}

export type WeatherFeedItem =
	| CurrentWeatherFeedItem
	| HourlyWeatherFeedItem
	| DailyWeatherFeedItem
	| WeatherAlertFeedItem
