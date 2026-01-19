export { WeatherKey, type Weather } from "./weather-context"
export {
	WeatherSource,
	Units,
	type Units as UnitsType,
	type WeatherSourceOptions,
} from "./weather-source"

export {
	WeatherFeedItemType,
	type WeatherFeedItemType as WeatherFeedItemTypeType,
	type WeatherFeedItem,
	type CurrentWeatherFeedItem,
	type CurrentWeatherData,
	type HourlyWeatherFeedItem,
	type HourlyWeatherData,
	type DailyWeatherFeedItem,
	type DailyWeatherData,
	type WeatherAlertFeedItem,
	type WeatherAlertData,
} from "./feed-items"

export {
	ConditionCode,
	Severity,
	Urgency,
	Certainty,
	PrecipitationType,
	DefaultWeatherKitClient,
	type ConditionCode as ConditionCodeType,
	type Severity as SeverityType,
	type Urgency as UrgencyType,
	type Certainty as CertaintyType,
	type PrecipitationType as PrecipitationTypeType,
	type WeatherKitClient,
	type WeatherKitCredentials,
	type WeatherKitQueryOptions,
	type WeatherKitResponse,
} from "./weatherkit"
