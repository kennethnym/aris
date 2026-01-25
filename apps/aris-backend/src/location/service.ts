import { LocationSource, type Location } from "@aris/source-location"

import { UserNotFoundError } from "../lib/error.ts"

/**
 * Manages LocationSource instances per user.
 */
export class LocationService {
	private sources = new Map<string, LocationSource>()

	/**
	 * Get or create a LocationSource for a user.
	 * @param userId - The user's unique identifier
	 * @returns The user's LocationSource instance
	 */
	feedSourceForUser(userId: string): LocationSource {
		let source = this.sources.get(userId)
		if (!source) {
			source = new LocationSource()
			this.sources.set(userId, source)
		}
		return source
	}

	/**
	 * Update location for a user.
	 * @param userId - The user's unique identifier
	 * @param location - The new location data
	 * @throws {UserNotFoundError} If no source exists for the user
	 */
	updateUserLocation(userId: string, location: Location): void {
		const source = this.sources.get(userId)
		if (!source) {
			throw new UserNotFoundError(userId)
		}
		source.pushLocation(location)
	}

	/**
	 * Get last known location for a user.
	 * @param userId - The user's unique identifier
	 * @returns The last location, or null if none exists
	 */
	lastUserLocation(userId: string): Location | null {
		return this.sources.get(userId)?.lastLocation ?? null
	}

	/**
	 * Remove a user's LocationSource.
	 * @param userId - The user's unique identifier
	 */
	removeUser(userId: string): void {
		this.sources.delete(userId)
	}
}
