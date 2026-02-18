import { FeedEngine, type FeedSource } from "@aris/core"

export class UserSession {
	readonly engine: FeedEngine
	private sources = new Map<string, FeedSource>()

	constructor(sources: FeedSource[]) {
		this.engine = new FeedEngine()
		for (const source of sources) {
			this.sources.set(source.id, source)
			this.engine.register(source)
		}
		this.engine.start()
	}

	getSource<T extends FeedSource>(sourceId: string): T | undefined {
		return this.sources.get(sourceId) as T | undefined
	}

	destroy(): void {
		this.engine.stop()
		this.sources.clear()
	}
}
