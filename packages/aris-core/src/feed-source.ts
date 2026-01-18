import type { Context } from "./context"
import type { FeedItem } from "./feed"

/**
 * Unified interface for sources that provide context and/or feed items.
 *
 * Sources form a dependency graph - a source declares which other sources
 * it depends on, and the graph ensures dependencies are resolved before
 * dependents run.
 *
 * A source may:
 * - Provide context for other sources (implement fetchContext/onContextUpdate)
 * - Produce feed items (implement fetchItems/onItemsUpdate)
 * - Both
 *
 * @example
 * ```ts
 * // Location source - provides context only
 * const locationSource: FeedSource = {
 *   id: "location",
 *   fetchContext: async () => {
 *     const pos = await getCurrentPosition()
 *     return { location: { lat: pos.coords.latitude, lng: pos.coords.longitude } }
 *   },
 * }
 *
 * // Weather source - depends on location, provides both context and items
 * const weatherSource: FeedSource<WeatherFeedItem> = {
 *   id: "weather",
 *   dependencies: ["location"],
 *   fetchContext: async (ctx) => {
 *     const weather = await fetchWeather(ctx.location)
 *     return { weather }
 *   },
 *   fetchItems: async (ctx) => {
 *     return createWeatherFeedItems(ctx.weather)
 *   },
 * }
 * ```
 */
export interface FeedSource<TItem extends FeedItem = FeedItem> {
	/** Unique identifier for this source */
	readonly id: string

	/** IDs of sources this source depends on */
	readonly dependencies?: readonly string[]

	/**
	 * Subscribe to reactive context updates.
	 * Called when the source can push context changes proactively.
	 * Returns cleanup function.
	 */
	onContextUpdate?(
		callback: (update: Partial<Context>) => void,
		getContext: () => Context,
	): () => void

	/**
	 * Fetch context on-demand.
	 * Called during manual refresh or initial load.
	 */
	fetchContext?(context: Context): Promise<Partial<Context>>

	/**
	 * Subscribe to reactive feed item updates.
	 * Called when the source can push item changes proactively.
	 * Returns cleanup function.
	 */
	onItemsUpdate?(callback: (items: TItem[]) => void, getContext: () => Context): () => void

	/**
	 * Fetch feed items on-demand.
	 * Called during manual refresh or when dependencies update.
	 */
	fetchItems?(context: Context): Promise<TItem[]>
}
