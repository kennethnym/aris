import { TflSource, type ITflApi, type TflLineId } from "@aris/source-tfl"

import type { FeedSourceProvider } from "../feed/service.ts"

import { UserNotFoundError } from "../lib/error.ts"

/**
 * Manages per-user TflSource instances with individual line configuration.
 */
export class TflService implements FeedSourceProvider {
	private sources = new Map<string, TflSource>()

	constructor(private readonly api: ITflApi) {}

	feedSourceForUser(userId: string): TflSource {
		let source = this.sources.get(userId)
		if (!source) {
			source = new TflSource({ client: this.api })
			this.sources.set(userId, source)
		}
		return source
	}

	/**
	 * Update monitored lines for a user. Mutates the existing TflSource
	 * so that references held by FeedEngine remain valid.
	 * @throws {UserNotFoundError} If no source exists for the user
	 */
	updateLinesOfInterest(userId: string, lines: TflLineId[]): void {
		const source = this.sources.get(userId)
		if (!source) {
			throw new UserNotFoundError(userId)
		}
		source.setLinesOfInterest(lines)
	}

	removeUser(userId: string): void {
		this.sources.delete(userId)
	}
}
