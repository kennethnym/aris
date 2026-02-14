import type { Context, FeedSource } from "@aris/core"

import { contextKey, type ContextKey } from "@aris/core"

/**
 * Geographic coordinates with accuracy and timestamp.
 */
export interface Location {
	lat: number
	lng: number
	/** Accuracy in meters */
	accuracy: number
	timestamp: Date
}

export interface LocationSourceOptions {
	/** Number of locations to retain in history. Defaults to 1. */
	historySize?: number
}

export const LocationKey: ContextKey<Location> = contextKey("location")

/**
 * A FeedSource that provides location context.
 *
 * This source accepts external location pushes and does not query location itself.
 * Use `pushLocation` to update the location from an external provider (e.g., GPS, network).
 *
 * Does not produce feed items - always returns empty array from `fetchItems`.
 */
export class LocationSource implements FeedSource {
	readonly id = "location"

	private readonly historySize: number
	private locations: Location[] = []
	private listeners = new Set<(update: Partial<Context>) => void>()

	constructor(options: LocationSourceOptions = {}) {
		this.historySize = options.historySize ?? 1
	}

	/**
	 * Push a new location update. Notifies all context listeners.
	 */
	pushLocation(location: Location): void {
		this.locations.push(location)
		if (this.locations.length > this.historySize) {
			this.locations.shift()
		}
		this.listeners.forEach((listener) => {
			listener({ [LocationKey]: location })
		})
	}

	/**
	 * Most recent location, or null if none pushed.
	 */
	get lastLocation(): Location | null {
		return this.locations[this.locations.length - 1] ?? null
	}

	/**
	 * Location history, oldest first. Length limited by `historySize`.
	 */
	get locationHistory(): readonly Location[] {
		return this.locations
	}

	onContextUpdate(callback: (update: Partial<Context>) => void): () => void {
		this.listeners.add(callback)
		return () => {
			this.listeners.delete(callback)
		}
	}

	async fetchContext(): Promise<Partial<Context> | null> {
		if (this.lastLocation) {
			return { [LocationKey]: this.lastLocation }
		}
		return null
	}

	async fetchItems(): Promise<[]> {
		return []
	}
}
