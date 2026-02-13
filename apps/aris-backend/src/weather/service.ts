import { WeatherSource, type WeatherSourceOptions } from "@aris/source-weatherkit"

import type { FeedSourceProvider } from "../feed/service.ts"

/**
 * Options forwarded to every per-user WeatherSource.
 * Must include either `credentials` or `client` (same requirement as WeatherSourceOptions).
 */
export type WeatherServiceOptions = WeatherSourceOptions

/**
 * Manages WeatherSource instances per user.
 */
export class WeatherService implements FeedSourceProvider {
	private sources = new Map<string, WeatherSource>()
	private readonly options: WeatherServiceOptions

	constructor(options: WeatherServiceOptions) {
		this.options = options
	}

	/**
	 * Get or create a WeatherSource for a user.
	 */
	feedSourceForUser(userId: string): WeatherSource {
		let source = this.sources.get(userId)
		if (!source) {
			source = new WeatherSource(this.options)
			this.sources.set(userId, source)
		}
		return source
	}

	/**
	 * Remove a user's WeatherSource.
	 */
	removeUser(userId: string): void {
		this.sources.delete(userId)
	}
}
