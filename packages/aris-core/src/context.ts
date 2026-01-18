/**
 * Branded type for type-safe context keys.
 *
 * Each package defines its own keys with associated value types:
 * ```ts
 * const LocationKey: ContextKey<Location> = contextKey("location")
 * ```
 */
export type ContextKey<T> = string & { __contextValue?: T }

/**
 * Creates a typed context key.
 *
 * @example
 * ```ts
 * interface Location { lat: number; lng: number; accuracy: number }
 * const LocationKey: ContextKey<Location> = contextKey("location")
 * ```
 */
export function contextKey<T>(key: string): ContextKey<T> {
	return key as ContextKey<T>
}

/**
 * Type-safe accessor for context values.
 *
 * @example
 * ```ts
 * const location = contextValue(context, LocationKey)
 * if (location) {
 *   console.log(location.lat, location.lng)
 * }
 * ```
 */
export function contextValue<T>(context: Context, key: ContextKey<T>): T | undefined {
	return context[key] as T | undefined
}

/**
 * Arbitrary key-value bag representing the current state.
 * Always includes `time`. Other keys are added by context providers.
 */
export interface Context {
	time: Date
	[key: string]: unknown
}
