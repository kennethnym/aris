import type { Context, FeedSource } from "@aris/core"

import { LocationKey, type Location } from "./location"

export interface LocationSourceOptions {
	/** Enable high accuracy mode (uses more battery) */
	enableHighAccuracy?: boolean
	/** Maximum age of cached position in milliseconds */
	maximumAge?: number
	/** Timeout for position requests in milliseconds */
	timeout?: number
}

export interface GeolocationProvider {
	getCurrentPosition(
		success: (position: GeolocationPosition) => void,
		error: (error: GeolocationPositionError) => void,
		options?: PositionOptions,
	): void
	watchPosition(
		success: (position: GeolocationPosition) => void,
		error: (error: GeolocationPositionError) => void,
		options?: PositionOptions,
	): number
	clearWatch(watchId: number): void
}

const DEFAULT_OPTIONS: LocationSourceOptions = {
	enableHighAccuracy: false,
	maximumAge: 60000,
	timeout: 10000,
}

function toLocation(position: GeolocationPosition): Location {
	return {
		lat: position.coords.latitude,
		lng: position.coords.longitude,
		accuracy: position.coords.accuracy,
	}
}

export function createLocationSource(
	geolocation: GeolocationProvider,
	options: LocationSourceOptions = {},
): FeedSource {
	const opts = { ...DEFAULT_OPTIONS, ...options }
	const positionOptions: PositionOptions = {
		enableHighAccuracy: opts.enableHighAccuracy,
		maximumAge: opts.maximumAge,
		timeout: opts.timeout,
	}

	return {
		id: "location",

		onContextUpdate(callback: (update: Partial<Context>) => void): () => void {
			const watchId = geolocation.watchPosition(
				(position) => {
					callback({ [LocationKey]: toLocation(position) })
				},
				() => {
					// Errors are silently ignored in reactive mode
					// fetchContext will surface errors on manual refresh
				},
				positionOptions,
			)

			return () => {
				geolocation.clearWatch(watchId)
			}
		},

		async fetchContext(): Promise<Partial<Context>> {
			return new Promise((resolve, reject) => {
				geolocation.getCurrentPosition(
					(position) => {
						resolve({ [LocationKey]: toLocation(position) })
					},
					(error) => {
						reject(new Error(`Geolocation error: ${error.message}`))
					},
					positionOptions,
				)
			})
		},
	}
}
