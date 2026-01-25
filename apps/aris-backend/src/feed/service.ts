import { FeedEngine, type FeedResult, type FeedSource, type FeedSubscriber } from "@aris/core"

/**
 * Provides a FeedSource instance for a user.
 */
export interface FeedSourceProvider {
	feedSourceForUser(userId: string): FeedSource
}

/**
 * Manages FeedEngine instances per user.
 *
 * Receives FeedSource instances from injected providers and wires them
 * into per-user engines. Engines are auto-started on creation.
 */
export class FeedEngineService {
	private engines = new Map<string, FeedEngine>()

	constructor(private readonly providers: FeedSourceProvider[]) {}

	/**
	 * Get or create a FeedEngine for a user.
	 * Automatically registers sources and starts the engine.
	 */
	engineForUser(userId: string): FeedEngine {
		let engine = this.engines.get(userId)
		if (!engine) {
			engine = this.createEngine(userId)
			this.engines.set(userId, engine)
		}
		return engine
	}

	/**
	 * Refresh a user's feed.
	 */
	async refresh(userId: string): Promise<FeedResult> {
		const engine = this.engineForUser(userId)
		return engine.refresh()
	}

	/**
	 * Subscribe to feed updates for a user.
	 * Returns unsubscribe function.
	 */
	subscribe(userId: string, callback: FeedSubscriber): () => void {
		const engine = this.engineForUser(userId)
		return engine.subscribe(callback)
	}

	/**
	 * Remove a user's FeedEngine.
	 * Stops the engine and cleans up resources.
	 */
	removeUser(userId: string): void {
		const engine = this.engines.get(userId)
		if (engine) {
			engine.stop()
			this.engines.delete(userId)
		}
	}

	private createEngine(userId: string): FeedEngine {
		const engine = new FeedEngine()

		for (const provider of this.providers) {
			const source = provider.feedSourceForUser(userId)
			engine.register(source)
		}

		engine.start()

		return engine
	}
}
