/**
 * A single item in the feed.
 *
 * @example
 * ```ts
 * type WeatherItem = FeedItem<"weather", { temp: number; condition: string }>
 *
 * const item: WeatherItem = {
 *   id: "weather-123",
 *   type: "weather",
 *   priority: 0.5,
 *   timestamp: new Date(),
 *   data: { temp: 18, condition: "cloudy" },
 * }
 * ```
 */
export interface FeedItem<
	TType extends string = string,
	TData extends Record<string, unknown> = Record<string, unknown>,
> {
	/** Unique identifier */
	id: string
	/** Item type, matches the data source type */
	type: TType
	/** Sort priority (higher = more important, shown first) */
	priority: number
	/** When this item was generated */
	timestamp: Date
	/** Type-specific payload */
	data: TData
}
